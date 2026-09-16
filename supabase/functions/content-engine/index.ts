import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const cleanSpaces = (value = "") => value.replace(/\s+/g, " ").trim();
const shorten = (value = "", max = 118) => cleanSpaces(value).length <= max ? cleanSpaces(value) : `${cleanSpaces(value).slice(0, max - 1).trim()}…`;

type Pillar = "hero_dish" | "engagement" | "local_discovery" | "kitchen_story" | "social_prompt" | "promotion";
type VisualTemplate = "editorial" | "bold" | "minimal" | "split" | "poster" | "luxe" | "premium-grid" | "hero-menu" | "bold-offer" | "lunch-time" | "family" | "promo-badge";

function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset", hour: "2-digit" }).formatToParts(date);
    const label = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = label.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  } catch {
    return 0;
  }
}

function localCalendarDate(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return { year: value("year"), month: value("month"), day: value("day") };
  } catch {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
}

function mondayOfCurrentWeek(timeZone = "Europe/Belgrade") {
  const local = localCalendarDate(new Date(), timeZone);
  const monday = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const day = monday.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

function wallTimeIso(date: Date, hour: number, minute: number, timeZone: string) {
  const desired = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0);
  let offset = timeZoneOffsetMinutes(timeZone, new Date(desired));
  let utc = desired - offset * 60_000;
  const correctedOffset = timeZoneOffsetMinutes(timeZone, new Date(utc));
  if (correctedOffset !== offset) utc = desired - correctedOffset * 60_000;
  return new Date(utc).toISOString();
}

function tagPart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, (m) => m === "Đ" ? "Dj" : "dj").replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, "");
}

function hashtag(value: string) {
  const clean = tagPart(value);
  return clean ? `#${clean}` : "";
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const n = Math.abs(offset) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}


function weeklyPriorityCap(item: any, frequency: number, menuCount: number) {
  if (menuCount <= 1) return frequency;
  const priority = Number(item?.marketing_priority || 0);
  if (priority >= 3) return frequency >= 4 ? 2 : 1;
  if (priority === 2) return frequency >= 7 ? 2 : 1;
  return 1;
}

function selectWeekItems(items: any[], pillars: Pillar[], recentUse: Map<string,number>, learnedScore: Map<string,number>) {
  if (!items.length) return [];
  if (items.length === 1) return pillars.map(() => items[0]);

  const usage = new Map<string,number>();
  const rankBonus = new Map(items.map((item, index) => [String(item.id), (items.length - index) * 18]));
  const selected: any[] = [];

  for (let index = 0; index < pillars.length; index += 1) {
    const pillar = pillars[index];
    const previous = selected[index - 1];
    let pool = items.filter((item) => (usage.get(String(item.id)) || 0) < weeklyPriorityCap(item, pillars.length, items.length));
    if (!pool.length) pool = items;

    const scoreFor = (item: any) => {
      const id = String(item.id);
      const priority = Number(item.marketing_priority || 0);
      const used = usage.get(id) || 0;
      const recentCount = recentUse.get(id) || 0;
      const learned = learnedScore.get(id) || 0;
      const coverageBonus = recentCount === 0 ? 22 : recentCount === 1 ? 8 : 0;
      const explorationBonus = priority >= 2 && learned <= 0 ? 12 : 0;
      let score = (rankBonus.get(id) || 0)
        + Math.min(90, learned)
        + priority * 28
        + coverageBonus
        + explorationBonus
        - recentCount * 8
        - used * 55
        + (item.image_url ? 8 : 0);

      if (pillar === "hero_dish") score += priority * 24;
      if (pillar === "promotion") score += priority * 20;
      if (pillar === "local_discovery") score += priority * 10;
      if ((pillar === "engagement" || pillar === "social_prompt") && used > 0) score -= 20;
      if (previous?.id === item.id) score -= 1000;
      return score;
    };

    const chosen = [...pool].sort((a, b) => scoreFor(b) - scoreFor(a))[0] || items[index % items.length];
    selected.push(chosen);
    usage.set(String(chosen.id), (usage.get(String(chosen.id)) || 0) + 1);
  }

  return selected;
}

function cuisineTags(cuisine = "") {
  const c = cuisine.toLowerCase();
  if (c.includes("ital")) return ["#ItalianFood", "#ItalianCuisine", "#PastaLovers", "#PizzaLovers"];
  if (c.includes("pizza")) return ["#Pizza", "#PizzaLovers", "#PizzaTime", "#Pizzeria"];
  if (c.includes("burger") || c.includes("fast")) return ["#BurgerLovers", "#StreetFood", "#Burger", "#FastFood"];
  if (c.includes("srp") || c.includes("balkan") || c.includes("trad")) return ["#BalkanFood", "#DomacaHrana", "#TradicionalnaKuhinja", "#UkusiBalkana"];
  if (c.includes("vegan")) return ["#VeganFood", "#PlantBased", "#VeganEats", "#HealthyFood"];
  if (c.includes("asian") || c.includes("azij")) return ["#AsianFood", "#AsianCuisine", "#StreetFood", "#FoodLovers"];
  if (c.includes("mediter")) return ["#MediterraneanFood", "#MediterraneanCuisine", "#FreshFood", "#FoodLovers"];
  if (c.includes("seafood") || c.includes("ribl")) return ["#Seafood", "#FreshFish", "#SeafoodLovers", "#Restaurant"];
  return ["#Foodie", "#Foodstagram", "#RestaurantLife", "#FoodLovers"];
}

