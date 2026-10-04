const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("golgiAPI", {
  // Control de bot y tareas
  startBot: () => ipcRenderer.invoke("bot:start"),
  stopBot: () => ipcRenderer.invoke("bot:stop"),
  getStatus: () => ipcRenderer.invoke("bot:status"),
  ordenarDrive: () => ipcRenderer.invoke("bot:ordenar"),
  actualizarWeb: () => ipcRenderer.invoke("bot:actualizar-web"),

  // Configuración
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getCategorias: () => ipcRenderer.invoke("categorias:get"),
  saveCategorias: (data) => ipcRenderer.invoke("categorias:save", data),
  detectarGrupos: () => ipcRenderer.invoke("whatsapp:detectar-grupos"),

  // Utilidades del sistema
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),

  // Eventos reactivos desde el proceso principal
  onLog: (callback) => ipcRenderer.on("bot:log", (_event, data) => callback(data)),
  onStatusChange: (callback) =>
    ipcRenderer.on("bot:status-changed", (_event, data) => callback(data)),
  onQR: (callback) => ipcRenderer.on("bot:qr", (_event, data) => callback(data)),
  onReady: (callback) => ipcRenderer.on("bot:ready", (_event, data) => callback(data)),
});
