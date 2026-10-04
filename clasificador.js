import fs from "fs";
import path from "path";
import { GEMINI_API_KEY } from "./config.js";

let categoriasCache = null;

export function cargarReglas() {
  if (categoriasCache) return categoriasCache;
  const rutaJson = path.join(process.cwd(), "categorias.json");
  try {
    const data = fs.readFileSync(rutaJson, "utf-8");
    categoriasCache = JSON.parse(data);
    return categoriasCache;
  } catch (err) {
    console.error("⚠️ Error al leer categorias.json:", err.message);
    return {
      materiaPorDefecto: "Sin clasificar",
      tipoPorDefecto: "Documentos sin clasificar",
      materias: {},
      tipos: {},
    };
  }
}

export function normalizar(texto) {
  if (!texto) return "";
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Separar letras de números (ej. Clase2 -> clase 2, TP6 -> tp 6, c1 -> c 1, certamen1 -> certamen 1)
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


const SINONIMOS = {
  bioestat: "bioestadistica",
  bioestad: "bioestadistica",
  bioesta: "bioestadistica",
  anato: "anatomia",
  histo: "histologia",
  embrio: "embriologia",
  histoembrio: "histologia y embriologia",
  fisio: "fisiologia",
  quim: "quimica",
  bioq: "bioquimica",
  bcm: "biologia celular y molecular",
  biocel: "biologia celular y molecular",
  biomol: "biologia celular y molecular",
  salpub: "salud publica",
  cert: "certamen",
  solemne: "certamen",
  c1: "certamen",
  c2: "certamen",
  c3: "certamen",
  ctrl: "control",
  transcri: "transcripcion",
  atm: "articulacion temporomandibular",
  tp: "trabajo practico",
  diapo: "seminario",
  diapos: "seminario",
  slides: "seminario",
  ppt: "seminario",
  pptx: "seminario",
};


export function expandirSinonimos(texto) {
  if (!texto) return "";
  let resultado = ` ${texto} `;
  for (const [abrev, real] of Object.entries(SINONIMOS)) {
    const regex = new RegExp(`(?:^|[^a-z0-9])${abrev}(?:$|[^a-z0-9])`, "gi");
    resultado = resultado.replace(regex, (match) => {
      const leading = match[0].match(/[^a-z0-9]/i) ? match[0] : "";
      const trailing = match[match.length - 1].match(/[^a-z0-9]/i)
        ? match[match.length - 1]
        : "";
      return `${leading}${real}${trailing}`;
    });
  }
  return resultado.trim();
}

function coincideTermino(textoNormalizado, terminoNorm) {
  if (!terminoNorm || !textoNormalizado) return false;
  if (terminoNorm.includes(" ")) {
    return textoNormalizado.includes(terminoNorm);
  }
  // Coincidencia con límites de palabra para evitar falsos positivos
  // (ej. "adn" en "cadena", "sem" en "semana", "lab" en "palabra")
  const regex = new RegExp(
    `(?:^|[^a-z0-9])${terminoNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`,
    "i",
  );
  return regex.test(textoNormalizado);
}

// 📄 Extractor seguro de texto de la portada / primeras páginas de PDFs
export async function extraerTextoPDF(bufferMedia, maxChars = 2000) {
  if (!bufferMedia) return "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const uint8Data = new Uint8Array(bufferMedia);
    const parser = new PDFParse(uint8Data);
    await parser.load();
    const textoExtraido = await parser.getText();
    if (parser.destroy) {
      try {
        await parser.destroy();
      } catch {}
    }
    return (textoExtraido || "").substring(0, maxChars).trim();
  } catch (error) {
    // Si el PDF está protegido o no tiene texto seleccionable, se continúa sin error
    return "";
  }
}

