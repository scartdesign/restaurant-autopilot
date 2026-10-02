import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
function stylePrompt(style: string) {
  if (style === "dark-luxe") return "dark luxury restaurant photography, moody directional light, black stone table, premium editorial food styling, dramatic but realistic";
  if (style === "clean-menu") return "clean premium menu photography, soft natural light, elegant neutral background, crisp appetizing plating, realistic commercial food photo";
  if (style === "bright-sale") return "high-energy commercial food photography, vibrant natural food colors, bold appetizing composition, realistic restaurant advertising photo";
  if (style === "family") return "warm inviting restaurant food photography, generous portions, welcoming table atmosphere, natural light, realistic family dining mood";
  if (style === "lunch") return "fresh lunch restaurant photography, bright natural light, appetizing close-up, modern casual restaurant styling, realistic commercial photo";
  return "ultra-realistic premium restaurant food photography, appetizing natural food styling, professional commercial lighting, shallow depth of field, realistic textures";
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const service = createClient(url, serviceKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || "status");
    const restaurantId = clean(body.restaurantId);
    if (!restaurantId) return json({ error: "restaurantId is required" }, 400);
    const [{ data: restaurant }, { data: admin }, { data: controls }] = await Promise.all([
      service.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", user.id).maybeSingle(),
      service.from("app_admins").select("role").eq("user_id", user.id).eq("role", "superadmin").maybeSingle(),
      service.from("app_controls").select("ai_images_enabled").eq("id", 1).maybeSingle(),
    ]);
    if (!restaurant && !admin) return json({ error: "Restaurant not found" }, 404);
    const activeRestaurant = restaurant || (await service.from("restaurants").select("*").eq("id", restaurantId).maybeSingle()).data;
    if (!activeRestaurant) return json({ error: "Restaurant not found" }, 404);
    let aiLimit: number | null = admin ? null : 0;
    if (!admin) {
      const { data: subs } = await service.from("customer_subscriptions").select("*, sales_plans(*)").eq("user_id", user.id).in("status", ["active", "trialing"]).order("created_at", { ascending: false });
      const valid = (subs || []).find((s: any) => new Date(s.starts_at).getTime() <= Date.now() && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now()));
      aiLimit = Number(valid?.sales_plans?.features?.ai_images_monthly || 0);
    }
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count: aiUsed } = await service.from("creative_assets").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart.toISOString());
    const envKey = Deno.env.get("OPENAI_API_KEY") || "";
    let vaultKey = "";
    if (!envKey) { const { data } = await service.rpc("internal_ai_provider_key"); vaultKey = typeof data === "string" ? data : ""; }
    const openAiKey = envKey || vaultKey;
    const globallyEnabled = controls?.ai_images_enabled !== false;
    if (action === "status") return json({ ok: true, ai_image_ready: Boolean(openAiKey) && globallyEnabled, ai_images_enabled: globallyEnabled, ai_images_used: aiUsed || 0, ai_images_limit: aiLimit });
    if (action === "select_variant") {
      const assetId = clean(body.assetId);
      const menuItemId = clean(body.menuItemId);
      if (!assetId || !menuItemId) return json({ error: "assetId and menuItemId are required" }, 400);
      const { data: asset } = await service.from("creative_assets").select("*").eq("id", assetId).eq("user_id", user.id).eq("restaurant_id", restaurantId).eq("menu_item_id", menuItemId).maybeSingle();
      if (!asset) return json({ error: "AI varijanta nije pronađena." }, 404);
      const { error: chooseError } = await service.from("menu_items").update({ image_url: asset.public_url }).eq("id", menuItemId).eq("restaurant_id", restaurantId);
      if (chooseError) return json({ error: chooseError.message }, 500);
      return json({ ok: true, image_url: asset.public_url, asset_id: asset.id });
    }
    if (action === "edit_upload") {
      if (!globallyEnabled) return json({ error: "AI fotografije su trenutno isključene od strane OWNER-a.", code: "AI_IMAGES_DISABLED" }, 503);
      if (!openAiKey) return json({ error: "AI generator nije konfigurisan.", code: "AI_PROVIDER_NOT_CONFIGURED" }, 503);
      if (aiLimit !== null && aiLimit <= 0) return json({ error: "AI slike nisu uključene u trenutni paket." }, 402);
      if (aiLimit !== null && (aiUsed || 0) >= aiLimit) return json({ error: `Mesečni limit AI slika je dostignut (${aiUsed || 0}/${aiLimit}).` }, 429);
      const menuItemId = clean(body.menuItemId);
      if (menuItemId) {
        const { data: item } = await service.from("menu_items").select("id").eq("id", menuItemId).eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle();
        if (!item) return json({ error: "Jelo nije pronađeno." }, 404);
      }
      const match = String(body.imageDataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[2].length > 12_000_000) return json({ error: "Dodaj JPG, PNG ili WEBP fotografiju do 9 MB." }, 400);
      const mime = match[1];
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const direction = clean(body.direction || "recommend");
      const directions: Record<string,string> = {
        recommend: "Choose the strongest commercial food-photo camera angle for the selected art direction. Keep the actual dish recognizable.",
        "top-view": "Recompose as a true 90-degree overhead top-view photograph. Show the dish clearly from above and keep its ingredients, portion count, and identity faithful to the source.",
        hero: "Create a dramatic appetizing hero close-up at a natural 35-degree camera angle, with directional restaurant lighting and strong food texture.",
        editorial: "Create an elegant overhead editorial flat lay with refined negative space, art-directed but still realistic and appetizing.",
      };
      const artDirections: Record<string,string> = {
        luxe: "noir fine-dining photography, deep shadow, restrained gold-toned details", "hero-menu": "bold best-seller hero photography, tight appetizing crop",
        editorial: "premium food magazine art direction", minimal: "bright clean studio food photography", bold: "energetic modern street-food campaign", split: "fresh chef's-special restaurant photography",
        poster: "dramatic evening restaurant poster photography", "promo-badge": "high-impact offer campaign food photography", "premium-grid": "curated upscale menu photography",
        "bold-offer": "punchy discount campaign food photography", "lunch-time": "bright natural lunch-hour food photography", family: "warm traditional shared-table food photography",
      };
      const template = clean(body.template);
      const hex = (value: unknown) => /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? String(value) : "";
      const palette = [hex(body.primary), hex(body.accent)].filter(Boolean).join(" and ");
      const prompt = `Edit the supplied restaurant dish photograph into a photorealistic commercial food photograph. ${directions[direction] || directions.recommend} Visual direction: ${artDirections[template] || "premium restaurant campaign photography"}. Use a subtle background or prop color relationship inspired by ${palette || "a refined restaurant palette"}, while keeping the food itself natural. Preserve the real dish identity, ingredients, portion count, and plausible plating; do not invent ingredients or extra portions. Food is the unmistakable focal point. Make it look genuinely edible with natural texture and light. No text, typography, logo, watermark, people, or hands. This is a photographic background for a separate design renderer.`;
      const form = new FormData();
      form.append("model", "gpt-image-2");
      form.append("prompt", prompt);
      form.append("size", body.format === "story" ? "1024x1536" : "1024x1024");
      form.append("quality", "medium");
      form.append("image", new Blob([bytes], { type: mime }), `restaurant-photo.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`);
      const openai = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { "Authorization": `Bearer ${openAiKey}` }, body: form });
      const result = await openai.json().catch(() => ({}));
      if (!openai.ok) return json({ error: result?.error?.message || "AI photo edit failed." }, openai.status);
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) return json({ error: "AI provider nije vratio obrađenu fotografiju." }, 502);
      const outputBinary = atob(b64);
      const outputBytes = new Uint8Array(outputBinary.length);
      for (let i = 0; i < outputBinary.length; i++) outputBytes[i] = outputBinary.charCodeAt(i);
      const path = `${user.id}/${restaurantId}/ai/studio-${crypto.randomUUID()}.png`;
      const { error: uploadError } = await service.storage.from("restaurant-assets").upload(path, outputBytes, { contentType: "image/png", upsert: false });
      if (uploadError) return json({ error: uploadError.message }, 500);
      const publicUrl = service.storage.from("restaurant-assets").getPublicUrl(path).data.publicUrl;
      const { data: asset, error: assetError } = await service.from("creative_assets").insert({ user_id: user.id, restaurant_id: restaurantId, menu_item_id: menuItemId || null, kind: "food_image", style: `studio-${direction}`, prompt, storage_path: path, public_url: publicUrl, provider: "openai", model: "gpt-image-2" }).select("id").single();
      if (assetError) return json({ error: assetError.message }, 500);
      return json({ ok: true, image_url: publicUrl, asset_id: asset.id, ai_images_used: (aiUsed || 0) + 1, ai_images_limit: aiLimit });
    }
    if (!["generate","variants"].includes(action)) return json({ error: "Unknown action" }, 400);
    if (!globallyEnabled) return json({ error: "AI fotografije su trenutno isključene od strane OWNER-a.", code: "AI_IMAGES_DISABLED" }, 503);
    if (!openAiKey) return json({ error: "AI generator nije konfigurisan. OWNER treba jednom da unese OpenAI API ključ u Superadmin / Creative AI.", code: "AI_PROVIDER_NOT_CONFIGURED" }, 503);
    if (aiLimit !== null && aiLimit <= 0) return json({ error: "AI slike nisu uključene u trenutni paket." }, 402);
    if (aiLimit !== null && (aiUsed || 0) >= aiLimit) return json({ error: `Mesečni limit AI slika je dostignut (${aiUsed || 0}/${aiLimit}).` }, 429);
    const menuItemId = clean(body.menuItemId);
    if (!menuItemId) return json({ error: "menuItemId is required" }, 400);
    const { data: item } = await service.from("menu_items").select("*").eq("id", menuItemId).eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle();
    if (!item) return json({ error: "Jelo nije pronađeno." }, 404);
    const style = clean(body.style || "photoreal");
    const prompt = `Create a ${stylePrompt(style)} of the restaurant dish "${clean(item.name)}". ${clean(item.description) ? `Dish details: ${clean(item.description)}.` : ""} Cuisine: ${clean(activeRestaurant.cuisine_type || "restaurant food")}. The food must look genuinely edible and professionally plated, with physically plausible ingredients, realistic textures, natural shadows and steam only if appropriate. No text, no typography, no logos, no watermark, no hands, no people. Composition must leave some clean negative space for later advertising copy. Commercial restaurant photography, not illustration, not 3D render.`;
    const remaining = aiLimit === null ? 3 : Math.max(0, aiLimit - (aiUsed || 0));
    const count = action === "variants" ? Math.min(3, remaining) : 1;
    if (count < 1) return json({ error: "Mesečni limit AI slika je dostignut.", code: "AI_LIMIT" }, 429);
    const assets: any[] = [];
    for (let index = 0; index < count; index++) {
      const openai = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-image-2", prompt: `${prompt} Variation ${index + 1}: use a meaningfully different camera angle and plating composition while keeping the dish accurate.`, size: "1024x1024", quality: "medium", n: 1 }),
      });
      const result = await openai.json().catch(() => ({}));
      if (!openai.ok) {
        if (!assets.length) return json({ error: result?.error?.message || "AI image generation failed." }, openai.status);
        break;
      }
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) continue;
      const binary = atob(b64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const path = `${user.id}/${restaurantId}/ai/${menuItemId}-${crypto.randomUUID()}.png`;
      const { error: uploadError } = await service.storage.from("restaurant-assets").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) continue;
      const publicUrl = service.storage.from("restaurant-assets").getPublicUrl(path).data.publicUrl;
      const { data: asset, error: assetError } = await service.from("creative_assets").insert({ user_id: user.id, restaurant_id: restaurantId, menu_item_id: menuItemId, kind: "food_image", style, prompt, storage_path: path, public_url: publicUrl, provider: "openai", model: "gpt-image-2" }).select("id,public_url").single();
      if (!assetError && asset) assets.push({ id: asset.id, image_url: asset.public_url });
    }
    if (!assets.length) return json({ error: "AI provider nije vratio upotrebljivu sliku." }, 502);
    if (action === "generate") {
      const { error: updateError } = await service.from("menu_items").update({ image_url: assets[0].image_url }).eq("id", menuItemId).eq("restaurant_id", restaurantId);
      if (updateError) return json({ error: updateError.message }, 500);
    }
    return json({ ok: true, image_url: action === "generate" ? assets[0].image_url : null, assets, ai_images_used: (aiUsed || 0) + assets.length, ai_images_limit: aiLimit });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500); }
});