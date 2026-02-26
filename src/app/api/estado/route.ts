/**
 * GET /api/estado — Conteos para dashboard
 * Reemplaza web_getEstadoSistema() de 12_WebApp.gs
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const [pendientesIA, esperandoSobre, alertasActivas] = await Promise.all([
    supabase
      .from('cierres')
      .select('*', { count: 'exact', head: true })
      .eq('estado_auditoria_ia', 'IA_PENDIENTE'),
    supabase
      .from('cierres')
      .select('*', { count: 'exact', head: true })
      .eq('estado_auditoria_ia', 'ESPERANDO_SOBRE'),
    supabase
      .from('alertas')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'PENDIENTE'),
  ]);

  return NextResponse.json({
    pendientesIA: pendientesIA.count || 0,
    esperandoSobre: esperandoSobre.count || 0,
    alertasActivas: alertasActivas.count || 0,
  });
}
