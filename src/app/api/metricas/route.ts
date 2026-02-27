/**
 * GET /api/metricas?dias=7 — Métricas agregadas para el dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dias = parseInt(searchParams.get('dias') || '7');

  const supabase = await createClient();

  // Fecha desde
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().split('T')[0];

  // Obtener todos los cierres del período
  const { data: cierres, error } = await supabase
    .from('cierres')
    .select('fecha, punto, responsable, sobrante_faltante_monto, sobrante_faltante_tipo, nivel_riesgo, estado_auditoria_ia')
    .gte('fecha', desdeStr)
    .order('fecha', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = cierres || [];

  // Resumen general
  const totalCierres = rows.length;
  const cuadran = rows.filter(c => c.sobrante_faltante_tipo === 'OK' || Math.abs(c.sobrante_faltante_monto) <= 500).length;
  const descuadres = totalCierres - cuadran;
  let faltanteTotal = 0;
  let sobranteTotal = 0;
  for (const c of rows) {
    if (c.sobrante_faltante_tipo === 'FALTANTE') faltanteTotal += Math.abs(c.sobrante_faltante_monto);
    if (c.sobrante_faltante_tipo === 'SOBRANTE') sobranteTotal += c.sobrante_faltante_monto;
  }

  // Por punto
  const puntoMap = new Map<string, { cierres: number; faltante: number; sobrante: number }>();
  for (const c of rows) {
    const entry = puntoMap.get(c.punto) || { cierres: 0, faltante: 0, sobrante: 0 };
    entry.cierres++;
    if (c.sobrante_faltante_tipo === 'FALTANTE') entry.faltante += Math.abs(c.sobrante_faltante_monto);
    if (c.sobrante_faltante_tipo === 'SOBRANTE') entry.sobrante += c.sobrante_faltante_monto;
    puntoMap.set(c.punto, entry);
  }
  const porPunto = Array.from(puntoMap.entries()).map(([punto, data]) => ({ punto, ...data }));

  // Por cajero
  const cajeroMap = new Map<string, { cierres: number; faltante: number; totalDif: number }>();
  for (const c of rows) {
    const nombre = c.responsable || 'N/A';
    const entry = cajeroMap.get(nombre) || { cierres: 0, faltante: 0, totalDif: 0 };
    entry.cierres++;
    if (c.sobrante_faltante_tipo === 'FALTANTE') entry.faltante += Math.abs(c.sobrante_faltante_monto);
    entry.totalDif += c.sobrante_faltante_monto;
    cajeroMap.set(nombre, entry);
  }
  const porCajero = Array.from(cajeroMap.entries()).map(([responsable, data]) => ({
    responsable,
    cierres: data.cierres,
    faltante: data.faltante,
    promedioDif: Math.round(data.totalDif / data.cierres),
  }));

  // Tendencia diaria
  const diaMap = new Map<string, number>();
  for (const c of rows) {
    const prev = diaMap.get(c.fecha) || 0;
    diaMap.set(c.fecha, prev + c.sobrante_faltante_monto);
  }
  const tendencia = Array.from(diaMap.entries()).map(([fecha, diferencia]) => ({ fecha, diferencia }));

  return NextResponse.json({
    resumen: { totalCierres, cuadran, descuadres, faltanteTotal, sobranteTotal },
    porPunto,
    porCajero,
    tendencia,
  });
}
