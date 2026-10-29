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

### Acciones Disponibles desde la Aplicación:
Desde el **Panel de Control** de la aplicación tienes todo en un solo clic:
* **▶️ Iniciar / Detener Bot:** Conecta con WhatsApp, muestra el código QR automáticamente y monitorea el grupo.
* **🧹 Organizar Drive:** Revisa todo tu Google Drive, ordena archivos sueltos en sus respectivas carpetas de asignaturas y traslada duplicados a `_Duplicados`.
* **🚀 Publicar Biblioteca Web:** Compila la biblioteca digital interactiva y la sube en vivo a GitHub Pages.

---

## 📚 ¿Cómo cambiar o agregar materias cuando pasen de año?
Cuando pasen a 2° año, 3° año, etc., las asignaturas cambian:
1. Abre la aplicación y dirígete a la pestaña 📚 **Materias**.
2. Haz clic en **`+ Agregar Materia`**, escribe el nombre de la nueva asignatura e introduce sus palabras clave (*ej: fármaco, dosis, receta*).
3. Presiona **`Guardar Materias`** y listo. El clasificador la reconocerá de inmediato.

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

### 🚀 Publicación Web Automática (Cero configuración técnica para el delegado)
El bot ya incluye internamente la conexión segura al servidor oficial de la Biblioteca Digital:
* El delegado de la generación **NO necesita instalar Git, ni crear tokens, ni abrir consolas técnicas**.
* En la aplicación, el delegado solo debe ingresar la información de su curso:
  1. **Generación** (año de su cohorte, ej: `2026`, `2027`).
  2. **Carpeta de Google Drive** de su curso.
  3. **Grupo de WhatsApp** de su curso.
* Cada vez que el bot clasifique archivos o presiones el botón *"Publicar"*, la web de la generación se actualizará sola en segundo plano a través de internet.

---

### 📁 Alternativa sin internet: Directamente en Google Drive
* Cada vez que el bot clasifica apuntes o se presiona *"Publicar"*, también sube automáticamente el archivo **`INDICE_BIBLIOTECA.html`** a la raíz de Google Drive de tu generación.
* Cualquier estudiante puede hacer doble clic en ese archivo en su computador o celular y tendrá la misma biblioteca interactiva funcionando sin depender de GitHub ni servidores.

---

## ⚙️ Gestión de Archivos desde la Web (Mover, Renombrar y Eliminar)

Cualquier usuario o delegado con acceso a la página web puede gestionar los archivos de Google Drive directamente desde la biblioteca:

* **⚙️ Gestionar / 🏷️ Clasificar:** Cada tarjeta de archivo en la biblioteca cuenta con un botón de gestión.
* **✏️ Renombrar:** Puedes escribir un nuevo nombre descriptivo para el archivo (la extensión se preserva automáticamente).
* **📚 Mover de Categoría:** Puedes reubicar el archivo en otra asignatura, tipo de recurso (Apuntes, Certámenes, Controles, Seminarios, etc.) o semestre.
* **🗑️ Eliminar:** Permite enviar el archivo a la papelera de Google Drive con un clic previa confirmación de seguridad.
* **⚡ Respuesta Instantánea:** Al guardar o eliminar, los cambios se reflejan inmediatamente en la interfaz y se persisten en el navegador (`localStorage`) para que nunca vuelvan a aparecer desorganizados o borrados mientras se procesa la sincronización.

### ⏱️ Configuración del Webhook en Google Apps Script:

1. Ve a [script.google.com](https://script.google.com/) con la misma cuenta de Google dueña del Drive.
2. Crea un **Nuevo proyecto**, borra el código que aparezca y pega el contenido del archivo [`GOOGLE_APPS_SCRIPT.js`](file:///c:/Users/eduan/Desktop/Golgi%20bot/GOOGLE_APPS_SCRIPT.js).
3. Haz clic en **Implementar** > **Nueva implementación**:
   * Tipo: **Aplicación web**.
   * Ejecutar como: **Yo**.
   * Quién tiene acceso: **Cualquier persona**.
4. Copia la **URL de la aplicación web** (termina en `/exec`).
5. En la biblioteca web, al hacer clic en **"⚙️ Gestionar"** o **"🏷️ Clasificar"**, pega la URL en la cajita de configuración (se guarda automáticamente para siempre). También puedes guardarla en tu archivo `.env` como `APPS_SCRIPT_URL=https://.../exec`.

> 🔒 **Recomendación de Seguridad (PIN Opcional):**  
> En la línea 35 de `GOOGLE_APPS_SCRIPT.js` puedes definir un `PIN_SEGURIDAD = "1234"` (o el que elijas). Al pulsar "💾 Guardar Cambios" o "🗑️ Eliminar", la web te pedirá este PIN una sola vez y lo guardará en tu navegador, impidiendo que personas no autorizadas modifiquen o borren archivos.

---

## 🔑 ¿Cómo evitar que el permiso de Google Drive expire cada semana?
1. Entra a [Google Cloud Console](https://console.cloud.google.com/) en tu proyecto de Golgi Bot.
2. En el menú lateral, ve a **APIs y servicios** > **Pantalla de consentimiento de OAuth**.
3. Si el estado de publicación dice *"Prueba"* (Testing), haz clic en el botón **"Publicar la aplicación"** para pasarla a *"En producción"*.
   *(Aunque Google te indique que no está verificada, como tú eres el único usuario/desarrollador que la usa, puedes continuar sin problemas).*
4. De esta manera, el archivo `token.json` durará indefinidamente y no te pedirá volver a autorizar cada 7 días.

---
*Desarrollado para la carrera de Medicina por Eduardo Ortega — Golgi Bot.*
