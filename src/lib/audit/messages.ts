/**
 * Generador de mensajes de alerta formateados.
 * Portado de 07_AuditEngine.gs — buildMensajeListo_()
 */

import { formatMoney } from '../parser/money';

interface SobreData {
  contado: number;
  diferencia: number;
  estado: string;
  notas: string;
}

interface MensajeParams {
  punto: string;
  responsable: string;
  fecha: string;
  efectivo_sistema: number;
  efectivo_declarado: number;
  efectivo_diferencia: number;
  tarjetas_otros_diferencia: number;
  sobrante_faltante_monto: number;
  sobrante_faltante_tipo: string;
  nivel: string;
  accion: string;
  sobre: SobreData | null;
}

export function buildMensajeListo(params: MensajeParams): string {
  const {
    punto, responsable, fecha,
    efectivo_sistema, efectivo_declarado, efectivo_diferencia,
    tarjetas_otros_diferencia, sobrante_faltante_monto, sobrante_faltante_tipo,
    nivel, accion, sobre,
  } = params;

  const emoji = nivel === 'ALTO' ? '🔴'
    : nivel === 'MEDIO' ? '🟡'
    : nivel === 'BAJO' ? '🟠'
    : '🟢';

  let msg = `${emoji} ALERTA CIERRE\n`;
  msg += `📅 Fecha: ${fecha}\n`;
  msg += `📍 Punto: ${punto}\n`;
  msg += `👤 Responsable: ${responsable}\n\n`;
  msg += '📊 RESUMEN:\n';
  msg += `• Efectivo Sistema: $${formatMoney(efectivo_sistema)}\n`;
  msg += `• Efectivo Declarado: $${formatMoney(efectivo_declarado)}\n`;
  msg += `• Diferencia Efectivo: $${formatMoney(efectivo_diferencia)}\n`;

  if (tarjetas_otros_diferencia !== 0) {
    msg += `• Diferencia Tarjetas: $${formatMoney(tarjetas_otros_diferencia)}\n`;
  }

  msg += `• Resultado: ${sobrante_faltante_tipo} $${formatMoney(Math.abs(sobrante_faltante_monto))}\n\n`;

  if (sobre && sobre.contado != null) {
    const sobreEmoji = sobre.estado === 'CONFIRMADO' ? '✅' : '⚠️';
    msg += '💼 CONFIRMACIÓN DE SOBRE:\n';
    msg += `• Efectivo Contado: $${formatMoney(sobre.contado)}\n`;
    msg += `• Diferencia vs Declarado: $${formatMoney(sobre.diferencia)}\n`;
    msg += `• Estado: ${sobreEmoji} ${sobre.estado}\n`;
    if (sobre.notas) {
      msg += `• Notas: ${sobre.notas}\n`;
    }
    msg += '\n';
  } else {
    msg += '💼 Sobre: PENDIENTE_CONTEO\n\n';
  }

  msg += `🚦 Nivel: ${nivel}\n`;
  msg += `⚡ Acción: ${accion}\n`;
  msg += '📌 Estado: PENDIENTE\n';

  return msg;
}
