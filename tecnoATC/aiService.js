const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateResponse(prompt, context = "") {
    try {
        const systemPrompt = `Eres un asistente de atención al cliente para una empresa.
Responde de manera amable, profesional y concisa.
REGLA CRÍTICA: Si el cliente pregunta sobre el estado de un envío, rastreo de un paquete, o hace una solicitud que requiere revisión manual o intervención humana estricta, DEBES responder ÚNICAMENTE con el siguiente código exacto y nada más: [REQUIERE_HUMANO]

Utiliza la siguiente información de contexto para responder la pregunta, si es relevante:
${context}
`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] }, 
                { role: 'user', parts: [{ text: prompt }] }
            ]
        });
        return response.text;
    } catch (error) {
        console.error("Error generating AI response:", error);
        return "Lo siento, en este momento estoy teniendo problemas técnicos. Por favor, intenta de nuevo más tarde.";
    }
}

module.exports = {
    generateResponse
};
