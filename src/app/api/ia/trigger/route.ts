/**
 * POST /api/ia/trigger — Disparar análisis IA manual para un cierre
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { analyzeCierre } from '@/lib/ia/analyzer';
import { nowTimestamp } from '@/lib/parser/dates';

export const maxDuration = 300; // 300s (Vercel Pro)

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { cierre_id } = body;

  if (!cierre_id) {
    return NextResponse.json({ error: 'cierre_id requerido' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: cierre, error } = await supabase
    .from('cierres')
    .select('*')
    .eq('id', cierre_id)
    .single();

  if (error || !cierre) {
    return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
  }

  // Permitir re-análisis desde varios estados
  const estadosPermitidos = ['IA_PENDIENTE', 'ESPERANDO_SOBRE', 'IA_ERROR', 'IA_COMPLETADO'];
  if (!estadosPermitidos.includes(cierre.estado_auditoria_ia)) {
    return NextResponse.json(
      { error: `Estado ${cierre.estado_auditoria_ia} no permite análisis IA` },
      { status: 400 },
    );
  }

  // Marcar como en proceso
  await supabase
    .from('cierres')
    .update({ estado_auditoria_ia: 'IA_EN_PROCESO' })
    .eq('id', cierre_id);

  try {
    const result = await analyzeCierre(cierre, process.env.DRIVE_ROOT_FOLDER_ID);

    await supabase
      .from('cierres')
      .update({
        estado_auditoria_ia: result.estado,
        resultado_auditoria_ia: result.resultado,
        explicacion_auditoria_ia: result.explicacion,
        accion_recomendada: result.accion,
        mensaje_listo: result.mensaje,
        fecha_revision: nowTimestamp(),
      })
      .eq('id', cierre_id);

    // Actualizar alerta si existe
    await supabase
      .from('alertas')
      .update({
        explicacion_ia: result.explicacion,
        mensaje_listo: result.mensaje,
      })
      .eq('cierre_id', cierre_id);

    // Limpiar cache
    await supabase
      .from('ia_extraction_cache')
      .delete()
      .eq('cierre_id', cierre_id);

    return NextResponse.json({
      success: true,
      veredicto: result.resultado,
      estado: result.estado,
    });
  } catch (e) {
    await supabase
      .from('cierres')
      .update({
        estado_auditoria_ia: 'IA_ERROR',
        resultado_auditoria_ia: `Error: ${(e as Error).message}`,
        fecha_revision: nowTimestamp(),
      })
      .eq('id', cierre_id);

    return NextResponse.json(
      { error: 'Error en análisis IA', details: (e as Error).message },
      { status: 500 },
    );
  }
}
