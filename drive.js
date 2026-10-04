import fs from "fs";
import { Readable } from "stream";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import {
  TOKEN_PATH,
  CREDENTIALS_PATH,
  SCOPES,
  DRIVE_FOLDER_ID,
} from "./config.js";

let driveClient;

function escaparQuery(texto) {
  return String(texto || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function iniciarDrive() {
  let authClient;
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
    const keys = credentials.installed || credentials.web;
    authClient = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      keys.redirect_uris[0],
    );
    authClient.setCredentials(token);
  } else {
    console.log("⚠️ Autorizando Google Drive...");
    authClient = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(authClient.credentials));
  }
  driveClient = google.drive({ version: "v3", auth: authClient });
  return driveClient;
}

export function obtenerDriveClient() {
  return driveClient;
}

// ☁️ SUBIR ARCHIVO (En memoria mediante streams, seguro para cualquier nombre de archivo)
export async function subirADrive(media, filename, carpetaDestinoId) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    const buffer = Buffer.from(media.data, "base64");
    const fileMetadata = { name: filename, parents: [carpetaDestinoId] };
    const mediaConfig = {
      mimeType: media.mimetype || "application/octet-stream",
      body: Readable.from(buffer),
    };
    console.log(`☁️ Subiendo "${filename}"...`);
    await driveClient.files.create({
      resource: fileMetadata,
      media: mediaConfig,
      fields: "id",
    });
    console.log(`✅ ¡Subido con éxito!`);
    return true;
  } catch (error) {
    console.error("❌ Error al subir:", error.message);
    return false;
  }
}


// 🔍 BUSCAR DUPLICADOS (Ahora recibe la carpetaDestinoId)
export async function existeArchivoEnDrive(filename, carpetaDestinoId) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    const nombreSeguro = escaparQuery(filename);
    const query = `name = '${nombreSeguro}' and '${carpetaDestinoId}' in parents and trashed = false`;

    const response = await driveClient.files.list({
      q: query,
      fields: "files(id, name)",
    });

    return !!(response.data.files && response.data.files.length > 0);
  } catch (error) {
    console.error("❌ Error al buscar archivo en Drive:", error.message);
    return false;
  }
}

