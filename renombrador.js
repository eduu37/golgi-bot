import path from "path";

const PALABRAS_MENORES = new Set([
  "de", "del", "la", "las", "el", "los", "en", "y", "e", "o", "u",
  "a", "al", "con", "por", "para", "un", "una", "unos", "unas"
]);

const SIGLAS_PRESERVAR = new Set([
  "tp", "atm", "bcm", "ecm", "adn", "arn", "dna", "rna", "pcr",
  "tc", "rm", "ia", "pdf", "docx", "pptx", "xlsx", "mp4", "mp3",
  "c1", "c2", "c3", "sem", "cp", "ct", "s1", "s2", "s3", "s4", "s5", "s6"
]);

const NUMEROS_ROMANOS = new Set([
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"
]);

/**
 * Limpia y embellece un nombre de archivo caótico o con marcas de WhatsApp.
 */
export function limpiarNombre(nombreOriginal) {
  if (!nombreOriginal) return "Documento";

  // 1. Extraer extensión real (maneja dobles extensiones como .docx.pdf)
  let baseName = nombreOriginal;
  let extension = "";

  if (/\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)$/i.test(nombreOriginal)) {
    extension = path.extname(nombreOriginal);
    baseName = path.basename(nombreOriginal, extension);
    const subExt = path.extname(baseName);
    if (subExt) {
      baseName = path.basename(baseName, subExt);
    }
  } else {
    extension = path.extname(nombreOriginal);
    baseName = path.basename(nombreOriginal, extension);
  }

  // 2. Si el nombre es un hash crudo de exportación (ej. ACFrOgDmV3R...)
  const extLower = extension.toLowerCase();
  if (/^ACFrOg[a-zA-Z0-9_-]{20,}$/.test(baseName) || /^archivo_[a-f0-9]{10,}$/.test(baseName)) {
    if ([".mp4", ".mkv", ".avi", ".mov"].includes(extLower)) return `Video_Grabacion${extension}`;
    if ([".mp3", ".m4a", ".wav", ".ogg"].includes(extLower)) return `Audio_Grabacion${extension}`;
    if ([".apkg"].includes(extLower)) return `Mazo_Anki${extension}`;
    return `Documento_Escaneado${extension}`;
  }

  // 3. Eliminar marcas de exportación de WhatsApp (ej. _260928_203419 o _260924_091057)
  baseName = baseName.replace(/_\d{6}_\d{6}/g, "");

  // 4. Separación PascalCase (ej. PlanCorporal -> Plan Corporal)
  baseName = baseName.replace(/([a-z])([A-Z])/g, "$1 $2");

  // 5. Separar letras de números cuando la palabra tiene 2 o más letras (ej. Clase2 -> Clase 2, TP6 -> TP 6, certamen1 -> certamen 1)
  // Preserva C1, S6, etc.
  baseName = baseName.replace(/([a-zA-Z]{2,})(\d)/g, "$1 $2");
  baseName = baseName.replace(/(\d)([a-zA-Z]{2,})/g, "$1 $2");

  // 6. Reemplazar guiones bajos por espacios
  baseName = baseName.replace(/_+/g, " ");

  // 7. Si hay palabras en formato kebab-case (ej. seminario-4-bioenergetica), convertir a espacios
  // Preserva fechas (ej. 25-9-2026) y rangos numéricos (ej. 1-5)
  baseName = baseName.replace(/([a-zA-Z])-([a-zA-Z0-9])/g, "$1 $2");
  baseName = baseName.replace(/([a-zA-Z0-9])-([a-zA-Z])/g, "$1 $2");

  // 8. Normalizar guiones simples y espaciado (manteniendo ' - ' como separador elegante de títulos)
  baseName = baseName.replace(/-{2,}/g, " - ");
  baseName = baseName.replace(/\s+-\s+/g, " - ");
  baseName = baseName.replace(/\s+/g, " ");

  // 8. Quitar preposiciones o símbolos huérfanos al final (por cortes de WhatsApp, ej. 'cavidad nasal y')
  baseName = baseName.trim().replace(/[\s\-_]+(y|e|de|del|en|con|para|por)$/i, "").trim();
  baseName = baseName.replace(/[\s\-_]+$/, "").trim();

  // 9. Normalizar a formato título elegante (Title Case) respetando paréntesis y corchetes
  const tokens = baseName.split(" ");
  const tokensFormateados = tokens.map((token, index) => {
    const tokenLimpio = token.trim();
    if (!tokenLimpio) return "";
    if (tokenLimpio === "-") return "-";

    // Separar signos de apertura/cierre (ej. '[arellano]' -> '[', 'arellano', ']')
    const match = tokenLimpio.match(/^([(\[{]*)(.*?)([)\]},.:;]*)$/);
    if (!match) return tokenLimpio;

    const prefix = match[1];
    const core = match[2];
    const suffix = match[3];
    if (!core) return tokenLimpio;

    const lower = core.toLowerCase();

    // Preservar siglas médicas conocidas
    if (SIGLAS_PRESERVAR.has(lower)) {
      return `${prefix}${lower.toUpperCase()}${suffix}`;
    }

    // Preservar números romanos (I, II, III, IV, etc.)
    if (NUMEROS_ROMANOS.has(lower)) {
      return `${prefix}${lower.toUpperCase()}${suffix}`;
    }

    // Palabras menores (de, la, en, etc.) van en minúscula salvo al inicio de la frase o tras un guión
    const esInicio = index === 0 || tokens[index - 1] === "-";
    if (!esInicio && PALABRAS_MENORES.has(lower)) {
      return `${prefix}${lower}${suffix}`;
    }

    // Capitalización estándar
    const capitalizada = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
    return `${prefix}${capitalizada}${suffix}`;
  });

  const nombreLimpio = tokensFormateados.filter(Boolean).join(" ").trim();
  return `${nombreLimpio}${extension}`;
}

/**
 * Genera el nombre estandarizado para Google Drive.
 * Ejemplo: "Anatomía - Certámenes - Pauta Certamen 1 2023.pdf"
 */
export function generarNombreEstandar({
  nombreOriginal = "",
  materia = "",
  tipo = "",
  formato = "[Materia] - [Tipo] - [Nombre]",
}) {
  const nombreLimpio = limpiarNombre(nombreOriginal);
  const extension = path.extname(nombreLimpio);
  const baseLimpia = path.basename(nombreLimpio, extension);

  // Si no hay materia válida, solo retorna el nombre limpio
  if (!materia || materia === "Sin clasificar") {
    return nombreLimpio;
  }

  // Evita duplicar si el nombre ya incluye el nombre de la materia o tipo
  let nombreContenido = baseLimpia;
  const regexMateria = new RegExp(`^${materia}\\s*-\\s*`, "i");
  nombreContenido = nombreContenido.replace(regexMateria, "").trim();

  const regexTipo = new RegExp(`^${tipo}\\s*-\\s*`, "i");
  nombreContenido = nombreContenido.replace(regexTipo, "").trim();

  if (formato === "[Nombre]") {
    return `${nombreContenido}${extension}`;
  }

  return `${materia} - ${tipo} - ${nombreContenido}${extension}`;
}
