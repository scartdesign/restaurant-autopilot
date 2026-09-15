import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const tagPart = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "dj").replace(/[^a-zA-Z0-9]/g, "");
const hashtag = (v: string) => tagPart(v) ? `#${tagPart(v)}` : "";
const uniq = <T>(arr: T[]) => [...new Set(arr)];

function goalCta(restaurant: any) {
  if (restaurant.social_goal === "delivery") return "Poruči odmah";
  if (restaurant.social_goal === "walk_ins") return "Svrati danas";
  if (restaurant.social_goal === "awareness") return "Sačuvaj objavu";
  return restaurant.reservation_url ? "Rezerviši sto" : "Pošalji poruku";
}

function stylePrompt(style: string) {
  if (style === "dark-luxe") return "dark luxury restaurant photography, moody directional light, black stone table, premium editorial food styling, dramatic but realistic";
  if (style === "clean-menu") return "clean premium menu photography, soft natural light, elegant neutral background, crisp appetizing plating, realistic commercial food photo";
  if (style === "bright-sale") return "high-energy commercial food photography, vibrant natural food colors, bold appetizing composition, realistic restaurant advertising photo";
  if (style === "family") return "warm inviting restaurant food photography, generous portions, welcoming table atmosphere, natural light, realistic family dining mood";
  if (style === "lunch") return "fresh lunch restaurant photography, bright natural light, appetizing close-up, modern casual restaurant styling, realistic commercial photo";
  return "ultra-realistic premium restaurant food photography, appetizing natural food styling, professional commercial lighting, shallow depth of field, realistic textures";
}

function campaignTemplates(style: string) {
  const map: Record<string, string[]> = {
    "premium-grid": ["premium-grid", "hero-menu", "promo-badge", "bold-offer", "family"],
    "dark-luxe": ["luxe", "premium-grid", "luxe", "promo-badge", "hero-menu"],
    "bright-sale": ["bold-offer", "promo-badge", "bold-offer", "hero-menu", "lunch-time"],
    "clean-menu": ["hero-menu", "minimal", "split", "hero-menu", "lunch-time"],
    "family": ["family", "hero-menu", "poster", "family", "luxe"],
    "lunch": ["lunch-time", "hero-menu", "split", "bold-offer", "minimal"],
  };
  return map[style] || map["premium-grid"];
}

function makeRecommendations(restaurant: any, menu: any[]) {
  const withPhoto = menu.filter((i) => i.image_url);
  const ranked = [...menu].sort((a, b) => Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)) || Number(b.price || 0) - Number(a.price || 0));
  const pick = (n: number) => ranked[n % Math.max(1, ranked.length)] || null;
  const hero = pick(0), lunch = pick(1), evening = pick(2);
  const city = restaurant.city || restaurant.neighborhood || "tvom gradu";
  const cta = goalCta(restaurant);
  const suggestions = [
    {
      id: "hero",
      type: "hero",
      title: hero ? `Guraj ${hero.name}` : "Istakni glavno jelo",
      subtitle: "Prodajni hero",
      reason: hero?.image_url ? "Ima fotografiju i dobar potencijal za jak feed vizual." : "Najbolji kandidat iz menija; ako nema fotografiju, napravi AI food photo.",
      menu_item_id: hero?.id || null,
      menu_item_name: hero?.name || "Glavno jelo",
      image_url: hero?.image_url || null,
      cta,
      time: "18:30",
      recommended_style: restaurant.brand_style === "premium" ? "dark-luxe" : "premium-grid",
      platforms: ["Instagram Feed", "Story", "Facebook"],
    },
    {
      id: "lunch",
      type: "lunch",
      title: lunch ? `Ručak: ${lunch.name}` : "Lunch kampanja",
      subtitle: "Popuni ručak",
      reason: `Objavi pre ručka i ciljaj ljude koji traže gde jesti u ${city}.`,
      menu_item_id: lunch?.id || null,
      menu_item_name: lunch?.name || "Lunch ponuda",
      image_url: lunch?.image_url || null,
      cta: restaurant.social_goal === "delivery" ? "Poruči za ručak" : "Svrati na ručak",
      time: "11:30",
      recommended_style: "lunch",
      platforms: ["Instagram Feed", "Story"],
    },
    {
      id: restaurant.social_goal === "delivery" ? "delivery" : "family",
      type: restaurant.social_goal === "delivery" ? "delivery" : "family",
      title: restaurant.social_goal === "delivery" ? `Večeras: ${evening?.name || "dostava"}` : `Večera / porodica: ${evening?.name || "preporuka"}`,
      subtitle: restaurant.social_goal === "delivery" ? "Večernji push" : "Family time",
      reason: restaurant.social_goal === "delivery" ? "Večernji termin je idealan za direktan CTA ka porudžbini." : "Topla, društvena objava dobro radi kao feed + story kombinacija.",
      menu_item_id: evening?.id || null,
      menu_item_name: evening?.name || "Večernja preporuka",
      image_url: evening?.image_url || null,
      cta: restaurant.social_goal === "delivery" ? "Poruči odmah" : cta,
      time: "17:30",
      recommended_style: restaurant.social_goal === "delivery" ? "bright-sale" : "family",
      platforms: ["Instagram Feed", "Story", "Facebook"],
    },
  ];
  return { suggestions, photo_coverage: menu.length ? Math.round((withPhoto.length / menu.length) * 100) : 0 };
}

