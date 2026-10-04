import fs from "fs";
import path from "path";
import readline from "readline";

const RUTA_ENV = path.join(process.cwd(), ".env");

function crearInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function preguntar(rl, pregunta) {
  return new Promise((resolve) => rl.question(pregunta, resolve));
}

function extraerIdDrive(input) {
  if (!input) return "";
  const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return input.trim();
}

function leerEnvExistente() {
  const valores = {
    GENERACION: "2026",
    TARGET_GROUP_ID: "",
    DRIVE_FOLDER_ID: "",
    GITHUB_REPO: "eduu37/golgi-bot",
    GITHUB_TOKEN: "",
    GITHUB_PAGES_URL: "",
    GEMINI_API_KEY: "",
  };
  if (fs.existsSync(RUTA_ENV)) {
    const raw = fs.readFileSync(RUTA_ENV, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        valores[match[1]] = match[2].trim();
      }
    }
  }
  return valores;
}

function guardarEnv(valores) {
  const gen = (valores.GENERACION || "2026").trim().replace(/[^a-zA-Z0-9_-]/g, "");

  const contenido = `# ============================================================
# GOLGI BOT — CONFIGURACIÓN DE LA GENERACIÓN
# Modificado por el Asistente de Configuración
# ============================================================

# Generación oficial del curso (ej: 2026, 2027)
GENERACION=${gen}

# ID del grupo de WhatsApp oficial de la generación
TARGET_GROUP_ID=${valores.TARGET_GROUP_ID || ""}

# ID de la carpeta de Google Drive donde se guardan los archivos
DRIVE_FOLDER_ID=${valores.DRIVE_FOLDER_ID || ""}

# Repositorio y publicación web (GitHub Pages)
GITHUB_REPO=${valores.GITHUB_REPO || "eduu37/golgi-bot"}
GITHUB_TOKEN=${valores.GITHUB_TOKEN || ""}
GITHUB_PAGES_URL=${valores.GITHUB_PAGES_URL || ""}

# Clave de API de Google Gemini (opcional, para clasificación con IA)
GEMINI_API_KEY=${valores.GEMINI_API_KEY || ""}
`;

  fs.writeFileSync(RUTA_ENV, contenido, "utf8");
}

async function detectarGrupoConWhatsApp() {
  console.log("\n⏳ Iniciando conexión con WhatsApp para detectar grupos...");
  console.log("   (Si es la primera vez, aparecerá un código QR para escanear)\n");

  const { default: wwebjs } = await import("whatsapp-web.js");
  const { default: qrcode } = await import("qrcode-terminal");
  const { Client, LocalAuth } = wwebjs;

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  return new Promise((resolve) => {
    client.on("qr", (qr) => {
      console.log("\n📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:");
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", async () => {
      console.log("\n✅ ¡WhatsApp conectado exitosamente!\n");
      try {
        const chats = await client.getChats();
        const grupos = chats.filter((c) => c.isGroup);

        if (grupos.length > 0) {
          console.log("📋 Selecciona tu grupo de la lista:");
          grupos.slice(0, 15).forEach((g, i) => {
            console.log(`   [${i + 1}] ${g.name}`);
          });
          console.log(`   [0] Enviar un mensaje desde mi teléfono en el grupo deseado`);

          const rl = crearInterface();
          const seleccion = await preguntar(rl, "\nIngresa el número de tu grupo: ");
          rl.close();

          const idx = parseInt(seleccion, 10);
          if (idx > 0 && idx <= grupos.length) {
            const elegido = grupos[idx - 1];
            console.log(`\n🎉 Grupo seleccionado: "${elegido.name}" (${elegido.id._serialized})`);
            await client.destroy();
            return resolve(elegido.id._serialized);
          }
        }
      } catch (errChats) {
        console.log("ℹ️ Buscando grupo por mensaje en tiempo real...");
      }

      console.log("\n📲 Ve a tu teléfono y envía un mensaje cualquiera en el grupo que quieres usar...");

      client.on("message_create", async (msg) => {
        const chatID = msg.id.remote;
        if (chatID.endsWith("@g.us")) {
          console.log(`\n🎉 ¡Grupo detectado! ID: ${chatID}`);
          await client.destroy();
          resolve(chatID);
        }
      });
    });

    client.initialize().catch((err) => {
      console.error("❌ Error iniciando cliente WhatsApp:", err.message);
      resolve("");
    });
  });
}

