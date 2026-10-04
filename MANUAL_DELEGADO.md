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

### Paso 2: Abrir la Aplicación de Escritorio
Abre la carpeta del bot y haz **doble clic** en:
* 🪟 En Windows: **`ABRIR_GOLGI_BOT.bat`**
* 🍎 En Mac: **`ABRIR_GOLGI_BOT.command`**

Se abrirá una ventana visual con botones modernos y modo oscuro. Desde allí podrás:
1. **Configurar tu carpeta de Drive y Grupo de WhatsApp** desde la pestaña ⚙️ **Configuración**.
2. **Escanear el código QR** que aparece directamente en pantalla.
3. **Iniciar o detener el bot** con el botón `[ Iniciar Bot ]`.
4. **Ver los registros en vivo** en la consola integrada.
5. **Gestionar las asignaturas** de tu curso desde la pestaña 📚 **Materias**.

---

### Alternativa: Asistente Rápido por Terminal
Si prefieres usar los lanzadores individuales numerados:
* **`1 - CONFIGURAR_BOT`**: Asistente rápido paso a paso en español.
* **`2 - INICIAR_BOT`**: Inicia el bot directamente.
* **`3 - ORDENAR_DRIVE`**: Limpia y organiza el Drive.
* **`4 - ACTUALIZAR_WEB`**: Actualiza GitHub Pages.

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
1. Comprime toda la carpeta en un archivo **ZIP** (o compárteles el enlace del repositorio de GitHub).
2. Envíales este mismo documento (`MANUAL_DELEGADO.md`).
3. El nuevo delegado solo tendrá que instalar Node.js, abrir la aplicación (**`ABRIR_GOLGI_BOT.bat`** o **`ABRIR_GOLGI_BOT.command`**) y vincular su propio grupo de WhatsApp y su propia carpeta de Drive en la pestaña ⚙️ **Configuración**.

---

## 🌐 ¿Cómo funciona la Página Web y la división por Generaciones?

### 🎓 Páginas Independientes por Generación y Portal Central
El sistema separa el material automáticamente para que cada generación tenga su propio rincón:
1. En la aplicación (pestaña ⚙️ **Configuración**), cada curso define su año en **Generación** (por ejemplo: `2026`, `2027`, etc.).
2. El bot genera:
   * **Una web independiente para tu curso:** `https://eduu37.github.io/golgi-bot/2026/` (o el repositorio correspondiente).
   * **Un Portal Central de la Carrera:** `https://eduu37.github.io/golgi-bot/`, donde aparecen las tarjetas de todas las generaciones registradas con accesos directos, estadísticas y fechas de actualización. De esta forma, las generaciones nuevas pueden consultar el material que dejaron las generaciones anteriores sin pisarse entre sí.

---

### 🚀 ¿Cómo publicar la web si el delegado NO tiene Git instalado en su PC?

Un estudiante de Medicina no necesita instalar Git ni abrir la terminal:
1. En GitHub, ve a tu foto de perfil $\rightarrow$ **Settings** $\rightarrow$ **Developer settings** $\rightarrow$ **Personal access tokens** $\rightarrow$ **Tokens (classic)** (o Fine-grained).
2. Haz clic en **Generate new token**, dale un nombre (ej: *Golgi Bot*) y marca la casilla **`repo`** (o permisos de lectura y escritura de contenido).
3. Copia el token que empieza con `ghp_...` o `github_pat_...`.
4. Abre la aplicación de Golgi Bot, ve a la pestaña ⚙️ **Configuración**, pega el token en la casilla **"Token de GitHub"** y haz clic en **Guardar Cambios**.
5. **¡Listo!** El bot usará internet para subir y actualizar la página web automáticamente cada vez que procese apuntes o le des a *"Publicar"*, **sin necesidad de tener Git instalado en tu computador**.

---

### 📁 Alternativa sin internet: Directamente en Google Drive
* Cada vez que el bot clasifica apuntes o se presiona *"Publicar"*, también sube automáticamente el archivo **`INDICE_BIBLIOTECA.html`** a la raíz de Google Drive de tu generación.
* Cualquier estudiante puede hacer doble clic en ese archivo en su computador o celular y tendrá la misma biblioteca interactiva funcionando sin depender de GitHub ni servidores.

---
*Desarrollado para la carrera de Medicina por Eduardo Ortega — Golgi Bot.*