function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset", hour: "2-digit" }).formatToParts(date);
    const label = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = label.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  } catch { return 0; }
}

function localCalendarDate(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return { year: value("year"), month: value("month"), day: value("day") };
  } catch { return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }; }
}

function wallTimeIso(date: Date, hour: number, minute: number, timeZone: string) {
  const desired = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0);
  let offset = timeZoneOffsetMinutes(timeZone, new Date(desired));
  let utc = desired - offset * 60000;
  const corrected = timeZoneOffsetMinutes(timeZone, new Date(utc));
  if (corrected !== offset) utc = desired - corrected * 60000;
  return new Date(utc).toISOString();
}

const openingKeys = ["sun","mon","tue","wed","thu","fri","sat"];
function openingRow(restaurant: any, date: Date) {
  const key = openingKeys[date.getUTCDay()];
  const raw = restaurant?.opening_hours?.[key];
  if (!raw || typeof raw !== "object") return { enabled: true, open: "09:00", close: "23:00" };
  return { enabled: raw.enabled !== false, open: String(raw.open || "09:00"), close: String(raw.close || "23:00") };
}
function minuteOfDay(value: string) {
  const [h,m] = String(value || "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function campaignDateAt(restaurant: any, dayOffset: number, hour: number, minute: number) {
  const timeZone = String(restaurant.timezone || "Europe/Belgrade");
  const local = localCalendarDate(new Date(), timeZone);
  let date = new Date(Date.UTC(local.year, local.month - 1, local.day + dayOffset));
  let row = openingRow(restaurant, date);
  for (let i=0; i<7 && !row.enabled; i++) {
    date = new Date(date.getTime() + 86400000);
    row = openingRow(restaurant, date);
  }
  const preferred = hour * 60 + minute;
  const open = minuteOfDay(row.open);
  const close = minuteOfDay(row.close);
  const earliest = Math.max(7 * 60, open - 60);
  const latest = Math.max(earliest, close - 60);
  const chosen = Math.min(latest, Math.max(earliest, preferred));
  return wallTimeIso(date, Math.floor(chosen / 60), chosen % 60, timeZone);
}

function captionFor(kind: string, restaurant: any, item: any) {
  const name = item?.name || "Naša preporuka";
  const desc = clean(item?.description || "Sveže pripremljeno i spremno za tvoj sto.");
  const cta = goalCta(restaurant);
  const city = restaurant.city ? ` u ${restaurant.city}` : "";
  if (kind === "hero") return `${name}. ${desc} Ovo je jedan od onih tanjira zbog kojih se planovi menjaju.${city ? ` Ako tražiš gde jesti${city}, kreni od ovoga.` : ""} ${cta}.`;
  if (kind === "lunch") return `Ručak bez razmišljanja: ${name}. ${desc} Dođi na vreme dok je sveže. ${restaurant.social_goal === "delivery" ? "Poruči za ručak." : "Svrati danas."}`;
  if (kind === "story") return `${name} ili ništa? Danas biramo ovo. Sačuvaj story i pošalji nekome ko ide s tobom.`;
  if (kind === "offer") return `Danas guramo ${name}. Dobar razlog da ne kuvaš i još bolji da svratiš. ${cta}.`;
  return `Sto, dobra ekipa i ${name}. ${desc} ${cta}.`;
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
    const action = clean(body.action || "recommend");
    const restaurantId = clean(body.restaurantId);
    if (!restaurantId) return json({ error: "restaurantId is required" }, 400);

    const [{ data: restaurant }, { data: admin }] = await Promise.all([
      service.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", user.id).maybeSingle(),
      service.from("app_admins").select("role").eq("user_id", user.id).eq("role", "superadmin").maybeSingle(),
    ]);
    if (!restaurant && !admin) return json({ error: "Restaurant not found" }, 404);
    const activeRestaurant = restaurant || (await service.from("restaurants").select("*").eq("id", restaurantId).maybeSingle()).data;
    if (!activeRestaurant) return json({ error: "Restaurant not found" }, 404);

    let planFeatures: Record<string, unknown> = {};
    let aiLimit: number | null = admin ? null : 0;
    let campaignPack = Boolean(admin);
    if (!admin) {
      const { data: subs } = await service.from("customer_subscriptions").select("*, sales_plans(*)").eq("user_id", user.id).in("status", ["active", "trialing"]).order("created_at", { ascending: false });
      const valid = (subs || []).find((s: any) => new Date(s.starts_at).getTime() <= Date.now() && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now()));
      planFeatures = (valid?.sales_plans?.features || {}) as Record<string, unknown>;
      aiLimit = Number(planFeatures.ai_images_monthly || 0);
      campaignPack = planFeatures.campaign_pack === true;
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count: aiUsed } = await service.from("creative_assets").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", monthStart.toISOString());
    const aiReady = Boolean(Deno.env.get("OPENAI_API_KEY"));

    if (action === "status") {
      return json({ ok: true, ai_image_ready: aiReady, ai_images_used: aiUsed || 0, ai_images_limit: aiLimit, campaign_pack: campaignPack, features: planFeatures });
    }

    const { data: menu, error: menuError } = await userClient.from("menu_items").select("*").eq("restaurant_id", restaurantId).eq("is_active", true).order("created_at", { ascending: false });
    if (menuError) return json({ error: menuError.message }, 400);

    if (action === "recommend") {
      const rec = makeRecommendations(activeRestaurant, menu || []);
      return json({ ok: true, ...rec, ai_image_ready: aiReady, ai_images_used: aiUsed || 0, ai_images_limit: aiLimit, campaign_pack: campaignPack });
    }

    if (action === "generate_image") {
      if (!aiReady) return json({ error: "AI generator još nema server-side OPENAI_API_KEY.", code: "AI_PROVIDER_NOT_CONFIGURED" }, 503);
      if (aiLimit !== null && aiLimit <= 0) return json({ error: "AI slike nisu uključene u trenutni paket." }, 402);
      if (aiLimit !== null && (aiUsed || 0) >= aiLimit) return json({ error: `Mesečni limit AI slika je dostignut (${aiUsed || 0}/${aiLimit}).` }, 429);
      const menuItemId = clean(body.menuItemId);
      if (!menuItemId) return json({ error: "menuItemId is required" }, 400);
      const item = (menu || []).find((i: any) => i.id === menuItemId);
      if (!item) return json({ error: "Jelo nije pronađeno." }, 404);
      const style = clean(body.style || "photoreal");
      const prompt = `Create a ${stylePrompt(style)} of the restaurant dish \"${clean(item.name)}\". ${clean(item.description) ? `Dish details: ${clean(item.description)}.` : ""} Cuisine: ${clean(activeRestaurant.cuisine_type || "restaurant food")}. The food must look genuinely edible and professionally plated, with physically plausible ingredients, realistic textures, natural shadows and steam only if appropriate. No text, no typography, no logos, no watermark, no hands, no people. Composition must leave some clean negative space for later advertising copy. Commercial restaurant photography, not illustration, not 3D render.`;
      const openai = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-image-2.5-sunburst", prompt, size: "1024x1024", quality: "medium", n: 1 }),
      });
      const result = await openai.json().catch(() => ({}));
      if (!openai.ok) return json({ error: result?.error?.message || "AI image generation failed." }, openai.status);
      const b64 = result?.data?.[0]?.b64_json;
      if (!b64) return json({ error: "AI provider nije vratio sliku." }, 502);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const path = `${user.id}/${restaurantId}/ai/${menuItemId}-${crypto.randomUUID()}.png`;
      const { error: uploadError } = await service.storage.from("restaurant-assets").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) return json({ error: uploadError.message }, 500);
      const publicUrl = service.storage.from("restaurant-assets").getPublicUrl(path).data.publicUrl;
      const { error: updateError } = await service.from("menu_items").update({ image_url: publicUrl }).eq("id", menuItemId).eq("restaurant_id", restaurantId);
      if (updateError) return json({ error: updateError.message }, 500);
      await service.from("creative_assets").insert({ user_id: user.id, restaurant_id: restaurantId, menu_item_id: menuItemId, kind: "food_image", style, prompt, storage_path: path, public_url: publicUrl, provider: "openai", model: "gpt-image-2.5-sunburst" });
      return json({ ok: true, image_url: publicUrl, prompt, ai_images_used: (aiUsed || 0) + 1, ai_images_limit: aiLimit });
    }

    if (action === "campaign_pack") {
      if (!campaignPack && !admin) return json({ error: "Campaign Pack je uključen u Pro i Business paket." }, 402);
      if (!menu?.length) return json({ error: "Dodaj bar jedno aktivno jelo u meni." }, 400);
      const style = clean(body.style || "premium-grid");
      const focusType = clean(body.focusType || "hero");
      const requestedFocusMenuItemId = clean(body.focusMenuItemId || "");
      const requestedHeroMenuItemId = clean(body.heroMenuItemId || "");
      const templates = campaignTemplates(style);
      const sorted = [...menu].sort((a: any, b: any) =>
        Number(b.marketing_priority || 0) - Number(a.marketing_priority || 0)
        || Number(Boolean(b.image_url)) - Number(Boolean(a.image_url))
        || Number(b.price || 0) - Number(a.price || 0)
      );
      const databaseHero = sorted.find((item: any) => Number(item.marketing_priority || 0) >= 3) || null;
      const focusItem =
        sorted.find((item: any) => requestedFocusMenuItemId && item.id === requestedFocusMenuItemId)
        || sorted.find((item: any) => requestedHeroMenuItemId && item.id === requestedHeroMenuItemId)
        || databaseHero
        || sorted[0];
      const supportItems = sorted.filter((item: any) => item.id !== focusItem?.id);
      const slots = [
        { kind: focusType === "lunch" ? "lunch" : "hero", post_type: "feed", day: 0, hour: focusType === "lunch" ? 11 : 18, minute: 30 },
        { kind: "lunch", post_type: "feed", day: 1, hour: 11, minute: 30 },
        { kind: "story", post_type: "story", day: 1, hour: 17, minute: 30 },
        { kind: "offer", post_type: "promotion", day: 3, hour: 16, minute: 30 },
        { kind: "family", post_type: "feed", day: 5, hour: 11, minute: 0 },
      ];
      const payload = slots.map((slot, index) => {
        const useFocus = index === 0 || slot.kind === "offer";
        const item = useFocus ? focusItem : (supportItems[(index - 1) % Math.max(1, supportItems.length)] || focusItem);
        const caption = captionFor(slot.kind, activeRestaurant, item);
        const cta = slot.kind === "story" ? "Odgovori" : goalCta(activeRestaurant);
        const tags = uniq([hashtag(activeRestaurant.name), hashtag(activeRestaurant.city || ""), hashtag(item.name), hashtag(item.category || ""), "#FoodLovers"]).filter(Boolean).slice(0, 8);
        const location = [activeRestaurant.neighborhood, activeRestaurant.city].filter(Boolean).join(" · ");
        return {
          restaurant_id: restaurantId,
          menu_item_id: item.id,
          post_type: slot.post_type,
          scheduled_for: campaignDateAt(activeRestaurant, slot.day, slot.hour, slot.minute),
          title: slot.kind === "offer" ? `${item.name} · Ponuda` : slot.kind === "family" ? `${item.name} · Family time` : slot.kind === "lunch" ? `${item.name} · Lunch` : slot.kind === "story" ? `${item.name} · Story` : item.name,
          caption,
          cta,
          hashtags: tags,
          seo_keywords: uniq([item.name, item.category, activeRestaurant.cuisine_type, activeRestaurant.city, `${item.name} ${activeRestaurant.city || ""}`]).filter(Boolean).slice(0, 7),
          platform_content: {
            instagram: { caption, hashtags: tags, keywords: [item.name, activeRestaurant.city].filter(Boolean), strategy: "campaign pack · brand + local intent + dish" },
            facebook: { caption: `${caption}${location ? `\n\n📍 ${location}` : ""}`, hashtags: tags.slice(0, 3), keywords: [item.name, activeRestaurant.city].filter(Boolean), strategy: "clean local campaign copy" },
          },
          visual_brief: `${style} campaign pack. Real food photography. Strong hierarchy, restaurant logo and brand colors. ${slot.post_type === "story" ? "9:16 story" : "4:5 feed"}.`,
          status: "draft",
          generation_meta: {
            engine: "creative-engine-v1",
            campaign_style: style,
            campaign_focus: focusType,
            campaign_focus_menu_item_id: focusItem?.id || null,
            hero_menu_item_id: databaseHero?.id || null,
            marketing_priority: Number(item.marketing_priority || 0),
            campaign_slot: slot.kind,
            image_url: item.image_url || null,
            generated_at: new Date().toISOString(),
            visual_design: {
              template: templates[index],
              format: slot.post_type === "story" ? "story" : "feed",
              headline: slot.kind === "offer" ? `POSEBNA PONUDA · ${item.name}` : slot.kind === "lunch" ? `VREME JE ZA RUČAK` : slot.kind === "family" ? `FAMILY TIME` : item.name,
              subline: clean(item.description || caption).slice(0, 118),
              cta,
              image_url: item.image_url || null,
              photo_position: index % 3 === 1 ? "right" : "center",
              overlay: style === "dark-luxe" ? .72 : style === "clean-menu" ? .45 : .66,
              primary_color: activeRestaurant.primary_color || "#17211b",
              accent_color: activeRestaurant.secondary_color || "#b9df72",
              logo_visible: activeRestaurant.default_logo_visible ?? true,
              logo_position: activeRestaurant.default_logo_position || "top-right",
              logo_size: activeRestaurant.default_logo_size || "m",
              logo_badge: activeRestaurant.default_logo_badge || "white",
            },
          },
        };
      });
      const { data: posts, error: insertError } = await userClient.from("posts").insert(payload).select();
      if (insertError) return json({ error: insertError.message }, 400);
      return json({ ok: true, posts, style, focusType, focusMenuItemId: focusItem?.id || null, heroMenuItemId: databaseHero?.id || null });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});