function dishTags(item: any) {
  const values = [item?.name, item?.category].filter(Boolean) as string[];
  const result = values.map(hashtag).filter(Boolean);
  const hay = values.join(" ").toLowerCase();
  if (hay.includes("pizza")) result.push("#PizzaLovers", "#PizzaTime");
  if (hay.includes("pasta") || hay.includes("carbonara") || hay.includes("lasagn")) result.push("#PastaLovers", "#Pasta");
  if (hay.includes("burger")) result.push("#BurgerLovers", "#Burger");
  if (hay.includes("kafa") || hay.includes("coffee")) result.push("#CoffeeLovers", "#CoffeeTime");
  if (hay.includes("desert") || hay.includes("tiramisu") || hay.includes("cake")) result.push("#DessertLovers", "#Dessert");
  if (hay.includes("steak") || hay.includes("biftek")) result.push("#SteakLovers", "#SteakDinner");
  if (hay.includes("salat")) result.push("#FreshFood", "#SaladLovers");
  return uniq(result);
}

function locationTags(restaurant: any) {
  const city = tagPart(restaurant.city || "");
  const area = tagPart(restaurant.neighborhood || "");
  const country = tagPart(restaurant.country || "");
  const out: string[] = [];
  if (city) out.push(`#${city}`, `#${city}Food`, `#${city}Eats`, `#GdeJesti${city}`);
  if (area) out.push(`#${area}`, `#${area}Food`, `#${area}Eats`);
  if (country && !country.toLowerCase().includes("serbia")) out.push(`#${country}Food`);
  return uniq(out);
}

function discoveryPack(restaurant: any, item: any, variation = 0) {
  const local = locationTags(restaurant);
  const niche = uniq([...dishTags(item), ...cuisineTags(restaurant.cuisine_type || "")]);
  const brand = [hashtag(restaurant.name || "Restoran")].filter(Boolean);
  const broad = rotate(["#Foodie", "#Foodstagram", "#InstaFood", "#FoodLovers", "#Restaurant"], variation);
  const mode = restaurant.hashtag_mode || "smart";
  let instagram: string[] = [];
  if (mode === "minimal") instagram = uniq([...brand.slice(0,1), ...local.slice(0,2), ...niche.slice(0,2)]).slice(0,5);
  else if (mode === "local") instagram = uniq([...brand.slice(0,1), ...rotate(local, variation).slice(0,4), ...rotate(niche, variation).slice(0,2)]).slice(0,7);
  else instagram = uniq([...brand.slice(0,1), ...rotate(local, variation).slice(0,3), ...rotate(niche, variation).slice(0,3), ...broad.slice(0,1)]).slice(0,8);
  const facebook = uniq([...brand.slice(0,1), ...local.slice(0,1), ...niche.slice(0,1)]).slice(0,3);
  const keywords = uniq([
    item?.name || "",
    item?.category || "",
    restaurant.cuisine_type || "",
    restaurant.city ? `${item?.name || restaurant.cuisine_type || "restoran"} ${restaurant.city}` : "",
    restaurant.city ? `${restaurant.cuisine_type || "restoran"} ${restaurant.city}` : "",
    restaurant.neighborhood ? `${restaurant.cuisine_type || "restoran"} ${restaurant.neighborhood}` : "",
    restaurant.social_goal === "delivery" ? "dostava hrane" : "",
    restaurant.social_goal === "reservations" ? "rezervacija restorana" : "",
  ]).slice(0,7);
  const score = clamp(48 + (restaurant.city ? 8 : 0) + (restaurant.neighborhood ? 5 : 0) + (restaurant.cuisine_type ? 6 : 0) + (restaurant.target_audience ? 4 : 0) + (item?.name ? 7 : 0) + (item?.image_url ? 8 : 0) + (item?.description ? 5 : 0) + (brand.length ? 4 : 0) + (instagram.length >= 5 ? 5 : 0), 0, 99);
  return { instagram, facebook, keywords, score };
}

function pillarSequence(frequency: number): Pillar[] {
  const maps: Record<number, Pillar[]> = {
    3: ["hero_dish", "engagement", "promotion"],
    4: ["hero_dish", "engagement", "local_discovery", "promotion"],
    5: ["hero_dish", "engagement", "local_discovery", "kitchen_story", "promotion"],
    6: ["hero_dish", "engagement", "local_discovery", "hero_dish", "kitchen_story", "promotion"],
    7: ["hero_dish", "engagement", "local_discovery", "hero_dish", "kitchen_story", "social_prompt", "promotion"],
  };
  return maps[frequency] || maps[5];
}

