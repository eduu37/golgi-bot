import path from 'path';
import { execSync } from 'child_process';

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

// 🎓 Generación y Repositorio
export const GENERACION = (process.env.GENERACION || '2026').trim().replace(/[^a-zA-Z0-9_-]/g, '') || '2026';
export const GITHUB_REPO = (process.env.GITHUB_REPO || 'eduu37/golgi-bot').trim();
export const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
export const GITHUB_BRANCH = (process.env.GITHUB_BRANCH || 'main').trim();

// ⚡ Webhook de Google Apps Script para mover archivos directo con 1 clic desde la web
export const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzKDFJqHLSFQ9yuqz1Z0zB5m9pigYJx52SDDSrMg9n7M9-xtCF0UIKV-H2VEs-ar5JMKw/exec').trim();

// 📅 Semestre académico actual (por defecto 1)
export const SEMESTRE_DEFAULT = (process.env.SEMESTRE || '1').trim();

// Detección automática del enlace de la biblioteca web (GitHub Pages)
export function obtenerUrlBibliotecaWeb(subpath = '') {
  let base = '';
  if (process.env.GITHUB_PAGES_URL && process.env.GITHUB_PAGES_URL.trim() !== '') {
    base = process.env.GITHUB_PAGES_URL.trim();
  } else {
    try {
      const remote = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/i);
      if (match && match[1] && match[2]) {
        base = `https://${match[1].toLowerCase()}.github.io/${match[2].toLowerCase()}/`;
      }
    } catch {}
    if (!base) {
      const partes = GITHUB_REPO.split('/');
      if (partes.length === 2) {
        base = `https://${partes[0].toLowerCase()}.github.io/${partes[1].toLowerCase()}/`;
      } else {
        base = 'https://eduu37.github.io/golgi-bot/';
      }
    }
  }

  if (!base.endsWith('/')) base += '/';
  if (subpath) {
    const cleanSub = subpath.replace(/^\/+|\/+$/g, '');
    return `${base}${cleanSub}/`;
  }
  return base;
}

export const GITHUB_PAGES_URL = obtenerUrlBibliotecaWeb();
export const GITHUB_PAGES_GENERACION_URL = obtenerUrlBibliotecaWeb(GENERACION);

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
export const TOKEN_PATH = path.join(process.cwd(), 'token.json');
export const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
export const STATE_PATH = path.join(process.cwd(), 'estado.json');
