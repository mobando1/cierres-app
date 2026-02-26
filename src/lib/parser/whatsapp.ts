/**
 * Parser de mensajes WhatsApp del POS.
 * Portado de 04_WhatsAppParser.gs
 *
 * El admin pega 1 o múltiples mensajes (CIERRE DE CAJA, DINERO DECLARADO, APERTURA)
 * de uno o varios negocios. Este parser:
 * 1) Divide el texto en bloques por tipo de mensaje
 * 2) Extrae campos de cada bloque
 * 3) Combina CIERRE + DINERO DECLARADO por ID/Punto
 * 4) Resuelve nombres de negocio via aliases
 */

import { CONFIG } from '../config';
import type { ParseResult, ParsedCierre, GastoDetalle } from '../types';
import { parseMoney, extractMoney } from './money';
import { parseDate, formatDateISO, formatDateDisplay, todayISO, nowColombia, nowTimestamp } from './dates';
import { hashRecord } from './hash';

interface Block {
  type: 'CIERRE' | 'DECLARADO' | 'APERTURA';
  text: string;
}

interface CierreData {
  punto: string | null;
  id_cierre: number | null;
  caja: string;
  responsable: string;
  inicio: string;
  fin: string;
  fecha: string;
  fecha_display: string;
  efectivo_inicial: number;
  ventas_efectivo: number;
  gastos_efectivo: number;
  traslados_caja: number;
  abonos_efectivo: number;
  efectivo_total: number;
  propinas: number;
  domicilios: number;
  total_efectivo_sistema: number;
  ingreso_ventas: number;
  descuentos: number;
  creditos: number;
  total_ingresos: number;
  total_gastos: number;
  formas_pago: Record<string, number>;
  gastos_detalle: GastoDetalle[];
}

interface DeclaradoData {
  punto: string | null;
  id_cierre: number | null;
  efectivo_sistema: number;
  efectivo_declarado: number;
  efectivo_diferencia: number;
  tarjetas_otros_sistema: number;
  tarjetas_otros_declarado: number;
  tarjetas_otros_diferencia: number;
  sobrante_faltante_monto: number;
  sobrante_faltante_tipo: 'SOBRANTE' | 'FALTANTE' | 'OK';
}

interface AperturaData {
  punto: string | null;
  usuario: string;
  valor: number;
}

// =====================================================================
// MAIN ENTRY POINT
// =====================================================================

export function parseWhatsAppText(rawText: string | null | undefined): ParseResult {
  const result: ParseResult = { success: false, cierres: [], errors: [], warnings: [] };

  if (!rawText || !rawText.trim()) {
    result.errors.push('Texto vacío');
    return result;
  }

  // Paso 1: Dividir en bloques
  const blocks = splitIntoBlocks(rawText);

  const cierresMap: Record<string, CierreData> = {};
  const declaradosMap: Record<string, DeclaradoData> = {};
  const aperturasMap: Record<string, AperturaData> = {};

  // Paso 2: Parsear cada bloque según su tipo
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    try {
      if (block.type === 'CIERRE') {
        const cierre = parseCierreBlock(block.text);
        if (cierre) {
          const key = (cierre.punto || 'UNKNOWN') + '|' + (cierre.id_cierre ?? i);
          cierresMap[key] = cierre;
        }
      } else if (block.type === 'DECLARADO') {
        const declarado = parseDeclaradoBlock(block.text);
        if (declarado) {
          const key = (declarado.punto || 'UNKNOWN') + '|' + (declarado.id_cierre ?? i);
          declaradosMap[key] = declarado;
        }
      } else if (block.type === 'APERTURA') {
        const apertura = parseAperturaBlock(block.text);
        if (apertura) {
          aperturasMap[apertura.punto || 'UNKNOWN'] = apertura;
        }
      }
    } catch (e) {
      result.warnings.push(`Error parseando bloque ${i}: ${(e as Error).message}`);
    }
  }

  // Paso 3: Combinar CIERRE + DECLARADO por key
  for (const key of Object.keys(cierresMap)) {
    const cierre = cierresMap[key];
    const declarado = declaradosMap[key] || null;
    const punto = cierre.punto;
    const apertura = punto ? aperturasMap[punto] || null : null;

    const combined = buildCombinedRecord(cierre, declarado, apertura);
    result.cierres.push(combined);
  }

  // Verificar DECLARADOS sin CIERRE correspondiente
  for (const dk of Object.keys(declaradosMap)) {
    if (!cierresMap[dk]) {
      result.warnings.push('DINERO DECLARADO sin CIERRE DE CAJA correspondiente: ' + dk);
    }
  }

  result.success = result.cierres.length > 0;
  if (!result.success && result.errors.length === 0) {
    result.errors.push('No se encontraron cierres válidos en el texto');
  }

  return result;
}