function goalClose(restaurant: any) {
  if (restaurant.social_goal === "delivery") return "Poruči dok je sveže.";
  if (restaurant.social_goal === "walk_ins") return "Svrati danas — sto i dobar zalogaj čekaju.";
  if (restaurant.social_goal === "awareness") return "Sačuvaj objavu i pošalji je nekome ko ovo mora da proba.";
  return restaurant.reservation_url ? "Rezerviši svoj sto na vreme." : "Piši nam za rezervaciju.";
}

function hookFor(restaurant: any, _pillar: Pillar, index: number) {
  const premium = ["Veče zaslužuje nešto posebno.", "Ukus koji ne traži objašnjenje.", "Detalj koji pravi razliku.", "Jedan tanjir. Dovoljno razloga da svratiš."];
  const traditional = ["Domaće, pošteno i sveže.", "Ukus koji vraća za sto.", "Kao nekad, samo danas.", "Kad znaš odakle dolazi ukus."];
  const direct = ["Gladni? Rešeno.", "Bez čekanja. Samo dobar zalogaj.", "Ovo ide odmah na sto.", "Danas se ne preskače ručak."];
  const modern = ["Danas biramo nešto baš dobro.", "Ovo je znak da je vreme za pauzu.", "Jedan dobar razlog da promeniš plan za danas.", "Ako biraš ukus, kreni od ovoga."];
  const bank = restaurant.brand_style === "premium" || restaurant.tone === "premium" ? premium : restaurant.brand_style === "traditional" || restaurant.tone === "traditional" ? traditional : restaurant.tone === "direct" || restaurant.brand_style === "fast_food" ? direct : modern;
  return bank[index % bank.length];
}

function makeCaption(restaurant: any, item: any, index: number, pillar: Pillar, otherItem?: any) {
  const name = item?.name || "Naša preporuka";
  const desc = cleanSpaces(item?.description || "Sveže pripremljeno i spremno za tvoj sto.");
  const price = item?.price ? ` ${item.price} ${item.currency || "RSD"}.` : "";
  const city = restaurant.city || "gradu";
  if (pillar === "engagement") return `${name} ili ${otherItem?.name || "nešto slatko posle"}? Izaberi bez razmišljanja 👇 Napiši u komentaru, a onda dođi da proveriš izbor uživo.`;
  if (pillar === "local_discovery") return `Tražiš gde jesti u ${city}? ${name} je dobar početak. ${desc}${price} ${goalClose(restaurant)}`;
  if (pillar === "kitchen_story") return `Iza svakog dobrog tanjira ima detalj koji se ne vidi na prvi pogled. Danas je to ${name}: ${desc} ${goalClose(restaurant)}`;
  if (pillar === "social_prompt") return `Ako si već probao ${name}, reci nam šta bi poručio uz njega. Ako nisi — sačuvaj ovu objavu za sledeći dolazak. ${goalClose(restaurant)}`;
  if (pillar === "promotion") return `${hookFor(restaurant, pillar, index)} ${name} je ove nedelje u fokusu.${price} ${goalClose(restaurant)}`;
  return `${hookFor(restaurant, pillar, index)} ${name} — ${desc}${price} ${goalClose(restaurant)}`;
}

function facebookCaption(caption: string, restaurant: any) {
  const location = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(", ");
  const details = [location ? `📍 ${location}` : "", restaurant.phone ? `📞 ${restaurant.phone}` : "", restaurant.reservation_url ? `Rezervacije: ${restaurant.reservation_url}` : ""].filter(Boolean).join("\n");
  return details ? `${caption}\n\n${details}` : caption;
}

function altText(restaurant: any, item: any, pillar: Pillar) {
  const location = restaurant.city ? ` u ${restaurant.city}` : "";
  if (pillar === "engagement") return `Story restorana ${restaurant.name}${location} sa jelom ${item?.name || "iz menija"} i pitanjem gostima.`;
  return `Fotografija jela ${item?.name || "iz ponude"} restorana ${restaurant.name}${location}. ${item?.description || ""}`.trim();
}

function platformContent(restaurant: any, item: any, caption: string, variation: number, pillar: Pillar) {
  const discovery = discoveryPack(restaurant, item, variation);
  const alt = altText(restaurant, item, pillar);
  return {
    hashtags: discovery.instagram,
    seo_keywords: discovery.keywords,
    discovery_score: discovery.score,
    platform_content: {
      instagram: { caption, hashtags: discovery.instagram, keywords: discovery.keywords, strategy: "brand + local intent + dish/cuisine + max one broad relevant tag", alt_text: alt },
      facebook: { caption: facebookCaption(caption, restaurant), hashtags: discovery.facebook, keywords: discovery.keywords.slice(0,4), strategy: "clean local copy + 2-3 relevant tags + contact/booking context", alt_text: alt },
    },
  };
}

const dayKeys = ["mon","tue","wed","thu","fri","sat","sun"];

