import fs from 'fs';
import path from 'path';
import { clasificarArchivo } from './clasificador.js';

const RUTA_RECURSOS = path.join(process.cwd(), 'enlaces.csv');

function obtenerLinksGuardados() {
    if (!fs.existsSync(RUTA_RECURSOS)) return new Set(); 
    
    const contenido = fs.readFileSync(RUTA_RECURSOS, 'utf8');
    const regexExtraerUrl = /^"([^"]+)"/gm; 
    let links = new Set();
    let match;
    
    while ((match = regexExtraerUrl.exec(contenido)) !== null) {
        if (match[1] !== "Enlace") {
            links.add(match[1]); 
        }
    }
    return links;
}

// 🛠️ Ahora aceptamos el objeto mensaje completo (msg) en lugar de solo msg.body
export async function procesarEnlaces(msg, timestamp) {
    if (!msg) return 0;

    let linksCandidatos = [];

    // 1. Extraemos texto plano de msg.body si existe
    const textoMensaje = msg.body || '';
    const regexLinks = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;
    const matchesTexto = textoMensaje.match(regexLinks);
    if (matchesTexto) {
        linksCandidatos.push(...matchesTexto);
    }

    // 2. 🪄 EL TRUCO SECRETO: Si WhatsApp detectó una tarjeta previa de YouTube/Web,
    // la librería guarda el link oficial en 'msg.canonicalUrl' o en la propiedad 'links'
    if (msg.canonicalUrl) {
        linksCandidatos.push(msg.canonicalUrl);
    }
    
    if (msg.links && Array.isArray(msg.links)) {
        for (const l of msg.links) {
            if (l.link) linksCandidatos.push(l.link);
        }
    }

    if (linksCandidatos.length > 0) {
        const linksEncontradosUnicos = [...new Set(linksCandidatos)];
        const linksYaGuardados = obtenerLinksGuardados();
        
        // Usamos el texto del mensaje (o el caption si es multimedia) para clasificar
        const textoParaClasificar = textoMensaje || (msg.caption ? msg.caption : '');
        const { materia, tipo } = await clasificarArchivo('', textoParaClasificar);
        const fecha = new Date(timestamp * 1000).toLocaleDateString('es-CL');

        
        let bloqueTexto = '';
        let nuevosGuardados = 0;

        if (!fs.existsSync(RUTA_RECURSOS)) {
            bloqueTexto += `"Enlace","Materia","Tipo","Fecha"\n`;
        }

        const escapeCsv = (str) => String(str).replace(/"/g, '""');

        for (const url of linksEncontradosUnicos) {
            const urlLimpiada = url.replace(/[).,;]+$/, '');

            if (!linksYaGuardados.has(urlLimpiada)) {
                bloqueTexto += `"${escapeCsv(urlLimpiada)}","${escapeCsv(materia)}","${escapeCsv(tipo)}","${escapeCsv(fecha)}"\n`;
                linksYaGuardados.add(urlLimpiada); 
                nuevosGuardados++;
            } else {
                console.log(`🔁 Link repetido ignorado: ${urlLimpiada}`);
            }
        }

        if (nuevosGuardados > 0) {
            fs.appendFileSync(RUTA_RECURSOS, bloqueTexto, 'utf8');
        }

        
        return nuevosGuardados; 
    }

    return 0; 
}