// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('pageTitle');
const pageDesc = document.getElementById('pageDesc');

// Status & Controls
const globalStatusDot = document.getElementById('globalStatusDot');
const globalStatusText = document.getElementById('globalStatusText');
const heroBadge = document.getElementById('heroBadge');
const heroBadgeText = document.getElementById('heroBadgeText');
const heroTitle = document.getElementById('heroTitle');
const heroDesc = document.getElementById('heroDesc');
const btnToggleBot = document.getElementById('btnToggleBot');
const btnBotIcon = document.getElementById('btnBotIcon');
const btnBotText = document.getElementById('btnBotText');

// QR Code
const qrCard = document.getElementById('qrCard');
const qrImage = document.getElementById('qrImage');

// Actions & Logs
const btnRunOrdenar = document.getElementById('btnRunOrdenar');
const btnRunActualizar = document.getElementById('btnRunActualizar');
const btnOpenWeb = document.getElementById('btnOpenWeb');
const btnClearLogs = document.getElementById('btnClearLogs');
const logsTerminal = document.getElementById('logsTerminal');

// Settings Form
const settingsForm = document.getElementById('settingsForm');
const inputGeneracion = document.getElementById('inputGeneracion');
const inputDrive = document.getElementById('inputDrive');
const inputGroup = document.getElementById('inputGroup');
const inputPagesUrl = document.getElementById('inputPagesUrl');
const inputGemini = document.getElementById('inputGemini');
const btnDetectGroup = document.getElementById('btnDetectGroup');
const saveFeedback = document.getElementById('saveFeedback');

// Subjects
const subjectsList = document.getElementById('subjectsList');
const btnAddSubject = document.getElementById('btnAddSubject');
const btnSaveSubjects = document.getElementById('btnSaveSubjects');
const saveSubjectsFeedback = document.getElementById('saveSubjectsFeedback');

let currentStatus = 'detenido';
let categoriasData = { materias: {}, tipos: {} };

// ============================================================
// 1. NAVEGACIÓN ENTRE PESTAÑAS
// ============================================================
const tabMeta = {
  'tab-dashboard': {
    title: 'Panel de Control',
    desc: 'Supervisión y control del bot de WhatsApp y sincronización con Google Drive.',
  },
  'tab-settings': {
    title: 'Configuración',
    desc: 'Personaliza la carpeta de Google Drive y el grupo de WhatsApp que usará el bot.',
  },
  'tab-subjects': {
    title: 'Materias y Asignaturas',
    desc: 'Administra las materias de tu año para que el bot clasifique los apuntes de forma exacta.',
  },
};

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    navItems.forEach((n) => n.classList.remove('active'));
    tabPanes.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    const pane = document.getElementById(tabId);
    if (pane) pane.classList.add('active');

    if (tabMeta[tabId]) {
      pageTitle.textContent = tabMeta[tabId].title;
      pageDesc.textContent = tabMeta[tabId].desc;
    }
  });
});

// ============================================================
// 2. ACTUALIZACIÓN DE ESTADO VISUAL
// ============================================================
function actualizarEstadoUI(estado, qr = null) {
  currentStatus = estado;

  if (estado === 'activo') {
    globalStatusDot.className = 'status-dot dot-online';
    globalStatusText.textContent = 'En Línea';

    heroBadge.className = 'hero-status-badge active';
    heroBadgeText.textContent = 'Bot Activo';
    heroTitle.textContent = 'Monitoreando WhatsApp';
    heroDesc.textContent = 'El bot está escuchando el grupo y respaldará cualquier archivo o enlace automáticamente.';

    btnToggleBot.className = 'btn btn-danger btn-large';
    btnBotIcon.textContent = '⏹️';
    btnBotText.textContent = 'Detener Bot';

    qrCard.style.display = 'none';
  } else if (estado === 'conectando') {
    globalStatusDot.className = 'status-dot dot-connecting';
    globalStatusText.textContent = 'Conectando...';

    heroBadge.className = 'hero-status-badge';
    heroBadgeText.textContent = 'Iniciando Conexión';
    heroTitle.textContent = 'Conectando con WhatsApp...';
    heroDesc.textContent = qr ? 'Escanea el código QR que se muestra abajo para iniciar sesión.' : 'Iniciando navegador y cliente de WhatsApp...';

    btnToggleBot.className = 'btn btn-secondary btn-large';
    btnBotIcon.textContent = '⏳';
    btnBotText.textContent = 'Cancelar';

    if (qr) {
      qrImage.src = qr;
      qrCard.style.display = 'block';
    }
  } else {
    // detenido
    globalStatusDot.className = 'status-dot dot-offline';
    globalStatusText.textContent = 'Desconectado';

    heroBadge.className = 'hero-status-badge';
    heroBadgeText.textContent = 'Servicio en Pausa';
    heroTitle.textContent = 'El bot está detenido';
    heroDesc.textContent = 'Presiona Iniciar para conectar con WhatsApp, monitorear el grupo y respaldar apuntes automáticamente.';

    btnToggleBot.className = 'btn btn-primary btn-large';
    btnBotIcon.textContent = '▶️';
    btnBotText.textContent = 'Iniciar Bot';

    qrCard.style.display = 'none';
  }
}

