/**
 * GET /api/cron/daily-summary — Resumen diario por email
 * Cron: 10pm Colombia (3 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendDailySummary } from '@/lib/email/alerts';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fecha de hoy (Colombia = UTC-5)
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const hoy = bogota.toISOString().split('T')[0];

  // Obtener cierres del día
  const { data: cierres } = await supabase
    .from('cierres')
    .select('punto, responsable, sobrante_faltante_monto, sobrante_faltante_tipo, nivel_riesgo, estado_auditoria_ia')
    .eq('fecha', hoy);

  // Obtener alertas pendientes
  const { data: alertas } = await supabase
    .from('alertas')
    .select('id')
    .eq('estado', 'PENDIENTE');

  // Obtener sobres pendientes
  const { data: sobres } = await supabase
    .from('cierres')
    .select('id')
    .eq('estado_auditoria_ia', 'ESPERANDO_SOBRE');

  const rows = cierres || [];

  if (rows.length === 0) {
    return NextResponse.json({ message: 'Sin cierres hoy', enviado: false });
  }

  // Construir resumen
  const totalCierres = rows.length;
  let faltanteTotal = 0;
  const descuadres: Array<{ punto: string; responsable: string; monto: number; tipo: string }> = [];

  for (const c of rows) {
    if (c.sobrante_faltante_tipo === 'FALTANTE') {
      faltanteTotal += Math.abs(c.sobrante_faltante_monto);
    }
    if (Math.abs(c.sobrante_faltante_monto) > 5000 && c.sobrante_faltante_tipo !== 'OK') {
      descuadres.push({
        punto: c.punto,
        responsable: c.responsable || 'N/A',
        monto: c.sobrante_faltante_monto,
        tipo: c.sobrante_faltante_tipo,
      });
    }
  }

  await sendDailySummary({
    fecha: hoy,
    totalCierres,
    faltanteTotal,
    descuadres,
    alertasPendientes: alertas?.length || 0,
    sobresPendientes: sobres?.length || 0,
  });

  return NextResponse.json({
    message: 'Resumen enviado',
    enviado: true,
    totalCierres,
    descuadres: descuadres.length,
  });
}
