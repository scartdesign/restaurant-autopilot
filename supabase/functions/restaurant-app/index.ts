import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const REPO_BASE = "https://raw.githubusercontent.com/scartdesign/restaurant-autopilot/main/preview-app/";
const PREFIX = "/functions/v1/restaurant-app/";

const MIME: Record<string,string> = {
  ".html":"text/html; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".ico":"image/x-icon",
  ".woff2":"font/woff2"
};

function mimeFor(path:string){
  const lower=path.toLowerCase();
  for(const [ext,mime] of Object.entries(MIME)) if(lower.endsWith(ext)) return mime;
  return "application/octet-stream";
}

async function fetchRepo(path:string){
  return await fetch(REPO_BASE + path, {
    headers: {
      "user-agent":"Restaurant-Autopilot-App",
      "cache-control":"no-cache"
    }
  });
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="GET" && req.method!=="HEAD"){
    return new Response("Method not allowed",{status:405,headers:{"content-type":"text/plain; charset=utf-8"}});
  }

  const url=new URL(req.url);

  if(url.pathname==="/functions/v1/restaurant-app"){
    return Response.redirect(url.origin + PREFIX + url.search, 302);
  }

  let path=url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : "";
  path=decodeURIComponent(path).replace(/^\/+/, "");
  if(!path) path="index.html";
  if(path.includes("..")) return new Response("Bad path",{status:400});

  let upstream=await fetchRepo(path);

  // React/Vite SPA fallback for routes without a file extension.
  if(!upstream.ok && !path.split("/").pop()?.includes(".")){
    path="index.html";
    upstream=await fetchRepo(path);
  }

  if(!upstream.ok){
    return new Response("Not found",{status:upstream.status,headers:{"content-type":"text/plain; charset=utf-8"}});
  }

  const headers=new Headers();
  headers.set("content-type", mimeFor(path));
  headers.set("cache-control", path==="index.html" ? "no-store, no-cache, must-revalidate, max-age=0" : "public, max-age=300");
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");

  if(req.method==="HEAD") return new Response(null,{status:200,headers});

  // IMPORTANT: text assets are returned as explicit text, not streamed,
  // so Supabase preserves their MIME type in browsers.
  if(path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".svg") || path.endsWith(".json") || path.endsWith(".webmanifest")){
    let text=await upstream.text();

    // Ensure built relative assets resolve under the edge-function prefix.
    if(path==="index.html"){
      text=text
        .replaceAll('src="./assets/','src="/functions/v1/restaurant-app/assets/')
        .replaceAll('href="./assets/','href="/functions/v1/restaurant-app/assets/')
        .replaceAll('href="./autopilot-icon.svg"','href="/functions/v1/restaurant-app/autopilot-icon.svg"')
        .replaceAll('href="./manifest.webmanifest"','href="/functions/v1/restaurant-app/manifest.webmanifest"');
    }

    return new Response(text,{status:200,headers});
  }

  const bytes=await upstream.arrayBuffer();
  return new Response(bytes,{status:200,headers});
});
