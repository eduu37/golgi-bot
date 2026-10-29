/**
 * ============================================================
 * GOLGI BOT — WEBHOOK DE CLASIFICACIÓN DIRECTA EN GOOGLE DRIVE
 * ============================================================
 * 
 * Este script se instala en tu cuenta de Google (gratis en Google Apps Script)
 * y permite que el botón "⚡ Mover en Drive Ahora" en la página web mueva los
 * archivos de Google Drive con 1 solo clic, sin abrir Drive ni mandar mensajes.
 * 
 * ⏱️ PASOS DE INSTALACIÓN (Toma 2 minutos):
 * 1. Entra con la cuenta de Google dueña de tu Drive a:
 *    👉 https://script.google.com/
 * 2. Haz clic en el botón azul "+ Nuevo proyecto".
 * 3. Borra todo el código que aparece por defecto y PEGA TODO ESTE ARCHIVO.
 * 4. (Opcional) Si tu carpeta raíz es diferente, cambia DRIVE_FOLDER_ID abajo.
 * 5. Arriba a la derecha, haz clic en el botón azul "Implementar" -> "Nueva implementación".
 * 6. En el engranaje ⚙️ (icono a la izquierda), selecciona "Aplicación web".
 * 7. Llena los campos:
 *    - Descripción: "Golgi Bot Mover Webhook"
 *    - Ejecutar como: "Yo (tu correo)"
 *    - Quién tiene acceso: "Cualquier persona" (Anyone)
 * 8. Haz clic en "Implementar". Google te pedirá "Revisar permisos" y "Permitir".
 * 9. Copia la "URL de la aplicación web" (termina en /exec) y pégala en:
 *    - Tu archivo .env local: APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 *    - O pégala directamente en la ventana emergente de la web (se guarda sola).
 * 
 * ¡Listo! Cada vez que pulses "⚡ Mover en Drive Ahora", el archivo se reubica solo.
 */

// ID de la carpeta principal de Medicina en Google Drive
// (Los archivos se organizarán automáticamente en subcarpetas: Materia / Tipo)
const DRIVE_FOLDER_ID = "1yoFG4Vy7G0DMhLu-ONlbtfqqdyQKCczF";

// PIN de seguridad opcional (déjalo vacío "" para uso abierto y rápido)
const PIN_SEGURIDAD = "";

// (Opcional) Token personal de GitHub si deseas que Apps Script despierte a GitHub Actions automáticamente
const GITHUB_TOKEN = ""; 
const GITHUB_REPO = "eduu37/golgi-bot";

function dispararGitHubAction() {
  if (!GITHUB_TOKEN) return;
  try {
    const url = "https://api.github.com/repos/" + GITHUB_REPO + "/dispatches";
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + GITHUB_TOKEN,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Golgi-Bot-AppsScript"
      },
      contentType: "application/json",
      payload: JSON.stringify({ event_type: "actualizar_biblioteca" }),
      muteHttpExceptions: true
    });
    Logger.log("GitHub Action disparada. Código de respuesta: " + res.getResponseCode());
  } catch (e) {
    Logger.log("Error al disparar GitHub Action: " + e.toString());
  }
}

/**
 * 🧪 Función de prueba y autorización:
 * Ejecuta esta función una sola vez en el editor de Apps Script para conceder
 * el permiso de peticiones externas (UrlFetchApp) y verificar la conexión con GitHub.
 */
function probarConexionGitHub() {
  Logger.log("🧪 Probando conexión con GitHub Actions...");
  dispararGitHubAction();
}

function doPost(e) {
  return procesarSolicitud(e);
}

function doGet(e) {
  return procesarSolicitud(e);
}

