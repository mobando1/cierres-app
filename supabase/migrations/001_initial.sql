-- =====================================================================
-- Cierres de Caja — Schema inicial
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- Tabla principal: cierres de caja (reemplaza Control_Caja_Diario)
CREATE TABLE cierres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  fecha DATE NOT NULL,
  punto TEXT NOT NULL,
  turno TEXT,
  responsable TEXT,
  id_cierre INTEGER,
  caja TEXT,
  hora_inicio TEXT,
  hora_fin TEXT,
  -- Efectivo
  efectivo_inicial INTEGER DEFAULT 0,
  ventas_efectivo INTEGER DEFAULT 0,
  gastos_efectivo INTEGER DEFAULT 0,
  traslados_caja INTEGER DEFAULT 0,
  abonos_efectivo INTEGER DEFAULT 0,
  efectivo_total INTEGER DEFAULT 0,
  propinas INTEGER DEFAULT 0,
  domicilios INTEGER DEFAULT 0,
  total_efectivo_sistema INTEGER DEFAULT 0,
  -- Ventas
  ingreso_ventas INTEGER DEFAULT 0,
  descuentos INTEGER DEFAULT 0,
  creditos INTEGER DEFAULT 0,
  total_ingresos INTEGER DEFAULT 0,
  total_gastos INTEGER DEFAULT 0,
  -- JSON dinámico
  formas_pago JSONB DEFAULT '{}',
  gastos_detalle JSONB DEFAULT '[]',
  -- Declarado vs sistema
  efectivo_sistema INTEGER DEFAULT 0,
  efectivo_declarado INTEGER DEFAULT 0,
  efectivo_diferencia INTEGER DEFAULT 0,
  tarjetas_otros_sistema INTEGER DEFAULT 0,
  tarjetas_otros_declarado INTEGER DEFAULT 0,
  tarjetas_otros_diferencia INTEGER DEFAULT 0,
  sobrante_faltante_monto INTEGER DEFAULT 0,
  sobrante_faltante_tipo TEXT DEFAULT 'SIN_DECLARADO',
  -- Apertura siguiente
  apertura_usuario TEXT,
  apertura_valor INTEGER DEFAULT 0,
  -- Sobre
  efectivo_contado_sobre INTEGER,
  sobre_diferencia INTEGER,
  sobre_estado TEXT,
  sobre_fecha_conteo TIMESTAMPTZ,
  sobre_notas TEXT,
  -- Admin
  observaciones_admin TEXT,
  -- Dedup
  hash_registro TEXT,
  -- Auditoría IA
  estado_auditoria_ia TEXT DEFAULT 'PENDIENTE',
  resultado_auditoria_ia TEXT,
  explicacion_auditoria_ia TEXT,
  fecha_revision TIMESTAMPTZ,
  nivel_riesgo TEXT,
  accion_recomendada TEXT,
  mensaje_listo TEXT,
  -- Constraint de unicidad
  UNIQUE(fecha, punto, id_cierre)
);

CREATE INDEX idx_cierres_fecha ON cierres(fecha DESC);
CREATE INDEX idx_cierres_punto ON cierres(punto);
CREATE INDEX idx_cierres_estado_ia ON cierres(estado_auditoria_ia);
CREATE INDEX idx_cierres_hash ON cierres(hash_registro);

-- Alertas de auditoría
CREATE TABLE alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  punto TEXT NOT NULL,
  responsable TEXT,
  cierre_id UUID REFERENCES cierres(id) ON DELETE SET NULL,
  diferencia_total INTEGER,
  tipo_alerta TEXT NOT NULL,
  nivel_riesgo TEXT NOT NULL,
  accion_recomendada TEXT,
  mensaje_listo TEXT,
  explicacion_ia TEXT,
  estado TEXT DEFAULT 'PENDIENTE'
);

CREATE INDEX idx_alertas_estado ON alertas(estado);
CREATE INDEX idx_alertas_punto ON alertas(punto);

-- Bandeja de entrada (mensajes sin procesar)
CREATE TABLE inbox_raw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  texto_whatsapp TEXT NOT NULL,
  punto TEXT,
  procesado BOOLEAN DEFAULT false,
  error TEXT,
  resumen TEXT
);

-- Lecciones de IA
CREATE TABLE lecciones_ia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  punto TEXT,
  responsable TEXT,
  cierre_id UUID REFERENCES cierres(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  leccion TEXT NOT NULL,
  alcance TEXT NOT NULL,
  activa BOOLEAN DEFAULT true
);

-- Índice de carpetas Drive
CREATE TABLE drive_index (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  punto TEXT NOT NULL,
  fecha DATE NOT NULL,
  folder_id TEXT NOT NULL,
  folder_url TEXT,
  UNIQUE(punto, fecha)
);

-- Configuración (key-value)
CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cache de extracción IA (progreso entre invocaciones)
CREATE TABLE ia_extraction_cache (
  cierre_id UUID PRIMARY KEY REFERENCES cierres(id) ON DELETE CASCADE,
  processed_files TEXT[] DEFAULT '{}',
  datos_extraidos TEXT[] DEFAULT '{}',
  batches_completed INTEGER DEFAULT 0,
  processed_images INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecciones_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_extraction_cache ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados tienen acceso total
CREATE POLICY "auth_all" ON cierres FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON alertas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON inbox_raw FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON lecciones_ia FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON drive_index FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON config FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON ia_extraction_cache FOR ALL USING (auth.role() = 'authenticated');

-- Política para service role (API routes usan service key, bypass RLS automático)
-- No se necesita política adicional — service role bypasses RLS por defecto

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================

INSERT INTO config (clave, valor, descripcion) VALUES
  ('TOLERANCIA_COP', '500', 'Tolerancia en COP para considerar cierre OK'),
  ('UMBRAL_BAJO', '5000', 'Umbral máximo para riesgo BAJO'),
  ('UMBRAL_MEDIO', '20000', 'Umbral máximo para riesgo MEDIO (mayor = ALTO)');
