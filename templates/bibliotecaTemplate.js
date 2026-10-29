import fs from "fs";
import path from "path";
import { GENERACION, DRIVE_FOLDER_ID, APPS_SCRIPT_URL, SEMESTRE_DEFAULT } from "../config.js";

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

  // Mapeo materias <-> semestres desde malla.json (fuente de verdad oficial)
  let mapaMateriasSemestre = {};
  let semestresConfig = {};
  let semestreActivoMalla = null;

  try {
    const rutaMalla = path.join(process.cwd(), "malla.json");
    if (fs.existsSync(rutaMalla)) {
      const malla = JSON.parse(fs.readFileSync(rutaMalla, "utf8"));
      if (malla.semestres) {
        semestresConfig = malla.semestres;
        for (const [sem, mats] of Object.entries(malla.semestres)) {
          if (Array.isArray(mats)) {
            for (const m of mats) {
              mapaMateriasSemestre[m] = String(sem);
            }
          }
        }
      }
      if (malla.semestreActivo) {
        semestreActivoMalla = String(malla.semestreActivo).trim();
      }
    }
  } catch (errMalla) {
    console.error("⚠️ Error al leer malla.json:", errMalla.message);
  }

  // Complementar con categorias.json si hay asignaturas adicionales
  try {
    const rutaCats = path.join(process.cwd(), "categorias.json");
    if (fs.existsSync(rutaCats)) {
      const cats = JSON.parse(fs.readFileSync(rutaCats, "utf8"));
      if (cats.semestres) {
        for (const [sem, mats] of Object.entries(cats.semestres)) {
          if (!semestresConfig[sem]) semestresConfig[sem] = mats;
          if (Array.isArray(mats)) {
            for (const m of mats) {
              if (!mapaMateriasSemestre[m]) {
                mapaMateriasSemestre[m] = String(sem);
              }
            }
          }
        }
      }
    }
  } catch {}

  const semDefault = SEMESTRE_DEFAULT || semestreActivoMalla || "2";

  // Conteo de recursos por semestre (archivos sin clasificar caen en el semestre activo)
  const conteoPorSemestre = {};
  for (const it of items) {
    const s = String(it.semestre || semDefault);
    conteoPorSemestre[s] = (conteoPorSemestre[s] || 0) + 1;
  }

  // Lista de semestres a mostrar en la barra (semestres activos 1 y 2, más cualquier semestre que tenga recursos)
  const setSemestres = new Set([
    "1",
    "2",
    String(semDefault),
    ...Object.keys(conteoPorSemestre).filter((s) => (conteoPorSemestre[s] || 0) > 0),
  ]);
  const listaSemestres = Array.from(setSemestres).sort((a, b) => Number(a) - Number(b));

  // Botones de pestañas de semestres
  const tabsSemestresHtml = listaSemestres
    .map(
      (sem) =>
        `<button class="semester-tab ${semDefault === String(sem) ? "active" : ""}" data-semestre="${sem}">
          <span>${sem}º Semestre</span>
          <span class="sem-count-badge" id="sem-count-${sem}">${conteoPorSemestre[sem] || 0}</span>
        </button>`,
    )
    .join("\n");

  // Opciones de píldoras de materias asociadas a su semestre
  const pillsMaterias = listaMaterias
    .map((m) => {
      let sem = mapaMateriasSemestre[m] || "";
      const esSinClasificar = m.toLowerCase().includes("sin clasificar");
      if (esSinClasificar) {
        sem = semDefault;
      }
      const claseExtra = esSinClasificar ? " filter-pill-unclassified" : "";
      const texto = esSinClasificar ? `⚠️ ${m}` : m;
      return `<button class="filter-pill filter-pill-materia${claseExtra}" data-materia="${m}" data-semestre="${sem}">${texto} <span class="pill-count">${materiasMap[m].total}</span></button>`;
    })
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

  // Lista completa de asignaturas para el modal de clasificar organizada por semestres
  let todasMaterias = [];
  try {
    const cats = JSON.parse(fs.readFileSync(path.join(process.cwd(), "categorias.json"), "utf8"));
    if (cats.materias) todasMaterias = Object.keys(cats.materias);
  } catch {}
  todasMaterias = Array.from(new Set([...todasMaterias, ...listaMaterias]))
    .filter((m) => m !== "Sin clasificar" && m !== "_Duplicados" && m !== "root")
    .sort((a, b) => a.localeCompare(b, "es"));

  let optionsMateriasClasificar = "";
  const semestresOrdenados = Object.keys(semestresConfig).sort((a, b) => Number(a) - Number(b));
  const materiasVistasEnMalla = new Set();

  for (const sem of semestresOrdenados) {
    const mats = semestresConfig[sem];
    if (Array.isArray(mats) && mats.length > 0) {
      optionsMateriasClasificar += `<optgroup label="${sem}º Semestre">\n`;
      for (const m of mats) {
        materiasVistasEnMalla.add(m.toLowerCase());
        optionsMateriasClasificar += `  <option value="${m}" data-semestre="${sem}">${m}</option>\n`;
      }
      optionsMateriasClasificar += `</optgroup>\n`;
    }
  }

  // Materias adicionales fuera de la malla si existieran
  const materiasAdicionales = todasMaterias.filter((m) => !materiasVistasEnMalla.has(m.toLowerCase()));
  if (materiasAdicionales.length > 0) {
    optionsMateriasClasificar += `<optgroup label="Otras Asignaturas">\n`;
    for (const m of materiasAdicionales) {
      const s = mapaMateriasSemestre[m] || semDefault;
      optionsMateriasClasificar += `  <option value="${m}" data-semestre="${s}">${m}</option>\n`;
    }
    optionsMateriasClasificar += `</optgroup>\n`;
  }

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

    /* SEMESTER SELECTOR BAR */
    .semester-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      align-items: center;
      padding-bottom: 0.95rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .semester-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-right: 0.35rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .semester-tab {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 0.48rem 0.95rem;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.86rem;
      font-weight: 600;
      font-family: inherit;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .semester-tab:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }

    .semester-tab.active {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(56, 189, 248, 0.2));
      border-color: var(--accent-emerald);
      color: #fff;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.25);
    }

    .sem-count-badge {
      font-size: 0.73rem;
      padding: 0.12rem 0.42rem;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.35);
      color: var(--text-muted);
    }

    .semester-tab.active .sem-count-badge {
      background: rgba(16, 185, 129, 0.35);
      color: #fff;
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

    .filter-pill-unclassified {
      border-color: rgba(245, 158, 11, 0.4) !important;
      color: #fbbf24 !important;
      background: rgba(245, 158, 11, 0.1) !important;
    }

    .filter-pill-unclassified:hover {
      background: rgba(245, 158, 11, 0.22) !important;
      border-color: #f59e0b !important;
      color: #fff !important;
    }

    .filter-pill-unclassified.active {
      background: #f59e0b !important;
      border-color: #f59e0b !important;
      color: #041019 !important;
      font-weight: 700 !important;
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

    .tag-semestre {
      background: rgba(16, 185, 129, 0.12);
      color: var(--accent-emerald);
      border: 1px solid rgba(16, 185, 129, 0.28);
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
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f1f5f9;
      color-scheme: dark;
      font-family: inherit;
      font-size: 0.92rem;
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      outline: none;
      transition: all 0.2s ease;
    }

    .modal-select:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
    }

    .modal-select optgroup {
      background: #090d16;
      color: var(--accent-cyan);
      font-weight: 700;
      font-size: 0.83rem;
      letter-spacing: 0.04em;
      padding: 0.4rem 0.2rem;
    }

    .modal-select option {
      background: #0f172a;
      color: #f1f5f9;
      padding: 0.45rem 0.6rem;
      font-size: 0.9rem;
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

    .btn-manage {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.55rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .btn-manage:hover {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent-cyan);
      border-color: rgba(56, 189, 248, 0.4);
      transform: translateY(-1px);
    }

    .btn-danger-modal {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      background: linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(225, 29, 72, 0.2));
      color: #fb7185;
      border: 1px solid rgba(244, 63, 94, 0.35);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-danger-modal:hover:not(:disabled) {
      background: linear-gradient(135deg, #f43f5e, #e11d48);
      color: #fff;
      box-shadow: 0 4px 15px rgba(244, 63, 94, 0.4);
      transform: translateY(-1px);
    }

    .btn-danger-modal:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
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
      <!-- Selector de Semestre -->
      <div class="semester-bar">
        <span class="semester-label">📅 Semestre:</span>
        <button class="semester-tab ${semDefault === "todos" ? "active" : ""}" data-semestre="todos">
          <span>🌟 Todos</span>
          <span class="sem-count-badge">${totalItems}</span>
        </button>
        ${tabsSemestresHtml}
      </div>

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

    <!-- MODAL DE GESTIÓN Y CLASIFICACIÓN -->
    <div class="modal-overlay" id="modalClasificar" style="display: none;">
      <div class="modal-box">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.5rem;" id="modalIconoHeader">⚙️</span>
            <div>
              <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0;" id="modalTituloHeader">Gestionar Recurso</h3>
              <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.15rem;" id="modalDescHeader">Modifica el nombre, cambia de categoría o elimina el archivo en Drive.</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="cerrarModalClasificar()">&times;</button>
        </div>

        <div class="modal-body" style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.95rem;">
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">✏️ Nombre del Archivo</label>
            <input type="text" id="inputNombreClasificar" class="modal-input" placeholder="Nombre descriptivo del archivo...">
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">📚 Asignatura / Materia</label>
            <select id="selectMateriaClasificar" class="modal-select">
              ${optionsMateriasClasificar}
            </select>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.95rem; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 10px;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="font-size: 1.1rem;">📅</span>
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Semestre Académico:</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span id="badgeSemestreModal" style="font-size: 0.88rem; font-weight: 700; color: var(--accent-cyan);">2º Semestre</span>
              <span style="font-size: 0.72rem; color: var(--text-dim); background: rgba(255, 255, 255, 0.06); padding: 0.15rem 0.45rem; border-radius: 6px;">Automático</span>
            </div>
            <input type="hidden" id="selectSemestreClasificar" value="2">
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">📂 Tipo de Recurso</label>
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
              <span>⚡</span> Activar Gestión con 1 Clic (Google Apps Script)
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
              ➕ Ver opciones alternativas (Gestionar manual en Drive o WhatsApp)...
            </button>
            <div id="opcionesSecundarias" style="display: none; margin-top: 0.75rem; flex-direction: column; gap: 0.6rem;">
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn-notify-wa" id="btnNotificarWA" onclick="notificarClasificacionWA()">💬 Notificar por WhatsApp</button>
                <a href="#" target="_blank" rel="noopener noreferrer" class="btn-move-drive" id="btnMoverEnDrive">📁 Abrir y Gestionar en Drive ↗</a>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn-cancel" onclick="cerrarModalClasificar()">Cancelar</button>
            <button type="button" class="btn-danger-modal" id="btnEliminarDirecto" onclick="ejecutarEliminarDirecto()">🗑️ Eliminar</button>
          </div>
          <button type="button" class="btn-move-direct" id="btnMoverDirecto" onclick="ejecutarGuardarCambios()">
            <span>💾 Guardar Cambios</span>
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
    const MAPA_MATERIA_SEMESTRE = ${JSON.stringify(mapaMateriasSemestre)};
    // Persistencia local para recordar clasificaciones y eliminaciones inmediatamente incluso si se recarga la página
    const CLASIFICACIONES_LOCALES = JSON.parse(localStorage.getItem('golgi_clasificaciones_locales') || '{}');
    const ELIMINADOS_LOCALES = new Set(JSON.parse(localStorage.getItem('golgi_eliminados_locales') || '[]'));

    // Quitar del CATALOGO en memoria los elementos eliminados localmente
    for (let i = CATALOGO.length - 1; i >= 0; i--) {
      if (ELIMINADOS_LOCALES.has(String(CATALOGO[i].id))) {
        CATALOGO.splice(i, 1);
      }
    }

    // Aplicar modificaciones locales (renombres o cambios de materia/tipo/semestre)
    for (const [id, datos] of Object.entries(CLASIFICACIONES_LOCALES)) {
      const item = CATALOGO.find(it => String(it.id) === String(id));
      if (item) {
        if (datos.materia) item.materia = datos.materia;
        if (datos.tipo) item.tipo = datos.tipo;
        if (datos.semestre) item.semestre = datos.semestre;
        if (datos.nombreLimpio) item.nombreLimpio = datos.nombreLimpio;
      }
    }
    let semestreActivo = "${semDefault}";
    let origenActivo = 'todos';
    let materiaActiva = 'todas';
    let tipoActivo = 'todos';
    let terminoBusqueda = '';

    const grid = document.getElementById('filesGrid');
    const emptyState = document.getElementById('emptyState');
    const visibleCount = document.getElementById('visibleCount');
    const searchInput = document.getElementById('searchInput');
    const tabsSemestre = document.querySelectorAll('.semester-tab');
    const tabsOrigen = document.querySelectorAll('.origin-tab');
    const pillsMateria = document.querySelectorAll('.filter-pill-materia');
    const pillsTipo = document.querySelectorAll('.filter-pill-tipo');

    function renderizar() {
      const normalizar = (txt) => (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = normalizar(terminoBusqueda);

      // Si la materia activa no corresponde al semestre activo, volver a 'todas'
      if (semestreActivo !== 'todos' && materiaActiva !== 'todas') {
        const semMateria = MAPA_MATERIA_SEMESTRE[materiaActiva];
        if (semMateria && semMateria !== semestreActivo) {
          materiaActiva = 'todas';
        }
      }

      // Filtrar visibilidad y conteos de píldoras de materia según el semestre activo
      pillsMateria.forEach(pill => {
        const mat = pill.getAttribute('data-materia');
        if (mat === 'todas') {
          if (materiaActiva === 'todas') pill.classList.add('active');
          else pill.classList.remove('active');

          const countSpan = pill.querySelector('.pill-count');
          if (countSpan) {
            const count = semestreActivo === 'todos'
              ? CATALOGO.length
              : CATALOGO.filter(it => String(it.semestre) === String(semestreActivo)).length;
            countSpan.textContent = count;
          }
        } else {
          const semMateria = pill.getAttribute('data-semestre') || MAPA_MATERIA_SEMESTRE[mat] || '';
          const esSinClasificar = (mat || '').toLowerCase().includes('sin clasificar');

          if (mat === materiaActiva) pill.classList.add('active');
          else pill.classList.remove('active');

          const countSpan = pill.querySelector('.pill-count');
          let count = 0;
          if (countSpan) {
            count = (semestreActivo === 'todos')
              ? CATALOGO.filter(it => it.materia === mat).length
              : CATALOGO.filter(it => it.materia === mat && String(it.semestre) === String(semestreActivo)).length;
            countSpan.textContent = count;
          }

          if (esSinClasificar) {
            const visible = (semestreActivo === 'todos') || (count > 0);
            pill.style.display = visible ? 'inline-flex' : 'none';
          } else {
            const visible = (semestreActivo === 'todos') || (semMateria === semestreActivo);
            pill.style.display = visible ? 'inline-flex' : 'none';
          }
        }
      });

      const filtrados = CATALOGO.filter(item => {
        // Filtro por semestre
        if (semestreActivo !== 'todos' && String(item.semestre) !== String(semestreActivo)) return false;

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
                    <span class="tag tag-semestre">\${item.semestre ? item.semestre + 'º Sem' : 'General'}</span>
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
                \${!item.esEnlaceWeb ? \`
                  <button type="button" class="\${esSinClasificar ? 'btn-classify' : 'btn-manage'}" onclick="abrirModalClasificar('\${item.id}')" title="\${esSinClasificar ? 'Asignar materia adecuada' : 'Mover de materia, renombrar o eliminar'}">
                    \${esSinClasificar ? '🏷️ Clasificar' : '⚙️ Gestionar'}
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

    // Pestañas de semestre
    tabsSemestre.forEach(tab => {
      tab.addEventListener('click', () => {
        tabsSemestre.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        semestreActivo = tab.getAttribute('data-semestre');
        if (semestreActivo !== 'todos' && materiaActiva !== 'todas') {
          const semMateria = MAPA_MATERIA_SEMESTRE[materiaActiva];
          if (semMateria && semMateria !== semestreActivo) {
            materiaActiva = 'todas';
          }
        }
        renderizar();
      });
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

    // Modal de gestión manual y Webhook de Google Apps Script
    let itemAClasificar = null;
    const APPS_SCRIPT_URL_COMPILED = "${APPS_SCRIPT_URL}";
    const DRIVE_FOLDER_ID_GEN = "${DRIVE_FOLDER_ID}";
    const GENERACION_ACTIVA = "${generacion}";
    const modalClasificar = document.getElementById('modalClasificar');
    const inputNombreClasificar = document.getElementById('inputNombreClasificar');
    const modalTituloHeader = document.getElementById('modalTituloHeader');
    const modalIconoHeader = document.getElementById('modalIconoHeader');
    const selectMateriaClasificar = document.getElementById('selectMateriaClasificar');
    const selectSemestreClasificar = document.getElementById('selectSemestreClasificar');
    const selectTipoClasificar = document.getElementById('selectTipoClasificar');
    const btnMoverEnDrive = document.getElementById('btnMoverEnDrive');
    const btnMoverDirecto = document.getElementById('btnMoverDirecto');
    const btnEliminarDirecto = document.getElementById('btnEliminarDirecto');
    const modalStatusBox = document.getElementById('modalStatusBox');
    const modalConfigBox = document.getElementById('modalConfigBox');
    const opcionesSecundarias = document.getElementById('opcionesSecundarias');

    if (selectMateriaClasificar) {
      selectMateriaClasificar.addEventListener('change', () => {
        const selectedOpt = selectMateriaClasificar.selectedOptions ? selectMateriaClasificar.selectedOptions[0] : null;
        const semOpt = selectedOpt ? selectedOpt.getAttribute('data-semestre') : null;
        const mat = selectMateriaClasificar.value;
        const semSugerido = semOpt || MAPA_MATERIA_SEMESTRE[mat] || '2';
        if (selectSemestreClasificar) {
          selectSemestreClasificar.value = semSugerido;
        }
        const badgeSem = document.getElementById('badgeSemestreModal');
        if (badgeSem) badgeSem.textContent = semSugerido + 'º Semestre';
      });
    }

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
      mostrarEstadoModal('success', '✅ URL de Google Apps Script guardada con éxito.');
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

      const esSinClasificar = (itemAClasificar.materia || '').toLowerCase().includes('sin clasificar');
      if (modalTituloHeader) {
        modalTituloHeader.textContent = esSinClasificar ? 'Clasificar Documento' : 'Gestionar Recurso';
      }
      if (modalIconoHeader) {
        modalIconoHeader.textContent = esSinClasificar ? '🏷️' : '⚙️';
      }

      if (inputNombreClasificar) {
        inputNombreClasificar.value = itemAClasificar.nombreLimpio || itemAClasificar.nombreOriginal || '';
      }

      if (btnMoverEnDrive) {
        btnMoverEnDrive.href = itemAClasificar.url;
      }
      ocultarEstadoModal();

      if (selectMateriaClasificar) {
        const mat = itemAClasificar.materia;
        if (mat && !mat.toLowerCase().includes('sin clasificar')) {
          selectMateriaClasificar.value = mat;
        } else if (selectMateriaClasificar.options.length > 0) {
          selectMateriaClasificar.selectedIndex = 0;
        }
      }

      const semDetectado = itemAClasificar.semestre || MAPA_MATERIA_SEMESTRE[selectMateriaClasificar ? selectMateriaClasificar.value : ''] || '2';
      if (selectSemestreClasificar) {
        selectSemestreClasificar.value = semDetectado;
      }
      const badgeSem = document.getElementById('badgeSemestreModal');
      if (badgeSem) badgeSem.textContent = semDetectado + 'º Semestre';

      if (selectTipoClasificar) {
        selectTipoClasificar.value = itemAClasificar.tipo || 'Apuntes';
      }

      if (btnMoverDirecto) {
        btnMoverDirecto.disabled = false;
        btnMoverDirecto.innerHTML = '<span>💾 Guardar Cambios</span>';
      }

      if (btnEliminarDirecto) {
        btnEliminarDirecto.disabled = false;
        btnEliminarDirecto.innerHTML = '🗑️ Eliminar';
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

    window.ejecutarGuardarCambios = async function() {
      if (!itemAClasificar) return;
      const urlScript = obtenerAppsScriptUrl();
      if (!urlScript) {
        if (modalConfigBox) modalConfigBox.style.display = 'block';
        mostrarEstadoModal('config', '⚠️ Para guardar cambios automáticamente, primero ingresa la URL de tu Google Apps Script arriba.');
        return;
      }

      const nuevoNombre = inputNombreClasificar ? inputNombreClasificar.value.trim() : '';
      const materia = selectMateriaClasificar ? selectMateriaClasificar.value : '';
      const tipo = selectTipoClasificar ? selectTipoClasificar.value : 'Apuntes';
      const semestre = selectSemestreClasificar ? selectSemestreClasificar.value : (MAPA_MATERIA_SEMESTRE[materia] || '1');

      if (!materia) {
        mostrarEstadoModal('error', '⚠️ Debes seleccionar una asignatura destino.');
        return;
      }

      try {
        if (btnMoverDirecto) {
          btnMoverDirecto.disabled = true;
          btnMoverDirecto.innerHTML = '<span>⏳ Guardando cambios...</span>';
        }
        if (btnEliminarDirecto) btnEliminarDirecto.disabled = true;

        mostrarEstadoModal('loading', '⏳ Guardando cambios en Google Drive...');

        const pinGuardado = localStorage.getItem('golgi_apps_script_pin') || '';
        const payload = {
          accion: 'actualizar',
          fileId: itemAClasificar.id,
          nuevoNombre: nuevoNombre || itemAClasificar.nombreLimpio,
          materia: materia,
          tipo: tipo,
          semestre: semestre,
          folderId: DRIVE_FOLDER_ID_GEN,
          generacion: GENERACION_ACTIVA,
          pin: pinGuardado
        };

        const res = await fetch(urlScript, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.ok) {
          mostrarEstadoModal('success', '✅ ¡Listo! Recurso actualizado con éxito en Google Drive.');
          if (btnMoverDirecto) btnMoverDirecto.innerHTML = '<span>✅ ¡Guardado!</span>';

          if (nuevoNombre) itemAClasificar.nombreLimpio = nuevoNombre;
          itemAClasificar.materia = materia;
          itemAClasificar.tipo = tipo;
          itemAClasificar.semestre = semestre;

          // Guardar en persistencia local
          try {
            CLASIFICACIONES_LOCALES[itemAClasificar.id] = {
              nombreLimpio: itemAClasificar.nombreLimpio,
              materia: materia,
              tipo: tipo,
              semestre: semestre,
              fecha: new Date().toISOString()
            };
            localStorage.setItem('golgi_clasificaciones_locales', JSON.stringify(CLASIFICACIONES_LOCALES));
          } catch {}

          setTimeout(() => {
            renderizar();
            cerrarModalClasificar();
          }, 1200);
        } else if (data.error && data.error.toLowerCase().includes('pin')) {
          const nuevoPin = prompt('🔒 Este script de Google Apps Script requiere un PIN de seguridad. Ingrésalo para continuar:');
          if (nuevoPin) {
            localStorage.setItem('golgi_apps_script_pin', nuevoPin.trim());
            mostrarEstadoModal('config', '🔑 PIN guardado. Por favor presiona "💾 Guardar Cambios" nuevamente.');
            if (btnMoverDirecto) {
              btnMoverDirecto.disabled = false;
              btnMoverDirecto.innerHTML = '<span>💾 Guardar Cambios</span>';
            }
            if (btnEliminarDirecto) btnEliminarDirecto.disabled = false;
          } else {
            throw new Error(data.error);
          }
        } else {
          throw new Error(data.error || 'Error al procesar la solicitud en Google Drive.');
        }
      } catch (err) {
        console.error('Error al actualizar archivo:', err);
        if (btnMoverDirecto) {
          btnMoverDirecto.disabled = false;
          btnMoverDirecto.innerHTML = '<span>💾 Reintentar Guardar</span>';
        }
        if (btnEliminarDirecto) btnEliminarDirecto.disabled = false;
        mostrarEstadoModal('error', '❌ <strong>Error:</strong> ' + err.message + '<br><small>Verifica los permisos de tu Google Apps Script o usa las opciones alternativas abajo.</small>');
        if (opcionesSecundarias) opcionesSecundarias.style.display = 'flex';
      }
    };

    // Alias retrocompatible
    window.ejecutarMoverDirecto = window.ejecutarGuardarCambios;

    window.ejecutarEliminarDirecto = async function() {
      if (!itemAClasificar) return;

      const nombreArchivo = itemAClasificar.nombreLimpio || itemAClasificar.nombreOriginal || 'este archivo';
      const confirmado = confirm('¿Estás seguro de enviar \"' + nombreArchivo + '\" a la papelera de Google Drive?\\n\\nEsta acción quitará el recurso de la biblioteca.');
      if (!confirmado) return;

      const urlScript = obtenerAppsScriptUrl();
      if (!urlScript) {
        if (modalConfigBox) modalConfigBox.style.display = 'block';
        mostrarEstadoModal('config', '⚠️ Para eliminar automáticamente, ingresa la URL de tu Google Apps Script arriba.');
        return;
      }

      try {
        if (btnEliminarDirecto) {
          btnEliminarDirecto.disabled = true;
          btnEliminarDirecto.innerHTML = '⏳ Eliminando...';
        }
        if (btnMoverDirecto) btnMoverDirecto.disabled = true;

        mostrarEstadoModal('loading', '⏳ Enviando <strong>' + nombreArchivo + '</strong> a la papelera de Google Drive...');

        const pinGuardado = localStorage.getItem('golgi_apps_script_pin') || '';
        const payload = {
          accion: 'eliminar',
          fileId: itemAClasificar.id,
          folderId: DRIVE_FOLDER_ID_GEN,
          generacion: GENERACION_ACTIVA,
          pin: pinGuardado
        };

        const res = await fetch(urlScript, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.ok) {
          mostrarEstadoModal('success', '🗑️ ¡Listo! <strong>' + nombreArchivo + '</strong> fue enviado a la papelera de Google Drive.');

          // Agregar al set de eliminados locales y guardar en localStorage
          ELIMINADOS_LOCALES.add(String(itemAClasificar.id));
          try {
            localStorage.setItem('golgi_eliminados_locales', JSON.stringify(Array.from(ELIMINADOS_LOCALES)));
          } catch {}

          // Quitar de CATALOGO en memoria
          const idx = CATALOGO.findIndex(it => String(it.id) === String(itemAClasificar.id));
          if (idx !== -1) {
            CATALOGO.splice(idx, 1);
          }

          setTimeout(() => {
            renderizar();
            cerrarModalClasificar();
          }, 1200);
        } else if (data.error && data.error.toLowerCase().includes('pin')) {
          const nuevoPin = prompt('🔒 Este script de Google Apps Script requiere un PIN de seguridad. Ingrésalo para continuar:');
          if (nuevoPin) {
            localStorage.setItem('golgi_apps_script_pin', nuevoPin.trim());
            mostrarEstadoModal('config', '🔑 PIN guardado. Por favor presiona "🗑️ Eliminar" nuevamente.');
            if (btnEliminarDirecto) {
              btnEliminarDirecto.disabled = false;
              btnEliminarDirecto.innerHTML = '🗑️ Eliminar';
            }
            if (btnMoverDirecto) btnMoverDirecto.disabled = false;
          } else {
            throw new Error(data.error);
          }
        } else {
          throw new Error(data.error || 'Error al eliminar el archivo en Google Drive.');
        }
      } catch (err) {
        console.error('Error al eliminar archivo:', err);
        if (btnEliminarDirecto) {
          btnEliminarDirecto.disabled = false;
          btnEliminarDirecto.innerHTML = '🗑️ Reintentar Eliminar';
        }
        if (btnMoverDirecto) btnMoverDirecto.disabled = false;
        mostrarEstadoModal('error', '❌ <strong>Error al eliminar:</strong> ' + err.message);
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