function procesarSolicitud(e) {
  try {
    let params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    const fileId = params.fileId || params.id;
    const accion = String(params.accion || params.action || "mover").toLowerCase().trim();
    const pin = params.pin || "";

    // ============================================================
    // ACCIÓN 0: OBTENER CATÁLOGO DE ARCHIVOS (PERMANENTE PARA CI/GITHUB ACTIONS)
    // ============================================================
    if (accion === "catalogo" || accion === "listar" || accion === "archivos") {
      const folderIdCatalogo = params.folderId || params.driveFolderId || DRIVE_FOLDER_ID;
      let targetFolder;
      try {
        targetFolder = folderIdCatalogo ? DriveApp.getFolderById(folderIdCatalogo) : DriveApp.getRootFolder();
      } catch (errF) {
        return jsonRespuesta({ ok: false, error: "No se pudo acceder a la carpeta: " + errF.toString() });
      }

      const lista = [];
      recorrerCarpetaParaCatalogo(targetFolder, "", "", lista);
      return jsonRespuesta({
        ok: true,
        total: lista.length,
        archivos: lista
      });
    }

    if (!fileId) {
      return jsonRespuesta({ ok: false, error: "Falta el ID del archivo (fileId)." });
    }

    // 1. Localizar el archivo en Google Drive
    const file = DriveApp.getFileById(fileId);
    if (!file) {
      return jsonRespuesta({ ok: false, error: "No se encontró el archivo en Google Drive." });
    }

    // 2. Localizar la carpeta raíz del Drive (soporta multi-generación según el folderId enviado desde la web)
    const folderIdDestino = params.folderId || params.driveFolderId || DRIVE_FOLDER_ID;
    let rootFolder;
    if (folderIdDestino) {
      rootFolder = DriveApp.getFolderById(folderIdDestino);
    } else {
      rootFolder = DriveApp.getRootFolder();
    }

    // 2.1 Seguridad: Verificar que el archivo pertenezca a la jerarquía de la carpeta del bot
    if (rootFolder && !esDescendienteDeCarpeta(file, rootFolder)) {
      return jsonRespuesta({ ok: false, error: "Seguridad: El archivo solicitado no pertenece a la carpeta autorizada del bot." });
    }

    // ============================================================
    // ACCIÓN 1: ELIMINAR ARCHIVO (MOVER A PAPELERA DE DRIVE)
    // ============================================================
    if (accion === "eliminar" || accion === "borrar" || accion === "trash") {
      const nombreEliminado = file.getName();
      file.setTrashed(true);
      dispararGitHubAction();
      return jsonRespuesta({
        ok: true,
        accion: "eliminar",
        mensaje: `Archivo "${nombreEliminado}" enviado a la papelera de Google Drive con éxito.`,
        archivo: nombreEliminado,
        fileId: fileId
      });
    }

    // ============================================================
    // ACCIÓN 2: RENOMBRAR Y/O MOVER (ACTUALIZAR)
    // ============================================================
    const nombreOriginal = file.getName();
    let nombreActualizado = nombreOriginal;
    const nuevoNombre = (params.nuevoNombre || params.nombre || "").trim();

    if (nuevoNombre && nuevoNombre !== nombreOriginal) {
      // Preservar extensión original si el usuario no la escribió
      let extensionOriginal = "";
      const dotIndex = nombreOriginal.lastIndexOf(".");
      if (dotIndex > 0) {
        extensionOriginal = nombreOriginal.substring(dotIndex);
      }
      let nombreFinal = nuevoNombre;
      if (extensionOriginal && !nombreFinal.toLowerCase().endsWith(extensionOriginal.toLowerCase())) {
        nombreFinal += extensionOriginal;
      }
      file.setName(nombreFinal);
      nombreActualizado = nombreFinal;
    }

    const materia = (params.materia || "").trim();
    const tipo = (params.tipo || "Apuntes").trim();

    if (materia) {
      // Buscar o crear la carpeta de la Asignatura/Materia
      const materiaFolder = obtenerOCrearCarpeta(rootFolder, materia);

      // Buscar o crear la subcarpeta del Tipo (Apuntes, Certámenes, etc.)
      const destinoFinal = tipo ? obtenerOCrearCarpeta(materiaFolder, tipo) : materiaFolder;

      // Mover el archivo a la subcarpeta destino
      if (file.moveTo) {
        file.moveTo(destinoFinal);
      } else {
        destinoFinal.addFile(file);
        const padres = file.getParents();
        while (padres.hasNext()) {
          const padre = padres.next();
          if (padre.getId() !== destinoFinal.getId()) {
            padre.removeFile(file);
          }
        }
      }
    }

    // Disparar compilación automática en GitHub Actions si está configurado
    dispararGitHubAction();

    return jsonRespuesta({
      ok: true,
      accion: "actualizar",
      mensaje: "Archivo actualizado con éxito en Google Drive",
      archivo: nombreActualizado,
      nombreAnterior: nombreOriginal,
      materia: materia,
      tipo: tipo,
      fileId: fileId
    });

  } catch (err) {
    return jsonRespuesta({ ok: false, error: err.toString() });
  }
}

function esDescendienteDeCarpeta(archivo, carpetaRaiz) {
  if (!carpetaRaiz) return true;
  const raizId = carpetaRaiz.getId();
  let padres = archivo.getParents();
  let visitados = {};
  let cola = [];
  while (padres.hasNext()) {
    cola.push(padres.next());
  }
  while (cola.length > 0) {
    const p = cola.shift();
    if (p.getId() === raizId) return true;
    if (!visitados[p.getId()]) {
      visitados[p.getId()] = true;
      let abuelos = p.getParents();
      while (abuelos.hasNext()) {
        cola.push(abuelos.next());
      }
    }
  }
  return false;
}

function obtenerOCrearCarpeta(parentFolder, nombre) {
  const folders = parentFolder.getFoldersByName(nombre);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(nombre);
}

function recorrerCarpetaParaCatalogo(carpeta, materia, tipo, resultado) {
  if (!carpeta) return;
  const files = carpeta.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.isTrashed()) continue;
    const name = f.getName();
    if (name.startsWith("INDICE_BIBLIOTECA") || name.startsWith("Enlaces_Guardados") || name === "desktop.ini") continue;

    resultado.push({
      id: f.getId(),
      name: name,
      size: f.getSize(),
      createdTime: f.getDateCreated().toISOString(),
      webViewLink: f.getUrl(),
      materia: materia || "Sin clasificar",
      tipo: tipo || "Apuntes",
      mimeType: f.getMimeType()
    });
  }

  const subCarpetas = carpeta.getFolders();
  while (subCarpetas.hasNext()) {
    const sub = subCarpetas.next();
    if (sub.isTrashed()) continue;
    const subNombre = sub.getName();
    if (!materia) {
      recorrerCarpetaParaCatalogo(sub, subNombre, "", resultado);
    } else if (!tipo) {
      recorrerCarpetaParaCatalogo(sub, materia, subNombre, resultado);
    } else {
      recorrerCarpetaParaCatalogo(sub, materia, tipo, resultado);
    }
  }
}

function jsonRespuesta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