function rowForDay(openingHours: any, offset: number) {
  const raw = openingHours && typeof openingHours === "object" ? openingHours[dayKeys[offset]] : null;
  if (!raw || typeof raw !== "object") return { enabled: true, open: "09:00", close: "23:00" };
  return {
    enabled: raw.enabled !== false,
    open: /^\d{2}:\d{2}$/.test(String(raw.open || "")) ? String(raw.open) : "09:00",
    close: /^\d{2}:\d{2}$/.test(String(raw.close || "")) ? String(raw.close) : "23:00",
  };
}

function scheduleOffsets(total: number, openingHours: any, learnedDays: number[] = []) {
  const basePreferred = total <= 3 ? [0,2,4] : total === 4 ? [0,1,3,5] : total === 5 ? [0,1,2,4,5] : total === 6 ? [0,1,2,3,4,5] : [0,1,2,3,4,5,6];
  const learned = learnedDays.filter((day,index,list) => day >= 0 && day <= 6 && list.indexOf(day) === index);
  const preferred = learned.length ? [...learned, ...basePreferred.filter((day) => !learned.includes(day))].slice(0,total) : basePreferred;
  const open = dayKeys.map((_, index) => index).filter((offset) => rowForDay(openingHours, offset).enabled);
  if (!open.length) return preferred;
  const used = new Set<number>();
  return preferred.map((want, index) => {
    const available = open.filter((value) => !used.has(value));
    const pool = available.length ? available : open;
    const chosen = [...pool].sort((a,b) => Math.abs(a-want)-Math.abs(b-want) || a-b)[0] ?? open[index % open.length];
    used.add(chosen);
    return chosen;
  });
}

function minutes(value: string) {
  const [h,m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function performanceSignal(row: any) {
  const reach = Number(row?.reach || 0);
  const interactions = Number(row?.likes||0)+Number(row?.comments||0)+Number(row?.saves||0)+Number(row?.shares||0);
  const engagement = reach > 0 ? interactions / reach * 100 : 0;
  return engagement * 10 + Number(row?.saves||0) * 1.2 + Number(row?.shares||0) * 1.5 + Number(row?.clicks||0) * .5 + Number(row?.conversions||0) * 5;
}

function localHour(value: string, timeZone: string) {
  try {
    const text = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(value));
    const hour = Number(text);
    return Number.isFinite(hour) ? hour : null;
  } catch { return null; }
}

function localDayOffset(value: string, timeZone: string) {
  try {
    const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(value));
    const map:Record<string,number> = {Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
    return map[label] ?? null;
  } catch { return null; }
}

function scheduleFor(monday: Date, dayOffset: number, index: number, pillar: Pillar, timeZone: string, openingHours: any, learnedHour: number | null = null) {
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + dayOffset);
  const fallbackHour = pillar === "promotion" ? 16 : pillar === "engagement" ? 11 : pillar === "kitchen_story" ? 13 : index % 2 === 0 ? 9 : 17;
  const preferredHour = learnedHour !== null && Number.isFinite(learnedHour) ? clamp(Math.round(learnedHour), 7, 22) : fallbackHour;
  const preferred = preferredHour * 60 + 30;
  const row = rowForDay(openingHours, dayOffset);
  const openMinute = minutes(row.open);
  const closeMinute = minutes(row.close);
  const earliest = Math.max(7 * 60, openMinute - 60);
  const latest = Math.max(earliest, closeMinute - 60);
  const chosen = Math.min(latest, Math.max(earliest, preferred));
  return wallTimeIso(d, Math.floor(chosen / 60), chosen % 60, timeZone);
}

function postTypeFor(pillar: Pillar) {
  if (pillar === "engagement" || pillar === "kitchen_story") return "story";
  if (pillar === "promotion") return "promotion";
  return "feed";
}

function titleFor(item: any, pillar: Pillar, city?: string) {
  if (pillar === "engagement") return `${item.name} · Izaberi svoj favorit`;
  if (pillar === "local_discovery") return `${item.name} · ${city || "Lokalni favorit"}`;
  if (pillar === "kitchen_story") return `${item.name} · Iza scene`;
  if (pillar === "social_prompt") return `${item.name} · Tvoj izbor?`;
  if (pillar === "promotion") return `${item.name} · Ove nedelje`;
  return item.name;
}

function ctaFor(restaurant: any, pillar: Pillar) {
  if (pillar === "engagement" || pillar === "social_prompt") return "Odgovori";
  if (restaurant.social_goal === "delivery") return "Poruči";
  if (restaurant.social_goal === "walk_ins") return "Svrati danas";
  if (restaurant.social_goal === "awareness") return "Sačuvaj objavu";
  return restaurant.reservation_url ? "Rezerviši sto" : "Pošalji poruku";
}

function visualTemplate(restaurant: any, pillar: Pillar, postType: string, hasImage: boolean, variation = 0): VisualTemplate {
  if (!hasImage) return "minimal";
  if (pillar === "promotion") return variation % 2 === 0 ? "bold-offer" : "promo-badge";
  if (postType === "story" && pillar === "engagement") return "lunch-time";
  if (pillar === "local_discovery") return "hero-menu";
  if (pillar === "kitchen_story") return "family";
  if (pillar === "social_prompt") return "promo-badge";
  if (restaurant.brand_style === "premium") return variation % 3 === 0 ? "premium-grid" : variation % 3 === 1 ? "luxe" : "hero-menu";
  if (restaurant.brand_style === "traditional") return variation % 2 === 0 ? "family" : "editorial";
  if (restaurant.brand_style === "fast_food") return variation % 2 === 0 ? "bold-offer" : "promo-badge";
  return variation % 4 === 0 ? "editorial" : variation % 4 === 1 ? "hero-menu" : variation % 4 === 2 ? "poster" : "minimal";
}

