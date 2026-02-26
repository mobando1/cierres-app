/**
 * Orquestador de análisis IA — Portado de 09_IAAnalyzer.gs
 * Pipeline: Drive → extracción lotes → síntesis → guardar en DB → email
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from '../config';
import { SYSTEM_PROMPT_AUDITOR, SYSTEM_PROMPT_EXTRACCION } from './prompts';
import { listFiles, getFileBase64, buildEvidenciaResumen, type DriveFiles } from '../drive/client';
import { sendAlertEmail } from '../email/alerts';
import { formatMoney } from '../parser/money';
import { formatDateDisplay, parseDate, nowColombia, nowTimestamp } from '../parser/dates';
import type { Cierre, IAAnalysisJSON, ParsedIAResponse } from '../types';

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic();
  return anthropicClient;
}

/**
 * Analiza un cierre completo con Claude API + visión.
 * Retorna el resultado para guardar en la DB.
 */
export async function analyzeCierre(
  cierre: Cierre,
  driveRootFolderId?: string,
): Promise<{
  estado: string;
  resultado: string;
  explicacion: string;
  accion: string;
  mensaje: string;
}> {
  const punto = cierre.punto;
  const fecha = cierre.fecha;

  // Paso 1: Recolectar evidencia de Drive
  let archivos: DriveFiles = {};
  if (driveRootFolderId) {
    // Buscar carpeta del punto
    const { google } = await import('googleapis');
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (keyJson) {
      const key = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));
      const auth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      const drive = google.drive({ version: 'v3', auth });

      // Buscar carpeta del punto dentro de root
      const puntoFolders = await drive.files.list({
        q: `'${driveRootFolderId}' in parents and name = '${punto}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      });
      const puntoFolderId = puntoFolders.data.files?.[0]?.id;
      if (puntoFolderId) {
        archivos = await listFiles(punto, fecha, puntoFolderId);
      }
    }
  }

  const evidenciaResumen = buildEvidenciaResumen(archivos);

  // Paso 2: Buscar otros cierres del mismo día (empalmes)
  const { createAdminClient } = await import('../supabase/server');
  const supabase = createAdminClient();
  const { data: otrosCierres } = await supabase
    .from('cierres')
    .select('*')
    .eq('punto', punto)
    .eq('fecha', fecha)
    .neq('id', cierre.id)
    .order('hora_inicio');

  // Paso 3: Extraer datos de imágenes en lotes
  const imageFiles = collectImageFiles(archivos);
  let datosExtraidos: string[] = [];

  if (imageFiles.length > 0) {
    datosExtraidos = await extractImageBatches(imageFiles, cierre.id);
  }

  // Paso 4: Construir contexto y hacer síntesis
  const contexto = buildContextoCierre(cierre, evidenciaResumen, otrosCierres || []);

  const content: Anthropic.MessageParam['content'] = [];
  content.push({ type: 'text', text: contexto });

  if (datosExtraidos.length > 0) {
    content.push({
      type: 'text',
      text: `=== DATOS EXTRAÍDOS DE IMÁGENES/PDFs (${imageFiles.length} procesados en ${datosExtraidos.length} lotes) ===\n\n` +
        datosExtraidos.join('\n\n--- SIGUIENTE LOTE ---\n\n'),
    });
  } else if (imageFiles.length === 0) {
    content.push({
      type: 'text',
      text: '=== SIN IMÁGENES EN DRIVE === No se encontraron soportes visuales para este cierre.',
    });
  }

  content.push({
    type: 'text',
    text: 'RECUERDA: Responde SOLO en formato JSON como se indica en las instrucciones del sistema.',
  });

  // Llamar Claude para síntesis
  const client = getClient();
  const response = await client.messages.create({
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.CLAUDE_MAX_TOKENS,
    system: SYSTEM_PROMPT_AUDITOR,
    messages: [{ role: 'user', content }],
  });

  const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseIAResponse(analysisText);
  const mensaje = buildMensajeIA(punto, fecha, cierre, parsed, evidenciaResumen, otrosCierres || []);

  // Enviar email
  await sendAlertEmail(punto, fecha, cierre, mensaje, parsed, evidenciaResumen);

  return {
    estado: 'IA_COMPLETADO',
    resultado: parsed.resumen,
    explicacion: parsed.completo,
    accion: parsed.accion,
    mensaje,
  };
}

// =====================================================================
// IMAGE EXTRACTION
// =====================================================================

interface ImageFile {
  id: string;
  name: string;
  folder: string;
  mimeType: string;
}

function collectImageFiles(archivos: DriveFiles): ImageFile[] {
  const files: ImageFile[] = [];
  for (const [folder, folderFiles] of Object.entries(archivos)) {
    for (const file of folderFiles) {
      if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
        files.push({ id: file.id, name: file.name, folder, mimeType: file.mimeType });
      }
    }
  }
  return files;
}

async function extractImageBatches(files: ImageFile[], cierreId: string): Promise<string[]> {
  const maxBytes = CONFIG.CLAUDE_BATCH_MAX_BYTES;
  const results: string[] = [];
  let batchNum = 0;

  // Cargar progreso desde DB cache
  const { createAdminClient } = await import('../supabase/server');
  const supabase = createAdminClient();
  const { data: cached } = await supabase
    .from('ia_extraction_cache')
    .select('*')
    .eq('cierre_id', cierreId)
    .single();

  const processedFileNames = new Set<string>(cached?.processed_files || []);
  if (cached?.datos_extraidos) {
    results.push(...cached.datos_extraidos);
    batchNum = cached.batches_completed || 0;
  }

  // Filtrar archivos ya procesados
  const pendingFiles = files.filter(f => !processedFileNames.has(f.name));
  if (pendingFiles.length === 0) return results;

  // Procesar por lotes
  let currentBatch: Array<{ name: string; folder: string; data: string; media_type: string }> = [];
  let currentSize = 0;

  for (const file of pendingFiles) {
    const fileData = await getFileBase64(file.id);
    if (!fileData) continue;

    const fileSize = fileData.data.length;

    // Si el lote excede el límite, procesarlo primero
    if (currentSize + fileSize > maxBytes && currentBatch.length > 0) {
      batchNum++;
      const extracted = await extractBatch(currentBatch, batchNum);
      if (extracted) results.push(extracted);

      for (const f of currentBatch) processedFileNames.add(f.name);
      await saveExtractionCache(supabase, cierreId, processedFileNames, results, batchNum);

      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push({
      name: file.name,
      folder: file.folder,
      data: fileData.data,
      media_type: fileData.media_type,
    });
    currentSize += fileSize;
  }

  // Último lote
  if (currentBatch.length > 0) {
    batchNum++;
    const extracted = await extractBatch(currentBatch, batchNum);
    if (extracted) results.push(extracted);
    for (const f of currentBatch) processedFileNames.add(f.name);
    await saveExtractionCache(supabase, cierreId, processedFileNames, results, batchNum);
  }

  return results;
}

async function extractBatch(
  batch: Array<{ name: string; folder: string; data: string; media_type: string }>,
  batchNum: number,
): Promise<string | null> {
  const content: Anthropic.MessageParam['content'] = [];

  content.push({
    type: 'text',
    text: `LOTE ${batchNum} — ${batch.length} archivo(s).\nExtraer datos en FORMATO COMPACTO (una línea por documento).`,
  });

  for (let i = 0; i < batch.length; i++) {
    const file = batch[i];
    const isPdf = file.media_type === 'application/pdf';

    if (isPdf) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf' as const, data: file.data },
      } as Anthropic.DocumentBlockParam);
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: file.data,
        },
      });
    }

    content.push({
      type: 'text',
      text: `[Archivo ${i + 1}: ${file.name} (carpeta: ${file.folder})]`,
    });
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: CONFIG.CLAUDE_MODEL,
      max_tokens: CONFIG.CLAUDE_EXTRACT_TOKENS,
      system: SYSTEM_PROMPT_EXTRACCION,
      messages: [{ role: 'user', content }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : null;
  } catch (e) {
    console.error(`Error en extracción lote ${batchNum}:`, e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveExtractionCache(supabase: any, cierreId: string, processedFiles: Set<string>, datos: string[], batches: number) {
  await supabase.from('ia_extraction_cache').upsert({
    cierre_id: cierreId,
    processed_files: Array.from(processedFiles),
    datos_extraidos: datos,
    batches_completed: batches,
    processed_images: processedFiles.size,
    updated_at: nowTimestamp(),
  });
}

// =====================================================================
// CONTEXT BUILDER
// =====================================================================

function buildContextoCierre(
  cierre: Cierre,
  evidencia: Record<string, { cantidad: number; archivos: string[] }>,
  otrosCierres: Cierre[],
): string {
  const fmt = (n: number) => formatMoney(n);
  let ctx = '=== DATOS DEL CIERRE DE CAJA ===\n';
  ctx += `Punto: ${cierre.punto}\nFecha: ${cierre.fecha}\nResponsable: ${cierre.responsable || 'N/A'}\n`;
  ctx += `ID Cierre: ${cierre.id_cierre}\nHora Inicio: ${cierre.hora_inicio || 'N/A'}\nHora Fin: ${cierre.hora_fin || 'N/A'}\n\n`;

  ctx += '--- CUADRE DE CAJA ---\n';
  ctx += `Efectivo Inicial: $${fmt(cierre.efectivo_inicial)}\nVentas en Efectivo: $${fmt(cierre.ventas_efectivo)}\n`;
  ctx += `Gastos en Efectivo: $${fmt(cierre.gastos_efectivo)}\nTotal Efectivo Sistema: $${fmt(cierre.total_efectivo_sistema)}\n`;
  ctx += `Propinas: $${fmt(cierre.propinas)}\n\n`;

  ctx += '--- VENTAS ---\n';
  ctx += `Ingreso Ventas: $${fmt(cierre.ingreso_ventas)}\nTotal Ingresos: $${fmt(cierre.total_ingresos)}\nTotal Gastos: $${fmt(cierre.total_gastos)}\n`;
  if (cierre.formas_pago && Object.keys(cierre.formas_pago).length > 0) {
    ctx += `Formas de Pago: ${JSON.stringify(cierre.formas_pago)}\n`;
  }
  if (cierre.gastos_detalle && cierre.gastos_detalle.length > 0) {
    ctx += `Gastos Detalle: ${JSON.stringify(cierre.gastos_detalle)}\n`;
  }

  ctx += '\n--- DINERO DECLARADO ---\n';
  ctx += `Efectivo Sistema: $${fmt(cierre.efectivo_sistema)}\nEfectivo Declarado: $${fmt(cierre.efectivo_declarado)}\n`;
  ctx += `Efectivo Diferencia: $${fmt(cierre.efectivo_diferencia)}\n`;
  ctx += `Tarjetas Sistema: $${fmt(cierre.tarjetas_otros_sistema)}\nTarjetas Declarado: $${fmt(cierre.tarjetas_otros_declarado)}\n`;
  ctx += `Tarjetas Diferencia: $${fmt(cierre.tarjetas_otros_diferencia)}\n`;
  ctx += `Resultado: ${cierre.sobrante_faltante_tipo} $${fmt(Math.abs(cierre.sobrante_faltante_monto))}\n`;

  // Sobre
  if (cierre.efectivo_contado_sobre != null) {
    ctx += '\n--- CONFIRMACIÓN DE SOBRE ---\n';
    ctx += `Contado: $${fmt(cierre.efectivo_contado_sobre)}\nDiferencia: $${fmt(cierre.sobre_diferencia || 0)}\n`;
    ctx += `Estado: ${cierre.sobre_estado}\n`;
    if (cierre.sobre_notas) ctx += `Notas: ${cierre.sobre_notas}\n`;
  }

  if (cierre.observaciones_admin) {
    ctx += '\n--- OBSERVACIONES DEL ADMINISTRADOR ---\n' + cierre.observaciones_admin + '\n';
  }

  // Empalmes
  if (otrosCierres.length > 0) {
    ctx += `\n--- OTROS CIERRES DEL MISMO DÍA (${otrosCierres.length}) ---\n`;
    for (const otro of otrosCierres) {
      ctx += `>> ${otro.responsable} (ID ${otro.id_cierre}): ${otro.sobrante_faltante_tipo} $${fmt(Math.abs(otro.sobrante_faltante_monto))}\n`;
      ctx += `   Hora: ${otro.hora_inicio || '?'} - ${otro.hora_fin || '?'}\n`;
    }
  }

  // Evidencia
  ctx += '\n--- EVIDENCIA EN DRIVE ---\n';
  for (const [folder, info] of Object.entries(evidencia)) {
    ctx += info.cantidad > 0
      ? `${folder}: ${info.cantidad} archivo(s) - ${info.archivos.join(', ')}\n`
      : `${folder}: SIN EVIDENCIA\n`;
  }

  return ctx;
}

// =====================================================================
// RESPONSE PARSER
// =====================================================================

function parseIAResponse(text: string): ParsedIAResponse {
  const result: ParsedIAResponse = {
    resumen: '',
    accion: '',
    completo: text,
    json: null,
  };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed: IAAnalysisJSON = JSON.parse(jsonMatch[0]);
      result.json = parsed;
      result.resumen = `${parsed.veredicto || 'SIN VEREDICTO'} — ${parsed.resumen || ''}`;
      result.accion = parsed.accion || '';
      return result;
    } catch {
      // Fallback to text parsing
    }
  }

  result.resumen = text.substring(0, 200) + (text.length > 200 ? '...' : '');
  return result;
}

// =====================================================================
// MESSAGE BUILDER
// =====================================================================

function buildMensajeIA(
  punto: string,
  fecha: string,
  cierre: Cierre,
  parsed: ParsedIAResponse,
  evidencia: Record<string, { cantidad: number; archivos: string[] }>,
  otrosCierres: Cierre[],
): string {
  const fechaDisplay = formatDateDisplay(parseDate(fecha) || nowColombia());
  const fmt = (n: number) => formatMoney(n);

  let msg = `CIERRE: ${punto} | ${fechaDisplay}`;
  if (cierre.hora_inicio || cierre.hora_fin) msg += ` | ${cierre.hora_inicio || '?'}-${cierre.hora_fin || '?'}`;
  msg += `\nCajero: ${cierre.responsable || 'N/A'} | Nivel: ${cierre.nivel_riesgo || 'N/A'}\n`;

  if (parsed.json) {
    const j = parsed.json;
    msg += `VEREDICTO: ${j.veredicto || 'N/A'} — ${j.resumen || ''}\n\n`;

    if (j.efectivo) {
      msg += 'EFECTIVO:\n';
      msg += `  Sistema: $${fmt(j.efectivo.sistema)} | Declarado: $${fmt(j.efectivo.declarado)}`;
      if (j.efectivo.sobre != null) msg += ` | Sobre: $${fmt(j.efectivo.sobre)}`;
      msg += `\n  Diferencia: $${fmt(j.efectivo.diferencia)}`;
      if (j.efectivo.explicacion) msg += ` (${j.efectivo.explicacion})`;
      msg += '\n\n';
    }

    if (j.gastos?.length) {
      const verificados = j.gastos.filter(g => g.verificado).length;
      msg += `GASTOS VERIFICADOS (${verificados}/${j.gastos.length}):\n`;
      for (const g of j.gastos) {
        msg += `  ${g.verificado ? 'OK' : 'XX'} ${g.concepto} — $${fmt(g.monto)}`;
        if (g.soporte && g.soporte !== 'SIN SOPORTE') msg += ` (${g.soporte})`;
        else if (!g.verificado) msg += ' — SIN SOPORTE';
        msg += '\n';
      }
      msg += '\n';
    }

    if (j.transferencias?.length) {
      msg += 'TRANSFERENCIAS:\n';
      for (const t of j.transferencias) {
        msg += `  ${t.verificado ? 'OK' : 'XX'} ${t.tipo} $${fmt(t.monto)}`;
        if (t.screenshot) msg += ` (${t.screenshot})`;
        msg += '\n';
      }
      msg += '\n';
    }

    if (j.documentos_no_legibles?.length) {
      msg += `NO LEGIBLES: ${j.documentos_no_legibles.join(', ')}\n\n`;
    }

    if (j.anomalias?.length) {
      msg += 'ANOMALIAS:\n';
      for (const a of j.anomalias) msg += `  ! ${a}\n`;
      msg += '\n';
    }

    if (j.accion) msg += `ACCION: ${j.accion}\n`;
  } else {
    msg += `VEREDICTO: ${parsed.resumen}\n\nACCION: ${parsed.accion || 'Revisar manualmente'}\n`;
  }

  if (otrosCierres.length > 0) {
    msg += '\nOTROS TURNOS:\n';
    for (const otro of otrosCierres) {
      msg += `  ${otro.responsable || '?'}: ${otro.sobrante_faltante_tipo} $${fmt(Math.abs(otro.sobrante_faltante_monto))}\n`;
    }
  }

  return msg;
}