// 🧠 NIVEL 1: Motor Local Ponderado con Límites de Palabra
export function clasificarLocal({
  filename = "",
  textoMensaje = "",
  textoCitado = "",
  textoDocumento = "",
  reglas = null,
}) {
  const cats = reglas || cargarReglas();
  const defaultMateria = cats.materiaPorDefecto || "Sin clasificar";
  const defaultTipo = cats.tipoPorDefecto || "Documentos sin clasificar";

  const fnNorm = expandirSinonimos(normalizar(filename));
  const msgNorm = expandirSinonimos(normalizar(textoMensaje));
  const quoteNorm = expandirSinonimos(normalizar(textoCitado));
  const docNorm = normalizar(textoDocumento);

  const scoresMaterias = {};
  const scoresTipos = {};

  for (const mat of Object.keys(cats.materias || {})) {
    scoresMaterias[mat] = 0;
  }
  for (const tip of Object.keys(cats.tipos || {})) {
    scoresTipos[tip] = 0;
  }

  // Ponderación de MATERIAS
  for (const [materia, palabras] of Object.entries(cats.materias || {})) {
    const materiaNorm = normalizar(materia);

    // Si coincide el nombre exacto de la materia
    if (coincideTermino(fnNorm, materiaNorm)) scoresMaterias[materia] += 15;
    if (coincideTermino(msgNorm, materiaNorm)) scoresMaterias[materia] += 10;
    if (coincideTermino(quoteNorm, materiaNorm)) scoresMaterias[materia] += 8;
    if (coincideTermino(docNorm, materiaNorm)) scoresMaterias[materia] += 5;

    for (const palabra of palabras) {
      const pNorm = normalizar(palabra);
      if (!pNorm || pNorm === materiaNorm) continue;

      if (coincideTermino(fnNorm, pNorm)) {
        scoresMaterias[materia] += pNorm.length > 7 ? 6 : 4;
      }
      if (coincideTermino(msgNorm, pNorm)) {
        scoresMaterias[materia] += pNorm.length > 7 ? 5 : 3;
      }
      if (coincideTermino(quoteNorm, pNorm)) {
        scoresMaterias[materia] += 4;
      }
      if (coincideTermino(docNorm, pNorm)) {
        scoresMaterias[materia] += 2;
      }
    }
  }

  // Ponderación de TIPOS
  for (const [tipo, palabras] of Object.entries(cats.tipos || {})) {
    const tipoNorm = normalizar(tipo);

    if (coincideTermino(fnNorm, tipoNorm)) scoresTipos[tipo] += 15;
    if (coincideTermino(msgNorm, tipoNorm)) scoresTipos[tipo] += 10;
    if (coincideTermino(quoteNorm, tipoNorm)) scoresTipos[tipo] += 8;
    if (coincideTermino(docNorm, tipoNorm)) scoresTipos[tipo] += 5;

    for (const palabra of palabras) {
      const pNorm = normalizar(palabra);
      if (!pNorm || pNorm === tipoNorm) continue;

      if (coincideTermino(fnNorm, pNorm)) {
        scoresTipos[tipo] += pNorm.length > 6 ? 6 : 4;
      }
      if (coincideTermino(msgNorm, pNorm)) {
        scoresTipos[tipo] += pNorm.length > 6 ? 5 : 3;
      }
      if (coincideTermino(quoteNorm, pNorm)) {
        scoresTipos[tipo] += 4;
      }
      if (coincideTermino(docNorm, pNorm)) {
        scoresTipos[tipo] += 2;
      }
    }
  }

  // Detección de patrones estructurales en nombres de archivo universitarios
  const tienePrefijoClase = /^\d+[\s\-_]/.test(filename.trim());
  if (tienePrefijoClase) {
    scoresTipos["Seminarios"] = (scoresTipos["Seminarios"] || 0) + 8;
  }

  // Taller de apoyo a seminarios / series de seminarios sin materia explícita pertenecen a BCM
  if (
    fnNorm.includes("taller de apoyo") ||
    fnNorm.includes("seminarios 1") ||
    fnNorm.includes("seminario 7") ||
    fnNorm.includes("bioenergetica")
  ) {
    scoresMaterias["Biología célular y molecular"] =
      (scoresMaterias["Biología célular y molecular"] || 0) + 12;
  }

  // Determinar ganadores
  const sortedMat = Object.entries(scoresMaterias).sort((a, b) => b[1] - a[1]);
  let topMat = sortedMat[0] && sortedMat[0][1] > 0 ? sortedMat[0] : null;
  const runnerUpMat = sortedMat[1] ? sortedMat[1][1] : 0;

  // Si se identificó claramente la materia pero no el tipo (ej. "Cavidad oral.docx", "cinemática 2.pdf"),
  // se infiere que es un apunte temático o seminario
  if (topMat && topMat[1] >= 4) {
    const hayTipoDetectado = Object.values(scoresTipos).some((v) => v > 0);
    if (!hayTipoDetectado) {
      if (/\.pptx?$/i.test(filename) || tienePrefijoClase) {
        scoresTipos["Seminarios"] = 8;
      } else {
        scoresTipos["Apuntes"] = 8;
      }
    }
  }

  const sortedTipo = Object.entries(scoresTipos).sort((a, b) => b[1] - a[1]);
  const topTipo = sortedTipo[0] && sortedTipo[0][1] > 0 ? sortedTipo[0] : null;
  const runnerUpTipo = sortedTipo[1] ? sortedTipo[1][1] : 0;

  const materiaElegida = topMat ? topMat[0] : defaultMateria;
  const tipoElegido = topTipo ? topTipo[0] : defaultTipo;

  // Cálculo de confianza heurística
  const matScore = topMat ? topMat[1] : 0;
  const tipoScore = topTipo ? topTipo[1] : 0;

  const matClear =
    (matScore >= 10 && matScore >= runnerUpMat * 1.5) ||
    (matScore >= 4 && runnerUpMat === 0);
  const tipoClear =
    (tipoScore >= 10 && tipoScore >= runnerUpTipo * 1.5) ||
    (tipoScore >= 4 && runnerUpTipo === 0);

  let confianza = 0.5;
  if (matClear && tipoClear) confianza = 0.95;
  else if (matClear || tipoClear) confianza = 0.8;
  else if (matScore > 0 || tipoScore > 0) confianza = 0.65;

  return {
    materia: materiaElegida,
    tipo: tipoElegido,
    confianza,
    scoreMateria: matScore,
    scoreTipo: tipoScore,
    metodo: "local",
    razon: `Puntaje heurístico (Materia: ${matScore}, Tipo: ${tipoScore})`,
  };

}

