/**
 * POST /api/ingest — Recibir texto WhatsApp → parsear → guardar → auditar
 * Reemplaza web_ingestMessage() de 12_WebApp.gs
 *
 * Body: { texto: string }
 * Response: { success, resumen, cierres_procesados, warnings }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { parseWhatsAppText } from '@/lib/parser';
import { classifyCierre } from '@/lib/audit';
import { nowTimestamp } from '@/lib/parser/dates';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const texto = body.texto || body.text || '';

    if (!texto.trim()) {
      return NextResponse.json({ success: false, error: 'Texto vacío' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Guardar raw en inbox
    await supabase.from('inbox_raw').insert({
      texto_whatsapp: texto,
      procesado: false,
    });

    // 2. Parsear
    const parseResult = parseWhatsAppText(texto);

    if (!parseResult.success) {
      // Marcar inbox como error
      await supabase
        .from('inbox_raw')
        .update({ procesado: true, error: parseResult.errors.join('; ') })
        .eq('texto_whatsapp', texto)
        .order('created_at', { ascending: false })
        .limit(1);

      return NextResponse.json({
        success: false,
        error: parseResult.errors.join('; '),
        warnings: parseResult.warnings,
      }, { status: 400 });
    }

    // 3. Upsert cada cierre y auditar
    const resumenParts: string[] = [];

    for (const cierre of parseResult.cierres) {
      // Clasificar riesgo
      const audit = classifyCierre(cierre);

      // Upsert cierre en Supabase
      const { error: upsertError } = await supabase
        .from('cierres')
        .upsert({
          fecha: cierre.fecha,
          punto: cierre.punto,
          id_cierre: cierre.id_cierre,
          caja: cierre.caja,
          responsable: cierre.responsable,
          hora_inicio: cierre.hora_inicio,
          hora_fin: cierre.hora_fin,
          // Efectivo
          efectivo_inicial: cierre.efectivo_inicial,
          ventas_efectivo: cierre.ventas_efectivo,
          gastos_efectivo: cierre.gastos_efectivo,
          traslados_caja: cierre.traslados_caja,
          abonos_efectivo: cierre.abonos_efectivo,
          efectivo_total: cierre.efectivo_total,
          propinas: cierre.propinas,
          domicilios: cierre.domicilios,
          total_efectivo_sistema: cierre.total_efectivo_sistema,
          // Ventas
          ingreso_ventas: cierre.ingreso_ventas,
          descuentos: cierre.descuentos,
          creditos: cierre.creditos,
          total_ingresos: cierre.total_ingresos,
          total_gastos: cierre.total_gastos,
          // JSON
          formas_pago: cierre.formas_pago,
          gastos_detalle: cierre.gastos_detalle,
          // Declarado
          efectivo_sistema: cierre.efectivo_sistema,
          efectivo_declarado: cierre.efectivo_declarado,
          efectivo_diferencia: cierre.efectivo_diferencia,
          tarjetas_otros_sistema: cierre.tarjetas_otros_sistema,
          tarjetas_otros_declarado: cierre.tarjetas_otros_declarado,
          tarjetas_otros_diferencia: cierre.tarjetas_otros_diferencia,
          sobrante_faltante_monto: cierre.sobrante_faltante_monto,
          sobrante_faltante_tipo: cierre.sobrante_faltante_tipo,
          // Apertura
          apertura_usuario: cierre.apertura_usuario,
          apertura_valor: cierre.apertura_valor,
          // Hash
          hash_registro: cierre.hash_registro,
          // Auditoría
          estado_auditoria_ia: audit.estado_auditoria_ia,
          resultado_auditoria_ia: audit.resultado_auditoria_ia,
          nivel_riesgo: audit.nivel_riesgo,
          accion_recomendada: audit.accion_recomendada,
          mensaje_listo: audit.mensaje_listo,
          fecha_revision: nowTimestamp(),
        }, {
          onConflict: 'fecha,punto,id_cierre',
        });

      if (upsertError) {
        resumenParts.push(`Error en ${cierre.punto}: ${upsertError.message}`);
        continue;
      }

      // Insertar alerta si aplica
      if (audit.alerta) {
        // Obtener cierre_id del cierre recién insertado
        const { data: cierreRow } = await supabase
          .from('cierres')
          .select('id')
          .eq('fecha', cierre.fecha)
          .eq('punto', cierre.punto)
          .eq('id_cierre', cierre.id_cierre)
          .single();

        await supabase.from('alertas').insert({
          punto: audit.alerta.punto,
          responsable: audit.alerta.responsable,
          cierre_id: cierreRow?.id || null,
          diferencia_total: audit.alerta.diferencia_total,
          tipo_alerta: audit.alerta.tipo_alerta,
          nivel_riesgo: audit.alerta.nivel_riesgo,
          accion_recomendada: audit.alerta.accion_recomendada,
          mensaje_listo: audit.alerta.mensaje_listo,
        });
      }

      resumenParts.push(`${cierre.punto} (ID ${cierre.id_cierre}): ${audit.nivel_riesgo}`);
    }

    // Marcar inbox como procesado
    await supabase
      .from('inbox_raw')
      .update({
        procesado: true,
        resumen: resumenParts.join(' | '),
        punto: parseResult.cierres[0]?.punto || null,
      })
      .eq('texto_whatsapp', texto)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      cierres_procesados: parseResult.cierres.length,
      resumen: resumenParts.join(' | '),
      warnings: parseResult.warnings,
    });
  } catch (error) {
    console.error('Error in /api/ingest:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