// =====================================================================
// SPLIT EN BLOQUES
// =====================================================================

interface Marker {
  pos: number;
  type: 'CIERRE' | 'DECLARADO' | 'APERTURA';
  matchPos: number;
}

function splitIntoBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  const patterns: Array<{ regex: RegExp; type: Block['type'] }> = [
    { regex: /CIERRE DE CAJA/gi, type: 'CIERRE' },
    { regex: /DINERO DECLARADO/gi, type: 'DECLARADO' },
    { regex: /APERTURA DE CAJA/gi, type: 'APERTURA' },
  ];

  // Encontrar todas las posiciones de inicio
  const markers: Marker[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      const blockStart = findBlockStart(text, match.index);
      markers.push({ pos: blockStart, type: pattern.type, matchPos: match.index });
    }
  }

  // Ordenar por posición
  markers.sort((a, b) => a.pos - b.pos);

  // Extraer texto de cada bloque
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].pos;
    const end = i + 1 < markers.length ? markers[i + 1].pos : text.length;
    blocks.push({
      type: markers[i].type,
      text: text.substring(start, end).trim(),
    });
  }

  return blocks;
}

function findBlockStart(text: string, matchIndex: number): number {
  const searchFrom = Math.max(0, matchIndex - 300);
  const before = text.substring(searchFrom, matchIndex);
  const lines = before.split('\n');

  // Buscar desde el final hacia el inicio — header WhatsApp [DD/MM/YYYY, HH:MM:SS AM]
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (/^\[[\d/,\s:APMapm]+\]/.test(line)) {
      return searchFrom + before.lastIndexOf(lines[i]);
    }
  }

  // Si no encontró header, retornar 2 líneas antes del match
  const twoLinesBefore = text.lastIndexOf('\n', text.lastIndexOf('\n', matchIndex - 1) - 1);
  return Math.max(0, twoLinesBefore + 1);
}

// =====================================================================
// PARSER: CIERRE DE CAJA
// =====================================================================

function parseCierreBlock(text: string): CierreData {
  const punto = detectPunto(text);

  const idMatch = text.match(/ID:\s*(\d+)/i);
  const id_cierre = idMatch ? parseInt(idMatch[1]) : null;

  const cajaMatch = text.match(/CAJA:\s*(.+)/i);
  const caja = cajaMatch ? cajaMatch[1].trim() : '';

  const userMatch = text.match(/Usuario:\s*(.+)/i);
  const responsable = userMatch ? userMatch[1].trim() : '';

  const inicioMatch = text.match(/Inicio:\s*(.+)/i);
  const finMatch = text.match(/Fin:\s*(.+)/i);
  const inicio = inicioMatch ? inicioMatch[1].trim() : '';
  const fin = finMatch ? finMatch[1].trim() : '';

  // Fecha del cierre
  let fecha = '';
  let fecha_display = '';
  const fechaMatch = text.match(/Fecha:\s*\n?\s*(\d{1,2}\s+\w+\s+\d{4}\s*,?\s*[\d:]+\s*(?:am|pm)?)/i);
  if (fechaMatch) {
    const parsedDate = parseDate(fechaMatch[1]);
    fecha = parsedDate ? formatDateISO(parsedDate) : '';
    fecha_display = parsedDate ? formatDateDisplay(parsedDate) : '';
  } else if (fin) {
    const finDate = parseDate(fin);
    fecha = finDate ? formatDateISO(finDate) : todayISO();
    fecha_display = finDate ? formatDateDisplay(finDate) : formatDateDisplay(nowColombia());
  } else {
    fecha = todayISO();
    fecha_display = formatDateDisplay(nowColombia());
  }

  // Cuadre de caja
  const efectivo_inicial = extractMoney(text, /Efectivo Inicial:\s*\$?([\d,.\-]+)/i);
  const ventas_efectivo = extractMoney(text, /Ventas en Efectivo:\s*\$?([\d,.\-]+)/i);
  const gastos_efectivo = extractMoney(text, /Gastos en Efectivo:\s*\$?([\d,.\-]+)/i);
  const traslados_caja = extractMoney(text, /Traslados de caja:\s*\$?([\d,.\-]+)/i);
  const abonos_efectivo = extractMoney(text, /Abonos en Efectivo:\s*\$?([\d,.\-]+)/i);
  const efectivo_total = extractMoney(text, /\(=\)\s*EFECTIVO\s*\$?([\d,.\-]+)/i);
  const propinas = extractMoney(text, /Propinas:\s*\$?([\d,.\-]+)/i);
  const domicilios = extractMoney(text, /Domicilios:\s*\$?([\d,.\-]+)/i);
  const total_efectivo_sistema = extractMoney(text, /TOTAL EFECTIVO\s*\$?([\d,.\-]+)/i);

  // Datos de ventas
  const ingreso_ventas = extractMoney(text, /Ingreso de Ventas:\s*\$?([\d,.\-]+)/i);
  const descuentos = extractMoney(text, /Descuentos:\s*\$?([\d,.\-]+)/i);
  const creditos = extractMoney(text, /Creditos:\s*\$?([\d,.\-]+)/i);
  const total_ingresos = extractMoney(text, /TOTAL INGRESOS\s*\$?([\d,.\-]+)/i);

  // Total gastos (de DATOS DE VENTAS, no del cuadre)
  const gastosSection = text.match(/DATOS DE VENTAS[\s\S]*?\(-\)\s*Gastos:\s*\$?([\d,.\-]+)/i);
  const total_gastos = gastosSection ? parseMoney(gastosSection[1]) : 0;

  // Formas de pago y gastos detalle
  const formas_pago = parseFormasPago(text);
  const gastos_detalle = parseGastosDetalle(text);

  return {
    punto, id_cierre, caja, responsable, inicio, fin,
    fecha, fecha_display,
    efectivo_inicial, ventas_efectivo, gastos_efectivo, traslados_caja,
    abonos_efectivo, efectivo_total, propinas, domicilios, total_efectivo_sistema,
    ingreso_ventas, descuentos, creditos, total_ingresos, total_gastos,
    formas_pago, gastos_detalle,
  };
}