// 🤖 NIVEL 2: Clasificador con IA (Google Gemini 2.0 Flash)
export async function clasificarConGemini({
  filename = "",
  textoMensaje = "",
  textoCitado = "",
  textoDocumento = "",
  reglas = null,
  apiKey = GEMINI_API_KEY,
}) {
  if (!apiKey) {
    return null;
  }

  const cats = reglas || cargarReglas();
  const materiasPermitidas = Object.keys(cats.materias || {});
  const tiposPermitidos = Object.keys(cats.tipos || {});

  const systemPrompt = `Eres un clasificador universitario de alta precisión para un grupo de estudio de medicina/salud en Chile.
Tu objetivo es clasificar el archivo en exactamente UNA 'materia' y UN 'tipo' a partir de las siguientes opciones válidas:

MATERIAS VÁLIDAS:
${JSON.stringify([...materiasPermitidas, cats.materiaPorDefecto || "Sin clasificar"])}

TIPOS VÁLIDOS:
${JSON.stringify([...tiposPermitidos, cats.tipoPorDefecto || "Documentos sin clasificar"])}

REGLAS CRÍTICAS:
1. Debes responder ÚNICAMENTE un objeto JSON válido con los campos: "materia", "tipo", "confianza" (número entre 0 y 1) y "razon" (breve explicación).
2. Comprende modismos y jerga médica chilena (ej. "certamen", "solemne", "control", "quiz", "mini prueba", "recuperativo", "pauta", "ensayo", "diapos", "ppt", "apuntes", "anki", "bcm", "biocel", "salpub", "anato", "histo", "embrio", "bioestat").
3. Si el nombre del archivo es genérico (ej. "Certamen 1.pdf"), prioriza el texto del mensaje, el mensaje citado o el contenido del documento.
4. Si ninguna materia coincide con certeza, usa "${cats.materiaPorDefecto || "Sin clasificar"}".
5. Si ningún tipo coincide con certeza, usa "${cats.tipoPorDefecto || "Documentos sin clasificar"}".`;

  const userContext = `Analiza la siguiente información para clasificar el recurso:
- Nombre del archivo: "${filename || "Sin nombre"}"
- Mensaje en WhatsApp: "${textoMensaje || "Sin mensaje"}"
- Mensaje citado (al que responde): "${textoCitado || "Ninguno"}"
${textoDocumento ? `- Fragmento inicial del contenido del archivo:\n"""\n${textoDocumento.substring(0, 1500)}\n"""` : ""}`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userContext }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
    },
  };

  const modelosCandidatos = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ];

  for (const modelo of modelosCandidatos) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const candidateText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!candidateText) continue;

      const parsed = JSON.parse(candidateText.trim());

      // Validar que los valores devueltos sean exactos de nuestra lista
      let materiaFinal = cats.materiaPorDefecto || "Sin clasificar";
      let tipoFinal = cats.tipoPorDefecto || "Documentos sin clasificar";

      for (const m of materiasPermitidas) {
        if (normalizar(m) === normalizar(parsed.materia)) {
          materiaFinal = m;
          break;
        }
      }

      for (const t of tiposPermitidos) {
        if (normalizar(t) === normalizar(parsed.tipo)) {
          tipoFinal = t;
          break;
        }
      }

      return {
        materia: materiaFinal,
        tipo: tipoFinal,
        confianza: parsed.confianza || 0.98,
        metodo: `gemini (${modelo})`,
        razon: parsed.razon || "Clasificado por Gemini AI",
      };
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }
  return null;
}