// ⚡ CARGAR MAPA DE HASHES (O(1) para detección instantánea de duplicados por contenido)
export async function cargarMapaHashesDrive(carpetaRaizId = DRIVE_FOLDER_ID) {
  if (!driveClient) throw new Error("Drive no está inicializado.");
  try {
    const response = await driveClient.files.list({
      q: `mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: 1000,
      fields: "files(id, name, md5Checksum, parents)",
    });

    const mapa = new Map();
    for (const f of response.data.files || []) {
      if (f.md5Checksum) {
        mapa.set(f.md5Checksum, f);
      }
    }
    return mapa;
  } catch (error) {
    console.error("⚠️ Error cargando mapa de hashes de Drive:", error.message);
    return new Map();
  }
}

// 🏷️ RENOMBRAR ARCHIVO EN DRIVE
export async function renombrarArchivoEnDrive(archivoId, nuevoNombre) {
  if (!driveClient) throw new Error("Drive no está inicializado.");
  try {
    await driveClient.files.update({
      fileId: archivoId,
      requestBody: { name: nuevoNombre },
      resource: { name: nuevoNombre },
      fields: "id, name",
    });
    return true;
  } catch (error) {
    console.error(`❌ Error al renombrar archivo ${archivoId}:`, error.message);
    return false;
  }
}


// 📂 OBTENER O CREAR CARPETAS
export async function obtenerOCrearCarpeta(nombreCarpeta, parentFolderId) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    const nombreSeguro = escaparQuery(nombreCarpeta);
    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${nombreSeguro}' and '${parentFolderId}' in parents and trashed = false`;

    const response = await driveClient.files.list({
      q: query,
      fields: "files(id, name)",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    console.log(`📂 Creando nueva carpeta: "${nombreCarpeta}"...`);
    const fileMetadata = {
      name: nombreCarpeta,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    };

    const carpetaCreada = await driveClient.files.create({
      resource: fileMetadata,
      fields: "id",
    });

    return carpetaCreada.data.id;
  } catch (error) {
    console.error(
      `❌ Error al buscar/crear la carpeta ${nombreCarpeta}:`,
      error.message,
    );
    return parentFolderId;
  }
}

// 📋 LISTAR ARCHIVOS SUELTOS (Ignora las carpetas)
export async function listarArchivosSueltos(carpetaId) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    // Busca archivos en la carpeta raíz cuyo tipo MIME NO sea el de una carpeta
    const query = `'${carpetaId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await driveClient.files.list({
      q: query,
      fields: "files(id, name, mimeType)",
    });

    return response.data.files || [];
  } catch (error) {
    console.error("❌ Error al listar archivos en Drive:", error.message);
    return [];
  }
}

// 🚚 MOVER ARCHIVO DE UNA CARPETA A OTRA
export async function moverArchivo(
  archivoId,
  carpetaOrigenId,
  carpetaDestinoId,
) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    // La API de Drive mueve archivos añadiendo un padre nuevo y quitando el antiguo
    const updateParams = {
      fileId: archivoId,
      addParents: carpetaDestinoId,
      fields: "id, parents",
    };
    if (carpetaOrigenId) {
      updateParams.removeParents = carpetaOrigenId;
    }
    await driveClient.files.update(updateParams);
    return true;
  } catch (error) {
    console.error(`❌ Error al mover el archivo ${archivoId}:`, error.message);
    return false;
  }
}
// 🔎 ESCÁNER PROFUNDO: Busca archivos en la raíz y en todas las subcarpetas
export async function listarTodosLosArchivos(carpetaId) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  let archivosEncontrados = [];

  // Función interna que se llama a sí misma para entrar en carpetas
  async function buscarRecursivamente(idActual) {
    try {
      const query = `'${idActual}' in parents and trashed = false`;
      const response = await driveClient.files.list({
        q: query,
        // Pedimos 'parents', 'md5Checksum' y 'size' para detección de duplicados y reordenamiento
        fields: "files(id, name, mimeType, parents, md5Checksum, size)",
      });

      for (const item of response.data.files) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          // Si es carpeta, entramos a revisarla
          await buscarRecursivamente(item.id);
        } else {
          // 🛑 EXCEPCIÓN: Si el archivo es nuestro Google Sheet de enlaces, lo ignoramos por completo
          if (
            item.name === "Enlaces_Guardados" ||
            item.name === "Enlaces_Guardados.csv"
          ) {
            continue;
          }

          // Si es cualquier otro archivo, lo guardamos para evaluarlo
          archivosEncontrados.push(item);
        }
      }
    } catch (error) {
      console.error(
        `❌ Error al escanear la carpeta ${idActual}:`,
        error.message,
      );
    }
  }

  await buscarRecursivamente(carpetaId);
  return archivosEncontrados;
}

// 🔄 SINCRONIZAR CSV / GOOGLE SHEETS
export async function sincronizarCSVDrive(
  nombreArchivo,
  contenidoCsvORuta,
  carpetaDestinoId = DRIVE_FOLDER_ID,
) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    const nombreSeguro = escaparQuery(nombreArchivo);
    const query = `name = '${nombreSeguro}' and '${carpetaDestinoId}' in parents and trashed = false`;
    const response = await driveClient.files.list({
      q: query,
      fields: "files(id)",
    });

    const esRuta = typeof contenidoCsvORuta === "string" && fs.existsSync(contenidoCsvORuta);
    const bodyStream = esRuta
      ? fs.createReadStream(contenidoCsvORuta)
      : Readable.from([contenidoCsvORuta]);

    const mediaConfig = {
      mimeType: "text/csv",
      body: bodyStream,
    };

    if (response.data.files && response.data.files.length > 0) {
      const fileId = response.data.files[0].id;
      await driveClient.files.update({
        fileId: fileId,
        media: mediaConfig,
      });
      console.log(`☁️ Google Sheet "${nombreArchivo}" actualizado en Drive.`);
      return fileId;
    } else {
      const fileMetadata = {
        name: nombreArchivo,
        parents: [carpetaDestinoId],
        mimeType: "application/vnd.google-apps.spreadsheet",
      };
      const creado = await driveClient.files.create({
        requestBody: fileMetadata,
        resource: fileMetadata,
        media: mediaConfig,
        fields: "id",
      });
      console.log(`☁️ Google Sheet "${nombreArchivo}" creado en Drive.`);
      return creado.data.id;
    }
  } catch (error) {
    console.error(`❌ Error al sincronizar "${nombreArchivo}":`, error.message);
    return null;
  }
}

// 🌐 SINCRONIZAR ARCHIVO EN DRIVE (HTML, Markdown, JSON, etc.)
export async function sincronizarArchivoEnDrive({
  nombreArchivo,
  contenido,
  mimeType = "text/html; charset=utf-8",
  carpetaDestinoId = DRIVE_FOLDER_ID,
}) {
  if (!driveClient) throw new Error("Drive no está inicializado.");

  try {
    const nombreSeguro = escaparQuery(nombreArchivo);
    const query = `name = '${nombreSeguro}' and '${carpetaDestinoId}' in parents and trashed = false`;
    const response = await driveClient.files.list({
      q: query,
      fields: "files(id, name)",
    });

    const mediaConfig = {
      mimeType,
      body: Readable.from([contenido]),
    };

    if (response.data.files && response.data.files.length > 0) {
      const fileId = response.data.files[0].id;
      await driveClient.files.update({
        fileId: fileId,
        requestBody: { name: nombreArchivo },
        media: mediaConfig,
      });
      console.log(`☁️ Archivo "${nombreArchivo}" actualizado en Drive.`);
      return fileId;
    } else {
      const fileMetadata = {
        name: nombreArchivo,
        parents: [carpetaDestinoId],
        mimeType: mimeType.split(";")[0],
      };
      const creado = await driveClient.files.create({
        requestBody: fileMetadata,
        resource: fileMetadata,
        media: mediaConfig,
        fields: "id",
      });
      console.log(`☁️ Archivo "${nombreArchivo}" creado en Drive por primera vez.`);
      return creado.data.id;
    }
  } catch (error) {
    console.error(`❌ Error al sincronizar "${nombreArchivo}" en Drive:`, error.message);
    return null;
  }
}

