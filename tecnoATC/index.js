const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./messageHandler');
require('dotenv').config();

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generate and scan this code with your phone
client.on('qr', (qr) => {
    console.log('Escanea el siguiente código QR con tu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Client is ready
client.on('ready', () => {
    console.log('El cliente de WhatsApp está listo y conectado!');
});

// Listen for incoming messages
client.on('message_create', async (msg) => {
    await handleMessage(msg);
});

// Start the client
client.initialize();
