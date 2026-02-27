import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

/**
 * Verifica que el request viene de un usuario autenticado.
 * Retorna el usuario o un NextResponse 401.
 */
export async function requireAuth(): Promise<
  { user: User; error?: never } | { user?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  return { user };
}