export async function iniciarConfigurador() {
  console.clear();
  console.log("============================================================");
  console.log("  🧬 ASISTENTE DE CONFIGURACIÓN FÁCIL — GOLGI BOT");
  console.log("============================================================");
  console.log("Este asistente te guiará para configurar el bot para tu curso");
  console.log("sin necesidad de tocar archivos de código ni terminales raras.\n");

  const actual = leerEnvExistente();
  const rl = crearInterface();

  // 1. GENERACIÓN DEL CURSO
  console.log("🎓 PASO 1: GENERACIÓN DEL CURSO");
  console.log("   Año de ingreso o cohorte de tu generación (ej: 2026, 2027).");
  const actualGen = actual.GENERACION || "2026";
  const inputGen = await preguntar(
    rl,
    `   Ingresa tu generación [Enter para mantener "${actualGen}"]: `,
  );
  if (inputGen.trim()) {
    actual.GENERACION = inputGen.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    console.log(`   ✅ Generación asignada: ${actual.GENERACION}\n`);
  } else {
    actual.GENERACION = actualGen;
    console.log(`   ➡️ Generación: ${actual.GENERACION}\n`);
  }

  // 2. CARPETA DE DRIVE
  console.log("📁 PASO 2: CARPETA DE GOOGLE DRIVE");
  console.log("   Crea una carpeta en Google Drive para tu generación y copia su enlace.");
  if (actual.DRIVE_FOLDER_ID) {
    console.log(`   (ID actual guardado: ${actual.DRIVE_FOLDER_ID})`);
  }
  const inputDrive = await preguntar(
    rl,
    "   Pega el enlace o ID de tu carpeta de Drive (Enter para mantener): ",
  );
  if (inputDrive.trim()) {
    actual.DRIVE_FOLDER_ID = extraerIdDrive(inputDrive);
    console.log(`   ✅ ID de Drive extraído: ${actual.DRIVE_FOLDER_ID}\n`);
  } else {
    console.log(`   ➡️ Se mantiene la carpeta actual.\n`);
  }

  // 3. GEMINI API KEY (OPCIONAL)
  console.log("🧠 PASO 3: CLAVE DE GEMINI AI (CLASIFICADOR INTELIGENTE)");
  console.log("   Puedes obtener una clave gratuita en: https://aistudio.google.com/app/apikey");
  if (actual.GEMINI_API_KEY) {
    console.log(`   (Clave actual: ${actual.GEMINI_API_KEY.slice(0, 8)}...)`);
  }
  const inputGemini = await preguntar(
    rl,
    "   Pega tu clave de Gemini (Enter para omitir o mantener actual): ",
  );
  if (inputGemini.trim()) {
    actual.GEMINI_API_KEY = inputGemini.trim();
    console.log(`   ✅ Clave de Gemini guardada.\n`);
  } else {
    console.log(`   ➡️ Sin cambios en Gemini.\n`);
  }

  // 4. GRUPO DE WHATSAPP
  console.log("💬 PASO 4: GRUPO DE WHATSAPP");
  if (actual.TARGET_GROUP_ID) {
    console.log(`   (Grupo actual vinculado: ${actual.TARGET_GROUP_ID})`);
  }
  console.log("   ¿Cómo deseas obtener el ID del grupo?");
  console.log("   [1] Conectar WhatsApp y seleccionarlo automáticamente (Recomendado)");
  console.log("   [2] Escribir o pegar el ID manualmente");
  console.log("   [3] Mantener el grupo actual y terminar");

  const opcionGrupo = await preguntar(rl, "\n   Elige una opción (1, 2 o 3): ");

  if (opcionGrupo.trim() === "1") {
    rl.close();
    const idDetectado = await detectarGrupoConWhatsApp();
    if (idDetectado) {
      actual.TARGET_GROUP_ID = idDetectado;
    }
  } else if (opcionGrupo.trim() === "2") {
    const idManual = await preguntar(rl, "   Pega el ID del grupo (ej: 120363xxx@g.us): ");
    if (idManual.trim()) {
      actual.TARGET_GROUP_ID = idManual.trim();
    }
    rl.close();
  } else {
    console.log("   ➡️ Se mantiene el grupo actual.");
    rl.close();
  }

  // Guardar archivo .env
  guardarEnv(actual);

  console.log("\n============================================================");
  console.log("  ✨ ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!");
  console.log("============================================================");
  console.log(`  🎓 Generación:        ${actual.GENERACION || "2026"}`);
  console.log(`  📁 Carpeta de Drive:  ${actual.DRIVE_FOLDER_ID || "Sin configurar"}`);
  console.log(`  💬 Grupo de WhatsApp: ${actual.TARGET_GROUP_ID || "Sin configurar"}`);
  console.log(`  🧠 Gemini AI:         ${actual.GEMINI_API_KEY ? "Configurado" : "Sin configurar (usará reglas locales)"}`);
  console.log("============================================================");
  console.log("\nYa puedes cerrar esta ventana y ejecutar el bot cuando quieras.\n");
}

if (process.argv[1] && process.argv[1].endsWith("configurador.js")) {
  iniciarConfigurador()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error en configuración:", err.message);
      process.exit(1);
    });
}
