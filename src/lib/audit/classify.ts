/**
 * Clasificación de riesgo para cierres de caja.
 * Portado de 07_AuditEngine.gs — clasificarYEscribirFila_()
 *
 * En la versión GAS esto escribía directamente a la hoja.
 * Aquí retorna el resultado y la API route lo guarda en Supabase.
 */

import { CONFIG } from '../config';
import type { ParsedCierre, NivelRiesgo, EstadoAuditoriaIA } from '../types';
import { formatMoney } from '../parser/money';
import { buildMensajeListo } from './messages';

export interface ClassifyResult {
  nivel_riesgo: NivelRiesgo | 'NO_AUDITABLE';
  estado_auditoria_ia: EstadoAuditoriaIA;
  resultado_auditoria_ia: string;
  accion_recomendada: string;
  mensaje_listo: string;
  necesita_ia: boolean;
  // Para alerta
  alerta: AlertaData | null;
}

export interface AlertaData {
  punto: string;
  responsable: string | null;
  diferencia_total: number;
  tipo_alerta: string;
  nivel_riesgo: NivelRiesgo;
  accion_recomendada: string;
  mensaje_listo: string;
}

/**
 * Clasifica el nivel de riesgo de un cierre basado en el monto sobrante/faltante.
 */
export function classifyCierre(cierre: ParsedCierre): ClassifyResult {
  const tolerancia = CONFIG.TOLERANCIA_COP;
  const umbralBajo = CONFIG.UMBRALES_RIESGO.BAJO;
  const umbralMedio = CONFIG.UMBRALES_RIESGO.MEDIO;

  const sfMonto = cierre.sobrante_faltante_monto;
  const sfTipo = cierre.sobrante_faltante_tipo;
  const absMontoTotal = Math.abs(sfMonto);
  const punto = cierre.punto;
  const responsable = cierre.responsable || '';

  let nivel: NivelRiesgo | 'NO_AUDITABLE';
  let estado: EstadoAuditoriaIA;
  let accion: string;

  if (sfTipo === 'SIN_DECLARADO') {
    nivel = 'NO_AUDITABLE';
    estado = 'PENDIENTE';
    accion = 'Falta el mensaje de DINERO DECLARADO. Pedir al cajero y pegarlo.';
  } else if (absMontoTotal <= tolerancia) {
    nivel = 'OK';
    estado = 'IA_COMPLETADO';
    accion = `Sin acción requerida. Cierre dentro de tolerancia ($${formatMoney(tolerancia)}).`;
  } else if (absMontoTotal <= umbralBajo) {
    nivel = 'BAJO';
    estado = 'IA_COMPLETADO';
    accion = 'Contar el sobre físico y registrar el conteo.';
  } else if (absMontoTotal <= umbralMedio) {
    nivel = 'MEDIO';
    estado = 'ESPERANDO_SOBRE';
    accion = `Contar sobre físico. Subir fotos de soportes a Drive (carpeta ${punto}/${cierre.fecha}). Esperar análisis IA.`;
  } else {
    nivel = 'ALTO';
    estado = 'ESPERANDO_SOBRE';
    accion = `URGENTE: Contar sobre AHORA. Subir TODOS los soportes a Drive. Llamar al cajero ${responsable} para explicación.`;
  }

  const resultado = `${sfTipo} $${formatMoney(Math.abs(sfMonto))}`;

  const mensaje = buildMensajeListo({
    punto,
    responsable,
    fecha: cierre.fecha,
    efectivo_sistema: cierre.efectivo_sistema,
    efectivo_declarado: cierre.efectivo_declarado,
    efectivo_diferencia: cierre.efectivo_diferencia,
    tarjetas_otros_diferencia: cierre.tarjetas_otros_diferencia,
    sobrante_faltante_monto: sfMonto,
    sobrante_faltante_tipo: sfTipo,
    nivel,
    accion,
    sobre: null,
  });

  // Generar alerta si no es OK
  let alerta: AlertaData | null = null;
  if (nivel !== 'OK') {
    alerta = {
      punto,
      responsable: cierre.responsable,
      diferencia_total: sfMonto,
      tipo_alerta: nivel === 'NO_AUDITABLE' ? 'SIN_DECLARADO' : sfTipo,
      nivel_riesgo: nivel === 'NO_AUDITABLE' ? 'BAJO' : nivel,
      accion_recomendada: accion,
      mensaje_listo: mensaje,
    };
  }

  return {
    nivel_riesgo: nivel === 'NO_AUDITABLE' ? 'BAJO' : nivel,
    estado_auditoria_ia: estado,
    resultado_auditoria_ia: resultado,
    accion_recomendada: accion,
    mensaje_listo: mensaje,
    necesita_ia: nivel === 'MEDIO' || nivel === 'ALTO',
    alerta,
  };
}
