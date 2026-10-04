# 📚 Golgi Bot — Asistente de Estudio y Biblioteca Digital

Sistema automatizado de captura, clasificación académica y biblioteca digital que conecta un **grupo de WhatsApp de Medicina** con **Google Drive**, manteniendo todo el material de estudio (certámenes, controles, resúmenes, apuntes, seminarios y ankis) impecablemente ordenado y accesible para toda la generación.

---

## 🌟 Características Principales

### 1. 🧠 Clasificador Académico Híbrido (Local + Gemini AI)
* **Reglas locales de alta precisión:** Normalización fonética, eliminación de acentos, segmentación letra-dígito (`Clase2` $\rightarrow$ `Clase 2`, `TP6` $\rightarrow$ `TP 6`), límites de palabra (`\b...\b`), pesos jerárquicos y diccionario de jerga médica chilena en `categorias.json`.
* **Extracción de portada PDF:** Lee las primeras páginas de guías y certámenes escaneados para detectar la materia aunque el archivo no tenga nombre descriptivo.
* **Integración con Google Gemini Flash:** Clasificación de respaldo mediante IA para documentos de contenido ambiguo.

### 2. ⚡ Detección Real de Duplicados por Hash MD5
* Compara la **huella digital de contenido** (`md5Checksum`) de cada archivo contra el catálogo de Drive en memoria ($O(1)$).
* Si un compañero vuelve a enviar un apunte con otro nombre, el bot lo detecta inmediatamente y omite la subida redundante.
* En el Drive existente, aísla automáticamente los archivos repetidos en la carpeta `_Duplicados` para no ensuciar las materias.

### 3. 🏷️ Smart Renamer (Estandarizador de Nombres)
* Transforma nombres caóticos, códigos hash y marcas de exportación de WhatsApp en títulos limpios en formato *Title Case*:
  * `Cavidad oral.docx.pdf` $\rightarrow$ **`Cavidad Oral.pdf`**
  * `SEM SEMANA 6 auryy_260928_203419.pdf` $\rightarrow$ **`SEM Semana 6 Auryy.pdf`**
  * `Tp1 - Unidad2 Histología.pdf` $\rightarrow$ **`TP 1 - Unidad 2 Histología.pdf`**
  * `Clase2_Gastrulacion_PlanCorporal.docx` $\rightarrow$ **`Clase 2 Gastrulacion Plan Corporal.docx`**
* Preserva siglas médicas (`TP`, `ATM`, `BCM`, `ECM`, `ADN`, `ARN`, `SEM`, `CP`, `C1`, `C2`) y números romanos (`I`, `II`, `III`, etc.).

### 4. 🌐 Biblioteca Digital e Índice Automático (GitHub Pages)
* Genera una aplicación web estática e interactiva en `docs/index.html` con:
  * 🔍 **Buscador instantáneo en vivo** ($0\text{ ms}$ de latencia).
  * 🏷️ **Filtros combinados por Materia y Tipo de Recurso**.
  * 📱 **Diseño moderno, responsive y Dark Mode Glassmorphism**.
  * 🔗 **Botones directos "Abrir en Drive ↗" y copiar enlace**.
* Sincroniza simultáneamente un **Google Sheet nativo** en la raíz de Google Drive (`INDICE_BIBLIOTECA`) y un índice en Markdown (`INDICE_BIBLIOTECA.md`).

---

## 📁 Estructura del Proyecto

```text
├── app/                       # Interfaz visual de escritorio (HTML/CSS/JS)
├── electron-main.js           # Proceso principal de Electron (App de escritorio)
├── electron-preload.cjs       # Puente seguro de Electron IPC
├── ABRIR_GOLGI_BOT.bat        # Lanzador 1-clic para Windows
├── ABRIR_GOLGI_BOT.command    # Lanzador 1-clic para macOS
├── index.js                   # Proceso principal: Bot de WhatsApp en tiempo real
├── sincronizador-git.js       # Sincronizador autónomo de GitHub Pages por HTTP API
├── ordenador.js               # Escáner profundo y reordenador autónomo de Google Drive
├── indice.js                  # Generador y publicador de la biblioteca por generaciones
├── clasificador.js            # Motor de clasificación por reglas y Gemini AI
├── renombrador.js             # Motor de limpieza y estandarización de nombres
├── drive.js                   # Módulo de integración con la API de Google Drive v3
├── enlaces.js                 # Extractor y acumulador de enlaces compartidos
├── status.js                  # Persistencia del último mensaje procesado
├── categorias.json            # Taxonomía y términos clave de las asignaturas
├── generaciones.json          # Registro histórico de generaciones académicas
├── docs/                      # Web pública servida por GitHub Pages (Portal y Generaciones)
├── config.js                  # Parámetros y utilidades del bot
├── MANUAL_DELEGADO.md         # Guía no técnica para delegados
├── .env.example               # Plantilla de variables de entorno
└── .gitignore                 # Protección estricta de credenciales y sesiones
```

---

## 🚀 Requisitos e Instalación

1. **Node.js** (versión 20 o superior recomendada):
   ```bash
   node --version
   ```

2. **Clonar e instalar dependencias:**
   ```bash
   git clone https://github.com/TU_USUARIO/golgi-bot.git
   cd golgi-bot
   npm install
   ```

3. **Configurar Credenciales de Google Drive:**
   * Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
   * Habilita la **Google Drive API**.
   * Descarga el archivo de credenciales OAuth 2.0 y guárdalo en la raíz del proyecto como `credentials.json`.

4. **Iniciar la Aplicación:**
   * Puedes hacer doble clic en `ABRIR_GOLGI_BOT.bat` (Windows) o `ABRIR_GOLGI_BOT.command` (macOS), o ejecutar:
     ```bash
     npm run app
     ```

---

## 💻 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run app` | Abre la aplicación gráfica de escritorio de Golgi Bot |
| `npm start` | Inicia el bot de WhatsApp por consola y procesa mensajes |
| `npm run ordenar` | Escanea todo tu Google Drive, aísla duplicados y reordena los archivos |
| `npm run ordenar:simular` | Modo prueba (`--dry-run`): Muestra qué cambios se harían sin alterar Drive |
| `npm run indice` | Regenera y sincroniza la Biblioteca Digital en local, GitHub Pages y Drive |
| `npm run indice:abrir` | Regenera la biblioteca y la abre de inmediato en tu navegador |
| `npm run indice:local` | Genera los archivos HTML locales sin sincronizar con Drive ni GitHub |

---

## 🌐 Publicación en GitHub Pages

1. Sube este repositorio a tu cuenta de GitHub.
2. En tu repositorio, ve a **Settings** $\rightarrow$ **Pages**.
3. En **Build and deployment**:
   * **Source**: `Deploy from a branch`
   * **Branch**: `main` y selecciona la carpeta `/docs`.
4. Haz clic en **Save**. Tu biblioteca estará disponible en:
   ```text
   https://<tu-usuario>.github.io/<nombre-repo>/
   ```

---

## 🔒 Seguridad y Privacidad

El archivo `.gitignore` está configurado para **proteger estrictamente**:
* Claves de API (`.env`)
* Credenciales de Google Drive (`credentials.json`, `token.json`)
* Sesiones autenticadas de WhatsApp (`.wwebjs_auth/`)
* Registros temporales y archivos de estado local

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
