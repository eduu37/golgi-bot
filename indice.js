import fs from "fs";
import path from "path";
import { DRIVE_FOLDER_ID } from "./config.js";
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
      } catch {}
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
      } catch {}
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
export function generarHtmlIndice(datos) {
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

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biblioteca Digital Golgi — Materiales y Enlaces de Medicina</title>
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

    /* CONTROLS (SEARCH & FILTERS) */
    .controls-panel {
      position: relative;
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

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 0.8rem;
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
      <div class="header-badge">
        <span class="header-badge-dot"></span>
        Biblioteca Oficial en Tiempo Real
      </div>
      <h1>Biblioteca Digital Golgi</h1>
      <p class="subtitle">Catálogo unificado de materiales de Medicina: certámenes, resúmenes, controles en Google Drive y clases grabadas en YouTube.</p>

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

    <footer>
      Generado automáticamente por <strong>Golgi bot</strong> — Sistema de Respaldo y Clasificación para Medicina.
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
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';
      grid.innerHTML = filtrados.map(item => {
        const esYt = item.badge === 'YOUTUBE';
        const esNotebook = item.badge === 'NOTEBOOKLM';
        const btnClase = esYt ? 'btn-open btn-open-yt' : (esNotebook ? 'btn-open btn-open-notebook' : 'btn-open');
        const badgeClase = item.esEnlaceWeb ? ('tag tag-badge-' + item.badge) : 'tag tag-ext';

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
                    <span class="tag tag-materia">\${item.materia}</span>
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
// 6. FUNCIÓN MAESTRA: GENERAR Y SINCRONIZAR
// ============================================================
export async function generarYSincronizarIndice(opciones = {}) {
  const { subirADrive = true, abrirLocal = false } = opciones;

  console.log("=================================================");
  console.log("🚀 GENERADOR AUTOMÁTICO DE ÍNDICE DIGITAL UNIFICADO");
  console.log("=================================================");

  const catalogo = await recopilarCatalogoDrive();

  console.log(`\n📦 Total de recursos catalogados: ${catalogo.totalItems}`);
  console.log(`   - 📄 Archivos en Google Drive: ${catalogo.totalArchivos}`);
  console.log(`   - 🔗 Enlaces web y videos: ${catalogo.totalEnlaces}`);
  console.log(`💾 Espacio total en Drive: ${catalogo.totalBytesFormateado}`);
  console.log(`🔁 Duplicados identificados: ${catalogo.duplicadosDetectados}`);

  // 1. Generamos contenidos
  const htmlContent = generarHtmlIndice(catalogo);
  const csvContent = generarCsvIndice(catalogo);
  const mdContent = generarMarkdownIndice(catalogo);

  // 2. Guardamos copias locales en el proyecto
  const rutaHtmlLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.html");
  const rutaIndexRoot = path.join(process.cwd(), "index.html");
  const rutaCsvLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.csv");
  const rutaMdLocal = path.join(process.cwd(), "INDICE_BIBLIOTECA.md");

  fs.writeFileSync(rutaHtmlLocal, htmlContent, "utf8");
  fs.writeFileSync(rutaIndexRoot, htmlContent, "utf8");
  fs.writeFileSync(path.join(process.cwd(), ".nojekyll"), "", "utf8");
  fs.writeFileSync(rutaCsvLocal, csvContent, "utf8");
  fs.writeFileSync(rutaMdLocal, mdContent, "utf8");

  // Carpeta docs/ para GitHub Pages
  const dirDocs = path.join(process.cwd(), "docs");
  if (!fs.existsSync(dirDocs)) {
    fs.mkdirSync(dirDocs, { recursive: true });
  }
  const rutaDocsHtml = path.join(dirDocs, "index.html");
  fs.writeFileSync(rutaDocsHtml, htmlContent, "utf8");
  fs.writeFileSync(path.join(dirDocs, ".nojekyll"), "", "utf8");

  console.log("\n💾 Archivos locales generados:");
  console.log(`   - [index.html](${rutaIndexRoot}) (GitHub Pages Raíz)`);
  console.log(`   - [docs/index.html](${rutaDocsHtml}) (GitHub Pages /docs)`);
  console.log(`   - [INDICE_BIBLIOTECA.html](${rutaHtmlLocal})`);
  console.log(`   - [INDICE_BIBLIOTECA.csv](${rutaCsvLocal})`);
  console.log(`   - [INDICE_BIBLIOTECA.md](${rutaMdLocal})`);

  // 3. Subir a Google Drive (en la raíz DRIVE_FOLDER_ID)
  if (subirADrive) {
    console.log("\n☁️ Sincronizando índices hacia la raíz de Google Drive...");

    // Subir página web interactiva
    await sincronizarArchivoEnDrive({
      nombreArchivo: "INDICE_BIBLIOTECA.html",
      contenido: htmlContent,
      mimeType: "text/html; charset=utf-8",
      carpetaDestinoId: DRIVE_FOLDER_ID,
    });

    // Subir Google Sheet nativo interactivo
    await sincronizarCSVDrive(
      "INDICE_BIBLIOTECA",
      rutaCsvLocal,
      DRIVE_FOLDER_ID,
    );

    // Subir Markdown
    await sincronizarArchivoEnDrive({
      nombreArchivo: "INDICE_BIBLIOTECA.md",
      contenido: mdContent,
      mimeType: "text/markdown; charset=utf-8",
      carpetaDestinoId: DRIVE_FOLDER_ID,
    });

    console.log("✅ Índices sincronizados exitosamente en Google Drive.");
  }

  if (abrirLocal) {
    console.log("\n🌐 Abriendo dashboard en tu navegador...");
    try {
      const { exec } = await import("child_process");
      exec(`start "" "${rutaHtmlLocal}"`);
    } catch {}
  }

  console.log("\n=================================================");
  console.log("✨ GENERACIÓN DE ÍNDICE COMPLETADA");
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
