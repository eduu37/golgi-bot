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
  SEMESTRE_DEFAULT,
} from "./config.js";
import {
  iniciarDrive,
  obtenerDriveClient,
  sincronizarArchivoEnDrive,
  sincronizarCSVDrive,
} from "./drive.js";
import { clasificarArchivo, obtenerSemestreDeMateria } from "./clasificador.js";
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

export function determinarSemestreItem(materia, ancestorFolders = []) {
  // 1. Revisar si alguna carpeta en la ruta de Drive menciona un semestre explícito (ej: "1º Semestre", "Semestre 2", "5to Semestre")
  for (const folder of ancestorFolders) {
    if (!folder || !folder.name) continue;
    const match = folder.name.match(/(\d+)\s*(?:º|°|er|do|to|to|mo|vo|no)?\s*semestre|semestre\s*(\d+)/i);
    if (match) {
      return String(match[1] || match[2]);
    }
  }

  // 2. Mapeo inteligente según la asignatura en categorias.json
  const semMateria = obtenerSemestreDeMateria(materia);
  if (semMateria) return String(semMateria);

  // 3. Fallback al semestre por defecto configurado
  return SEMESTRE_DEFAULT || "1";
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
      semestre: determinarSemestreItem(materia, []),
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
export async function recopilarCatalogoDrive(driveFolderId = DRIVE_FOLDER_ID) {
  await iniciarDrive();
  const drive = obtenerDriveClient();

  console.log("🔍 Consultando estructura completa de Google Drive...");
  const todos = [];
  let pageToken = null;
  do {
    const respuesta = await drive.files.list({
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, mimeType, parents, size, createdTime, md5Checksum, webViewLink)",
      q: "trashed = false",
      pageToken: pageToken || undefined,
    });
    if (respuesta.data.files) {
      todos.push(...respuesta.data.files);
    }
    pageToken = respuesta.data.nextPageToken;
  } while (pageToken);

  const mapaPorId = new Map();
  todos.forEach((item) => mapaPorId.set(item.id, item));

  // Identificamos carpetas
  const carpetas = todos.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const mapaNombresCarpetas = new Map();
  carpetas.forEach((c) => mapaNombresCarpetas.set(c.id, c.name));

  // Verificación de pertenencia a DRIVE_FOLDER_ID para proteger privacidad de archivos personales
  const esDescendienteDeDriveRaiz = (item) => {
    if (!driveFolderId) return true;
    if (!item || !item.parents) return false;
    let parents = [...item.parents];
    const visitados = new Set();
    while (parents.length > 0) {
      if (parents.includes(driveFolderId)) return true;
      const nextParents = [];
      for (const pId of parents) {
        if (!visitados.has(pId)) {
          visitados.add(pId);
          const pFolder = mapaPorId.get(pId);
          if (pFolder && pFolder.parents) {
            nextParents.push(...pFolder.parents);
          }
        }
      }
      parents = nextParents;
    }
    return false;
  };

  // Filtramos archivos documentales (excluimos carpetas, índices previos y archivos ajenos a DRIVE_FOLDER_ID)
  const nombresExcluidos = new Set([
    "Enlaces_Guardados",
    "Enlaces_Guardados.csv",
    "INDICE_BIBLIOTECA",
    "INDICE_BIBLIOTECA.html",
    "INDICE_BIBLIOTECA.csv",
    "INDICE_BIBLIOTECA.md",
  ]);

  const itemsDocumentales = todos.filter(
    (f) =>
      f.mimeType !== "application/vnd.google-apps.folder" &&
      !nombresExcluidos.has(f.name) &&
      esDescendienteDeDriveRaiz(f),
  );

  // Mapa de hashes para detectar duplicados (solo entre archivos del curso)
  const hashesVistos = new Map();
  const idsDuplicados = new Set();
  for (const f of itemsDocumentales) {
    if (f.md5Checksum) {
      if (hashesVistos.has(f.md5Checksum)) {
        idsDuplicados.add(f.id);
      } else {
        hashesVistos.set(f.md5Checksum, f.id);
      }
    }
  }

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

    const ancestors = [];
    if (parentFolder) ancestors.push(parentFolder);
    if (grandParentFolder) ancestors.push(grandParentFolder);
    let curr = grandParentFolder;
    while (curr && curr.parents && curr.parents[0]) {
      const nextParent = mapaPorId.get(curr.parents[0]);
      if (nextParent && nextParent.id !== DRIVE_FOLDER_ID) {
        ancestors.push(nextParent);
        curr = nextParent;
      } else {
        break;
      }
    }

    const semestre = determinarSemestreItem(materia, ancestors);

    catalogoArchivos.push({
      id: item.id,
      nombreOriginal: item.name,
      nombreLimpio: limpiarNombre(item.name),
      materia,
      tipo,
      semestre,
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
// 3. GENERADOR HTML DE BIBLIOTECA (MODULARIZADO EN templates/)
// ============================================================
import { generarHtmlIndice } from "./templates/bibliotecaTemplate.js";
export { generarHtmlIndice };


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
// 6. GENERADOR PORTAL PRINCIPAL DE GENERACIONES (MODULARIZADO EN templates/)
// ============================================================
import { generarHtmlPortalGeneraciones } from "./templates/portalTemplate.js";
export { generarHtmlPortalGeneraciones };

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
    driveFolderId = opciones.driveFolderId || DRIVE_FOLDER_ID,
  } = opciones;

  console.log("=================================================");
  console.log(`🚀 GENERADOR DE BIBLIOTECA DIGITAL — GENERACIÓN ${generacion}`);
  console.log("=================================================");

  const catalogo = await recopilarCatalogoDrive(driveFolderId);

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
    driveFolderId: DRIVE_FOLDER_ID,
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

