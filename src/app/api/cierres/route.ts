/**
 * GET /api/cierres — Listar cierres recientes
 * Reemplaza web_getCierresRecientes() de 12_WebApp.gs
 *
 * Query params: ?limit=20&offset=0&punto=La+Glorieta&fecha=2026-02-09
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const punto = searchParams.get('punto');
  const fecha = searchParams.get('fecha');

  const supabase = await createClient();

  let query = supabase
    .from('cierres')
    .select('*', { count: 'exact' })
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (punto) query = query.eq('punto', punto);
  if (fecha) query = query.eq('fecha', fecha);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}
