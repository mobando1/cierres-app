/**
 * Email notifications — Portado de 09_IAAnalyzer.gs enviarNotificacionAlerta_()
 * Usa Resend en vez de GmailApp.
 */

import { Resend } from 'resend';
import { formatMoney } from '../parser/money';
import type { Cierre, ParsedIAResponse } from '../types';

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (resendClient) return resendClient;
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendAlertEmail(
  punto: string,
  fecha: string,
  cierre: Cierre,
  mensajeIA: string,
  parsed: ParsedIAResponse,
  evidencia: Record<string, { cantidad: number; archivos: string[] }>,
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('ADMIN_EMAIL no configurado — no se envía email');
    return;
  }

  const nivel = cierre.nivel_riesgo || 'N/A';
  const emoji = nivel === 'ALTO' ? '🔴' : '🟡';
  const color = nivel === 'ALTO' ? '#FF4444' : '#FFB300';
  const subject = `${emoji} ALERTA ${nivel} - ${punto} - ${fecha}`;
  const fmt = (n: number) => formatMoney(n);

  const accion = parsed.accion || cierre.accion_recomendada || 'Revisar soportes en Drive.';

  let totalArchivos = 0;
  for (const info of Object.values(evidencia)) totalArchivos += info.cantidad;

  let html = '<div style="font-family: Arial, sans-serif; max-width: 600px;">';

  // Banner
  html += `<div style="background: ${color}; color: white; padding: 12px 16px; border-radius: 8px 8px 0 0; font-size: 18px; font-weight: bold;">`;
  html += `${emoji} ${nivel} — ${punto} | ${fecha}</div>`;

  // Acción
  html += '<div style="background: #FFF3CD; padding: 12px 16px; border: 1px solid #FFE69C;">';
  html += `<strong>QUÉ HACER:</strong><br>${accion}</div>`;

  // Veredicto
  if (parsed.resumen) {
    html += '<div style="background: #E3F2FD; padding: 12px 16px; border: 1px solid #90CAF9;">';
    html += `<strong>VEREDICTO:</strong> ${parsed.resumen}</div>`;
  }

  // Números
  html += '<div style="background: #F8F9FA; padding: 12px 16px; border: 1px solid #DEE2E6;">';
  html += '<strong>Números:</strong><br>';
  html += `• <strong>Diferencia: ${cierre.sobrante_faltante_tipo} $${fmt(Math.abs(cierre.sobrante_faltante_monto))}</strong><br>`;
  html += `• Efectivo: $${fmt(cierre.efectivo_sistema)} (sistema) vs $${fmt(cierre.efectivo_declarado)} (declarado)<br>`;
  html += `• Responsable: ${cierre.responsable || 'N/A'}</div>`;

  // Gastos verificados
  if (parsed.json?.gastos?.length) {
    const gastos = parsed.json.gastos;
    const verificados = gastos.filter(g => g.verificado).length;
    html += '<div style="padding: 12px 16px; border: 1px solid #DEE2E6; background: #F1F8E9;">';
    html += `<strong>Gastos (${verificados}/${gastos.length} verificados):</strong><br>`;
    for (const g of gastos) {
      html += `${g.verificado ? '✅' : '❌'} ${g.concepto} — $${fmt(g.monto)}`;
      if (!g.verificado) html += ' <span style="color:#D32F2F;">(SIN SOPORTE)</span>';
      html += '<br>';
    }
    html += '</div>';
  }

  // Anomalías
  if (parsed.json?.anomalias?.length) {
    html += '<div style="padding: 12px 16px; border: 1px solid #FFB74D; background: #FFF3E0;">';
    html += '<strong>Anomalías:</strong><br>';
    for (const a of parsed.json.anomalias) html += `• ${a}<br>`;
    html += '</div>';
  }

  if (totalArchivos === 0) {
    html += '<div style="background: #FFF3E0; padding: 10px 16px; border: 1px solid #FFB74D;">';
    html += 'Sin evidencia en Drive. Sube fotos para análisis.</div>';
  }

  html += '</div>';

  try {
    const resend = getResend();
    await resend.emails.send({
      from: 'Cierres de Caja <noreply@' + (process.env.RESEND_DOMAIN || 'resend.dev') + '>',
      to: adminEmail,
      subject,
      text: mensajeIA,
      html,
    });
  } catch (e) {
    console.error('Error enviando email:', e);
  }
}
