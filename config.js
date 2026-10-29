import fs from 'fs';
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
export const APPS_SCRIPT_URL = (process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwte8RGJo-cmbWxRGOz5M33rui7v-0KVK7tqhnHzZRwP3tBMys8jcjXE2HmXDH7TOlqXQ/exec').trim();

// 📅 Semestre académico actual (por defecto lee de .env, malla.json o '2')
let semPorDefecto = (process.env.SEMESTRE || '').trim();
if (!semPorDefecto) {
  try {
    const rutaMalla = path.join(process.cwd(), 'malla.json');
    if (fs.existsSync(rutaMalla)) {
      const malla = JSON.parse(fs.readFileSync(rutaMalla, 'utf8'));
      if (malla && malla.semestreActivo) {
        semPorDefecto = String(malla.semestreActivo).trim();
      }
    }
  } catch {}
}
export const SEMESTRE_DEFAULT = semPorDefecto || '2';

// Detección automática del enlace de la biblioteca web (GitHub Pages)
export function obtenerUrlBaseGithubPages() {
  let base = '';
  if (process.env.GITHUB_PAGES_URL && process.env.GITHUB_PAGES_URL.trim() !== '') {
    base = process.env.GITHUB_PAGES_URL.trim();
  } else {
    try {
      const remote = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/i);
      if (match && match[1] && match[2]) {
        base = `https://${match[1].toLowerCase()}.github.io/${match[2].toLowerCase()}`;
      }
    } catch {}
    if (!base) {
      const partes = GITHUB_REPO.split('/');
      if (partes.length === 2) {
        base = `https://${partes[0].toLowerCase()}.github.io/${partes[1].toLowerCase()}`;
      } else {
        base = 'https://eduu37.github.io/golgi-bot';
      }
    }
  }

  // Eliminar cualquier subcarpeta numérica de generación al final (ej: /2026/ o /2026) para tener la raíz limpia del repositorio
  base = base.replace(/\/+\d{4}\/?$/i, '').replace(/\/+$/, '') + '/';
  return base;
}

export function obtenerUrlBibliotecaWeb(subpath = '') {
  const base = obtenerUrlBaseGithubPages();
  if (subpath) {
    const partes = String(subpath)
      .split(/[\/\\]+/)
      .filter(Boolean);
    const partesUnicas = partes.filter((p, i) => i === 0 || p !== partes[i - 1]);
    if (partesUnicas.length > 0) {
      return `${base}${partesUnicas.join('/')}/`;
    }
  }
  return base;
}

export const GITHUB_PAGES_URL = obtenerUrlBaseGithubPages();
export const GITHUB_PAGES_GENERACION_URL = obtenerUrlBibliotecaWeb(GENERACION);

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
export const TOKEN_PATH = path.join(process.cwd(), 'token.json');
export const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
export const STATE_PATH = path.join(process.cwd(), 'estado.json');
