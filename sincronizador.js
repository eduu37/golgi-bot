import path from 'path';
import fs from 'fs';
import { DRIVE_FOLDER_ID } from './config.js';
import { iniciarDrive, sincronizarCSVDrive } from './drive.js';

async function ejecutarSincronizacion() {
    console.log('🚀 Iniciando sincronización manual de enlaces...');
    
    // Ruta donde está guardado nuestro Excel local
    const rutaCsv = path.join(process.cwd(), 'enlaces.csv');
    
    // Verificamos que el archivo exista localmente antes de intentar subirlo
    if (!fs.existsSync(rutaCsv)) {
        console.log('⚠️ No se encontró el archivo "enlaces.csv".');
        console.log('Probablemente el bot aún no ha guardado ningún enlace nuevo.');
        process.exit(1);
    }

    try {
        await iniciarDrive();
        console.log('✅ Conectado a Google Drive.');
        
        console.log('☁️ Sincronizando "enlaces.csv" hacia Google Sheets...');
        // Recuerda que usamos el nombre limpio para que Drive lo transforme
        await sincronizarCSVDrive('Enlaces_Guardados', rutaCsv, DRIVE_FOLDER_ID);
        
        console.log('\n=======================================');
        console.log('✅ TAREA DE SINCRONIZACIÓN FINALIZADA');
        console.log('=======================================');
        
    } catch (error) {
        console.error('❌ Ocurrió un error:', error.message);
    }

    // Apagamos el proceso de forma limpia
    process.exit(0);
}

ejecutarSincronizacion();