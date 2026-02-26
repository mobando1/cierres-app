/**
 * Google Drive client — Portado de 08_DriveManager.gs
 * Usa googleapis npm con service account en vez de DriveApp de GAS.
 */

import { google, drive_v3 } from 'googleapis';
import { CONFIG } from '../config';

let driveClient: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurada');

  const key = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export interface DriveFile {
  name: string;
  id: string;
  mimeType: string;
  url: string;
}

export interface DriveFiles {
  [subfolder: string]: DriveFile[];
}

/**
 * Lista todos los archivos en la carpeta de un negocio/fecha.
 */
export async function listFiles(punto: string, fecha: string, folderId: string): Promise<DriveFiles> {
  const drive = getDriveClient();
  const result: DriveFiles = {};

  try {
    // Buscar la carpeta de fecha dentro del folderId
    const fechaFolders = await drive.files.list({
      q: `'${folderId}' in parents and name = '${fecha}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
    });

    const fechaFolder = fechaFolders.data.files?.[0];
    if (!fechaFolder?.id) return result;

    // Listar subcarpetas
    for (const subName of CONFIG.DRIVE.SUBFOLDERS) {
      result[subName] = [];

      const subFolders = await drive.files.list({
        q: `'${fechaFolder.id}' in parents and name = '${subName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
      });

      const subFolder = subFolders.data.files?.[0];
      if (!subFolder?.id) continue;

      const files = await drive.files.list({
        q: `'${subFolder.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink)',
        pageSize: 100,
      });

      for (const file of files.data.files || []) {
        result[subName].push({
          name: file.name || '',
          id: file.id || '',
          mimeType: file.mimeType || '',
          url: file.webViewLink || '',
        });
      }
    }

    // Archivos en la raíz de la carpeta fecha
    const rootFiles = await drive.files.list({
      q: `'${fechaFolder.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
    });

    if (rootFiles.data.files && rootFiles.data.files.length > 0) {
      if (!result['07_Otros']) result['07_Otros'] = [];
      for (const file of rootFiles.data.files) {
        result['07_Otros'].push({
          name: file.name || '',
          id: file.id || '',
          mimeType: file.mimeType || '',
          url: file.webViewLink || '',
        });
      }
    }
  } catch (e) {
    console.error(`Error listando archivos Drive: ${punto} ${fecha}`, e);
  }

  return result;
}

/**
 * Descarga un archivo como base64 (imágenes y PDFs, max 4MB).
 */
export async function getFileBase64(fileId: string): Promise<{ data: string; media_type: string } | null> {
  try {
    const drive = getDriveClient();

    // Obtener metadata
    const meta = await drive.files.get({ fileId, fields: 'mimeType, size, name' });
    const mimeType = meta.data.mimeType || '';
    const size = parseInt(meta.data.size || '0');

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    if (!isImage && !isPdf) return null;

    if (size > 4 * 1024 * 1024) {
      console.warn(`Archivo muy grande: ${meta.data.name} (${Math.round(size / 1024)}KB)`);
      return null;
    }

    // Descargar contenido
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    return {
      data: buffer.toString('base64'),
      media_type: mimeType,
    };
  } catch (e) {
    console.error(`Error descargando archivo Drive: ${fileId}`, e);
    return null;
  }
}

/**
 * Crea las carpetas de un negocio/fecha en Drive.
 */
export async function createDateFolders(punto: string, fecha: string): Promise<string | null> {
  try {
    const drive = getDriveClient();
    const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) throw new Error('DRIVE_ROOT_FOLDER_ID no configurada');

    // Crear/buscar carpeta del punto
    const puntoFolderId = await getOrCreateFolder(drive, rootFolderId, punto);

    // Crear/buscar carpeta de la fecha
    const fechaFolderId = await getOrCreateFolder(drive, puntoFolderId, fecha);

    // Crear subcarpetas
    for (const sub of CONFIG.DRIVE.SUBFOLDERS) {
      await getOrCreateFolder(drive, fechaFolderId, sub);
    }

    return fechaFolderId;
  } catch (e) {
    console.error(`Error creando carpetas Drive: ${punto} ${fecha}`, e);
    return null;
  }
}

async function getOrCreateFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string> {
  // Buscar existente
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  // Crear nuevo
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return created.data.id!;
}

/**
 * Construye resumen de evidencia disponible por carpeta.
 */
export function buildEvidenciaResumen(archivos: DriveFiles): Record<string, { cantidad: number; archivos: string[] }> {
  const resumen: Record<string, { cantidad: number; archivos: string[] }> = {};
  for (const [folder, files] of Object.entries(archivos)) {
    resumen[folder] = {
      cantidad: files.length,
      archivos: files.map(f => f.name),
    };
  }
  return resumen;
}
