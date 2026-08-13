import * as cheerio from "cheerio";

export async function searchManufacturerImage(
  brand: string,
  model: string,
  name: string
): Promise<string | null> {
  const query = `${brand} ${model} official product image`;
  console.log(`[ImageSearch] Buscando imagen para: ${query}`);

  // Opcion 1: Google Custom Search (si hay API key)
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&searchType=image&imgSize=huge&imgType=photo&safe=active`
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        if (items.length > 0) {
          for (const item of items) {
             const url = item.link;
             if (url.startsWith("https://")) {
               console.log(`[ImageSearch] Imagen encontrada via Google: ${url}`);
               return url;
             }
          }
        }
      }
    } catch (e) {
      console.error("[ImageSearch] Error en Google API:", e);
    }
  }

  // Opcion 2: Scraper MercadoLibre (fallback)
  try {
    const mlQuery = `${brand} ${model} ${name}`.substring(0, 80).replace(/ /g, '-');
    console.log(`[ImageSearch] Probando MercadoLibre Scraper: ${mlQuery}`);
    const res = await fetch(`https://listado.mercadolibre.com.ve/${encodeURIComponent(mlQuery)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Buscar la primera imagen de los resultados
      const firstImage = $(".ui-search-result-image__element").first();
      let imgUrl = firstImage.attr("data-src") || firstImage.attr("src");
      
      if (imgUrl) {
        // MercadoLibre retorna miniaturas como -I.jpg o -W.jpg, las reemplazamos por -O.webp o -F.webp (original/full)
        // Ejemplo: https://http2.mlstatic.com/D_NQ_NP_600557-MLV72314512341_102023-I.webp
        imgUrl = imgUrl.replace(/^http:\/\//, "https://").replace(/-[A-Z]\.(jpg|png|webp)$/, "-F.$1");
        console.log(`[ImageSearch] Imagen encontrada via Scraper ML: ${imgUrl}`);
        return imgUrl;
      }
    } else {
      console.log(`[ImageSearch] Scraper ML respondio con status: ${res.status}`);
    }
  } catch (e) {
    console.error("[ImageSearch] Error en MercadoLibre Scraper:", e);
  }

  return null;
}
