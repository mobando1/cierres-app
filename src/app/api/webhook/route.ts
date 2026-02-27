/**
 * POST /api/webhook — Endpoint externo (iOS Shortcuts, etc.)
 * Reemplaza doPost() de 12_WebApp.gs
 *
 * Acepta: { texto: string, token: string }
 * El token se valida contra API_TOKEN en env vars.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { parseWhatsAppText } from '@/lib/parser';
import { classifyCierre } from '@/lib/audit';
import { nowTimestamp } from '@/lib/parser/dates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { texto, text, token } = body;
    const rawText = texto || text || '';

    // Validar token (requerido siempre)
    const apiToken = process.env.API_TOKEN;
    if (!apiToken || token !== apiToken) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Texto vacío' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Guardar raw
    await supabase.from('inbox_raw').insert({
      texto_whatsapp: rawText,
      procesado: false,
    });

    // Parsear
    const parseResult = parseWhatsAppText(rawText);

    if (!parseResult.success) {
      await supabase
        .from('inbox_raw')
        .update({ procesado: true, error: parseResult.errors.join('; ') })
        .eq('texto_whatsapp', rawText)
        .order('created_at', { ascending: false })
        .limit(1);

      return NextResponse.json({
        success: false,
        error: parseResult.errors.join('; '),
      }, { status: 400 });
    }

    // Upsert y auditar
    let procesados = 0;
    for (const cierre of parseResult.cierres) {
      const audit = classifyCierre(cierre);

      const { error } = await supabase
        .from('cierres')
        .upsert({
          fecha: cierre.fecha,
          punto: cierre.punto,
          id_cierre: cierre.id_cierre,
          caja: cierre.caja,
          responsable: cierre.responsable,
          hora_inicio: cierre.hora_inicio,
          hora_fin: cierre.hora_fin,
          efectivo_inicial: cierre.efectivo_inicial,
          ventas_efectivo: cierre.ventas_efectivo,
          gastos_efectivo: cierre.gastos_efectivo,
          traslados_caja: cierre.traslados_caja,
          abonos_efectivo: cierre.abonos_efectivo,
          efectivo_total: cierre.efectivo_total,
          propinas: cierre.propinas,
          domicilios: cierre.domicilios,
          total_efectivo_sistema: cierre.total_efectivo_sistema,
          ingreso_ventas: cierre.ingreso_ventas,
          descuentos: cierre.descuentos,
          creditos: cierre.creditos,
          total_ingresos: cierre.total_ingresos,
          total_gastos: cierre.total_gastos,
          formas_pago: cierre.formas_pago,
          gastos_detalle: cierre.gastos_detalle,
          efectivo_sistema: cierre.efectivo_sistema,
          efectivo_declarado: cierre.efectivo_declarado,
          efectivo_diferencia: cierre.efectivo_diferencia,
          tarjetas_otros_sistema: cierre.tarjetas_otros_sistema,
          tarjetas_otros_declarado: cierre.tarjetas_otros_declarado,
          tarjetas_otros_diferencia: cierre.tarjetas_otros_diferencia,
          sobrante_faltante_monto: cierre.sobrante_faltante_monto,
          sobrante_faltante_tipo: cierre.sobrante_faltante_tipo,
          apertura_usuario: cierre.apertura_usuario,
          apertura_valor: cierre.apertura_valor,
          hash_registro: cierre.hash_registro,
          estado_auditoria_ia: audit.estado_auditoria_ia,
          resultado_auditoria_ia: audit.resultado_auditoria_ia,
          nivel_riesgo: audit.nivel_riesgo,
          accion_recomendada: audit.accion_recomendada,
          mensaje_listo: audit.mensaje_listo,
          fecha_revision: nowTimestamp(),
        }, {
          onConflict: 'fecha,punto,id_cierre',
        });

      if (!error) procesados++;
    }

    // Marcar inbox
    await supabase
      .from('inbox_raw')
      .update({ procesado: true, punto: parseResult.cierres[0]?.punto || null })
      .eq('texto_whatsapp', rawText)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      cierres_procesados: procesados,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 },
    );
  }
}