// =====================================================================
// PARSER: DINERO DECLARADO
// =====================================================================

function parseDeclaradoBlock(text: string): DeclaradoData {
  const punto = detectPunto(text);
  const idMatch = text.match(/ID:\s*(\d+)/i);
  const id_cierre = idMatch ? parseInt(idMatch[1]) : null;

  const efectivo_sistema = extractMoney(text, /Efectivo Sistema:\s*\$?([\d,.\-]+)/i);
  const efectivo_declarado = extractMoney(text, /Efectivo Declarado:\s*\$?([\d,.\-]+)/i);
  const efectivo_diferencia = extractMoney(text, /Efectivo Diferencia\s*\$?([\-]?[\d,.\-]+)/i);
  const tarjetas_otros_sistema = extractMoney(text, /Tarjetas y Otros Sistema:\s*\$?([\d,.\-]+)/i);
  const tarjetas_otros_declarado = extractMoney(text, /Tarjetas y Otros Declarado:\s*\$?([\d,.\-]+)/i);
  const tarjetas_otros_diferencia = extractMoney(text, /Tarjetas y Otros Diferencia\s*\$?([\-]?[\d,.\-]+)/i);

  // SOBRANTE o FALTANTE
  const sobranteMatch = text.match(/SOBRANTE\s*\$?([\d,.\-]+)/i);
  const faltanteMatch = text.match(/FALTANTE\s*\$?([\d,.\-]+)/i);

  let sobrante_faltante_monto: number;
  let sobrante_faltante_tipo: 'SOBRANTE' | 'FALTANTE' | 'OK';

  if (sobranteMatch) {
    sobrante_faltante_monto = parseMoney(sobranteMatch[1]);
    sobrante_faltante_tipo = 'SOBRANTE';
  } else if (faltanteMatch) {
    sobrante_faltante_monto = -parseMoney(faltanteMatch[1]);
    sobrante_faltante_tipo = 'FALTANTE';
  } else {
    const totalDiff = (efectivo_diferencia || 0) + (tarjetas_otros_diferencia || 0);
    sobrante_faltante_monto = totalDiff;
    sobrante_faltante_tipo = totalDiff > 0 ? 'SOBRANTE' : totalDiff < 0 ? 'FALTANTE' : 'OK';
  }

  return {
    punto, id_cierre,
    efectivo_sistema, efectivo_declarado, efectivo_diferencia,
    tarjetas_otros_sistema, tarjetas_otros_declarado, tarjetas_otros_diferencia,
    sobrante_faltante_monto, sobrante_faltante_tipo,
  };
}

// =====================================================================
// PARSER: APERTURA DE CAJA
// =====================================================================

function parseAperturaBlock(text: string): AperturaData {
  const punto = detectPunto(text);
  const userMatch = text.match(/Usuario:\s*(.+)/i);
  const usuario = userMatch ? userMatch[1].trim() : '';
  const valorMatch = text.match(/Valor:\s*\$?([\d,.\-]+)/i);
  const valor = valorMatch ? parseMoney(valorMatch[1]) : 0;
  return { punto, usuario, valor };
}

