/**
 * Configuración global del sistema Cierres de Caja.
 * Portado de 00_Config.gs del proyecto Google Apps Script.
 */

export const CONFIG = {
  // Negocios (puntos)
  PUNTOS: [
    'La Glorieta',
    'La Glorieta Express',
    'Salomé Restaurante',
    'Salomé Heladería',
  ] as const,

  // Mapeo: nombre POS (lowercase) → nombre estándar
  PUNTOS_ALIASES: {
    'la glorieta': 'La Glorieta',
    'glorieta': 'La Glorieta',
    'la glorieta express': 'La Glorieta Express',
    'glorieta express': 'La Glorieta Express',
    'la glorieta original': 'La Glorieta Express',
    'salome delicatessen resto': 'Salomé Restaurante',
    'salomé delicatessen resto': 'Salomé Restaurante',
    'salome restaurante': 'Salomé Restaurante',
    'salomé restaurante': 'Salomé Restaurante',
    'salome heladeria': 'Salomé Heladería',
    'salomé heladería': 'Salomé Heladería',
    'salome heladería': 'Salomé Heladería',
    'salomé heladeria': 'Salomé Heladería',
  } as Record<string, string>,

  // Google Drive
  DRIVE: {
    ROOT_FOLDER_NAME: 'CIERRES_AUDITORIA',
    SUBFOLDERS: [
      '01_Gastos',
      '02_Banco',
      '03_Cierres_POS',
      '04_Comprobantes',
      '05_Pagos_Entrantes',
      '06_Pagos_Salientes',
      '07_Otros',
    ],
  },

  // Auditoría
  TOLERANCIA_COP: 500,
  UMBRALES_RIESGO: {
    BAJO: 5000,   // 501 - 5000
    MEDIO: 20000, // 5001 - 20000; >20000 = ALTO
  },

  // Claude API
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929' as const,
  CLAUDE_MAX_TOKENS: 8192,
  CLAUDE_EXTRACT_TOKENS: 4096,
  CLAUDE_BATCH_MAX_BYTES: 20 * 1024 * 1024, // 20MB

  // Timezone
  TIMEZONE: 'America/Bogota',
} as const;

export type Punto = typeof CONFIG.PUNTOS[number];
