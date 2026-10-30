// Yalla Dahab : import rapide d'une annonce Airbnb.
// L'hôte colle le lien de son annonce Airbnb dans l'éditeur ; cette fonction lit la page
// (titre, description, voyageurs, chambres, photos) et copie les photos dans son dossier
// de photos, pour que l'annonce ne dépende pas d'Airbnb. Réservée aux comptes connectés.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_PHOTOS = 12;
const BUCKET = "listing-photos";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Seules les adresses Airbnb sont acceptées (la fonction ne doit pas servir à lire d'autres sites).
function isAirbnb(u: URL) {
  return u.protocol === "https:" && (/(^|\.)airbnb\.[a-z.]+$/.test(u.hostname) || u.hostname === "abnb.me");
}

async function roomUrl(link: string) {
  let u: URL;
  try { u = new URL(link.trim()); } catch { return null; }
  if (!isAirbnb(u)) return null;
  // Lien court de l'appli (abnb.me) : on suit la redirection pour trouver le numéro de l'annonce.
  if (u.hostname === "abnb.me") {
    const res = await fetch(u, { redirect: "follow" });
    u = new URL(res.url);
    if (!isAirbnb(u)) return null;
  }
  const id = u.pathname.match(/\/rooms\/(?:plus\/)?(\d+)/)?.[1];
  return id ? `https://www.airbnb.com/rooms/${id}` : null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function meta(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, "i");
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${key}"`, "i");
  const m = html.match(re) || html.match(re2);
  return m ? decode(m[1]) : "";
}

// Texte d'une chaîne JSON trouvée dans la page (les données de l'annonce y sont en JSON).
function jsonString(html: string, key: string) {
  const m = html.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return "";
  try { return JSON.parse(`"${m[1]}"`); } catch { return ""; }
}

function cleanHtml(s: string) {
  return decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n").trim();
}

function parse(html: string) {
  // <title> : « Nom de l'annonce - Appartements à louer à Dahab, … - Airbnb »
  const pageTitle = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] || "");
  let title = pageTitle.split(/\s+-\s+/)[0].trim();
  const ogTitle = meta(html, "og:title");
  const ogDesc = meta(html, "og:description");
  if (!title || /^airbnb/i.test(title)) title = ogDesc || ogTitle;

  const htmlDesc = html.match(/"htmlDescription":\{[^{}]*?"htmlText":"((?:[^"\\]|\\.)*)"/)?.[1];
  let description = "";
  if (htmlDesc) { try { description = cleanHtml(JSON.parse(`"${htmlDesc}"`)); } catch { /* ignoré */ } }
  if (!description) description = jsonString(html, "description") || meta(html, "description");

  const facts = `${ogTitle} ${pageTitle} ${html.slice(0, 400000)}`;
  const guests = Number(facts.match(/(\d+)\s+guests?/i)?.[1]) || null;
  const bedrooms = /\bstudio\b/i.test(ogTitle) ? 0 : (Number(facts.match(/(\d+)\s+bedrooms?/i)?.[1]) || null);

  const kind = (ogTitle + " " + pageTitle).toLowerCase();
  const type = /villa|house|home|bungalow|chalet/.test(kind) ? "villa"
    : /private room|shared room|room in|hotel room|guesthouse|bed and breakfast/.test(kind) ? "room"
    : /studio|loft/.test(kind) || bedrooms === 0 ? "studio"
    : /apartment|rental unit|condo|flat/.test(kind) ? "apartment" : "";

  // Photos de l'annonce (on écarte les photos de profil des hôtes et voyageurs).
  const seen = new Set<string>();
  const photos: string[] = [];
  for (const m of html.matchAll(/https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s\\?)]+\.(?:jpe?g|png|webp)/gi)) {
    const src = m[0];
    if (/\/user\/|User-|\/profile|platform-assets|\/airbnb-/i.test(src) || seen.has(src)) continue;
    seen.add(src);
    photos.push(src);
    if (photos.length >= MAX_PHOTOS) break;
  }
  const og = meta(html, "og:image");
  if (!photos.length && og) photos.push(og.split("?")[0]);

  return { title, description, guests, bedrooms, type, photos };
}

// Copie une photo Airbnb (taille 1200 px) dans le dossier de photos de l'hôte.
async function copyPhoto(userId: string, src: string, i: number) {
  try {
    const res = await fetch(`${src}?im_w=1200`);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    const path = `${userId}/${Date.now()}-airbnb-${i}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, await res.arrayBuffer(), { contentType: type, cacheControl: "31536000" });
    if (error) return null;
    return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return reply({ error: "login" }, 401);

  const { url } = await req.json().catch(() => ({}));
  const room = url && await roomUrl(String(url));
  if (!room) return reply({ error: "bad_url" }, 400);

  const page = await fetch(room, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html",
    },
  });
  if (!page.ok) return reply({ error: "airbnb_" + page.status }, 502);
  const listing = parse(await page.text());
  if (!listing.title && !listing.photos.length) return reply({ error: "nothing_found" }, 422);

  const copied = await Promise.all(listing.photos.map((src, i) => copyPhoto(auth.user.id, src, i)));
  listing.photos = copied.filter((p): p is string => Boolean(p));
  return reply({ ...listing, source: room });
});
