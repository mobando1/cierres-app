/**
 * GET /api/alertas — Listar alertas pendientes
 * PATCH /api/alertas — Marcar alerta como revisada/resuelta
 *
 * Reemplaza web_getAlertasPendientes() de 12_WebApp.gs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') || 'PENDIENTE';
  const limit = parseInt(searchParams.get('limit') || '50');

  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from('alertas')
    .select('*', { count: 'exact' })
    .eq('estado', estado)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, estado } = body;

  if (!id || !estado) {
    return NextResponse.json({ error: 'id y estado requeridos' }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('alertas')
    .update({ estado })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
