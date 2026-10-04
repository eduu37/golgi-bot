import wwebjs from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import crypto from "crypto";
import path from "path";

import {
  TARGET_GROUP_ID,
  EXTENSIONES_PROHIBIDAS,
  DRIVE_FOLDER_ID,
  ESTANDARIZAR_NOMBRES,
  DETECTAR_DUPLICADOS_HASH,
  AUTO_ACTUALIZAR_INDICE,
} from "./config.js";

import {
  iniciarDrive,
  subirADrive,
  existeArchivoEnDrive,
  obtenerOCrearCarpeta,
  sincronizarCSVDrive,
  cargarMapaHashesDrive,
} from "./drive.js";

import { getLastIDSaved, guardarUltimoId } from "./status.js";
import { clasificarArchivo } from "./clasificador.js";
import { procesarEnlaces } from "./enlaces.js";
import { generarNombreEstandar } from "./renombrador.js";


// =========================================================
// INICIO DEL BOT DE WHATSAPP
// =========================================================

const { Client, LocalAuth } = wwebjs;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", (qr) => qrcode.generate(qr, { small: true }));

client.on("ready", async () => {
  console.log("✅ WhatsApp conectado.");
  console.log("⏱️ Esperando 10 segundos para sincronizar el historial...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  try {
    const chat = await client.getChatById(TARGET_GROUP_ID);
    console.log(`📁 Grupo encontrado: "${chat.name}"`);

    const messages = await chat.fetchMessages({ limit: 100 });

    if (messages.length === 0) {
      console.log("❌ El grupo aparece vacío.");
      await shutdownBot();
      return;
    }

    const lastIDSaved = getLastIDSaved();
    let messagesToProcess = [];

    if (lastIDSaved) {
      const lastIndex = messages.findIndex(
        (m) => m.id._serialized === lastIDSaved,
      );
      if (lastIndex !== -1) {
        messagesToProcess = messages.slice(lastIndex + 1);
      } else {
        console.log(
          "⚠️ Último mensaje fuera de radar. Revisando bloque completo...",
        );
        messagesToProcess = messages;
      }
    } else {
      console.log("Primera vez ejecutando. Revisando todo el bloque...");
      messagesToProcess = messages;
    }

    // Variables para el reporte
    let archivosSubidos = 0;
    let archivosOmitidos = 0;
    let enlacesGuardados = 0;
    let detalleTipos = {};

    if (messagesToProcess.length === 0) {
      console.log("No hay mensajes nuevos.");
    } else {
      console.log(
        `Se encontraron ${messagesToProcess.length} mensajes nuevos.`,
      );

      // ⚡ Carga inicial del mapa de hashes para deduplicación instantánea
      console.log("⚡ Sincronizando catálogo de archivos existentes en Drive...");
      const mapaHashes = DETECTAR_DUPLICADOS_HASH
        ? await cargarMapaHashesDrive(DRIVE_FOLDER_ID)
        : new Map();
      console.log(
        `📦 Catálogo cargado: ${mapaHashes.size} archivos registrados en Drive.`,
      );

      // =========================================================
      // AQUÍ EMPIEZA EL PROCESO DE CADA MENSAJE
      // =========================================================
      for (let msg of messagesToProcess) {
        if (msg.fromMe) continue;

        // ESCÁNER DE ENLACES
        const links = await procesarEnlaces(msg, msg.timestamp);
        enlacesGuardados += links;

        if (msg.hasMedia) {
          try {
            const media = await msg.downloadMedia();
            if (media) {
              let extension = "";

              if (media.filename && media.filename.includes(".")) {
                extension = media.filename.split(".").pop().toLowerCase();
              } else {
                let mimeCrudo = (
                  media.mimetype ? media.mimetype.split("/")[1] : ""
                )
                  ?.split(";")[0]
                  ?.toLowerCase() || "";
                const traductorMime = {
                  jpeg: "jpg",
                  "vnd.openxmlformats-officedocument.wordprocessingml.document":
                    "docx",
                  msword: "doc",
                  "vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                    "xlsx",
                  "vnd.ms-excel": "xls",
                  "vnd.openxmlformats-officedocument.presentationml.presentation":
                    "pptx",
                  "vnd.ms-powerpoint": "ppt",
                };
                extension = traductorMime[mimeCrudo] || mimeCrudo;
              }

              if (EXTENSIONES_PROHIBIDAS.includes(extension)) {
                console.log(
                  `⏩ Archivo .${extension} ignorado por filtro de exclusión.`,
                );
                continue;
              }

              let filename = media.filename;
              if (!filename) {
                const huellaDigital = crypto
                  .createHash("md5")
                  .update(media.data)
                  .digest("hex")
                  .substring(0, 10);
                filename = `archivo_${huellaDigital}${extension ? `.${extension}` : ""}`;
              }

              const bufferMedia = Buffer.from(media.data, "base64");
              const hashMd5 = crypto
                .createHash("md5")
                .update(bufferMedia)
                .digest("hex");

              // 🔍 0. DETECCIÓN INSTANTÁNEA POR HASH DE CONTENIDO (MD5)
              if (DETECTAR_DUPLICADOS_HASH && mapaHashes.has(hashMd5)) {
                const yaExiste = mapaHashes.get(hashMd5);
                console.log(
                  `🔁 Archivo idéntico ya existe en Drive (MD5: ${hashMd5}) como "${yaExiste.name}". Omitiendo subida...`,
                );
                archivosOmitidos++;
                continue;
              }

              // Extraer contexto de mensaje citado si el usuario está respondiendo a otro mensaje
              let textoCitado = "";
              if (msg.hasQuotedMsg) {
                try {
                  const quotedMsg = await msg.getQuotedMessage();
                  textoCitado = quotedMsg
                    ? quotedMsg.body || quotedMsg.caption || ""
                    : "";
                } catch (errQuoted) {
                  // Continuar si falla la lectura del mensaje citado
                }
              }

              // 🧠 1. CLASIFICACIÓN INTELIGENTE (MOTOR HÍBRIDO LOCAL + GEMINI FLASH)
              const textoMensaje = msg.body || msg.caption || "";
              const resultadoClasif = await clasificarArchivo({
                filename,
                textoMensaje,
                textoCitado,
                bufferMedia,
              });

              const materia = resultadoClasif.materia;
              const tipo = resultadoClasif.tipo;

              console.log(
                `🧠 Clasificado: "${materia}" / "${tipo}" [Método: ${resultadoClasif.metodo || "local"}, Confianza: ${Math.round((resultadoClasif.confianza || 0.8) * 100)}%]`,
              );
              if (resultadoClasif.razon) {
                console.log(`   💡 Razón: ${resultadoClasif.razon}`);
              }

              // 🏷️ Nombre estandarizado y embellecido
              let filenameFinal = filename;
              if (ESTANDARIZAR_NOMBRES) {
                filenameFinal = generarNombreEstandar({
                  nombreOriginal: filename,
                  materia,
                  tipo,
                });
                if (filenameFinal !== filename) {
                  console.log(
                    `🏷️ Nombre estandarizado: "${filename}" ➡️ "${filenameFinal}"`,
                  );
                }
              }

              // 📂 2. CREACIÓN Y BÚSQUEDA DE LAS CARPETAS EN DRIVE
              const idCarpetaMateria = await obtenerOCrearCarpeta(
                materia,
                DRIVE_FOLDER_ID,
              );
              const idSubcarpetaFinal = await obtenerOCrearCarpeta(
                tipo,
                idCarpetaMateria,
              );

              // 🔍 3. VERIFICACIÓN DE DUPLICADOS POR NOMBRE
              const yaExiste = await existeArchivoEnDrive(
                filenameFinal,
                idSubcarpetaFinal,
              );

              if (yaExiste) {
                console.log(
                  `🔁 Archivo repetido: "${filenameFinal}" ya está en la carpeta ${materia}/${tipo}. Omitiendo...`,
                );
                archivosOmitidos++;
                continue;
              }

              // ☁️ 4. SUBIMOS EL ARCHIVO
              const subidoExitoso = await subirADrive(
                media,
                filenameFinal,
                idSubcarpetaFinal,
              );

              // Actualización estadísticas para el reporte solo si la subida fue exitosa
              if (subidoExitoso) {
                archivosSubidos++;
                if (DETECTAR_DUPLICADOS_HASH) {
                  mapaHashes.set(hashMd5, { name: filenameFinal });
                }
                const claveTipo = extension || "otro";
                detalleTipos[claveTipo] = (detalleTipos[claveTipo] || 0) + 1;
              }

              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          } catch (err) {
            console.error("❌ Error al procesar archivo:", err.message);
          }
        }
      }

      // =========================================================
      // AQUÍ TERMINA EL PROCESO DE LOS MENSAJES
      // =========================================================

      // --- REPORTE FINAL ---
      if (enlacesGuardados > 0) {
        console.log("☁️ Sincronizando enlaces con Google Drive...");
        const rutaCsv = path.join(process.cwd(), "enlaces.csv");
        await sincronizarCSVDrive(
          "Enlaces_Guardados",
          rutaCsv,
          DRIVE_FOLDER_ID,
        );
      }

      if (archivosSubidos > 0 && AUTO_ACTUALIZAR_INDICE) {
        console.log("📑 Actualizando y sincronizando el Índice de la Biblioteca en Drive...");
        try {
          const { generarYSincronizarIndice } = await import("./indice.js");
          await generarYSincronizarIndice({ subirADrive: true });
        } catch (errIndice) {
          console.error("⚠️ Error actualizando índice:", errIndice.message);
        }
      }

      const fechaActual = new Date().toLocaleString("es-CL");

      let mensajeReporte = `*Reporte de Respaldo a Drive por Golgi bot* ☁️\n\n`;
      mensajeReporte += `🔗 *Link al drive:* https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}?usp=sharing\n`;
      mensajeReporte += `📅 *Fecha:* ${fechaActual}\n`;
      mensajeReporte += `📩 *Mensajes analizados:* ${messagesToProcess.length}\n`;
      mensajeReporte += `✅ *Archivos respaldados:* ${archivosSubidos}\n`;

      if (enlacesGuardados > 0) {
        mensajeReporte += `🌐 *Enlaces capturados:* ${enlacesGuardados}\n`;
      }
      if (archivosOmitidos > 0) {
        mensajeReporte += `⏭️ *Archivos omitidos (duplicados):* ${archivosOmitidos}\n`;
      }

      if (archivosSubidos > 0) {
        mensajeReporte += `\n*Detalle por tipo:*\n`;
        for (const [tipo, cantidad] of Object.entries(detalleTipos)) {
          mensajeReporte += `📄 ${tipo.toUpperCase()}: ${cantidad}\n`;
        }
        mensajeReporte += `\n📁 _Archivos ordenados automáticamente por materia y tipo._`;
      } else if (archivosOmitidos > 0) {
        mensajeReporte += `\n*(Todos los archivos encontrados ya estaban en el Drive)*`;
      } else {
        mensajeReporte += `\n*(Ningún archivo nuevo superó el filtro)*`;
      }

      // --- ENVÍO CON PAUSA LARGA PARA COMUNIDADES ---
      try {
        console.log("⏳ Enviando reporte al grupo...");
        await chat.sendMessage(mensajeReporte);
        console.log("📝 ¡Orden de envío generada!");

        console.log(
          "⏳ Esperando 30 segundos para asegurar la entrega del mensaje...",
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } catch (errMsg) {
        console.error("❌ ERROR AL ENVIAR:", errMsg.message);
      }
    }

    const idMasReciente = messages[messages.length - 1].id._serialized;
    guardarUltimoId(idMasReciente);

    await shutdownBot();
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    await shutdownBot();
  }
});

async function shutdownBot() {
  console.log("🛑 Apagando bot...");
  await client.destroy();
  process.exit(0);
}

async function arrancar() {
  console.log("🚀 Iniciando sistema...");
  await iniciarDrive();
  client.initialize();
}

arrancar();
