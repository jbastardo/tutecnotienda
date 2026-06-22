// Generacion de descripciones e imagenes con IA (Gemini + Unsplash)

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

export function iaConfigured(): boolean {
  return !!GEMINI_KEY;
}

export async function generateDescription(
  productName: string,
  sku?: string,
  category?: string,
  brand?: string
): Promise<string | null> {
  if (!iaConfigured()) {
    console.log("[IA] Gemini no configurado");
    return null;
  }

  const prompt = `Eres un redactor profesional de ecommerce. Escribe una descripcion de producto atractiva y persuasiva en español para una tienda de tecnologia en Venezuela. La descripcion debe tener entre 150 y 250 palabras, usar HTML simple (parrafos <p>), mencionar caracteristicas clave, usos practicos, y beneficios. NO incluyas precio, NO uses markdown.

Producto: ${productName}
${brand ? `Marca: ${brand}` : ""}
${category ? `Categoria: ${category}` : ""}
${sku ? `SKU: ${sku}` : ""}

Responde SOLO con el HTML de la descripcion, sin titulos ni comentarios extra.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text.trim();
    return null;
  } catch (e) {
    console.error("[IA] Error Gemini:", e);
    return null;
  }
}

export async function searchProductImages(query: string): Promise<string[]> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return [];

  const words = query.replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2).slice(0, 4);
  const searchTerm = (words.join(" ") || query.substring(0, 30)) + " product white background";

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerm)}&per_page=4&orientation=squarish&client_id=${unsplashKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(
      (r: { urls: { regular: string } }) => r.urls.regular
    );
  } catch {
    return [];
  }
}
