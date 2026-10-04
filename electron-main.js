import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import { obtenerUrlBibliotecaWeb } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let botProcess = null;
let currentStatus = "detenido"; // "detenido" | "conectando" | "activo"
let lastQR = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 750,
    minWidth: 900,
    minHeight: 620,
    title: "Golgi Bot — Gestor de Biblioteca Digital",
    backgroundColor: "#0a0e17",
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, "app", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
    detenerProcesoBot();
  });
}

function enviarLog(mensaje, tipo = "info") {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bot:log", {
      timestamp: new Date().toLocaleTimeString("es-CL"),
      mensaje,
      tipo,
    });
  }
}

function cambiarEstado(nuevoEstado) {
  currentStatus = nuevoEstado;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bot:status-changed", {
      estado: currentStatus,
      qr: lastQR,
    });
  }
}

function detenerProcesoBot() {
  if (botProcess) {
    try {
      botProcess.kill();
    } catch {}
    botProcess = null;
  }
  cambiarEstado("detenido");
  lastQR = null;
}

// ============================================================
// IPC HANDLERS
// ============================================================

// 1. Iniciar Bot
ipcMain.handle("bot:start", async () => {
  if (botProcess) {
    return { ok: false, error: "El bot ya está en ejecución." };
  }

  cambiarEstado("conectando");
  enviarLog("🚀 Iniciando servicio de Golgi Bot...", "info");

  botProcess = fork(path.join(__dirname, "index.js"), [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  botProcess.stdout.on("data", async (data) => {
    const texto = data.toString();
    const lineas = texto.split(/\r?\n/).filter(Boolean);

    for (const linea of lineas) {
      enviarLog(linea, "info");

      if (linea.includes("¡El bot está LISTO") || linea.includes("Bot conectado")) {
        cambiarEstado("activo");
        lastQR = null;
        if (mainWindow) mainWindow.webContents.send("bot:ready");
      }
    }
  });

  botProcess.stderr.on("data", (data) => {
    enviarLog(data.toString().trim(), "error");
  });

  botProcess.on("exit", (code) => {
    enviarLog(`🛑 Proceso finalizado con código ${code}`, code === 0 ? "info" : "warn");
    detenerProcesoBot();
  });

  return { ok: true };
});

// 2. Detener Bot
ipcMain.handle("bot:stop", async () => {
  enviarLog("🛑 Deteniendo Golgi Bot...", "warn");
  detenerProcesoBot();
  return { ok: true };
});

// 3. Estado actual
ipcMain.handle("bot:status", () => {
  return {
    estado: currentStatus,
    qr: lastQR,
  };
});

// 4. Ordenar Drive
ipcMain.handle("bot:ordenar", async () => {
  enviarLog("📁 Ejecutando Clasificador y Ordenador de Drive...", "info");
  return new Promise((resolve) => {
    const p = fork(path.join(__dirname, "ordenador.js"), [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    p.stdout.on("data", (data) => enviarLog(data.toString().trim(), "info"));
    p.stderr.on("data", (data) => enviarLog(data.toString().trim(), "error"));
    p.on("exit", (code) => {
      enviarLog(`✅ Ordenamiento de Drive finalizado (código ${code})`, "success");
      resolve({ ok: code === 0 });
    });
  });
});

// 5. Actualizar Biblioteca Web
ipcMain.handle("bot:actualizar-web", async () => {
  enviarLog("🌐 Regenerando y sincronizando Biblioteca Digital...", "info");
  return new Promise((resolve) => {
    const p = fork(path.join(__dirname, "indice.js"), [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    p.stdout.on("data", (data) => enviarLog(data.toString().trim(), "info"));
    p.stderr.on("data", (data) => enviarLog(data.toString().trim(), "error"));
    p.on("exit", (code) => {
      enviarLog(`✅ Biblioteca digital actualizada (código ${code})`, "success");
      resolve({ ok: code === 0 });
    });
  });
});

// 6. Leer y Guardar Configuración (.env)
ipcMain.handle("settings:get", () => {
  const rutaEnv = path.join(__dirname, ".env");
  const datos = {
    DRIVE_FOLDER_ID: "",
    TARGET_GROUP_ID: "",
    GEMINI_API_KEY: "",
    GENERACION: "2026",
    GITHUB_REPO: "eduu37/golgi-bot",
    GITHUB_TOKEN: "",
    GITHUB_PAGES_URL: "",
  };

  if (fs.existsSync(rutaEnv)) {
    const raw = fs.readFileSync(rutaEnv, "utf8");
    for (const linea of raw.split(/\r?\n/)) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m) datos[m[1]] = m[2].trim();
    }
  }

  if (!datos.GITHUB_PAGES_URL) {
    datos.GITHUB_PAGES_URL = obtenerUrlBibliotecaWeb(datos.GENERACION || "2026");
  }

  return datos;
});

ipcMain.handle("settings:save", (_event, settings) => {
  const rutaEnv = path.join(__dirname, ".env");
  let driveId = settings.DRIVE_FOLDER_ID || "";
  const match = driveId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) driveId = match[1];

  const gen = (settings.GENERACION || "2026").trim().replace(/[^a-zA-Z0-9_-]/g, "");

  const contenido = `# ============================================================
# GOLGI BOT — VARIABLES DE ENTORNO
# Modificado desde la Aplicación de Escritorio
# ============================================================
GENERACION=${gen}
TARGET_GROUP_ID=${settings.TARGET_GROUP_ID || ""}
DRIVE_FOLDER_ID=${driveId}
GITHUB_REPO=${settings.GITHUB_REPO || "eduu37/golgi-bot"}
GITHUB_TOKEN=${settings.GITHUB_TOKEN || ""}
GITHUB_PAGES_URL=${settings.GITHUB_PAGES_URL || ""}
GEMINI_API_KEY=${settings.GEMINI_API_KEY || ""}
`;

  fs.writeFileSync(rutaEnv, contenido, "utf8");
  enviarLog("💾 Configuración guardada en .env", "success");
  return { ok: true, driveId, pagesUrl: settings.GITHUB_PAGES_URL, generacion: gen };
});

// 7. Leer y Guardar Categorías (categorias.json)
ipcMain.handle("categorias:get", () => {
  const rutaJson = path.join(__dirname, "categorias.json");
  if (fs.existsSync(rutaJson)) {
    try {
      return JSON.parse(fs.readFileSync(rutaJson, "utf8"));
    } catch {}
  }
  return { materias: {}, tipos: {} };
});

ipcMain.handle("categorias:save", (_event, data) => {
  const rutaJson = path.join(__dirname, "categorias.json");
  fs.writeFileSync(rutaJson, JSON.stringify(data, null, 2), "utf8");
  enviarLog("📚 Materias y categorías actualizadas en categorias.json", "success");
  return { ok: true };
});

// 8. Abrir enlaces en el navegador predeterminado
ipcMain.handle("shell:open-external", (_event, url) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    shell.openExternal(url);
  }
});

// 9. Detectar Grupos de WhatsApp
ipcMain.handle("whatsapp:detectar-grupos", async () => {
  enviarLog("🔍 Iniciando detector de grupos de WhatsApp...", "info");
  const { default: wwebjs } = await import("whatsapp-web.js");
  const { Client, LocalAuth } = wwebjs;

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  return new Promise((resolve) => {
    client.on("qr", async (qr) => {
      enviarLog("📱 Código QR generado para escanear.", "info");
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        lastQR = qrDataUrl;
        cambiarEstado("conectando");
        if (mainWindow) {
          mainWindow.webContents.send("bot:qr", qrDataUrl);
        }
      } catch (err) {
        enviarLog("Error generando imagen QR: " + err.message, "error");
      }
    });

    client.on("ready", async () => {
      enviarLog("✅ WhatsApp conectado. Obteniendo lista de grupos...", "success");
      try {
        const chats = await client.getChats();
        const grupos = chats
          .filter((c) => c.isGroup)
          .map((g) => ({
            id: g.id._serialized,
            name: g.name,
          }));

        await client.destroy();
        lastQR = null;
        cambiarEstado("detenido");
        resolve({ ok: true, grupos });
      } catch (err) {
        await client.destroy();
        resolve({ ok: false, error: err.message, grupos: [] });
      }
    });

    client.initialize().catch((err) => {
      enviarLog("❌ Error conectando WhatsApp: " + err.message, "error");
      resolve({ ok: false, error: err.message, grupos: [] });
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  detenerProcesoBot();
  if (process.platform !== "darwin") app.quit();
});
