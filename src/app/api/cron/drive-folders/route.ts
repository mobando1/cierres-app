/**
 * GET /api/cron/drive-folders — Crea carpetas de mañana en Drive
 * Corre diario a las 23:50 COL (4:50 UTC) via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDateFolders } from '@/lib/drive/client';
import { createAdminClient } from '@/lib/supabase/server';
import { CONFIG } from '@/lib/config';
import { nowTimestamp } from '@/lib/parser/dates';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Calcular fecha de mañana (timezone Colombia)
  const now = new Date();
  const colombiaOffset = -5 * 60; // UTC-5
  const colombiaTime = new Date(now.getTime() + (colombiaOffset + now.getTimezoneOffset()) * 60000);
  colombiaTime.setDate(colombiaTime.getDate() + 1);
  const manana = colombiaTime.toISOString().split('T')[0];

  const results: string[] = [];
  const supabase = createAdminClient();

  for (const punto of CONFIG.PUNTOS) {
    try {
      const folderId = await createDateFolders(punto, manana);
      if (folderId) {
        // Registrar en drive_index
        await supabase.from('drive_index').upsert({
          punto,
          fecha: manana,
          folder_id: folderId,
          folder_url: `https://drive.google.com/drive/folders/${folderId}`,
        }, {
          onConflict: 'punto,fecha',
        });

        results.push(`${punto}: OK`);
      } else {
        results.push(`${punto}: Error`);
      }
    } catch (e) {
      results.push(`${punto}: Error - ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    message: 'Carpetas Drive creadas',
    fecha: manana,
    results,
    timestamp: nowTimestamp(),
  });
}
