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
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + GITHUB_TOKEN,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Golgi-Bot-AppsScript"
      },
      contentType: "application/json",
      payload: JSON.stringify({ event_type: "actualizar_biblioteca" }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Error al disparar GitHub Action: " + e.toString());
  }
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
    const materia = (params.materia || "").trim();
    const tipo = (params.tipo || "Apuntes").trim();
    const pin = params.pin || "";

    if (PIN_SEGURIDAD && pin !== PIN_SEGURIDAD) {
      return jsonRespuesta({ ok: false, error: "PIN de seguridad incorrecto." });
    }

    if (!fileId) {
      return jsonRespuesta({ ok: false, error: "Falta el ID del archivo (fileId)." });
    }

    if (!materia) {
      return jsonRespuesta({ ok: false, error: "Falta la materia destino." });
    }

    // 1. Localizar el archivo en Google Drive
    const file = DriveApp.getFileById(fileId);
    if (!file) {
      return jsonRespuesta({ ok: false, error: "No se encontró el archivo en Google Drive." });
    }

    // 2. Localizar la carpeta raíz del Drive
    let rootFolder;
    if (DRIVE_FOLDER_ID) {
      rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } else {
      rootFolder = DriveApp.getRootFolder();
    }

    // 3. Buscar o crear la carpeta de la Asignatura/Materia
    const materiaFolder = obtenerOCrearCarpeta(rootFolder, materia);

    // 4. Buscar o crear la subcarpeta del Tipo (Apuntes, Certámenes, etc.)
    const destinoFinal = tipo ? obtenerOCrearCarpeta(materiaFolder, tipo) : materiaFolder;

    // 5. Mover el archivo a la subcarpeta destino
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

    // Disparar compilación automática en GitHub Actions si está configurado
    dispararGitHubAction();

    return jsonRespuesta({
      ok: true,
      mensaje: "Archivo movido con éxito en Google Drive",
      archivo: file.getName(),
      materia: materia,
      tipo: tipo
    });

  } catch (err) {
    return jsonRespuesta({ ok: false, error: err.toString() });
  }
}

function obtenerOCrearCarpeta(parentFolder, nombre) {
  const folders = parentFolder.getFoldersByName(nombre);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(nombre);
}

function jsonRespuesta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
