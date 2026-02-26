/**
 * GET /api/cron/ia-queue — Procesa cierres con estado IA_PENDIENTE
 * Corre cada 1 min via Vercel Cron.
 * Procesa UN cierre por ejecución (presupuesto completo de tiempo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { analyzeCierre } from '@/lib/ia/analyzer';
import { nowTimestamp } from '@/lib/parser/dates';

export const maxDuration = 300; // 5 min (Vercel Pro)

export async function GET(request: NextRequest) {
  // Validar cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Buscar primer cierre pendiente de IA
  const { data: pendiente, error } = await supabase
    .from('cierres')
    .select('*')
    .eq('estado_auditoria_ia', 'IA_PENDIENTE')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !pendiente) {
    return NextResponse.json({ message: 'No hay cierres pendientes de IA' });
  }

  try {
    const driveRootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
    const result = await analyzeCierre(pendiente, driveRootFolderId);

    // Guardar resultado
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
      .eq('id', pendiente.id);

    // Actualizar alerta si existe
    await supabase
      .from('alertas')
      .update({
        explicacion_ia: result.explicacion,
        mensaje_listo: result.mensaje,
      })
      .eq('cierre_id', pendiente.id);

    // Limpiar cache de extracción
    await supabase
      .from('ia_extraction_cache')
      .delete()
      .eq('cierre_id', pendiente.id);

    return NextResponse.json({
      message: 'Análisis IA completado',
      cierre: `${pendiente.punto} ${pendiente.fecha}`,
      veredicto: result.resultado,
    });
  } catch (e) {
    console.error('Error en cron IA:', e);

    // Marcar como error
    await supabase
      .from('cierres')
      .update({
        estado_auditoria_ia: 'IA_ERROR',
        resultado_auditoria_ia: `Error: ${(e as Error).message}`,
        fecha_revision: nowTimestamp(),
      })
      .eq('id', pendiente.id);

    return NextResponse.json(
      { error: 'Error en análisis IA', details: (e as Error).message },
      { status: 500 },
    );
  }
}