// 🎯 FUNCIÓN PRINCIPAL EXPORTADA (Soporta objetos o parámetros posicionales)
export async function clasificarArchivo(param1 = "", param2 = "") {
  let filename = "";
  let textoMensaje = "";
  let textoCitado = "";
  let bufferMedia = null;

  if (typeof param1 === "object" && param1 !== null) {
    filename = param1.filename || "";
    textoMensaje = param1.textoMensaje || param1.caption || "";
    textoCitado = param1.textoCitado || "";
    bufferMedia = param1.bufferMedia || null;
  } else {
    filename = param1 || "";
    textoMensaje = param2 || "";
  }

  const reglas = cargarReglas();

  // 1. Evaluación local rápida con límites de palabra
  const resultadoLocal = clasificarLocal({
    filename,
    textoMensaje,
    textoCitado,
    reglas,
  });

  // Si la clasificación local tiene alta confianza (ej. "Certamen 1 Anatomía")
  // se devuelve de inmediato en menos de 1 ms sin gastar API.
  if (resultadoLocal.confianza >= 0.9) {
    return {
      materia: resultadoLocal.materia,
      tipo: resultadoLocal.tipo,
      confianza: resultadoLocal.confianza,
      metodo: "local_alta_confianza",
      razon: resultadoLocal.razon,
    };
  }

  // 2. Si la confianza es media o baja, intentamos extraer texto del PDF (portada)
  let textoDocumento = "";
  const esPdf = filename.toLowerCase().endsWith(".pdf");
  if (bufferMedia && esPdf) {
    try {
      textoDocumento = await extraerTextoPDF(bufferMedia, 2000);
    } catch {}
  }

  // Reevaluamos localmente con el texto del documento incorporado
  let resultadoLocalConDoc = resultadoLocal;
  if (textoDocumento) {
    resultadoLocalConDoc = clasificarLocal({
      filename,
      textoMensaje,
      textoCitado,
      textoDocumento,
      reglas,
    });

    if (resultadoLocalConDoc.confianza >= 0.9 && !GEMINI_API_KEY) {
      return {
        materia: resultadoLocalConDoc.materia,
        tipo: resultadoLocalConDoc.tipo,
        confianza: resultadoLocalConDoc.confianza,
        metodo: "local_con_documento",
        razon: resultadoLocalConDoc.razon,
      };
    }
  }

  // 3. Nivel de Alta Precisión con Gemini AI
  if (GEMINI_API_KEY) {
    try {
      const resultadoGemini = await clasificarConGemini({
        filename,
        textoMensaje,
        textoCitado,
        textoDocumento,
        reglas,
      });

      if (resultadoGemini) {
        return resultadoGemini;
      }
    } catch (err) {
      console.error("⚠️ Error consultando Gemini, usando respaldo local:", err.message);
    }
  }

  // 4. Respaldo definitivo (mejor resultado local acumulado)
  return {
    materia: resultadoLocalConDoc.materia,
    tipo: resultadoLocalConDoc.tipo,
    confianza: resultadoLocalConDoc.confianza,
    metodo: "local_fallback",
    razon: resultadoLocalConDoc.razon,
  };
}
