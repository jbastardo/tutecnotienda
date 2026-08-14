import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "TCL 43F35 official product image";
  
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const elements = $("a.iusc").length;
      const firstM = $("a.iusc").first().attr("m");
      
      let imgUrl = null;
      if (firstM) {
        try {
          const imgData = JSON.parse(firstM);
          imgUrl = imgData.murl;
        } catch(e) {}
      }

      return NextResponse.json({
        success: true,
        status: res.status,
        htmlLength: html.length,
        elementsFound: elements,
        parsedUrl: imgUrl,
        firstMAttr: firstM
      });
    } else {
      return NextResponse.json({ success: false, status: res.status });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
