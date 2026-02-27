/**
 * GET /api/sobres?pendientes — Cierres pendientes de conteo de sobre
 * POST /api/sobres — Registrar conteo de sobre
 *
 * Reemplaza web_registrarSobre() y web_getCierresPendientesSobre() de 12_WebApp.gs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/lib/config';
import { nowTimestamp } from '@/lib/parser/dates';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('cierres')
    .select('id, fecha, punto, responsable, id_cierre, efectivo_declarado, sobrante_faltante_monto, sobrante_faltante_tipo, nivel_riesgo')
    .eq('estado_auditoria_ia', 'ESPERANDO_SOBRE')
    .order('fecha', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cierre_id, efectivo_contado, notas } = body;

  if (!cierre_id || efectivo_contado === undefined) {
    return NextResponse.json(
      { error: 'cierre_id y efectivo_contado requeridos' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Leer cierre actual
  const { data: cierre, error: readError } = await supabase
    .from('cierres')
    .select('efectivo_declarado, estado_auditoria_ia')
    .eq('id', cierre_id)
    .single();

  if (readError || !cierre) {
    return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
  }

  const contado = Number(efectivo_contado);
  const declarado = cierre.efectivo_declarado || 0;
  const diferencia = contado - declarado;
  const absDif = Math.abs(diferencia);
  const sobreEstado = absDif <= CONFIG.TOLERANCIA_COP ? 'CONFIRMADO' : 'DISCREPANCIA';

  // Determinar nuevo estado de auditoría IA
  const nuevoEstado = 'IA_PENDIENTE';

  const { error: updateError } = await supabase
    .from('cierres')
    .update({
      efectivo_contado_sobre: contado,
      sobre_diferencia: diferencia,
      sobre_estado: sobreEstado,
      sobre_fecha_conteo: nowTimestamp(),
      sobre_notas: notas || null,
      estado_auditoria_ia: nuevoEstado,
    })
    .eq('id', cierre_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Disparar análisis IA en background (fire-and-forget)
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    : 'http://localhost:3000';

  fetch(`${baseUrl}/api/cron/ia-queue`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => {
    // Fire-and-forget: si falla, el cron diario lo recoge
  });

  return NextResponse.json({
    success: true,
    sobre_estado: sobreEstado,
    diferencia,
    nuevo_estado: nuevoEstado,
  });
}
