/**
 * Interfaces TypeScript para el sistema Cierres de Caja.
 * Mapea 1:1 con las tablas de Supabase.
 */

// =====================================================================
// DATABASE TYPES
// =====================================================================

export interface Cierre {
  id: string;
  created_at: string;
  fecha: string; // YYYY-MM-DD
  punto: string;
  turno: string | null;
  responsable: string | null;
  id_cierre: number | null;
  caja: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  // Efectivo
  efectivo_inicial: number;
  ventas_efectivo: number;
  gastos_efectivo: number;
  traslados_caja: number;
  abonos_efectivo: number;
  efectivo_total: number;
  propinas: number;
  domicilios: number;
  total_efectivo_sistema: number;
  // Ventas
  ingreso_ventas: number;
  descuentos: number;
  creditos: number;
  total_ingresos: number;
  total_gastos: number;
  // JSON dinámico
  formas_pago: Record<string, number>;
  gastos_detalle: GastoDetalle[];
  // Declarado vs sistema
  efectivo_sistema: number;
  efectivo_declarado: number;
  efectivo_diferencia: number;
  tarjetas_otros_sistema: number;
  tarjetas_otros_declarado: number;
  tarjetas_otros_diferencia: number;
  sobrante_faltante_monto: number;
  sobrante_faltante_tipo: 'SOBRANTE' | 'FALTANTE' | 'OK' | 'SIN_DECLARADO' | null;
  // Apertura siguiente
  apertura_usuario: string | null;
  apertura_valor: number;
  // Sobre
  efectivo_contado_sobre: number | null;
  sobre_diferencia: number | null;
  sobre_estado: 'CONFIRMADO' | 'DISCREPANCIA' | null;
  sobre_fecha_conteo: string | null;
  sobre_notas: string | null;
  // Admin
  observaciones_admin: string | null;
  // Dedup
  hash_registro: string | null;
  // Auditoría IA
  estado_auditoria_ia: EstadoAuditoriaIA;
  resultado_auditoria_ia: string | null;
  explicacion_auditoria_ia: string | null;
  fecha_revision: string | null;
  nivel_riesgo: NivelRiesgo | null;
  accion_recomendada: string | null;
  mensaje_listo: string | null;
}

export interface GastoDetalle {
  categoria: string;
  monto: number;
  cantidad: number;
}

export interface Alerta {
  id: string;
  created_at: string;
  punto: string;
  responsable: string | null;
  cierre_id: string | null;
  diferencia_total: number | null;
  tipo_alerta: string;
  nivel_riesgo: NivelRiesgo;
  accion_recomendada: string | null;
  mensaje_listo: string | null;
  explicacion_ia: string | null;
  estado: 'PENDIENTE' | 'REVISADA' | 'RESUELTA';
}

export interface InboxRaw {
  id: string;
  created_at: string;
  texto_whatsapp: string;
  punto: string | null;
  procesado: boolean;
  error: string | null;
  resumen: string | null;
}

export interface LeccionIA {
  id: string;
  created_at: string;
  punto: string | null;
  responsable: string | null;
  cierre_id: string | null;
  tipo: 'CORRECCION' | 'MEJORA' | 'RIESGO' | 'EMPALME' | 'ERROR';
  leccion: string;
  alcance: 'GLOBAL' | 'NEGOCIO' | 'CAJERO';
  activa: boolean;
}

export interface DriveIndex {
  id: string;
  created_at: string;
  punto: string;
  fecha: string;
  folder_id: string;
  folder_url: string | null;
}

export interface IAExtractionCache {
  cierre_id: string;
  processed_files: string[];
  datos_extraidos: string[];
  batches_completed: number;
  processed_images: number;
  updated_at: string;
}

// =====================================================================
// ENUMS
// =====================================================================

export type EstadoAuditoriaIA =
  | 'PENDIENTE'
  | 'ESPERANDO_SOBRE'
  | 'IA_PENDIENTE'
  | 'IA_COMPLETADO'
  | 'IA_ERROR'
  | 'IA_NO_CONFIGURADA';

export type NivelRiesgo = 'OK' | 'BAJO' | 'MEDIO' | 'ALTO';

// =====================================================================
// PARSER TYPES
// =====================================================================

export interface ParseResult {
  success: boolean;
  cierres: ParsedCierre[];
  errors: string[];
  warnings: string[];
}

export interface ParsedCierre {
  punto: string;
  id_cierre: number;
  caja: string | null;
  responsable: string | null;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string | null;
  hora_fin: string | null;
  // Efectivo
  efectivo_inicial: number;
  ventas_efectivo: number;
  gastos_efectivo: number;
  traslados_caja: number;
  abonos_efectivo: number;
  efectivo_total: number;
  propinas: number;
  domicilios: number;
  total_efectivo_sistema: number;
  // Ventas
  ingreso_ventas: number;
  descuentos: number;
  creditos: number;
  total_ingresos: number;
  total_gastos: number;
  // Formas de pago y gastos detalle
  formas_pago: Record<string, number>;
  gastos_detalle: GastoDetalle[];
  // Declarado
  efectivo_sistema: number;
  efectivo_declarado: number;
  efectivo_diferencia: number;
  tarjetas_otros_sistema: number;
  tarjetas_otros_declarado: number;
  tarjetas_otros_diferencia: number;
  sobrante_faltante_monto: number;
  sobrante_faltante_tipo: 'SOBRANTE' | 'FALTANTE' | 'OK' | 'SIN_DECLARADO';
  // Apertura
  apertura_usuario: string | null;
  apertura_valor: number;
  // Hash
  hash_registro: string;
}

// =====================================================================
// IA TYPES
// =====================================================================

export interface IAAnalysisJSON {
  veredicto: 'CUADRA' | 'DESCUADRE_MENOR' | 'DESCUADRE_MAYOR';
  resumen: string;
  efectivo: {
    sistema: number;
    declarado: number;
    sobre: number | null;
    diferencia: number;
    explicacion: string;
  };
  gastos: Array<{
    concepto: string;
    monto: number;
    soporte: string;
    verificado: boolean;
  }>;
  transferencias: Array<{
    tipo: string;
    monto: number;
    screenshot: string;
    verificado: boolean;
  }>;
  verificacion_matematica?: {
    formula_efectivo: string;
    formula_declarado: string;
    cadena_turnos: string;
  };
  documentos_no_legibles: string[];
  anomalias: string[];
  accion: string;
}

export interface ParsedIAResponse {
  resumen: string;
  accion: string;
  completo: string;
  json: IAAnalysisJSON | null;
}

// =====================================================================
// API TYPES
// =====================================================================

export interface EstadoSistema {
  pendientesIA: number;
  esperandoSobre: number;
  alertasActivas: number;
}

export interface IngestResult {
  success: boolean;
  resumen?: string;
  error?: string;
  cierres_procesados?: number;
}