function visualDesign(restaurant: any, item: any, pillar: Pillar, postType: string, title: string, caption: string, cta: string, variation = 0) {
  const template = visualTemplate(restaurant, pillar, postType, Boolean(item?.image_url), variation);
  return {
    template,
    format: postType === "story" ? "story" : "feed",
    headline: shorten(title, 52),
    subline: shorten(item?.description || caption, postType === "story" ? 96 : 118),
    cta,
    image_url: item?.image_url || null,
    photo_position: template === "split" || template === "hero-menu" ? "right" : "center",
    overlay: template === "minimal" || template === "hero-menu" ? .44 : template === "luxe" || template === "family" ? .58 : template === "poster" || template === "lunch-time" || template === "promo-badge" ? .72 : .68,
    auto: true,
  };
}

function visualBrief(restaurant: any, item: any, pillar: Pillar, postType: string) {
  const format = postType === "story" ? "1080x1920 vertical story" : "1080x1350 feed";
  const focus = pillar === "engagement" ? "jasno pitanje, kratak tekst i jak vizuelni fokus" : pillar === "promotion" ? "jedna jaka ponuda i dominantan CTA" : "hero fotografija hrane, premium tipografija i minimalan tekst";
  return `${format}. ${restaurant.brand_style || "modern"} stil. ${focus}. Koristi originalnu fotografiju jela ${item?.name || "iz ponude"}. Hrana mora ostati dominantna; bez generičkog AI izgleda.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const service = createClient(url, serviceKey);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "week";
    const restaurantId = body.restaurantId;
    if (!restaurantId) return json({ error: "restaurantId is required" }, 400);

    const [{ data: admin }, { data: ownedRestaurant }] = await Promise.all([
      service.from("app_admins").select("role").eq("user_id", user.id).eq("role", "superadmin").maybeSingle(),
      service.from("restaurants").select("*").eq("id", restaurantId).eq("owner_id", user.id).maybeSingle(),
    ]);
    const isAdmin = Boolean(admin);
    let restaurant: any = ownedRestaurant;
    if (isAdmin && !restaurant) {
      const { data } = await service.from("restaurants").select("*").eq("id", restaurantId).maybeSingle();
      restaurant = data;
    }
    if (!restaurant) return json({ error: "Restaurant not found" }, 404);

    let entitlement: any = { active: true, is_superadmin: isAdmin, generation_limit: null, generated_this_month: 0, features: {} };
    if (!isAdmin) {
      const { data, error } = await supabase.rpc("current_entitlement");
      if (error) return json({ error: error.message }, 403);
      entitlement = data || {};
      if (!entitlement.active) return json({ error: "Aktivan paket je potreban za generisanje sadržaja.", code: "ACTIVE_PLAN_REQUIRED" }, 402);
      if (action === "promotion" && entitlement.features?.campaigns !== true) {
        return json({ error: "Campaign Autopilot je dostupan u Pro i Business paketu.", code: "FEATURE_NOT_INCLUDED" }, 402);
      }
    }

    const generationLimit = entitlement.generation_limit === null || entitlement.generation_limit === undefined ? null : Number(entitlement.generation_limit);
    const generatedThisMonth = Number(entitlement.generated_this_month || 0);
    const ensureQuota = (additional: number) => {
      if (isAdmin || generationLimit === null) return null;
      if (generatedThisMonth + Math.max(0, additional) <= generationLimit) return null;
      const remaining = Math.max(0, generationLimit - generatedThisMonth);
      return json({ error: `Mesečni limit objava je dostignut. Preostalo: ${remaining}, potrebno: ${Math.max(0, additional)}.`, code: "GENERATION_LIMIT_REACHED", generated_this_month: generatedThisMonth, generation_limit: generationLimit, remaining }, 429);
    };

    if (action === "week") {
      const { data: menuItems, error: menuError } = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).eq("is_active", true).order("created_at", { ascending: false });
      if (menuError) return json({ error: menuError.message }, 400);
      if (!menuItems?.length) return json({ error: "Dodaj bar jedno aktivno jelo u meni." }, 400);

      const recentSince = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: recentPosts }, { data: performanceRows }] = await Promise.all([
        service.from("posts").select("id,menu_item_id,created_at").eq("restaurant_id", restaurantId).gte("created_at", recentSince),
        service.from("post_performance").select("post_id,reach,likes,comments,saves,shares,clicks,conversions").eq("restaurant_id", restaurantId).eq("platform","combined").order("measured_at",{ascending:false}).limit(60),
      ]);
      const recentUse = new Map<string,number>();
      for (const post of recentPosts || []) if (post.menu_item_id) recentUse.set(String(post.menu_item_id),(recentUse.get(String(post.menu_item_id))||0)+1);
      const performancePostIds = [...new Set((performanceRows || []).map((row:any)=>row.post_id).filter(Boolean))];
      let performancePosts:any[]=[];
      if (performancePostIds.length) {
        const { data } = await service.from("posts").select("id,menu_item_id,scheduled_for,post_type").in("id", performancePostIds);
        performancePosts = data || [];
      }
      const performancePostMap = new Map(performancePosts.map((post:any)=>[post.id,post]));
      const learnedScore = new Map<string,number>();
      for (const row of performanceRows || []) {
        const post = performancePostMap.get(row.post_id);
        if (!post?.menu_item_id) continue;
        const score = performanceSignal(row);
        const id=String(post.menu_item_id);
        learnedScore.set(id,(learnedScore.get(id)||0)+score);
      }
      const rankedMenu=[...menuItems].sort((a:any,b:any)=>{
        const aId=String(a.id), bId=String(b.id);
        const aManual=Number(a.marketing_priority||0)*35;
        const bManual=Number(b.marketing_priority||0)*35;
        const aLearn=(learnedScore.get(aId)||0) + aManual - (recentUse.get(aId)||0)*12;
        const bLearn=(learnedScore.get(bId)||0) + bManual - (recentUse.get(bId)||0)*12;
        return bLearn-aLearn || Number(Boolean(b.image_url))-Number(Boolean(a.image_url)) || (recentUse.get(aId)||0)-(recentUse.get(bId)||0);
      });
      const timeZone = String(restaurant.timezone || "Europe/Belgrade");
      const hourBuckets = new Map<string,{score:number;count:number}>();
      const dayBuckets = new Map<number,{score:number;count:number}>();
      for (const row of performanceRows || []) {
        const post = performancePostMap.get(row.post_id);
        if (!post?.scheduled_for) continue;
        const hour = localHour(String(post.scheduled_for), timeZone);
        if (hour === null) continue;
        const type = String(post.post_type || "feed");
        const signal = performanceSignal(row);
        const day = localDayOffset(String(post.scheduled_for), timeZone);
        if (day !== null) {
          const dayPrev = dayBuckets.get(day) || {score:0,count:0};
          dayPrev.score += signal; dayPrev.count += 1; dayBuckets.set(day, dayPrev);
        }
        for (const key of [`${type}:${hour}`, `all:${hour}`]) {
          const prev = hourBuckets.get(key) || {score:0,count:0};
          prev.score += signal; prev.count += 1; hourBuckets.set(key, prev);
        }
      }
      const bestLearnedHour = (type:string) => {
        const candidates=[...hourBuckets.entries()]
          .filter(([key,value]) => key.startsWith(type+":") && value.count >= (type==="all"?3:2))
          .map(([key,value]) => ({hour:Number(key.split(":")[1]),avg:value.score/value.count,count:value.count}))
          .sort((a,b)=>b.avg-a.avg || b.count-a.count);
        return candidates[0]?.hour ?? null;
      };
      const fallbackLearnedHour = bestLearnedHour("all");
      const learnedScheduleHours:Record<string,number|null> = {
        feed: bestLearnedHour("feed") ?? fallbackLearnedHour,
        story: bestLearnedHour("story") ?? fallbackLearnedHour,
        promotion: bestLearnedHour("promotion") ?? fallbackLearnedHour,
      };
      const learnedScheduleDays=[...dayBuckets.entries()]
        .filter(([,value])=>value.count>=2)
        .map(([day,value])=>({day,avg:value.score/value.count,count:value.count}))
        .sort((a,b)=>b.avg-a.avg||b.count-a.count)
        .map((row)=>row.day);
      const monday = mondayOfCurrentWeek(timeZone);
      const weekStart = dateOnly(monday);
      const frequency = clamp(Number(restaurant.posting_frequency || 5), 3, 7);
      const { data: existingPlan } = await supabase.from("content_plans").select("id").eq("restaurant_id", restaurantId).eq("week_start", weekStart).maybeSingle();
      let replaceableThisMonth = 0;
      if (existingPlan?.id) {
        const { data: existingPosts } = await supabase.from("posts").select("id,status,created_at").eq("content_plan_id", existingPlan.id);
        const locked = (existingPosts || []).filter((p: any) => p.status === "approved" || p.status === "published");
        if (locked.length) {
          return json({ error: "Ova nedelja već ima odobrene ili objavljene postove. Neću ih pregaziti. Regeneriši pojedinačnu objavu ili napravi novu nedelju kada počne sledeća.", code: "WEEK_HAS_LOCKED_POSTS", locked_posts: locked.length }, 409);
        }
        const monthStart = new Date();
        monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);
        replaceableThisMonth = (existingPosts || []).filter((p: any) => (p.status === "draft" || p.status === "rejected") && new Date(p.created_at).getTime() >= monthStart.getTime()).length;
      }
      const quotaError = ensureQuota(Math.max(0, frequency - replaceableThisMonth));
      if (quotaError) return quotaError;
      const { data: plan, error: planError } = await supabase.from("content_plans").upsert({ restaurant_id: restaurantId, week_start: weekStart, status: "generated" }, { onConflict: "restaurant_id,week_start" }).select().single();
      if (planError || !plan) return json({ error: planError?.message || "Plan error" }, 400);
      await supabase.from("posts").delete().eq("content_plan_id", plan.id).in("status", ["draft", "rejected"]);
      const pillars = pillarSequence(frequency);
      const scheduleDays = scheduleOffsets(frequency, restaurant.opening_hours, learnedScheduleDays);
      const selectedMenu = selectWeekItems(rankedMenu, pillars, recentUse, learnedScore);
      const payload = Array.from({ length: frequency }).map((_, index) => {
        const item = selectedMenu[index] || rankedMenu[index % rankedMenu.length];
        const otherItem = selectedMenu[(index + 1) % selectedMenu.length] || rankedMenu[(index + 1) % rankedMenu.length];
        const pillar = pillars[index];
        const postType = postTypeFor(pillar);
        const title = titleFor(item, pillar, restaurant.city);
        const caption = makeCaption(restaurant, item, index, pillar, otherItem);
        const cta = ctaFor(restaurant, pillar);
        const learnedHour = learnedScheduleHours[postType] ?? null;
        return {
          restaurant_id: restaurantId,
          content_plan_id: plan.id,
          menu_item_id: item.id,
          post_type: postType,
          scheduled_for: scheduleFor(monday, scheduleDays[index], index, pillar, timeZone, restaurant.opening_hours, learnedHour),
          title,
          caption,
          cta,
          ...platformContent(restaurant, item, caption, index, pillar),
          visual_brief: visualBrief(restaurant, item, pillar, postType),
          status: "draft",
          generation_meta: {
            engine: "restaurant-autopilot-v14",
            pillar,
            variation: index,
            image_url: item.image_url || null,
            location_tag: restaurant.neighborhood || restaurant.city || null,
            generated_at: new Date().toISOString(),
            format: postType === "story" ? "9:16" : "4:5",
            learning_signal: {
              performance_samples: (performanceRows || []).length,
              item_score: Math.round((learnedScore.get(String(item.id)) || 0) * 10) / 10,
              marketing_priority: Number(item.marketing_priority || 0),
              recent_uses_30d: recentUse.get(String(item.id)) || 0,
              schedule_hour: learnedHour,
              schedule_day: scheduleDays[index],
            },
            visual_design: visualDesign(restaurant, item, pillar, postType, title, caption, cta, index),
          },
        };
      });
      const { data: posts, error: insertError } = await supabase.from("posts").insert(payload).select();
      if (insertError) return json({ error: insertError.message }, 400);
      return json({ ok: true, plan, posts, engine: "restaurant-autopilot-v14", pillars, timezone: timeZone, schedule_days: scheduleDays, learning:{performance_samples:(performanceRows||[]).length,schedule_hours:learnedScheduleHours,schedule_days:learnedScheduleDays,ranked_menu:rankedMenu.map((item:any)=>({id:item.id,name:item.name,score:Math.round(((learnedScore.get(String(item.id))||0)+Number(item.marketing_priority||0)*35)*10)/10,marketing_priority:Number(item.marketing_priority||0),recent_uses_30d:recentUse.get(String(item.id))||0,coverage_bonus:(recentUse.get(String(item.id))||0)===0?22:(recentUse.get(String(item.id))||0)===1?8:0,exploration_bonus:Number(item.marketing_priority||0)>=2&&!(learnedScore.get(String(item.id))||0)?12:0}))} });
    }

    if (action === "promotion") {
      const quotaError = ensureQuota(2);
      if (quotaError) return quotaError;
      const title = String(body.title || "").trim();
      if (!title) return json({ error: "Naslov akcije je obavezan." }, 400);
      const description = String(body.description || "").trim();
      const discountText = String(body.discountText || "").trim();
      const startsAt = body.startsAt || new Date().toISOString();
      const endsAt = body.endsAt || null;
      const { data: promotion, error: promotionError } = await supabase.from("promotions").insert({ restaurant_id: restaurantId, title, description: description || null, discount_text: discountText || null, starts_at: startsAt, ends_at: endsAt, is_active: true }).select().single();
      if (promotionError || !promotion) return json({ error: promotionError?.message || "Promotion error" }, 400);

      const requestedMenuItemId = String(body.menuItemId || "").trim();
      let visualItem: any = null;
      if (requestedMenuItemId) {
        const { data } = await supabase.from("menu_items").select("*").eq("id", requestedMenuItemId).eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle();
        visualItem = data;
      }
      if (!visualItem) {
        const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).eq("is_active", true).not("image_url", "is", null).order("marketing_priority", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
        visualItem = data;
      }

      const pseudoItem = { name: title, description: description || discountText, category: visualItem?.category || "Promocija", price: null, currency: "RSD", image_url: visualItem?.image_url || null };
      const feedCaption = `${[title, discountText, description].filter(Boolean).join(" · ")}. ${goalClose(restaurant)}`;
      const storyCaption = `${discountText || title}. ${description || "Važi ograničeno vreme."} ${ctaFor(restaurant, "promotion")}.`;
      const cta = ctaFor(restaurant, "promotion");
      const commonMeta = { engine: "restaurant-autopilot-v14", source: "promotion", image_url: visualItem?.image_url || null, selected_menu_item_id: visualItem?.id || null, generated_at: new Date().toISOString(), pillar: "promotion" };
      const feedTitle = discountText || title;
      const feed = {
        restaurant_id: restaurantId, promotion_id: promotion.id, post_type: "promotion", scheduled_for: startsAt, title: feedTitle, caption: feedCaption, cta,
        ...platformContent(restaurant, pseudoItem, feedCaption, 1, "promotion"),
        visual_brief: visualBrief(restaurant, pseudoItem, "promotion", "promotion"), status: "draft",
        generation_meta: { ...commonMeta, variation: 1, format: "4:5", visual_design: { ...visualDesign(restaurant, pseudoItem, "promotion", "promotion", feedTitle, feedCaption, cta, 1), template: "bold-offer", headline: shorten(discountText || title, 48) } },
      };
      const storyTitle = discountText || title;
      const story = {
        restaurant_id: restaurantId, promotion_id: promotion.id, post_type: "story", scheduled_for: startsAt, title: `${title} · Story`, caption: storyCaption, cta,
        ...platformContent(restaurant, pseudoItem, storyCaption, 2, "promotion"),
        visual_brief: visualBrief(restaurant, pseudoItem, "promotion", "story"), status: "draft",
        generation_meta: { ...commonMeta, source: "promotion-story", variation: 2, format: "9:16", visual_design: { ...visualDesign(restaurant, pseudoItem, "promotion", "story", storyTitle, storyCaption, cta, 2), template: "promo-badge", headline: shorten(discountText || title, 45) } },
      };
      const { data: posts, error: postError } = await supabase.from("posts").insert([feed, story]).select();
      if (postError) return json({ error: postError.message }, 400);
      return json({ ok: true, promotion, posts, engine: "restaurant-autopilot-v14" });
    }

    if (action === "regenerate" || action === "optimize_discovery") {
      const postId = body.postId;
      if (!postId) return json({ error: "postId is required" }, 400);
      const { data: post, error: postError } = await supabase.from("posts").select("*, menu_items(*)").eq("id", postId).eq("restaurant_id", restaurantId).single();
      if (postError || !post) return json({ error: "Post not found" }, 404);
      const variation = Number(post.generation_meta?.variation || 0) + 1;
      const pillar = (post.generation_meta?.pillar || (post.post_type === "promotion" ? "promotion" : post.post_type === "story" ? "kitchen_story" : "hero_dish")) as Pillar;
      const item = post.menu_items || { name: post.title, description: null, price: null, currency: "RSD", image_url: post.generation_meta?.image_url || null };
      const caption = action === "regenerate" ? makeCaption(restaurant, item, variation, pillar) : (post.caption || makeCaption(restaurant, item, variation, pillar));
      const discovery = platformContent(restaurant, item, caption, variation, pillar);
      const oldVisual = post.generation_meta?.visual_design || {};
      const nextVisual = action === "regenerate" ? { ...oldVisual, subline: shorten(item?.description || caption, post.post_type === "story" ? 96 : 118) } : oldVisual;
      const { data: updated, error: updateError } = await supabase.from("posts").update({
        caption,
        ...discovery,
        cta: post.cta || ctaFor(restaurant, pillar),
        status: "draft",
        generation_meta: { ...(post.generation_meta || {}), engine: "restaurant-autopilot-v14", pillar, variation, visual_design: nextVisual, regenerated_at: new Date().toISOString() },
      }).eq("id", postId).select().single();
      if (updateError) return json({ error: updateError.message }, 400);
      return json({ ok: true, post: updated, engine: "restaurant-autopilot-v14" });
    }

    if (action === "quality_check") {
      const postId = body.postId;
      if (!postId) return json({ error: "postId is required" }, 400);
      const { data: post, error: postError } = await supabase.from("posts").select("*").eq("id", postId).eq("restaurant_id", restaurantId).single();
      if (postError || !post) return json({ error: "Post not found" }, 404);
      const visual = post.generation_meta?.visual_design || {};
      const checks = {
        caption: post.caption?.length >= 45 && post.caption?.length <= 450,
        local_signal: Boolean((post.seo_keywords || []).some((k: string) => restaurant.city && k.toLowerCase().includes(String(restaurant.city).toLowerCase()))),
        focused_hashtags: (post.hashtags || []).length >= 5 && (post.hashtags || []).length <= 10,
        clear_cta: Boolean(post.cta),
        photo_ready: Boolean(post.generation_meta?.image_url),
        platform_versions: Boolean(post.platform_content?.instagram && post.platform_content?.facebook),
        visual_design: Boolean(visual.template && visual.headline && visual.cta),
      };
      const score = Math.round((Object.values(checks).filter(Boolean).length / Object.values(checks).length) * 100);
      return json({ ok: true, score, checks });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});