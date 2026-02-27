/**
 * PATCH /api/cierres/[id]/observaciones — Guardar observación admin + crear lección IA
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { observaciones, tipo, alcance } = body;

  if (!observaciones || typeof observaciones !== 'string') {
    return NextResponse.json({ error: 'observaciones requeridas' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Leer cierre para obtener punto y responsable
  const { data: cierre, error: readError } = await supabase
    .from('cierres')
    .select('punto, responsable')
    .eq('id', id)
    .single();

  if (readError || !cierre) {
    return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 });
  }

  // Actualizar observaciones_admin
  const { error: updateError } = await supabase
    .from('cierres')
    .update({ observaciones_admin: observaciones })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Crear lección IA
  const { error: leccionError } = await supabase
    .from('lecciones_ia')
    .insert({
      cierre_id: id,
      punto: cierre.punto,
      responsable: cierre.responsable,
      tipo: tipo || 'CORRECCION',
      leccion: observaciones,
      alcance: alcance || 'GLOBAL',
      activa: true,
    });

  if (leccionError) {
    console.error('Error creando lección IA:', leccionError);
    // No fallar la request — la observación ya se guardó
  }

  return NextResponse.json({ success: true });
}
