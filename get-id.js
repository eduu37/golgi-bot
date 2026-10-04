import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const { Client, LocalAuth } = wwebjs;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Escanea este QR con tu WhatsApp para iniciar sesión.');
});

client.on('ready', () => {
    console.log('✅ ¡Conectado! Ahora ve a tu teléfono y envía un mensaje cualquiera en el grupo que te interesa.');
});

client.on('message_create', (msg) => {
    
    // Usamos msg.id.remote para capturar siempre el chat donde ocurrió
    const chatID = msg.id.remote;

    // AHORA SÍ verificamos si el ID termina en @g.us (indicador oficial de grupos/comunidades)
    if (chatID.endsWith('@g.us')) {
        console.log('\n-----------------------------------');
        console.log(`📩 MENSAJE DE GRUPO O COMUNIDAD DETECTADO`);
        console.log(`🔑 ID DEL GRUPO: ${chatID}`);
        console.log('-----------------------------------\n');
    }
});

client.initialize();