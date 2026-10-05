import fs from "fs";
import path from "path";
import {
  DRIVE_FOLDER_ID,
  AUTO_PUBLICAR_GITHUB,
  GENERACION,
  GITHUB_REPO,
  GITHUB_TOKEN,
  GITHUB_BRANCH,
  GITHUB_PAGES_URL,
  GITHUB_PAGES_GENERACION_URL,
  APPS_SCRIPT_URL,
} from "./config.js";
import {
  iniciarDrive,
  obtenerDriveClient,
  sincronizarArchivoEnDrive,
  sincronizarCSVDrive,
} from "./drive.js";
import { clasificarArchivo } from "./clasificador.js";
import { limpiarNombre } from "./renombrador.js";

// ============================================================
// FORMATO Y UTILIDADES
// ============================================================
function formatearBytes(bytes) {
  if (!bytes || bytes === "0") return "—";
  const num = parseInt(bytes, 10);
  if (isNaN(num)) return "—";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

function formatearFecha(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function obtenerExtensionYTipo(nombre) {
  const ext = path.extname(nombre || "").toLowerCase().replace(".", "");
  const mapaIconos = {
    pdf: { badge: "PDF", icon: "📄", color: "#ef4444" },
    docx: { badge: "DOCX", icon: "📝", color: "#2563eb" },
    doc: { badge: "DOC", icon: "📝", color: "#2563eb" },
    pptx: { badge: "PPTX", icon: "📊", color: "#ea580c" },
    ppt: { badge: "PPT", icon: "📊", color: "#ea580c" },
    xlsx: { badge: "XLSX", icon: "📈", color: "#16a34a" },
    xls: { badge: "XLS", icon: "📈", color: "#16a34a" },
    apkg: { badge: "ANKI", icon: "🧠", color: "#ec4899" },
    html: { badge: "HTML", icon: "🌐", color: "#06b6d4" },
    mp4: { badge: "VIDEO", icon: "🎬", color: "#8b5cf6" },
    mp3: { badge: "AUDIO", icon: "🎵", color: "#a855f7" },
  };
  return mapaIconos[ext] || { badge: ext.toUpperCase() || "FILE", icon: "📁", color: "#64748b" };
}

// ============================================================
// 1. RECOPILACIÓN INTELIGENTE DE ENLACES WEB (YOUTUBE, DOCS, NOTEBOOKLM)
// ============================================================
export async function recopilarEnlacesWeb() {
  const rutaCsv = path.join(process.cwd(), "enlaces.csv");
  if (!fs.existsSync(rutaCsv)) return [];

  console.log("🔗 Procesando enlaces y videos web desde enlaces.csv...");
  const raw = fs.readFileSync(rutaCsv, "utf8");
  const lineas = raw.split(/\r?\n/).filter(Boolean).slice(1);
  const linksVistos = new Set();
  const catalogoLinks = [];

  for (const linea of lineas) {
    const partes = linea.split('","').map((s) => s.replace(/^"|"$/g, "").trim());
    if (partes.length < 4) continue;
    const [url, materiaCsv, tipoCsv, fechaCsv] = partes;

    if (!url || !url.startsWith("http") || linksVistos.has(url)) continue;
    linksVistos.add(url);

    let nombre = url;
    let autor = "";
    let materia = materiaCsv;
    let tipo = tipoCsv === "Documentos sin clasificar" ? "Recursos Web" : tipoCsv;
    let badge = "WEB";
    let icon = "🌐";
    let colorIcono = "#38bdf8";
    let subtexto = "Enlace Web";
    let actionLabel = "Visitar Enlace ↗";

    const urlLower = url.toLowerCase();

    if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
      badge = "YOUTUBE";
      icon = "▶️";
      colorIcono = "#ef4444";
      subtexto = "Video / Clase";
      tipo =
        tipo === "Documentos sin clasificar" || tipo === "Recursos Web"
          ? "Clases y Videos"
          : tipo;
      actionLabel = "Ver Video ▶️";

      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          { signal: AbortSignal.timeout(3000) },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.title) nombre = data.title;
          if (data.author_name) autor = data.author_name;
        }
      } catch { }
    } else if (urlLower.includes("docs.google.com/document")) {
      badge = "DOCS";
      icon = "📝";
      colorIcono = "#2563eb";
      subtexto = "Google Docs";
      actionLabel = "Abrir Documento ↗";
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const html = await res.text();
          const m = html.match(/<title>([^<]+)<\/title>/i);
          if (m && m[1]) {
            nombre = m[1].replace(/\s*-\s*Documentos de Google/i, "").trim();
          }
        }
      } catch { }
    } else if (urlLower.includes("docs.google.com/spreadsheets")) {
      badge = "SHEETS";
      icon = "📈";
      colorIcono = "#16a34a";
      subtexto = "Google Sheets";
      actionLabel = "Abrir Planilla ↗";
      nombre = "Planilla / Base de Datos Compartida";
    } else if (urlLower.includes("drive.google.com/drive/folders")) {
      badge = "CARPETA";
      icon = "📂";
      colorIcono = "#f59e0b";
      subtexto = "Carpeta en Drive";
      actionLabel = "Explorar Carpeta 📂";
      nombre = `Carpeta de Recursos: ${materia !== "Sin clasificar" ? materia : "Drive"}`;
    } else if (urlLower.includes("notebook.google.com") || urlLower.includes("notebooklm")) {
      badge = "NOTEBOOKLM";
      icon = "📓";
      colorIcono = "#8b5cf6";
      subtexto = "Cuaderno IA";
      actionLabel = "Abrir Cuaderno 📓";
      nombre = `Cuaderno NotebookLM ${materia !== "Sin clasificar" ? "— " + materia : ""}`;
    } else if (urlLower.includes("claude.ai")) {
      badge = "CLAUDE";
      icon = "✨";
      colorIcono = "#d97706";
      subtexto = "Artefacto IA";
      actionLabel = "Ver Artefacto ✨";
      nombre = "Artefacto Interactivo Claude AI";
    }

    // Reclasificación si estaba sin clasificar
    if (materia === "Sin clasificar" && nombre !== url) {
      const reclass = await clasificarArchivo(nombre, "");
      if (reclass.materia !== "Sin clasificar") {
        materia = reclass.materia;
        if (tipo === "Recursos Web") tipo = reclass.tipo;
      }
    }

    catalogoLinks.push({
      id: `link-${catalogoLinks.length + 1}`,
      nombreOriginal: url,
      nombreLimpio: nombre,
      materia,
      tipo,
      extension: "link",
      badge,
      icon,
      colorIcono,
      sizeBytes: 0,
      sizeFormateado: subtexto,
      createdTime: null,
      fechaFormateada: fechaCsv || "—",
      url,
      esDuplicado: false,
      esEnlaceWeb: true,
      autor,
      actionLabel,
    });
  }

  return catalogoLinks;
}