// Botón Toggle Iniciar / Detener
btnToggleBot.addEventListener('click', async () => {
  if (currentStatus === 'detenido') {
    actualizarEstadoUI('conectando');
    await window.golgiAPI.startBot();
  } else {
    await window.golgiAPI.stopBot();
    actualizarEstadoUI('detenido');
  }
});

// ============================================================
// 3. REGISTRO DE EVENTOS (LOGS)
// ============================================================
function agregarLog(mensaje, tipo = 'info', timestamp = null) {
  const time = timestamp || new Date().toLocaleTimeString('es-CL');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${tipo}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${escapeHtml(mensaje)}</span>`;
  logsTerminal.appendChild(entry);
  logsTerminal.scrollTop = logsTerminal.scrollHeight;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

btnClearLogs.addEventListener('click', () => {
  logsTerminal.innerHTML = '';
});

// Acciones Rápidas
btnRunOrdenar.addEventListener('click', async () => {
  btnRunOrdenar.disabled = true;
  btnRunOrdenar.textContent = 'Ejecutando...';
  await window.golgiAPI.ordenarDrive();
  btnRunOrdenar.disabled = false;
  btnRunOrdenar.textContent = 'Ejecutar';
});

btnRunActualizar.addEventListener('click', async () => {
  btnRunActualizar.disabled = true;
  btnRunActualizar.textContent = 'Publicando...';
  await window.golgiAPI.actualizarWeb();
  btnRunActualizar.disabled = false;
  btnRunActualizar.textContent = 'Publicar';
});

let currentPagesUrl = 'https://eduu37.github.io/golgi-bot/';

btnOpenWeb.addEventListener('click', () => {
  window.golgiAPI.openExternal(currentPagesUrl);
});

// ============================================================
// 4. CONFIGURACIÓN (.env)
// ============================================================
async function cargarConfiguracion() {
  const datos = await window.golgiAPI.getSettings();
  if (inputGeneracion) inputGeneracion.value = datos.GENERACION || '2026';
  inputDrive.value = datos.DRIVE_FOLDER_ID || '';
  inputGroup.value = datos.TARGET_GROUP_ID || '';
  inputGemini.value = datos.GEMINI_API_KEY || '';
  if (datos.GITHUB_PAGES_URL) {
    currentPagesUrl = datos.GITHUB_PAGES_URL;
    if (inputPagesUrl) inputPagesUrl.value = datos.GITHUB_PAGES_URL;
  }
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const settings = {
    GENERACION: inputGeneracion ? inputGeneracion.value.trim() : '2026',
    DRIVE_FOLDER_ID: inputDrive.value.trim(),
    TARGET_GROUP_ID: inputGroup.value.trim(),
    GEMINI_API_KEY: inputGemini.value.trim(),
  };

  const res = await window.golgiAPI.saveSettings(settings);
  if (res.ok) {
    if (res.driveId) inputDrive.value = res.driveId;
    if (res.pagesUrl) {
      currentPagesUrl = res.pagesUrl;
      if (inputPagesUrl) inputPagesUrl.value = res.pagesUrl;
    }
    saveFeedback.textContent = '✅ Guardado con éxito';
    setTimeout(() => { saveFeedback.textContent = ''; }, 3000);
  }
});

btnDetectGroup.addEventListener('click', async () => {
  btnDetectGroup.disabled = true;
  btnDetectGroup.textContent = '⏳ Escaneando...';
  agregarLog('Iniciando detector de grupos de WhatsApp...', 'info');

  const res = await window.golgiAPI.detectarGrupos();
  btnDetectGroup.disabled = false;
  btnDetectGroup.textContent = '🔍 Detectar Grupos';

  if (res.ok && res.grupos && res.grupos.length > 0) {
    const nombres = res.grupos.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
    const elegidaStr = prompt(`Selecciona el número de tu grupo:\n\n${nombres}\n\nIngresa el número:`);
    const idx = parseInt(elegidaStr, 10);
    if (idx > 0 && idx <= res.grupos.length) {
      const g = res.grupos[idx - 1];
      inputGroup.value = g.id;
      agregarLog(`Grupo asignado: "${g.name}" (${g.id})`, 'success');
    }
  } else {
    alert('No se pudieron obtener grupos automáticamente. Puedes pegar el ID manualmente.');
  }
});

// ============================================================
// 5. MATERIAS Y ASIGNATURAS (categorias.json)
// ============================================================
async function cargarCategorias() {
  categoriasData = await window.golgiAPI.getCategorias();
  renderizarMaterias();
}

function renderizarMaterias() {
  subjectsList.innerHTML = '';
  const materias = categoriasData.materias || {};

  Object.entries(materias).forEach(([materia, palabras]) => {
    const item = document.createElement('div');
    item.className = 'subject-item';

    const tagsHtml = (palabras || [])
      .slice(0, 8)
      .map((p) => `<span class="keyword-tag">${escapeHtml(p)}</span>`)
      .join('');

    item.innerHTML = `
      <div>
        <div class="subject-name">${escapeHtml(materia)}</div>
        <div class="subject-keywords">${tagsHtml}</div>
      </div>
      <button class="btn-delete-subject" title="Eliminar materia" data-materia="${escapeHtml(materia)}">🗑️</button>
    `;

    subjectsList.appendChild(item);
  });

  // Listeners de eliminar
  document.querySelectorAll('.btn-delete-subject').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mat = btn.getAttribute('data-materia');
      if (confirm(`¿Eliminar la materia "${mat}"?`)) {
        delete categoriasData.materias[mat];
        renderizarMaterias();
      }
    });
  });
}

btnAddSubject.addEventListener('click', () => {
  const nombre = prompt('Ingresa el nombre de la nueva materia (ej: Pediatría, Farmacología):');
  if (!nombre || !nombre.trim()) return;

  const palabrasStr = prompt('Ingresa palabras clave separadas por comas (ej: fármaco, dosis, receta):');
  const palabras = palabrasStr ? palabrasStr.split(',').map((p) => p.trim()).filter(Boolean) : [];

  if (!categoriasData.materias) categoriasData.materias = {};
  categoriasData.materias[nombre.trim()] = palabras;
  renderizarMaterias();
});

btnSaveSubjects.addEventListener('click', async () => {
  const res = await window.golgiAPI.saveCategorias(categoriasData);
  if (res.ok) {
    saveSubjectsFeedback.textContent = '✅ Materias guardadas';
    setTimeout(() => { saveSubjectsFeedback.textContent = ''; }, 3000);
  }
});

// ============================================================
// 6. EVENTOS DESDE ELECTRON MAIN
// ============================================================
window.golgiAPI.onLog((data) => {
  agregarLog(data.mensaje, data.tipo, data.timestamp);
});

window.golgiAPI.onStatusChange((data) => {
  actualizarEstadoUI(data.estado, data.qr);
});

window.golgiAPI.onQR((qrDataUrl) => {
  actualizarEstadoUI('conectando', qrDataUrl);
});

window.golgiAPI.onReady(() => {
  actualizarEstadoUI('activo');
  agregarLog('¡El bot está en línea y conectado a WhatsApp!', 'success');
});

// Inicialización
cargarConfiguracion();
cargarCategorias();