// =====================================================================
// COMBINAR CIERRE + DECLARADO + APERTURA
// =====================================================================

function buildCombinedRecord(
  cierre: CierreData,
  declarado: DeclaradoData | null,
  apertura: AperturaData | null,
): ParsedCierre {
  const record: ParsedCierre = {
    punto: cierre.punto || '',
    id_cierre: cierre.id_cierre || 0,
    caja: cierre.caja || null,
    responsable: cierre.responsable || null,
    fecha: cierre.fecha || todayISO(),
    hora_inicio: cierre.inicio || null,
    hora_fin: cierre.fin || null,
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
    efectivo_sistema: 0,
    efectivo_declarado: 0,
    efectivo_diferencia: 0,
    tarjetas_otros_sistema: 0,
    tarjetas_otros_declarado: 0,
    tarjetas_otros_diferencia: 0,
    sobrante_faltante_monto: 0,
    sobrante_faltante_tipo: 'SIN_DECLARADO',
    // Apertura
    apertura_usuario: null,
    apertura_valor: 0,
    // Hash
    hash_registro: '',
  };

  // Merge DINERO DECLARADO
  if (declarado) {
    record.efectivo_sistema = declarado.efectivo_sistema;
    record.efectivo_declarado = declarado.efectivo_declarado;
    record.efectivo_diferencia = declarado.efectivo_diferencia;
    record.tarjetas_otros_sistema = declarado.tarjetas_otros_sistema;
    record.tarjetas_otros_declarado = declarado.tarjetas_otros_declarado;
    record.tarjetas_otros_diferencia = declarado.tarjetas_otros_diferencia;
    record.sobrante_faltante_monto = declarado.sobrante_faltante_monto;
    record.sobrante_faltante_tipo = declarado.sobrante_faltante_tipo;
  }

  // Merge APERTURA
  if (apertura) {
    record.apertura_usuario = apertura.usuario || null;
    record.apertura_valor = apertura.valor;
  }

  // Generar hash de dedup
  record.hash_registro = hashRecord(record);

  return record;
}

// =====================================================================
// HELPERS
// =====================================================================

function detectPunto(text: string): string | null {
  // Buscar en header WhatsApp: "REPORTES GLORIETA: LA GLORIETA EXPRESS"
  const headerMatch = text.match(/REPORTES\s+\w+:\s*(.+)/i);
  if (headerMatch) {
    const nombre = headerMatch[1].split('\n')[0].trim();
    return resolvePuntoAlias(nombre);
  }

  // Buscar nombre en las primeras 5 líneas
  const lines = text.split('\n').slice(0, 5);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^\[/.test(line) || /CIERRE DE CAJA|DINERO DECLARADO|APERTURA/i.test(line)) continue;
    const resolved = resolvePuntoAlias(line);
    if (resolved) return resolved;
  }

  return null;
}

function resolvePuntoAlias(nombre: string): string | null {
  if (!nombre) return null;
  const key = nombre.toLowerCase().trim();

  // Match exacto
  if (CONFIG.PUNTOS_ALIASES[key]) return CONFIG.PUNTOS_ALIASES[key];

  // Match parcial
  const aliasKeys = Object.keys(CONFIG.PUNTOS_ALIASES);
  for (const ak of aliasKeys) {
    if (key.includes(ak) || ak.includes(key)) {
      return CONFIG.PUNTOS_ALIASES[ak];
    }
  }

  // Nombre estándar directo
  for (const p of CONFIG.PUNTOS) {
    if (key === p.toLowerCase()) return p;
  }

  return nombre;
}

function parseFormasPago(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  const section = text.match(/FORMAS DE PAGO:([\s\S]*?)(?:▪️|$)/i);
  if (!section) return result;

  const lines = section[1].split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(.+?):\s*\$?([\d,.\-]+)/);
    if (match) {
      const forma = match[1].trim();
      const monto = parseMoney(match[2]);
      if (forma && monto !== 0) {
        result[forma] = monto;
      }
    }
  }
  return result;
}

function parseGastosDetalle(text: string): GastoDetalle[] {
  const result: GastoDetalle[] = [];
  const section = text.match(/▪️\s*GASTOS:([\s\S]*?)(?:▪️|Fecha:|$)/i);
  if (!section) return result;

  const content = section[1].trim();
  if (/No disponible/i.test(content)) return result;

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Formato: "General:  $-29,500 (1)"
    const match = line.match(/^(.+?):\s*\$?-?([\d,.\-]+)\s*\((\d+)\)/);
    if (match) {
      result.push({
        categoria: match[1].trim(),
        monto: parseMoney(match[2]),
        cantidad: parseInt(match[3]),
      });
    }
  }
  return result;
}
