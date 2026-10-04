import path from 'path';

// Carga automática de variables de entorno desde .env si existe
try {
  if (process.loadEnvFile) {
    process.loadEnvFile();
  }
} catch {
  // Si no existe .env, continúa normalmente con variables de entorno del sistema
}

export const TARGET_GROUP_ID = process.env.TARGET_GROUP_ID || ''; 
export const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || ''; 
export const EXTENSIONES_PROHIBIDAS = ['png', 'jpg', 'jpeg', 'webp'];

// API Key para el clasificador inteligente con Gemini Flash
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 🚀 Mejoras avanzadas de organización
export const ESTANDARIZAR_NOMBRES = true;
export const DETECTAR_DUPLICADOS_HASH = true;
export const FORMATO_NOMBRE = '[Nombre]'; // '[Nombre]' o '[Materia] - [Tipo] - [Nombre]'
export const AISLAR_DUPLICADOS = true; // Mueve archivos idénticos (mismo MD5) a carpeta '_Duplicados'
export const AUTO_ACTUALIZAR_INDICE = true; // Regenera y sincroniza automáticamente INDICE_BIBLIOTECA en Drive
export const AUTO_PUBLICAR_GITHUB = true; // Sube automáticamente los cambios a GitHub Pages al detectar nuevos archivos o enlaces

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
export const TOKEN_PATH = path.join(process.cwd(), 'token.json');
export const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
export const STATE_PATH = path.join(process.cwd(), 'estado.json');