// ============================================================
// 2. RECOPILACIÓN INTELIGENTE DEL CATÁLOGO DESDE DRIVE + ENLACES
// ============================================================
export async function recopilarCatalogoDrive() {
  await iniciarDrive();
  const drive = obtenerDriveClient();

  console.log("🔍 Consultando estructura completa de Google Drive...");
  const respuesta = await drive.files.list({
    pageSize: 1000,
    fields: "files(id, name, mimeType, parents, size, createdTime, md5Checksum, webViewLink)",
    q: "trashed = false",
  });

  const todos = respuesta.data.files || [];
  const mapaPorId = new Map();
  todos.forEach((item) => mapaPorId.set(item.id, item));

  // Identificamos carpetas
  const carpetas = todos.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const mapaNombresCarpetas = new Map();
  carpetas.forEach((c) => mapaNombresCarpetas.set(c.id, c.name));

  // Mapa de hashes para detectar duplicados
  const hashesVistos = new Map();
  const idsDuplicados = new Set();
  for (const f of todos) {
    if (f.mimeType === "application/vnd.google-apps.folder") continue;
    if (f.md5Checksum) {
      if (hashesVistos.has(f.md5Checksum)) {
        idsDuplicados.add(f.id);
      } else {
        hashesVistos.set(f.md5Checksum, f.id);
      }
    }
  }

  // Filtramos archivos documentales (excluimos carpetas e índices previos)
  const nombresExcluidos = new Set([
    "Enlaces_Guardados",
    "Enlaces_Guardados.csv",
    "INDICE_BIBLIOTECA",
    "INDICE_BIBLIOTECA.html",
    "INDICE_BIBLIOTECA.csv",
    "INDICE_BIBLIOTECA.md",
  ]);

  const itemsDocumentales = todos.filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder" && !nombresExcluidos.has(f.name),
  );

  let totalBytes = 0;
  const catalogoArchivos = [];

  for (const item of itemsDocumentales) {
    const parentFolder = item.parents ? mapaPorId.get(item.parents[0]) : null;
    const grandParentFolder =
      parentFolder && parentFolder.parents ? mapaPorId.get(parentFolder.parents[0]) : null;

    let materia = "Sin clasificar";
    let tipo = "Varios";

    if (grandParentFolder && grandParentFolder.name && parentFolder && parentFolder.name) {
      materia = grandParentFolder.name;
      tipo = parentFolder.name;
    } else if (parentFolder && parentFolder.name) {
      if (parentFolder.name === "_Duplicados") {
        materia = "_Duplicados";
        tipo = "Repetidos";
      } else {
        materia = parentFolder.name;
      }
    }

    if (materia === "Sin clasificar" || materia === "root") {
      const resultado = await clasificarArchivo(item.name, "");
      materia = resultado.materia;
      tipo = resultado.tipo;
    }

    const sizeNum = parseInt(item.size || "0", 10);
    totalBytes += isNaN(sizeNum) ? 0 : sizeNum;

    const infoExt = obtenerExtensionYTipo(item.name);
    const esDuplicado = idsDuplicados.has(item.id) || materia === "_Duplicados";

    catalogoArchivos.push({
      id: item.id,
      nombreOriginal: item.name,
      nombreLimpio: limpiarNombre(item.name),
      materia,
      tipo,
      extension: path.extname(item.name).toLowerCase().replace(".", ""),
      badge: infoExt.badge,
      icon: infoExt.icon,
      colorIcono: infoExt.color,
      sizeBytes: sizeNum,
      sizeFormateado: formatearBytes(item.size),
      createdTime: item.createdTime,
      fechaFormateada: formatearFecha(item.createdTime),
      url: item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`,
      md5Checksum: item.md5Checksum || "",
      esDuplicado,
      esEnlaceWeb: false,
      autor: "",
      actionLabel: "Abrir en Drive ↗",
    });
  }

  // Recopilar enlaces web externos
  const catalogoEnlaces = await recopilarEnlacesWeb();

  // Catálogo unificado
  const catalogoCombinado = [...catalogoArchivos, ...catalogoEnlaces];

  // Ordenamos alfabéticamente por Materia -> Tipo -> Nombre
  catalogoCombinado.sort((a, b) => {
    if (a.materia !== b.materia) return a.materia.localeCompare(b.materia, "es");
    if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo, "es");
    return a.nombreLimpio.localeCompare(b.nombreLimpio, "es");
  });

  // Agrupamos por Materia y Tipo para estadísticas
  const materiasMap = {};
  for (const doc of catalogoCombinado) {
    if (doc.esDuplicado) continue;
    if (!materiasMap[doc.materia]) {
      materiasMap[doc.materia] = { total: 0, tipos: {}, archivos: 0, enlaces: 0 };
    }
    materiasMap[doc.materia].total++;
    if (doc.esEnlaceWeb) {
      materiasMap[doc.materia].enlaces = (materiasMap[doc.materia].enlaces || 0) + 1;
    } else {
      materiasMap[doc.materia].archivos = (materiasMap[doc.materia].archivos || 0) + 1;
    }
    materiasMap[doc.materia].tipos[doc.tipo] =
      (materiasMap[doc.materia].tipos[doc.tipo] || 0) + 1;
  }

  return {
    fechaGeneracion: new Date().toISOString(),
    totalArchivos: catalogoArchivos.length,
    totalEnlaces: catalogoEnlaces.length,
    totalItems: catalogoCombinado.length,
    totalBytes,
    totalBytesFormateado: formatearBytes(totalBytes),
    duplicadosDetectados: idsDuplicados.size,
    materiasMap,
    items: catalogoCombinado,
  };
}

// ============================================================
// 3. GENERADOR HTML (MODERNO, GLASSMORPHISM, BUSCADOR REACTIVO)
// ============================================================
export function generarHtmlIndice(datos, generacion = GENERACION) {
  const {
    fechaGeneracion,
    totalArchivos,
    totalEnlaces,
    totalItems,
    totalBytesFormateado,
    duplicadosDetectados,
    items,
    materiasMap,
  } = datos;

  const listaMaterias = Object.keys(materiasMap).sort((a, b) => a.localeCompare(b, "es"));
  const fechaTexto = new Date(fechaGeneracion).toLocaleString("es-CL", {
    dateStyle: "full",
    timeStyle: "short",
  });

  // Opciones de píldoras de materias
  const pillsMaterias = listaMaterias
    .map(
      (m) =>
        `<button class="filter-pill filter-pill-materia" data-materia="${m}">${m} <span class="pill-count">${materiasMap[m].total}</span></button>`,
    )
    .join("\n");

  // Opciones de píldoras de tipo
  const listaTipos = Array.from(new Set(items.map((it) => it.tipo))).filter(Boolean).sort();
  const pillsTipos = listaTipos
    .map(
      (t) =>
        `<button class="filter-pill filter-pill-tipo" data-tipo="${t}">${t}</button>`,
    )
    .join("\n");

  // Serializamos items en JSON para el cliente
  const itemsJsonSeguro = JSON.stringify(items).replace(/</g, "\\u003c");

  // Lista completa de asignaturas para el modal de clasificar
  let todasMaterias = [];
  try {
    const cats = JSON.parse(fs.readFileSync(path.join(process.cwd(), "categorias.json"), "utf8"));
    if (cats.materias) todasMaterias = Object.keys(cats.materias);
  } catch {}
  if (todasMaterias.length === 0) todasMaterias = listaMaterias;
  todasMaterias = Array.from(new Set([...todasMaterias, ...listaMaterias]))
    .filter((m) => m !== "Sin clasificar" && m !== "_Duplicados" && m !== "root")
    .sort((a, b) => a.localeCompare(b, "es"));

  const optionsMateriasClasificar = todasMaterias
    .map((m) => `<option value="${m}">${m}</option>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biblioteca Digital — Generación ${generacion}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #0a0e17;
      --bg-card: rgba(18, 24, 38, 0.7);
      --bg-card-hover: rgba(26, 35, 54, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-active: rgba(56, 189, 248, 0.4);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-cyan: #38bdf8;
      --accent-teal: #14b8a6;
      --accent-emerald: #10b981;
      --accent-purple: #a855f7;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --glass-blur: blur(16px);
      --shadow-card: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      line-height: 1.5;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(56, 189, 248, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 25%, rgba(168, 85, 247, 0.07) 0%, transparent 40%),
        radial-gradient(circle at 50% 85%, rgba(16, 185, 129, 0.06) 0%, transparent 50%);
      background-attachment: fixed;
    }

    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    /* HEADER */
    header {
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 2rem;
    }

    .portal-nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--accent-cyan);
      text-decoration: none;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 500;
      transition: all 0.2s ease;
      margin-bottom: 0.85rem;
    }

    .portal-nav-btn:hover {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--accent-cyan);
      transform: translateX(-2px);
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent-cyan);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      margin-bottom: 1rem;
    }

    .header-badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-cyan);
      box-shadow: 0 0 10px var(--accent-cyan);
    }

    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.6rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 800px;
    }

    /* STATS GRID */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1.75rem;
    }

    .stat-card {
      background: var(--bg-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 1.15rem 1.25rem;
      transition: all 0.2s ease;
    }

    .stat-card:hover {
      border-color: var(--border-active);
      transform: translateY(-2px);
    }

    .stat-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-dim);
      font-weight: 600;
      margin-bottom: 0.35rem;
    }

    .stat-val {
      font-family: 'Outfit', sans-serif;
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
    }

    /* CONTROLS (SEARCH & FILTERS) - COMPLETAMENTE ESTÁTICO (NO STICKY) */
    .controls-panel,
    .search-wrapper,
    .filters-row,
    .origin-tabs {
      position: static !important;
      top: auto !important;
      bottom: auto !important;
    }

    .controls-panel {
      background: rgba(10, 14, 23, 0.88);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 1.25rem;
      margin-bottom: 2rem;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
    }

    /* ORIGIN TABS (TODOS / DRIVE / ENLACES) */
    .origin-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.15rem;
      flex-wrap: wrap;
    }

    .origin-tab {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 0.55rem 1.1rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .origin-tab:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.2);
    }

    .origin-tab.active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2));
      border-color: var(--accent-cyan);
      color: #fff;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    }

    .tab-count {
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.35);
      color: var(--text-muted);
    }

    .origin-tab.active .tab-count {
      background: rgba(56, 189, 248, 0.3);
      color: #fff;
    }

    .search-wrapper {
      position: relative;
      margin-bottom: 1rem;
    }

    .search-icon {
      position: absolute;
      left: 1.1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.1rem;
      color: var(--text-dim);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      background: rgba(18, 24, 38, 0.9);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      color: #fff;
      font-family: inherit;
      font-size: 1rem;
      padding: 0.85rem 1rem 0.85rem 3rem;
      outline: none;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
    }

    .search-input::placeholder {
      color: var(--text-dim);
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .filter-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      margin-right: 0.5rem;
    }

    .filter-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.15s ease;
    }

    .filter-pill:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    .filter-pill.active {
      background: var(--accent-cyan);
      border-color: var(--accent-cyan);
      color: #041019;
      font-weight: 700;
    }

    .pill-count {
      font-size: 0.75rem;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.25);
    }

    .filter-pill.active .pill-count {
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
    }

    /* RESULTS SUMMARY */
    .results-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      padding: 0 0.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* CARDS GRID */
    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1rem;
    }

    .file-card {
      background: var(--bg-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: var(--shadow-card);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .file-card:hover {
      background: var(--bg-card-hover);
      border-color: rgba(56, 189, 248, 0.3);
      transform: translateY(-3px);
      box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.6);
    }

    .file-card-top {
      display: flex;
      gap: 0.85rem;
      margin-bottom: 1rem;
    }

    .file-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-title {
      font-weight: 600;
      font-size: 0.98rem;
      color: #fff;
      word-break: break-word;
      line-height: 1.35;
      margin-bottom: 0.35rem;
    }

    .file-author {
      font-size: 0.78rem;
      color: var(--accent-cyan);
      margin-bottom: 0.45rem;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .file-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      align-items: center;
    }

    .tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.18rem 0.5rem;
      border-radius: 6px;
      text-transform: capitalize;
    }

    .tag-materia {
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent-cyan);
      border: 1px solid rgba(56, 189, 248, 0.25);
    }

    .tag-tipo {
      background: rgba(168, 85, 247, 0.12);
      color: var(--accent-purple);
      border: 1px solid rgba(168, 85, 247, 0.25);
    }

    .tag-ext {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-dim);
      font-weight: 700;
      font-size: 0.68rem;
    }

    .tag-badge-YOUTUBE {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .tag-badge-DOCS {
      background: rgba(37, 99, 235, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }

    .tag-badge-SHEETS {
      background: rgba(22, 163, 74, 0.15);
      color: #4ade80;
      border: 1px solid rgba(22, 163, 74, 0.3);
    }

    .tag-badge-CARPETA {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .tag-badge-NOTEBOOKLM {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.3);
    }

    .tag-badge-CLAUDE {
      background: rgba(217, 119, 6, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(217, 119, 6, 0.3);
    }

    .tag-badge-WEB {
      background: rgba(6, 182, 212, 0.15);
      color: #22d3ee;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }

    .tag-dupe {
      background: rgba(244, 63, 94, 0.15);
      color: var(--accent-rose);
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    .file-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    .file-actions {
      display: flex;
      gap: 0.4rem;
      margin-top: 0.85rem;
    }

    .btn-open {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent-cyan);
      border: 1px solid rgba(56, 189, 248, 0.25);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      transition: all 0.15s ease;
    }

    .btn-open:hover {
      background: var(--accent-cyan);
      color: #041019;
    }

    .btn-open-yt {
      background: rgba(239, 68, 68, 0.14);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.35);
    }

    .btn-open-yt:hover {
      background: #ef4444;
      color: #fff;
    }

    .btn-open-notebook {
      background: rgba(168, 85, 247, 0.14);
      color: #d8b4fe;
      border-color: rgba(168, 85, 247, 0.35);
    }

    .btn-open-notebook:hover {
      background: #a855f7;
      color: #fff;
    }

    .btn-copy {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
      padding: 0.55rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.15s ease;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    /* EMPTY STATE */
    .empty-state {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--text-muted);
      display: none;
      grid-column: 1 / -1;
    }

    /* MODAL CLASIFICACIÓN MANUAL */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(4, 7, 13, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      padding: 1.5rem;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-box {
      width: 100%;
      max-width: 540px;
      background: linear-gradient(150deg, #131b2a 0%, #0d121c 100%);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 18px;
      box-shadow: 0 25px 65px -10px rgba(0, 0, 0, 0.8), 0 0 30px -5px rgba(245, 158, 11, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalPop {
      0% { transform: scale(0.95); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .modal-close-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-dim);
      font-size: 1.4rem;
      line-height: 1;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .modal-close-btn:hover {
      background: rgba(244, 63, 94, 0.2);
      border-color: rgba(244, 63, 94, 0.4);
      color: #fff;
    }

    .modal-select {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      font-family: inherit;
      font-size: 0.92rem;
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      outline: none;
      transition: all 0.2s ease;
    }

    .modal-select:focus {
      border-color: var(--accent-amber);
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.25);
    }

    .modal-select option {
      background: #131b2a;
      color: #fff;
    }

    .btn-classify {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.18));
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
      font-size: 0.83rem;
      font-weight: 700;
      padding: 0.55rem 0.85rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn-classify:hover {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #041019;
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }

    .tag-unclassified {
      background: rgba(245, 158, 11, 0.15) !important;
      color: #fbbf24 !important;
      border: 1px solid rgba(245, 158, 11, 0.35) !important;
      font-weight: 700 !important;
    }

    .btn-move-drive {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      text-decoration: none;
      border: 1px solid rgba(56, 189, 248, 0.3);
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
    }

    .btn-move-drive:hover {
      background: linear-gradient(135deg, #38bdf8, #0284c7);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(56, 189, 248, 0.4);
    }

    .btn-notify-wa {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.2));
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.4);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 0.95rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-notify-wa:hover {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff;
      transform: translateY(-1px);
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-dim);
      font-size: 0.85rem;
      font-weight: 500;
      padding: 0.55rem 0.95rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .btn-move-direct {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #fff;
      font-size: 0.88rem;
      font-weight: 700;
      padding: 0.65rem 1.25rem;
      border-radius: 9px;
      border: 1px solid rgba(16, 185, 129, 0.4);
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-move-direct:hover:not(:disabled) {
      background: linear-gradient(135deg, #34d399, #10b981);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
    }

    .btn-move-direct:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      filter: grayscale(0.4);
      transform: none !important;
    }

    .modal-status-box {
      border-radius: 10px;
      padding: 0.85rem 1rem;
      font-size: 0.84rem;
      line-height: 1.45;
      display: none;
      animation: fadeIn 0.2s ease-out;
    }

    .status-loading {
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent-cyan);
    }

    .status-success {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
    }

    .status-error {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.4);
      color: #fb7185;
    }

    .status-config {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
    }

    .modal-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 0.55rem 0.75rem;
      color: #fff;
      font-size: 0.85rem;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }

    .modal-input:focus {
      border-color: var(--accent-amber);
    }

    .secondary-options-toggle {
      font-size: 0.78rem;
      color: var(--text-dim);
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      text-align: left;
      transition: color 0.15s ease;
    }

    .secondary-options-toggle:hover {
      color: #fff;
    }

    /* FOOTER */
    footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border-subtle);
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    @media (max-width: 640px) {
      .container { padding: 1.5rem 1rem; }
      h1 { font-size: 1.85rem; }
      .files-grid { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <a href="../" class="portal-nav-btn">
          <span>⬅️</span>
          <span>Todas las Generaciones</span>
        </a>
      </div>
      <div class="header-badge">
        <span class="header-badge-dot"></span>
        🎓 Generación ${generacion}
      </div>
      <h1>Biblioteca Digital — Generación ${generacion}</h1>
      <p class="subtitle">Materiales de estudio, certámenes y enlaces oficiales recopilados por Golgi Bot</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Documentos Drive</div>
          <div class="stat-val" id="stat-archivos">${totalArchivos}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Enlaces y Videos</div>
          <div class="stat-val" id="stat-enlaces" style="color: var(--accent-cyan);">${totalEnlaces}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Materias</div>
          <div class="stat-val">${listaMaterias.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Almacenamiento Drive</div>
          <div class="stat-val">${totalBytesFormateado}</div>
        </div>
      </div>
    </header>

    <div class="controls-panel">
      <!-- Selector de Origen -->
      <div class="origin-tabs">
        <button class="origin-tab active" data-origen="todos">
          <span>🌟 Todo el Material</span>
          <span class="tab-count">${totalItems}</span>
        </button>
        <button class="origin-tab" data-origen="drive">
          <span>📄 Archivos Drive</span>
          <span class="tab-count">${totalArchivos}</span>
        </button>
        <button class="origin-tab" data-origen="links">
          <span>🔗 Enlaces y Videos Web</span>
          <span class="tab-count">${totalEnlaces}</span>
        </button>
      </div>

      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input 
          type="text" 
          id="searchInput" 
          class="search-input" 
          placeholder="Buscar por tema, video, certamen, profe (ej: ATM, somitos, fecundación, anki, YouTube)..."
          autocomplete="off"
        >
      </div>

      <div class="filters-row">
        <span class="filter-label">Materia:</span>
        <button class="filter-pill filter-pill-materia active" data-materia="todas">Todas <span class="pill-count">${totalItems}</span></button>
        ${pillsMaterias}
      </div>

      <div class="filters-row" style="margin-top: 0.65rem;">
        <span class="filter-label">Tipo:</span>
        <button class="filter-pill filter-pill-tipo active" data-tipo="todos">Todos</button>
        ${pillsTipos}
      </div>
    </div>

    <div class="results-info">
      <div>Mostrando <strong id="visibleCount" style="color: #fff;">${totalItems}</strong> recursos</div>
      <div style="font-size: 0.8rem; color: var(--text-dim);">Última sincronización: ${fechaTexto}</div>
    </div>

    <div class="files-grid" id="filesGrid"></div>

    <div class="empty-state" id="emptyState">
      <div class="empty-icon">🔎</div>
      <h3>No se encontraron recursos</h3>
      <p>Prueba con otros términos de búsqueda o selecciona otra materia.</p>
    </div>

    <!-- MODAL DE CLASIFICACIÓN MANUAL -->
    <div class="modal-overlay" id="modalClasificar" style="display: none;">
      <div class="modal-box">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.5rem;">🏷️</span>
            <div>
              <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0;">Clasificar Documento</h3>
              <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.15rem;">Asigna la materia correcta a este recurso.</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="cerrarModalClasificar()">&times;</button>
        </div>

        <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.95rem;">
          <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 0.85rem 1rem;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 0.25rem;">Archivo a Clasificar:</div>
            <div id="modalClasificarNombre" style="font-size: 0.95rem; font-weight: 600; color: #fff; word-break: break-word;"></div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">📚 ¿A qué Asignatura pertenece?</label>
            <select id="selectMateriaClasificar" class="modal-select">
              ${optionsMateriasClasificar}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">📂 ¿Qué Tipo de Recurso es?</label>
            <select id="selectTipoClasificar" class="modal-select">
              <option value="Apuntes">Apuntes / Clases</option>
              <option value="Certámenes">Certámenes</option>
              <option value="Controles">Controles</option>
              <option value="Seminarios">Seminarios</option>
              <option value="Resúmenes">Resúmenes</option>
              <option value="Guías">Guías / Talleres</option>
              <option value="Libros">Libros</option>
              <option value="Varios">Varios</option>
            </select>
          </div>

          <!-- CAJA DE ESTADO / ALERTAS DINÁMICAS -->
          <div id="modalStatusBox" class="modal-status-box"></div>

          <!-- CAJA DE CONFIGURACIÓN RÁPIDA (SI NO SE HA CONFIGURADO LA URL DE APPS SCRIPT) -->
          <div id="modalConfigBox" class="modal-status-box status-config" style="display: none;">
            <div style="font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>⚡</span> Activar Mover con 1 Clic (Google Apps Script)
            </div>
            <p style="font-size: 0.8rem; margin-bottom: 0.5rem; line-height: 1.4;">
              Pega aquí la URL de tu aplicación web de Google Apps Script:
            </p>
            <div style="display: flex; gap: 0.4rem;">
              <input type="url" id="inputAppsScriptUrl" class="modal-input" placeholder="https://script.google.com/macros/s/.../exec">
              <button type="button" class="btn-classify" style="padding: 0.45rem 0.85rem;" onclick="guardarUrlAppsScriptModal()">Guardar</button>
            </div>
          </div>

          <!-- OPCIONES ALTERNATIVAS / MANUALES -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 0.65rem;">
            <button type="button" class="secondary-options-toggle" onclick="toggleOpcionesSecundarias()">
              ➕ Ver opciones alternativas (Mover manual en Drive o WhatsApp)...
            </button>
            <div id="opcionesSecundarias" style="display: none; margin-top: 0.75rem; flex-direction: column; gap: 0.6rem;">
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn-notify-wa" id="btnNotificarWA" onclick="notificarClasificacionWA()">💬 Notificar por WhatsApp</button>
                <a href="#" target="_blank" rel="noopener noreferrer" class="btn-move-drive" id="btnMoverEnDrive">📁 Abrir y Mover en Drive ↗</a>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; gap: 0.6rem;">
          <button type="button" class="btn-cancel" onclick="cerrarModalClasificar()">Cerrar</button>
          <button type="button" class="btn-move-direct" id="btnMoverDirecto" onclick="ejecutarMoverDirecto()">
            <span>⚡ Mover en Drive Ahora</span>
          </button>
        </div>
      </div>
    </div>

    <footer>
      Generado automáticamente por <strong>Golgi bot.</strong>
    </footer>
  </div>

  <script>
    const CATALOGO = ${itemsJsonSeguro};
    let origenActivo = 'todos';
    let materiaActiva = 'todas';
    let tipoActivo = 'todos';
    let terminoBusqueda = '';

    const grid = document.getElementById('filesGrid');
    const emptyState = document.getElementById('emptyState');
    const visibleCount = document.getElementById('visibleCount');
    const searchInput = document.getElementById('searchInput');
    const tabsOrigen = document.querySelectorAll('.origin-tab');
    const pillsMateria = document.querySelectorAll('.filter-pill-materia');
    const pillsTipo = document.querySelectorAll('.filter-pill-tipo');

    function renderizar() {
      const normalizar = (txt) => (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = normalizar(terminoBusqueda);

      const filtrados = CATALOGO.filter(item => {
        // Filtro por pestaña de origen
        if (origenActivo === 'drive' && item.esEnlaceWeb) return false;
        if (origenActivo === 'links' && !item.esEnlaceWeb) return false;

        // Filtro por materia
        if (materiaActiva !== 'todas' && item.materia !== materiaActiva) return false;

        // Filtro por tipo de documento
        if (tipoActivo !== 'todos' && item.tipo !== tipoActivo) return false;

        // Filtro por buscador reactivo
        if (query) {
          const matchNombre = normalizar(item.nombreLimpio).includes(query);
          const matchOriginal = normalizar(item.nombreOriginal).includes(query);
          const matchMateria = normalizar(item.materia).includes(query);
          const matchTipo = normalizar(item.tipo).includes(query);
          const matchBadge = normalizar(item.badge).includes(query);
          const matchExt = normalizar(item.extension).includes(query);
          const matchAutor = item.autor ? normalizar(item.autor).includes(query) : false;
          if (!matchNombre && !matchOriginal && !matchMateria && !matchTipo && !matchBadge && !matchExt && !matchAutor) {
            return false;
          }
        }
        return true;
      });

      visibleCount.textContent = filtrados.length;

      if (filtrados.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      grid.innerHTML = filtrados.map(item => {
        const esYt = item.badge === 'YOUTUBE';
        const esNotebook = item.badge === 'NOTEBOOKLM';
        const btnClase = esYt ? 'btn-open btn-open-yt' : (esNotebook ? 'btn-open btn-open-notebook' : 'btn-open');
        const badgeClase = item.esEnlaceWeb ? ('tag tag-badge-' + item.badge) : 'tag tag-ext';
        const esSinClasificar = (item.materia || '').toLowerCase().includes('sin clasificar');
        const tagMateriaClase = esSinClasificar ? 'tag tag-materia tag-unclassified' : 'tag tag-materia';
        const tagMateriaTexto = esSinClasificar ? '⚠️ Sin clasificar' : item.materia;

        return \`
          <div class="file-card">
            <div>
              <div class="file-card-top">
                <div class="file-icon-box" style="color: \${item.colorIcono};">
                  \${item.icon}
                </div>
                <div class="file-info">
                  <div class="file-title" title="\${item.nombreOriginal}">\${item.nombreLimpio}</div>
                  \${item.autor ? \`<div class="file-author"><span>👤 \${item.autor}</span></div>\` : ''}
                  <div class="file-tags">
                    <span class="\${tagMateriaClase}">\${tagMateriaTexto}</span>
                    <span class="tag tag-tipo">\${item.tipo}</span>
                    <span class="tag \${badgeClase}">\${item.badge}</span>
                    \${item.esDuplicado ? '<span class="tag tag-dupe">Repetido</span>' : ''}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="file-meta">
                <span>\${item.sizeFormateado}</span>
                <span>\${item.fechaFormateada}</span>
              </div>
              <div class="file-actions">
                \${esSinClasificar ? \`
                  <button type="button" class="btn-classify" onclick="abrirModalClasificar('\${item.id}')" title="Asignar materia adecuada">
                    🏷️ Clasificar
                  </button>
                \` : ''}
                <a href="\${item.url}" target="_blank" rel="noopener noreferrer" class="\${btnClase}">
                  \${item.actionLabel || (item.esEnlaceWeb ? 'Visitar Enlace ↗' : 'Abrir en Drive ↗')}
                </a>
                <button class="btn-copy" onclick="copiarEnlace('\${item.url}', this)" title="Copiar enlace directo">
                  📋
                </button>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Buscador en tiempo real
    searchInput.addEventListener('input', (e) => {
      terminoBusqueda = e.target.value;
      renderizar();
    });

    // Pestañas de origen (Todos / Drive / Enlaces)
    tabsOrigen.forEach(tab => {
      tab.addEventListener('click', () => {
        tabsOrigen.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        origenActivo = tab.getAttribute('data-origen');
        renderizar();
      });
    });

    // Filtros de materia
    pillsMateria.forEach(pill => {
      pill.addEventListener('click', () => {
        pillsMateria.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        materiaActiva = pill.getAttribute('data-materia');
        renderizar();
      });
    });

    // Filtros de tipo
    pillsTipo.forEach(pill => {
      pill.addEventListener('click', () => {
        pillsTipo.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        tipoActivo = pill.getAttribute('data-tipo');
        renderizar();
      });
    });

    // Copiar enlace al portapapeles
    window.copiarEnlace = function(url, btn) {
      navigator.clipboard.writeText(url).then(() => {
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '✅';
        setTimeout(() => { btn.innerHTML = textoOriginal; }, 1500);
      });
    };

    // Modal de clasificación manual y Webhook de Google Apps Script
    let itemAClasificar = null;
    const APPS_SCRIPT_URL_COMPILED = "${APPS_SCRIPT_URL}";
    const modalClasificar = document.getElementById('modalClasificar');
    const modalClasificarNombre = document.getElementById('modalClasificarNombre');
    const selectMateriaClasificar = document.getElementById('selectMateriaClasificar');
    const selectTipoClasificar = document.getElementById('selectTipoClasificar');
    const btnMoverEnDrive = document.getElementById('btnMoverEnDrive');
    const btnMoverDirecto = document.getElementById('btnMoverDirecto');
    const modalStatusBox = document.getElementById('modalStatusBox');
    const modalConfigBox = document.getElementById('modalConfigBox');
    const opcionesSecundarias = document.getElementById('opcionesSecundarias');

    function obtenerAppsScriptUrl() {
      return APPS_SCRIPT_URL_COMPILED || localStorage.getItem('golgi_apps_script_url') || '';
    }

    window.guardarUrlAppsScriptModal = function() {
      const input = document.getElementById('inputAppsScriptUrl');
      const url = (input ? input.value : '').trim();
      if (!url.startsWith('https://script.google.com/')) {
        alert('Por favor ingresa una URL válida de Google Apps Script (debe empezar con https://script.google.com/)');
        return;
      }
      localStorage.setItem('golgi_apps_script_url', url);
      if (modalConfigBox) modalConfigBox.style.display = 'none';
      mostrarEstadoModal('success', '✅ URL de Google Apps Script guardada con éxito. ¡Ya puedes mover con 1 clic!');
    };

    window.toggleOpcionesSecundarias = function() {
      if (opcionesSecundarias) {
        opcionesSecundarias.style.display = opcionesSecundarias.style.display === 'none' ? 'flex' : 'none';
      }
    };

    function mostrarEstadoModal(tipo, mensaje) {
      if (!modalStatusBox) return;
      modalStatusBox.className = 'modal-status-box status-' + tipo;
      modalStatusBox.innerHTML = mensaje;
      modalStatusBox.style.display = 'block';
    }

    function ocultarEstadoModal() {
      if (modalStatusBox) {
        modalStatusBox.style.display = 'none';
        modalStatusBox.innerHTML = '';
      }
    }

    window.abrirModalClasificar = function(id) {
      itemAClasificar = CATALOGO.find(it => String(it.id) === String(id));
      if (!itemAClasificar) return;

      modalClasificarNombre.textContent = itemAClasificar.nombreLimpio || itemAClasificar.nombreOriginal;
      btnMoverEnDrive.href = itemAClasificar.url;
      ocultarEstadoModal();

      if (btnMoverDirecto) {
        btnMoverDirecto.disabled = false;
        btnMoverDirecto.innerHTML = '<span>⚡ Mover en Drive Ahora</span>';
      }

      if (opcionesSecundarias) opcionesSecundarias.style.display = 'none';

      const scriptUrl = obtenerAppsScriptUrl();
      if (!scriptUrl && modalConfigBox) {
        modalConfigBox.style.display = 'block';
      } else if (modalConfigBox) {
        modalConfigBox.style.display = 'none';
      }

      modalClasificar.style.display = 'flex';
    };

    window.cerrarModalClasificar = function() {
      if (modalClasificar) modalClasificar.style.display = 'none';
      itemAClasificar = null;
      ocultarEstadoModal();
    };

    window.ejecutarMoverDirecto = async function() {
      if (!itemAClasificar) return;
      const urlScript = obtenerAppsScriptUrl();
      if (!urlScript) {
        if (modalConfigBox) modalConfigBox.style.display = 'block';
        mostrarEstadoModal('config', '⚠️ Para mover automáticamente con 1 clic, primero ingresa la URL de tu Google Apps Script arriba.');
        return;
      }

      const materia = selectMateriaClasificar ? selectMateriaClasificar.value : '';
      const tipo = selectTipoClasificar ? selectTipoClasificar.value : 'Apuntes';

      if (!materia) {
        mostrarEstadoModal('error', '⚠️ Debes seleccionar una asignatura destino.');
        return;
      }

      try {
        if (btnMoverDirecto) {
          btnMoverDirecto.disabled = true;
          btnMoverDirecto.innerHTML = '<span>⏳ Moviendo en Drive...</span>';
        }
        mostrarEstadoModal('loading', '⏳ Moviendo <strong>' + itemAClasificar.nombreLimpio + '</strong> a <strong>' + materia + ' / ' + tipo + '</strong> en Google Drive...');

        const payload = {
          fileId: itemAClasificar.id,
          materia: materia,
          tipo: tipo
        };

        const res = await fetch(urlScript, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.ok) {
          mostrarEstadoModal('success', '✅ ¡Listo! <strong>' + itemAClasificar.nombreLimpio + '</strong> fue movido con éxito a <strong>' + materia + ' / ' + tipo + '</strong> en Google Drive.');
          if (btnMoverDirecto) btnMoverDirecto.innerHTML = '<span>✅ ¡Movido con éxito!</span>';

          // Actualizar dinámicamente en el catálogo local
          itemAClasificar.materia = materia;
          itemAClasificar.tipo = tipo;

          // Re-renderizar después de breve pausa y cerrar modal
          setTimeout(() => {
            renderizar();
            cerrarModalClasificar();
          }, 1500);
        } else {
          throw new Error(data.error || 'Error al procesar la solicitud en Google Drive.');
        }
      } catch (err) {
        console.error('Error al mover archivo:', err);
        if (btnMoverDirecto) {
          btnMoverDirecto.disabled = false;
          btnMoverDirecto.innerHTML = '<span>⚡ Reintentar Mover</span>';
        }
        mostrarEstadoModal('error', '❌ <strong>Error al mover:</strong> ' + err.message + '<br><small>Verifica los permisos de tu Google Apps Script o usa las opciones alternativas abajo.</small>');
        if (opcionesSecundarias) opcionesSecundarias.style.display = 'flex';
      }
    };

    window.notificarClasificacionWA = function() {
      if (!itemAClasificar) return;
      const materia = selectMateriaClasificar ? selectMateriaClasificar.value : 'General';
      const tipo = selectTipoClasificar ? selectTipoClasificar.value : 'Apuntes';
      const nombreItem = itemAClasificar.nombreLimpio || itemAClasificar.nombreOriginal;
      const partes = [
        'Hola! En la Biblioteca Digital el archivo \"' + nombreItem + '\" que figura Sin Clasificar corresponde a:',
        '📚 *Materia:* ' + materia,
        '📂 *Tipo:* ' + tipo,
        '🔗 ' + itemAClasificar.url
      ];
      const texto = partes.join('\\n');
      const waUrl = 'https://wa.me/?text=' + encodeURIComponent(texto);
      window.open(waUrl, '_blank');
    };

    if (modalClasificar) {
      modalClasificar.addEventListener('click', (e) => {
        if (e.target === modalClasificar) cerrarModalClasificar();
      });
    }

    // Render inicial
    renderizar();
  </script>
</body>
</html>`;
}

// ============================================================
// 4. GENERADOR CSV (SINCRONIZABLE A GOOGLE SHEETS)
// ============================================================
export function generarCsvIndice(datos) {
  const lineas = [
    "Materia,Tipo,Nombre_Archivo,Formato,Tamano_o_Tipo,Fecha_Subida,Enlace_Directo,Estado,ID_o_Referencia",
  ];

  for (const item of datos.items) {
    const escapar = (val) => `"${String(val || "").replace(/"/g, '""')}"`;
    lineas.push(
      [
        escapar(item.materia),
        escapar(item.tipo),
        escapar(item.nombreLimpio),
        escapar(item.badge),
        escapar(item.sizeFormateado),
        escapar(item.fechaFormateada),
        escapar(item.url),
        escapar(item.esEnlaceWeb ? "Enlace Web" : item.esDuplicado ? "Duplicado" : "Único"),
        escapar(item.id),
      ].join(","),
    );
  }

  return lineas.join("\n");
}

// ============================================================
// 5. GENERADOR MARKDOWN (PARA LECTURA RÁPIDA)
// ============================================================
export function generarMarkdownIndice(datos) {
  let md = `# 📚 Biblioteca Digital Golgi — Índice de Materiales y Recursos\n\n`;
  md += `> **Última actualización:** ${new Date(datos.fechaGeneracion).toLocaleString("es-CL")}\n`;
  md += `> **Total de Recursos:** ${datos.totalItems} (${datos.totalArchivos} en Drive, ${datos.totalEnlaces} enlaces web) | **Espacio Drive:** ${datos.totalBytesFormateado}\n\n`;

  // Agrupamos por Materia y Tipo
  const materias = {};
  for (const item of datos.items) {
    if (!materias[item.materia]) materias[item.materia] = {};
    if (!materias[item.materia][item.tipo]) materias[item.materia][item.tipo] = [];
    materias[item.materia][item.tipo].push(item);
  }

  for (const [materia, tipos] of Object.entries(materias)) {
    md += `## 📁 ${materia}\n\n`;
    for (const [tipo, items] of Object.entries(tipos)) {
      md += `### ${tipo} (${items.length})\n\n`;
      md += `| Título / Nombre | Formato | Detalle | Enlace |\n`;
      md += `| :--- | :---: | :---: | :---: |\n`;
      for (const it of items) {
        const detalle = it.esEnlaceWeb
          ? (it.autor ? `Canal: ${it.autor}` : it.sizeFormateado)
          : it.sizeFormateado;
        const textoEnlace = it.esEnlaceWeb ? `Visitar ${it.badge}` : `Abrir en Drive`;
        md += `| ${it.nombreLimpio} | \`${it.badge}\` | ${detalle} | [${textoEnlace}](${it.url}) |\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

// ============================================================
// 6. GENERADOR PORTAL PRINCIPAL DE GENERACIONES
// ============================================================
export function generarHtmlPortalGeneraciones(generaciones = []) {
  const cardsHtml = generaciones
    .map((gen) => {
      const fecha = gen.ultimaActualizacion
        ? new Date(gen.ultimaActualizacion).toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Reciente";

      return `
      <div class="gen-card">
        <div class="gen-card-badge">🎓 Generación ${gen.id}</div>
        <h2 class="gen-card-title">Generación ${gen.id}</h2>
        <p class="gen-card-desc">Materiales oficiales, certámenes, seminarios y enlaces recopilados automáticamente por Golgi Bot.</p>
        
        <div class="gen-stats-grid">
          <div class="gen-stat-item">
            <span class="gen-stat-num">${gen.totalItems || 0}</span>
            <span class="gen-stat-lbl">Recursos</span>
          </div>
          <div class="gen-stat-item">
            <span class="gen-stat-num">${gen.totalMaterias || 0}</span>
            <span class="gen-stat-lbl">Materias</span>
          </div>
          <div class="gen-stat-item">
            <span class="gen-stat-num">${gen.totalArchivos || 0}</span>
            <span class="gen-stat-lbl">Archivos Drive</span>
          </div>
        </div>

        <div class="gen-card-footer">
          <span class="gen-date">🕒 Act: ${fecha}</span>
          <a href="${gen.url || gen.id + '/'}" class="btn-enter-gen">
            <span>Entrar a Biblioteca</span>
            <span class="arrow">→</span>
          </a>
        </div>
      </div>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biblioteca Digital de Medicina — Portal de Generaciones</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #0a0e17;
      --bg-card: rgba(18, 24, 38, 0.7);
      --bg-card-hover: rgba(26, 35, 54, 0.9);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-active: rgba(56, 189, 248, 0.4);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-cyan: #38bdf8;
      --accent-teal: #14b8a6;
      --accent-emerald: #10b981;
      --glass-blur: blur(16px);
      --shadow-card: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-image: 
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56, 189, 248, 0.15), transparent 70%),
        radial-gradient(ellipse 60% 40% at 100% 100%, rgba(20, 184, 166, 0.1), transparent 60%);
      background-attachment: fixed;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 3.5rem 1.5rem 4rem;
      flex: 1;
      width: 100%;
    }

    header {
      text-align: center;
      margin-bottom: 3.5rem;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent-cyan);
      padding: 0.35rem 0.9rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-cyan);
      box-shadow: 0 0 8px var(--accent-cyan);
    }

    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 0.85rem;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .generaciones-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.75rem;
      margin-bottom: 3rem;
    }

    .gen-card {
      background: var(--bg-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow-card);
      position: relative;
      overflow: hidden;
    }

    .gen-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-teal));
      opacity: 0.7;
    }

    .gen-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-active);
      background: var(--bg-card-hover);
      box-shadow: 0 16px 36px -12px rgba(56, 189, 248, 0.2);
    }

    .gen-card-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.06);
      color: var(--accent-cyan);
      font-weight: 600;
      font-size: 0.78rem;
      padding: 0.25rem 0.65rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      width: fit-content;
    }

    .gen-card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.5rem;
    }

    .gen-card-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 1.5rem;
      flex: 1;
    }

    .gen-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.04);
      padding: 0.85rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .gen-stat-num {
      display: block;
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .gen-stat-lbl {
      display: block;
      font-size: 0.7rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 0.15rem;
    }

    .gen-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .gen-date {
      font-size: 0.78rem;
      color: var(--text-dim);
    }

    .btn-enter-gen {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-teal));
      color: #041019;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .btn-enter-gen:hover {
      box-shadow: 0 4px 14px rgba(56, 189, 248, 0.4);
      transform: translateY(-1px);
    }

    .btn-enter-gen .arrow {
      transition: transform 0.2s ease;
    }

    .btn-enter-gen:hover .arrow {
      transform: translateX(3px);
    }

    footer {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.85rem;
      padding: 2rem 0;
      border-top: 1px solid var(--border-subtle);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge-pill">
        <span class="badge-dot"></span>
        Archivo Académico Central de Medicina
      </div>
      <h1>Biblioteca Digital — Portal de Generaciones</h1>
      <p class="subtitle">Explora los apuntes, certámenes, seminarios y enlaces organizados por generación.</p>
    </header>

    <div class="generaciones-grid">
      ${cardsHtml}
    </div>

    <footer>
      <p>🧬 Desarrollado para la carrera de Medicina — Golgi Bot &bull; Actualizado automáticamente</p>
    </footer>
  </div>
</body>
</html>`;
}

// ============================================================
// 7. SUBIDA DIRECTA A GITHUB VÍA API REST (CERO GIT REQUERIDO)
// ============================================================
export async function publicarAGitHubAPI({ archivos, token, repo, rama = "main" }) {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error(`Repositorio inválido: "${repo}". Debe tener formato "usuario/repo".`);
  }

  console.log(`🌐 Sincronizando ${archivos.length} archivo(s) con GitHub Pages vía API (${owner}/${repoName}@${rama})...`);

  for (const archivo of archivos) {
    const { ruta, contenido } = archivo;
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${ruta}`;
    let sha = null;

    try {
      const getRes = await fetch(`${url}?ref=${rama}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "GolgiBot-Uploader",
        },
      });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch {}

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "GolgiBot-Uploader",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `bot: Actualizar ${ruta}`,
        content: Buffer.from(contenido, "utf8").toString("base64"),
        branch: rama,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`Error en API de GitHub (${putRes.status}) al subir ${ruta}: ${errText}`);
    }
    console.log(`   ✅ Sincronizado en GitHub: ${ruta}`);
  }
}

// ============================================================
// 8. FUNCIÓN MAESTRA: GENERAR Y SINCRONIZAR POR GENERACIÓN
// ============================================================
export async function generarYSincronizarIndice(opciones = {}) {
  const {
    subirADrive = true,
    abrirLocal = false,
    publicarAGitHub = AUTO_PUBLICAR_GITHUB ?? true,
    generacion = opciones.generacion || GENERACION,
  } = opciones;

  console.log("=================================================");
  console.log(`🚀 GENERADOR DE BIBLIOTECA DIGITAL — GENERACIÓN ${generacion}`);
  console.log("=================================================");

  const catalogo = await recopilarCatalogoDrive();

  console.log(`\n📦 Total de recursos catalogados: ${catalogo.totalItems}`);
  console.log(`   - 📄 Archivos en Google Drive: ${catalogo.totalArchivos}`);
  console.log(`   - 🔗 Enlaces web y videos: ${catalogo.totalEnlaces}`);
  console.log(`💾 Espacio total en Drive: ${catalogo.totalBytesFormateado}`);
  console.log(`🔁 Duplicados identificados: ${catalogo.duplicadosDetectados}`);

  // 1. Generamos contenidos para la generación
  const htmlContentGen = generarHtmlIndice(catalogo, generacion);
  const csvContent = generarCsvIndice(catalogo);
  const mdContent = generarMarkdownIndice(catalogo);

  // 2. Registro histórico de generaciones (generaciones.json)
  const rutaGeneraciones = path.join(process.cwd(), "generaciones.json");
  let listaGeneraciones = [];
  if (fs.existsSync(rutaGeneraciones)) {
    try {
      listaGeneraciones = JSON.parse(fs.readFileSync(rutaGeneraciones, "utf8"));
    } catch {}
  }
  if (!Array.isArray(listaGeneraciones)) listaGeneraciones = [];

  const idx = listaGeneraciones.findIndex((g) => g.id === generacion);
  const datosGen = {
    id: generacion,
    nombre: `Generación ${generacion}`,
    totalArchivos: catalogo.totalArchivos,
    totalEnlaces: catalogo.totalEnlaces,
    totalItems: catalogo.totalItems,
    totalMaterias: Object.keys(catalogo.materiasMap).length,
    totalBytes: catalogo.totalBytesFormateado,
    ultimaActualizacion: new Date().toISOString(),
    url: `${generacion}/`,
  };
  if (idx >= 0) {
    listaGeneraciones[idx] = datosGen;
  } else {
    listaGeneraciones.push(datosGen);
  }
  listaGeneraciones.sort((a, b) => b.id.localeCompare(a.id, "es", { numeric: true }));

  const jsonGeneraciones = JSON.stringify(listaGeneraciones, null, 2);
  fs.writeFileSync(rutaGeneraciones, jsonGeneraciones, "utf8");

  // 3. Generamos portal principal
  const portalHtml = generarHtmlPortalGeneraciones(listaGeneraciones);

  // 4. Guardamos archivos locales
  // A. Carpetas de la generación
  const dirGen = path.join(process.cwd(), generacion);
  if (!fs.existsSync(dirGen)) fs.mkdirSync(dirGen, { recursive: true });
  fs.writeFileSync(path.join(dirGen, "index.html"), htmlContentGen, "utf8");
  fs.writeFileSync(path.join(dirGen, ".nojekyll"), "", "utf8");

  const dirDocsGen = path.join(process.cwd(), "docs", generacion);
  if (!fs.existsSync(dirDocsGen)) fs.mkdirSync(dirDocsGen, { recursive: true });
  fs.writeFileSync(path.join(dirDocsGen, "index.html"), htmlContentGen, "utf8");
  fs.writeFileSync(path.join(dirDocsGen, ".nojekyll"), "", "utf8");

  // B. Raíz y docs (Portal Principal)
  const rutaIndexRoot = path.join(process.cwd(), "index.html");
  fs.writeFileSync(rutaIndexRoot, portalHtml, "utf8");
  fs.writeFileSync(path.join(process.cwd(), ".nojekyll"), "", "utf8");

  const dirDocs = path.join(process.cwd(), "docs");
  if (!fs.existsSync(dirDocs)) fs.mkdirSync(dirDocs, { recursive: true });
  fs.writeFileSync(path.join(dirDocs, "index.html"), portalHtml, "utf8");
  fs.writeFileSync(path.join(dirDocs, "generaciones.json"), jsonGeneraciones, "utf8");
  fs.writeFileSync(path.join(dirDocs, ".nojekyll"), "", "utf8");

  // C. Copias locales para Drive y visualización directa
  const rutaHtmlLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.html");
  const rutaCsvLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.csv");
  const rutaMdLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.md");

  fs.writeFileSync(rutaHtmlLocal, htmlContentGen, "utf8");
  fs.writeFileSync(rutaCsvLocal, csvContent, "utf8");
  fs.writeFileSync(rutaMdLocal, mdContent, "utf8");

  console.log("\n💾 Archivos locales generados:");
  console.log(`   - [${generacion}/index.html] (Web Generación ${generacion})`);
  console.log(`   - [docs/${generacion}/index.html] (GitHub Pages /docs/${generacion})`);
  console.log(`   - [index.html] (Portal de Generaciones Principal)`);
  console.log(`   - [INDICE_BIBLIOTECA.html] (Copia autónoma para Drive)`);

  // 5. Subir a Google Drive (en la raíz DRIVE_FOLDER_ID)
  if (subirADrive) {
    console.log("\n☁️ Sincronizando índices hacia la raíz de Google Drive...");

    await sincronizarArchivoEnDrive({
      nombreArchivo: "INDICE_BIBLIOTECA.html",
      contenido: htmlContentGen,
      mimeType: "text/html; charset=utf-8",
      carpetaDestinoId: DRIVE_FOLDER_ID,
    });

    await sincronizarCSVDrive(
      "INDICE_BIBLIOTECA",
      rutaCsvLocal,
      DRIVE_FOLDER_ID,
    );

    await sincronizarArchivoEnDrive({
      nombreArchivo: "INDICE_BIBLIOTECA.md",
      contenido: mdContent,
      mimeType: "text/markdown; charset=utf-8",
      carpetaDestinoId: DRIVE_FOLDER_ID,
    });

    console.log("✅ Índices sincronizados exitosamente en Google Drive.");
  }

  // 6. Publicación a GitHub Pages
  if (publicarAGitHub) {
    console.log("\n🚀 Publicando en GitHub Pages...");

    if (GITHUB_TOKEN && GITHUB_TOKEN.trim() !== "") {
      console.log("🔑 GITHUB_TOKEN detectado: Sincronizando vía API REST (¡Sin Git instalado!)...");
      try {
        await publicarAGitHubAPI({
          token: GITHUB_TOKEN,
          repo: GITHUB_REPO,
          rama: GITHUB_BRANCH,
          archivos: [
            { ruta: "index.html", contenido: portalHtml },
            { ruta: "docs/index.html", contenido: portalHtml },
            { ruta: `${generacion}/index.html`, contenido: htmlContentGen },
            { ruta: `docs/${generacion}/index.html`, contenido: htmlContentGen },
            { ruta: "generaciones.json", contenido: jsonGeneraciones },
            { ruta: "docs/generaciones.json", contenido: jsonGeneraciones },
            { ruta: "INDICE_BIBLIOTECA.html", contenido: htmlContentGen },
          ],
        });
        console.log(`✅ ¡Biblioteca de la Generación ${generacion} desplegada exitosamente en GitHub Pages!`);
      } catch (errApi) {
        console.warn("⚠️ Error al publicar vía API de GitHub:", errApi.message);
      }
    } else {
      // Fallback a git local
      try {
        const { execSync } = await import("child_process");
        execSync(
          `git add index.html docs/ ${generacion}/ INDICE_BIBLIOTECA.html INDICE_BIBLIOTECA.csv INDICE_BIBLIOTECA.md generaciones.json enlaces.csv`,
          { stdio: "ignore" },
        );
        try {
          execSync(`git commit -m "bot: Auto-actualizar biblioteca digital Gen ${generacion}"`, {
            stdio: "ignore",
          });
          execSync(`git push origin ${GITHUB_BRANCH}`, { stdio: "ignore" });
          console.log(`✅ Biblioteca digital (Gen ${generacion}) desplegada en GitHub Pages vía Git local.`);
        } catch {
          console.log("ℹ️ No hay cambios pendientes para subir a GitHub.");
        }
      } catch (errGit) {
        console.warn("⚠️ No se pudo auto-publicar vía Git local:", errGit.message);
        console.log("💡 TIP: Agrega tu GITHUB_TOKEN en Configuración o en el archivo .env para publicar automáticamente sin tener Git instalado.");
      }
    }
  }

  if (abrirLocal) {
    console.log("\n🌐 Abriendo dashboard en tu navegador...");
    try {
      const { exec } = await import("child_process");
      exec(`start "" "${path.join(dirGen, "index.html")}"`);
    } catch { }
  }

  console.log("\n=================================================");
  console.log(`✨ GENERACIÓN DE ÍNDICE COMPLETADA (GEN ${generacion})`);
  console.log("=================================================");

  return catalogo;
}

// Ejecución directa si se invoca desde la terminal: node indice.js
if (process.argv[1] && process.argv[1].endsWith("indice.js")) {
  const soloLocal = process.argv.includes("--solo-local");
  const abrir = process.argv.includes("--abrir");
  generarYSincronizarIndice({ subirADrive: !soloLocal, abrirLocal: abrir })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error generando índice:", err.message);
      process.exit(1);
    });
}
