import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RAW_BASE = "https://raw.githubusercontent.com/scartdesign/restaurant-autopilot/main/preview-app";
const FUNCTION_BASE = "/functions/v1/preview";

function contentType(path: string) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webmanifest") || path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === FUNCTION_BASE) {
    return Response.redirect(`${url.origin}${FUNCTION_BASE}/`, 302);
  }

  let path = url.pathname.startsWith(`${FUNCTION_BASE}/`)
    ? url.pathname.slice(FUNCTION_BASE.length)
    : "/";

  if (!path || path === "/") path = "/index.html";
  if (path.includes("..")) return new Response("Bad path", { status: 400 });

  const rawUrl = `${RAW_BASE}${path}`;
  let upstream = await fetch(rawUrl, {
    headers: { "cache-control": "no-cache", "user-agent": "Restaurant-Autopilot-Preview" },
  });

  if (!upstream.ok && !path.split("/").pop()?.includes(".")) {
    path = "/index.html";
    upstream = await fetch(`${RAW_BASE}/index.html`, {
      headers: { "cache-control": "no-cache", "user-agent": "Restaurant-Autopilot-Preview" },
    });
  }

  if (!upstream.ok) {
    return new Response("Preview asset not found.", {
      status: upstream.status,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers();
  headers.set("content-type", contentType(path));
  headers.set("cache-control", path.endsWith("index.html") ? "no-store, max-age=0" : "public, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");

  if (path.endsWith("index.html")) {
    const html = await upstream.text();
    return new Response(html, { status: 200, headers });
  }

  return new Response(upstream.body, { status: 200, headers });
});
