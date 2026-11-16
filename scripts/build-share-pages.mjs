// Crée une page par annonce en ligne (stay/<id>.html) pour que WhatsApp, Facebook, etc.
// affichent un aperçu avec la photo, le titre et le prix quand on partage le lien.
// Lancé par .github/workflows/share-pages.yml ; peut aussi tourner à la main :
//   node scripts/build-share-pages.mjs            (lit les annonces dans Supabase)
//   node scripts/build-share-pages.mjs data.json  (lit les annonces dans un fichier, pour tester)
import fs from "node:fs";
import vm from "node:vm";
import { shareImageName, makeShareImages } from "./share-images.mjs";

const SITE = "https://yalladahab.com";
const OUT = "stay";
const IMG = `${OUT}/img`;

// Réglages et textes du site, lus dans les fichiers du site lui-même.
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync("assets/js/config.js", "utf8") + fs.readFileSync("assets/js/i18n.js", "utf8"), ctx);
const CONFIG = ctx.window.YD_CONFIG;
const EN = ctx.window.YD_I18N.en;

async function loadListings() {
  if (process.argv[2]) return JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/listings?status=eq.published&select=*`, {
    headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${CONFIG.supabaseAnonKey}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const text = (obj) => (obj && (obj.en || obj.fr)) || "";
const money = (n, cur) => (cur === "USD" ? `$${Number(n).toLocaleString("en")}` : `${Number(n).toLocaleString("en")} EGP`);
const safeId = (id) => /^[a-z0-9_-]+$/i.test(id);

// Prix de nuit le plus bas (avec le tableau « prix selon le nombre de personnes »).
function nightPrice(l) {
  const table = l.price_by_guests && typeof l.price_by_guests === "object" ? Object.values(l.price_by_guests).map(Number).filter((n) => n > 0) : [];
  const night = table.length ? Math.min(...table, ...(l.price_night ? [l.price_night] : [])) : l.price_night;
  return { night, from: table.length > 0 };
}

// Prix affiché sur l'image : la nuit, sinon la semaine, sinon le mois.
function imagePrice(l) {
  const { night, from } = nightPrice(l);
  if (night) return { amount: money(night, l.currency), unit: "/ night", from: from ? "from" : "" };
  if (l.price_week) return { amount: money(l.price_week, l.currency), unit: "/ week", from: "" };
  if (l.price_month) return { amount: money(l.price_month, l.currency), unit: "/ month", from: "" };
  return null;
}

const areaLabel = (l) => (l.area === "near-dahab" || l.area === "other-dahab") ? EN["area." + l.area] : (EN["area." + l.area] || l.area) + ", Dahab";

function summary(l) {
  const parts = [EN["type." + l.type] || l.type, `${l.guests} guests`];
  if (l.beds > 0) parts.push(`${l.beds} bed${l.beds === 1 ? "" : "s"}`);
  // Prix selon le nombre de personnes : on affiche le plus petit (« from »).
  const { night, from } = nightPrice(l);
  if (night) parts.push(`${from ? "from " : ""}${money(night, l.currency)} / night`);
  if (l.price_week) parts.push(`${money(l.price_week, l.currency)} / week`);
  if (l.price_month) parts.push(`${money(l.price_month, l.currency)} / month`);
  return parts.join(" · ");
}

function page(template, l, shareImage) {
  const title = `${text(l.title)} · ${areaLabel(l)}`;
  let desc = text(l.description).replace(/\s+/g, " ").trim();
  if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  desc = `${summary(l)}. ${desc}`;
  const url = `${SITE}/${OUT}/${l.id}`;
  // Image d'aperçu : la composition (grande photo + miniatures + bandeau vert sauge),
  // sinon la 1re photo, sinon l'image du site.
  const photo = l.photos && l.photos[0];
  const fallback = `${SITE}/assets/img/share-sauge.jpg`;
  const image = shareImage ? `${SITE}/${shareImage}` : photo || fallback;
  const sized = !!shareImage || !photo;
  const meta = [
    `<title>${esc(title)} · Yalla Dahab</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:site_name" content="Yalla Dahab">`,
    // Une seule image (sinon Facebook peut choisir l'image du site).
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:secure_url" content="${esc(image)}">`,
    ...(sized ? [
      `<meta property="og:image:type" content="image/jpeg">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
    ] : []),
    `<meta property="og:image:alt" content="${esc(photo ? text(l.title) : "Yalla Dahab: stay with Dahab locals")}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ].join("\n  ");
  return template
    // Les liens du site (styles, scripts, menu) partent de la racine.
    // (listing.html a déjà <base href="/"> pour que ses liens marchent aussi depuis /stay/…)
    .replace(/<meta charset="utf-8">(?!\s*<base)/, '<meta charset="utf-8">\n  <base href="/">')
    // On retire les balises génériques de listing.html pour mettre celles de l'annonce.
    .replace(/\s*<title>[^<]*<\/title>/, "")
    .replace(/\s*<meta (name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, "")
    .replace('<meta name="viewport" content="width=device-width, initial-scale=1">', `<meta name="viewport" content="width=device-width, initial-scale=1">\n  ${meta}`)
    .replace('<body data-page="listing">', `<body data-page="listing" data-listing-id="${esc(l.id)}">`);
}

const listings = (await loadListings()).filter((l) => safeId(l.id));
const template = fs.readFileSync("listing.html", "utf8");
fs.mkdirSync(IMG, { recursive: true });

// Images d'aperçu : refaites seulement quand les photos, le titre ou le prix changent
// (le nom du fichier change alors aussi, et Facebook reprend la nouvelle image).
const jobs = listings.filter((l) => l.photos && l.photos.length).map((l) => {
  const info = { title: text(l.title), area: areaLabel(l), price: imagePrice(l) };
  return { listing: l, info, file: `${IMG}/${shareImageName(l, info)}` };
});
let made = new Set();
try {
  made = await makeShareImages(jobs);
} catch (e) {
  // Sans Chrome, on garde l'ancienne façon (1re photo) plutôt que de tout bloquer.
  console.log(`Images d'aperçu non créées : ${e.message.split("\n")[0]}`);
  for (const j of jobs) if (fs.existsSync(j.file)) made.add(j.file);
}
const imageOf = new Map(jobs.filter((j) => made.has(j.file)).map((j) => [j.listing.id, j.file]));

const keep = new Set();
for (const l of listings) {
  const file = `${l.id}.html`;
  keep.add(file);
  fs.writeFileSync(`${OUT}/${file}`, page(template, l, imageOf.get(l.id)));
}
// Les annonces retirées ou mises en pause perdent leur page (le lien renvoie alors vers la fiche).
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html") && !keep.has(f)) fs.unlinkSync(`${OUT}/${f}`);
// Les anciennes images d'aperçu (photos ou prix changés, annonce retirée) sont supprimées.
const keepImg = new Set([...imageOf.values()].map((f) => f.slice(IMG.length + 1)));
for (const f of fs.readdirSync(IMG)) if (!keepImg.has(f)) fs.unlinkSync(`${IMG}/${f}`);
console.log(`${keep.size} page(s) de partage dans ${OUT}/, ${keepImg.size} image(s) d'aperçu dans ${IMG}/`);
