import {
  DRIVE_FOLDER_ID,
  ESTANDARIZAR_NOMBRES,
  DETECTAR_DUPLICADOS_HASH,
  FORMATO_NOMBRE,
  AISLAR_DUPLICADOS,
  AUTO_ACTUALIZAR_INDICE,
} from "./config.js";
import {
  iniciarDrive,
  listarTodosLosArchivos,
  obtenerOCrearCarpeta,
  moverArchivo,
  renombrarArchivoEnDrive,
} from "./drive.js";
import { clasificarArchivo } from "./clasificador.js";
import { generarNombreEstandar } from "./renombrador.js";

// Argumentos opcionales de línea de comandos:
// node ordenador.js --dry-run          (Simulación sin modificar Drive)
// node ordenador.js --sin-renombrar   (Solo mueve, no renombra)
// node ordenador.js --sin-aislar      (Detecta duplicados pero no los mueve a _Duplicados)
const args = process.argv.slice(2);
const esDryRun = args.includes("--dry-run");
const renombrarActivo = ESTANDARIZAR_NOMBRES && !args.includes("--sin-renombrar");
const aislarDuplicadosActivo = AISLAR_DUPLICADOS && !args.includes("--sin-aislar");

async function ejecutarOrdenamientoTotal() {
  console.log("=================================================");
  console.log("🚀 ORDENADOR INTELIGENTE DE GOOGLE DRIVE");
  if (esDryRun) console.log("🧪 MODO SIMULACIÓN (--dry-run): No se harán cambios reales.");
  console.log("=================================================");

  await iniciarDrive();
  console.log("✅ Conectado exitosamente a Google Drive.");

  console.log("🔍 Escaneando todas las carpetas y subcarpetas...");
  const archivos = await listarTodosLosArchivos(DRIVE_FOLDER_ID);

  if (archivos.length === 0) {
    console.log("✨ No hay ningún archivo en todo tu Drive. Está vacío.");
    process.exit(0);
  }

  console.log(`📦 Se encontraron ${archivos.length} archivos en total.`);

  // -------------------------------------------------------------
  // FASE 1: DETECCIÓN Y AISLAMIENTO DE DUPLICADOS EXACTOS (HASH MD5)
  // -------------------------------------------------------------
  const mapaHashes = new Map();
  const idsDuplicados = new Set();
  const duplicadosEncontrados = [];

  if (DETECTAR_DUPLICADOS_HASH) {
    console.log("\n⚡ Fase 1: Analizando huellas digitales (MD5) para detectar duplicados...");

    for (const archivo of archivos) {
      if (!archivo.md5Checksum) continue;
      if (archivo.name === "Enlaces_Guardados" || archivo.name === "Enlaces_Guardados.csv") continue;

      if (mapaHashes.has(archivo.md5Checksum)) {
        const original = mapaHashes.get(archivo.md5Checksum);
        duplicadosEncontrados.push({ original, duplicado: archivo });
        idsDuplicados.add(archivo.id);
      } else {
        mapaHashes.set(archivo.md5Checksum, archivo);
      }
    }

    if (duplicadosEncontrados.length > 0) {
      console.log(`⚠️ Se detectaron ${duplicadosEncontrados.length} archivo(s) repetidos exactamente por contenido:`);
      for (const d of duplicadosEncontrados) {
        console.log(`   - Repetido: "${d.duplicado.name}"`);
        console.log(`     Original: "${d.original.name}" (MD5: ${d.duplicado.md5Checksum})`);
      }

      if (aislarDuplicadosActivo) {
        console.log(`\n📦 Moviendo archivos duplicados a la carpeta "_Duplicados" para limpiar las materias...`);
        let idCarpetaDuplicados = null;
        if (!esDryRun) {
          idCarpetaDuplicados = await obtenerOCrearCarpeta("_Duplicados", DRIVE_FOLDER_ID);
        }

        for (const d of duplicadosEncontrados) {
          const carpetaActualId = d.duplicado.parents ? d.duplicado.parents[0] : null;
          if (carpetaActualId === idCarpetaDuplicados) continue;

          console.log(`   🚚 Aislater duplicado: "${d.duplicado.name}" ➡️ _Duplicados`);
          if (!esDryRun) {
            await moverArchivo(d.duplicado.id, carpetaActualId, idCarpetaDuplicados);
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }
    } else {
      console.log("✨ No se encontraron archivos duplicados por hash.");
    }
  }

  // -------------------------------------------------------------
  // FASE 2: CLASIFICACIÓN, ESTANDARIZACIÓN DE NOMBRES Y UBICACIÓN
  // -------------------------------------------------------------
  console.log("\n⚡ Fase 2: Clasificando y reubicando archivos únicos...");
  let movidos = 0;
  let renombrados = 0;
  let intactos = 0;

  for (const archivo of archivos) {
    // 🛑 EXCEPCIONES:
    if (archivo.name === "Enlaces_Guardados" || archivo.name === "Enlaces_Guardados.csv") {
      continue;
    }
    // Si fue aislado como duplicado, no lo procesamos de nuevo
    if (idsDuplicados.has(archivo.id) && aislarDuplicadosActivo) {
      continue;
    }

    const carpetaActualId = archivo.parents ? archivo.parents[0] : null;

    // 1. Clasificamos según el nombre (con categorias.json)
    const { materia, tipo } = await clasificarArchivo(archivo.name, "");

    // 🛑 Si el nombre no especifica materia pero ya vive en una subcarpeta válida, no degradar
    if (materia === "Sin clasificar" && carpetaActualId && carpetaActualId !== DRIVE_FOLDER_ID) {
      intactos++;
      continue;
    }

    // 2. Estandarización inteligente de nombre (Smart Renamer)
    let nombreActual = archivo.name;
    if (renombrarActivo) {
      const nuevoNombre = generarNombreEstandar({
        nombreOriginal: nombreActual,
        materia,
        tipo,
        formato: FORMATO_NOMBRE,
      });

      if (nuevoNombre !== nombreActual) {
        console.log(`🏷️ Renombrando: "${nombreActual}"`);
        console.log(`   ➡️ "${nuevoNombre}"`);
        if (!esDryRun) {
          const renombradoOk = await renombrarArchivoEnDrive(archivo.id, nuevoNombre);
          if (renombradoOk) {
            renombrados++;
            nombreActual = nuevoNombre;
          }
        } else {
          renombrados++;
          nombreActual = nuevoNombre;
        }
      }
    }

    // 3. Obtenemos las carpetas destino
    let idSubcarpetaFinal = null;
    if (!esDryRun) {
      const idCarpetaMateria = await obtenerOCrearCarpeta(materia, DRIVE_FOLDER_ID);
      idSubcarpetaFinal = await obtenerOCrearCarpeta(tipo, idCarpetaMateria);
    }

    // 4. Verificamos si ya está en la ubicación correcta
    if (!esDryRun && carpetaActualId === idSubcarpetaFinal) {
      intactos++;
      continue;
    }

    console.log(`🔄 Reubicando: "${nombreActual}"`);
    console.log(`   ➡️ Destino: ${materia} / ${tipo}`);

    if (!esDryRun) {
      const exito = await moverArchivo(
        archivo.id,
        carpetaActualId,
        idSubcarpetaFinal,
      );
      if (exito) movidos++;
      // Pequeña pausa para no saturar la API de Google
      await new Promise((resolve) => setTimeout(resolve, 800));
    } else {
      movidos++;
    }
  }

  // -------------------------------------------------------------
  // FASE 3: REGENERACIÓN AUTOMÁTICA DEL ÍNDICE DE DRIVE
  // -------------------------------------------------------------
  if (AUTO_ACTUALIZAR_INDICE && !args.includes("--sin-indice")) {
    console.log("\n📑 Fase 3: Actualizando y sincronizando el Índice de la Biblioteca en Drive...");
    try {
      const { generarYSincronizarIndice } = await import("./indice.js");
      await generarYSincronizarIndice({ subirADrive: !esDryRun });
    } catch (errIndice) {
      console.error("⚠️ No se pudo regenerar el índice:", errIndice.message);
    }
  }

  console.log("\n=================================================");
  console.log("✅ TAREA DE ORDENAMIENTO FINALIZADA");
  console.log(`📂 Archivos totales analizados: ${archivos.length}`);
  console.log(`🔁 Duplicados detectados por MD5: ${duplicadosEncontrados.length}`);
  if (aislarDuplicadosActivo) {
    console.log(`📦 Duplicados aislados en "_Duplicados": ${duplicadosEncontrados.length}`);
  }
  console.log(`🏷️ Nombres estandarizados / limpiados: ${renombrados}`);
  console.log(`🚚 Archivos reubicados a su carpeta: ${movidos}`);
  console.log(`👍 Ya estaban bien ubicados: ${intactos}`);
  if (esDryRun) console.log("🧪 Recordatorio: Fue una ejecución de prueba (--dry-run).");
  console.log("=================================================");
  process.exit(0);
}

ejecutarOrdenamientoTotal();
