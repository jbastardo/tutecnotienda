const { generateResponse } = require('./aiService');

// Almacenamos temporalmente los chats en pausa (en memoria).
// En producción, esto debería ir a una base de datos.
const pausedChats = new Map();

// Simulating typing delay (between 2 and 5 seconds)
const simulateTypingDelay = async (chat) => {
    const delay = Math.floor(Math.random() * 3000) + 2000; 
    await chat.sendStateTyping();
    return new Promise(resolve => setTimeout(resolve, delay));
};

const handleMessage = async (msg) => {
    try {
        if (msg.from === 'status@broadcast' || msg.id.fromMe) return;

        const chat = await msg.getChat();
        if (chat.isGroup) return;

        const chatId = chat.id._serialized;

        // Comando secreto para despausar el chat (solo para ti)
        if (msg.body.trim().toLowerCase() === '/resumir') {
            pausedChats.delete(chatId);
            await msg.reply("✅ Chat despausado. El bot volverá a responder.");
            return;
        }

        // Si el chat está en pausa, ignoramos el mensaje
        if (pausedChats.has(chatId)) {
            console.log(`[Pausa] Mensaje ignorado de ${msg.from}`);
            return;
        }

        console.log(`[Mensaje Entrante] de ${msg.from}: ${msg.body}`);

        await simulateTypingDelay(chat);

        const context = "Aún no tenemos base de datos de contexto.";
        
        const aiResponse = await generateResponse(msg.body, context);

        await chat.clearState();

        // Detección de intervención humana
        if (aiResponse.includes('[REQUIERE_HUMANO]')) {
            pausedChats.set(chatId, true);
            const pauseMsg = "Entiendo. Por la naturaleza de tu consulta, te transferiré con un agente humano para que te ayude con esto. Por favor, espera un momento.";
            await msg.reply(pauseMsg);
            console.log(`[Intervención Humana Solicitada] Chat ${chatId} pausado.`);
            return;
        }

        await msg.reply(aiResponse);
        console.log(`[Respuesta Enviada]: ${aiResponse}`);

    } catch (error) {
        console.error('Error handling message:', error);
    }
};

module.exports = {
    handleMessage
};
