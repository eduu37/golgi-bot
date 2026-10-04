# 🧬 Manual de Uso y Traspaso — Golgi Bot
### Guía oficial para Delegados y Encargados de Generación en Medicina
*(Diseñado para personas sin ningún conocimiento previo de programación)*

---

## 📌 ¿Qué hace este sistema?
**Golgi Bot** es un asistente automatizado para WhatsApp y Google Drive que:
1. **Descarga y clasifica** todos los apuntes, certámenes, controles, seminarios y videos enviados al grupo de WhatsApp.
2. **Elimina duplicados** automáticamente para no llenar el Drive de tu generación.
3. **Crea y actualiza una Biblioteca Digital interactiva en la web** accesible para todos tus compañeros sin costo.

---

## 🚀 Inicio Rápido (En 3 Pasos)

### Paso 1: Instalar Node.js (Solo la primera vez en el computador)
1. Entra a [https://nodejs.org/](https://nodejs.org/).
2. Descarga la versión **LTS (Recomendada para la mayoría)**.
3. Abre el instalador y dale a *"Siguiente / Next"* en todo hasta finalizar.

---

### Paso 2: Configurar tu Generación
Abre la carpeta del bot y haz **doble clic** en:
* 🪟 En Windows: **`1 - CONFIGURAR_BOT.bat`**
* 🍎 En Mac: **`1 - CONFIGURAR_BOT.command`**

El asistente te preguntará en español:
1. **Carpeta de Google Drive:** Solo pega el enlace normal de la carpeta de Drive de tu generación (el programa extrae el código automáticamente).
2. **Clave de Gemini AI:** Es opcional y gratuita; puedes pegarla o presionar Enter para omitir.
3. **Grupo de WhatsApp:** Elige la opción `[1]`, escanea el código QR que aparecerá en pantalla con tu WhatsApp (como si fuera WhatsApp Web) y selecciona tu grupo de la lista.

> ✅ ¡Listo! No tienes que tocar ni editar ningún archivo de código.

---

### Paso 3: Encender el Bot en el día a día
Cada vez que quieras que el bot revise el grupo y guarde materiales:
* 🪟 En Windows: Doble clic en **`2 - INICIAR_BOT.bat`**
* 🍎 En Mac: Doble clic en **`2 - INICIAR_BOT.command`**

Verás una ventana negra que mostrará el progreso. Cuando termine de procesar los mensajes, enviará automáticamente el reporte con el link de la biblioteca al grupo.

---

## 🛠️ Herramientas Extra (1 Clic)

| Archivo | ¿Para qué sirve? |
| :--- | :--- |
| **`3 - ORDENAR_DRIVE`** | Revisa todo tu Google Drive, ordena archivos sueltos en carpetas y mueve los duplicados a `_Duplicados`. |
| **`4 - ACTUALIZAR_WEB`** | Vuelve a generar la página web de la biblioteca y la sincroniza con GitHub Pages. |

---

## 📚 ¿Cómo cambiar o agregar materias cuando pasen de año?
Cuando pasen a 2° año, 3° año, etc., las asignaturas cambian. Para cambiar las materias:
1. Abre el archivo **`categorias.json`** con el Bloc de Notas o cualquier editor de texto.
2. Verás una lista de materias con sus palabras clave:
   ```json
   "Anatomía": ["anato", "osteología", "músculos"],
   "Fisiología": ["fisio", "potencial de acción", "sinapsis"]
   ```
3. Solo cambia o agrega los nombres de las asignaturas nuevas de tu curso y guarda el archivo (`Ctrl + G`).

---

## 🔄 ¿Cómo traspasar el bot a la siguiente generación?
1. Comprime toda la carpeta en un archivo **ZIP** (o compárteles el repositorio de GitHub).
2. Envíales este mismo documento (`MANUAL_DELEGADO.md`).
3. El nuevo delegado solo tendrá que instalar Node.js, abrir **`1 - CONFIGURAR_BOT`** y vincular su propio grupo de WhatsApp y su propia carpeta de Drive.

---
*Desarrollado para la carrera de Medicina por Eduardo Ortega — Golgi Bot.*
