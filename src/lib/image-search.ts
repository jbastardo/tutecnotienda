import * as cheerio from "cheerio";

export async function searchManufacturerImage(
  brand: string,
  model: string,
  name: string
): Promise<string | null> {
  const query = `${brand} ${model} official product image`;
  console.log(`[ImageSearch] Buscando imagen para: ${query}`);

  // Opcion Principal: Bing Image Search Scraper (Evita bloqueos de Google API y MercadoLibre Captchas)
  try {
    const bingQuery = `${brand} ${model} ${name} product image`.substring(0, 100);
    console.log(`[ImageSearch] Probando Bing Scraper: ${bingQuery}`);
    const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(bingQuery)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      
      // Buscar la data de la imagen original en Bing (atributo 'm' contiene un JSON con la url original)
      const mAttr = $("a.iusc").first().attr("m");
      if (mAttr) {
        try {
          const imgData = JSON.parse(mAttr);
          if (imgData && imgData.murl) {
             const imgUrl = imgData.murl;
             console.log(`[ImageSearch] Imagen encontrada via Scraper Bing: ${imgUrl}`);
             return imgUrl;
          }
        } catch (parseError) {
          console.error("[ImageSearch] Error parseando JSON de Bing:", parseError);
        }
      }
    } else {
      console.log(`[ImageSearch] Scraper Bing respondio con status: ${res.status}`);
    }
  } catch (e) {
    console.error("[ImageSearch] Error en Bing Scraper:", e);
  }

  return null;
}
