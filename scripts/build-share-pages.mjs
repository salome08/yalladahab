// Crée une page par annonce en ligne (stay/<adresse lisible>.html, ex. stay/dar-bahr-horizon-assala.html)
// pour que WhatsApp, Facebook, etc. affichent un aperçu avec la photo, le titre et le prix quand on partage le lien.
// Les anciens liens restent valables : stay/<id>.html (liens donnés avant les adresses lisibles) et
// les anciennes adresses lisibles (titre changé), gardées dans stay/slugs.json.
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
vm.runInNewContext(["config.js", "i18n.js", "slug.js"].map((f) => fs.readFileSync(`assets/js/${f}`, "utf8")).join("\n"), ctx);
const CONFIG = ctx.window.YD_CONFIG;
const EN = ctx.window.YD_I18N.en;
const makeSlugs = ctx.window.YD_SLUGS;

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

function page(template, l, shareImage, slug) {
  const title = `${text(l.title)} · ${areaLabel(l)}`;
  let desc = text(l.description).replace(/\s+/g, " ").trim();
  if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  desc = `${summary(l)}. ${desc}`;
  const url = `${SITE}/${OUT}/${slug}`;
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
    .replace(/\s*<meta (name="description"|name="robots"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, "")
    .replace('<meta name="viewport" content="width=device-width, initial-scale=1">', `<meta name="viewport" content="width=device-width, initial-scale=1">\n  ${meta}`)
    .replace('<body data-page="listing">', `<body data-page="listing" data-listing-id="${esc(l.id)}">`)
    // Le texte de l'annonce directement dans la page, pour Google (la fiche complète le remplace dès qu'elle s'affiche).
    .replace('<div class="container" id="listing"></div>', `<div class="container" id="listing">${staticBody(l, title)}</div>`)
    .replace("</head>", `  <script type="application/ld+json">${jsonLd(l, title, url, photo)}</script>\n</head>`);
}

// Contenu lisible sans JavaScript : titre, lieu, prix, photos, description, lien vers tous les logements.
function staticBody(l, title) {
  const photos = (l.photos || []).slice(0, 3).map((p, i) =>
    `<img src="${esc(p)}" alt="${esc(text(l.title))}${i ? ` (photo ${i + 1})` : ""}" loading="lazy" style="width:100%;max-width:640px;border-radius:14px;display:block;margin:0 0 12px">`).join("");
  const desc = text(l.description).trim().split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<article class="stay-static" style="padding:24px 0">` +
    `<h1>${esc(text(l.title))}</h1>` +
    `<p><strong>${esc(areaLabel(l))}</strong> · ${esc(summary(l))}</p>` +
    photos + desc +
    `<p>Contact the host directly on WhatsApp, no booking fees.</p>` +
    `<p><a href="/listings.html">See all stays in Dahab</a> · <a href="/">Yalla Dahab</a></p>` +
    `</article>`;
}

// Fil d'Ariane pour Google : Yalla Dahab › Stays in Dahab › l'annonce.
function jsonLd(l, title, url, photo) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Yalla Dahab", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Stays in Dahab", item: `${SITE}/listings.html` },
      { "@type": "ListItem", position: 3, name: text(l.title), item: url },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Plan du site pour Google (sitemap.xml) : les pages publiques + une adresse par annonce en ligne.
function writeSitemap(listings, slugOf) {
  const day = (d) => (d ? String(d).slice(0, 10) : "");
  const pages = ["", "listings.html", "events.html", "host.html", "advertise.html"].map((p) => ({ loc: `${SITE}/${p}` }));
  for (const l of listings) pages.push({ loc: `${SITE}/${OUT}/${slugOf[l.id]}`, lastmod: day(l.updated_at || l.created_at) });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map((p) => `  <url><loc>${esc(p.loc)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}</url>`).join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync("sitemap.xml", xml);
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

// Adresses lisibles. stay/slugs.json garde toutes les adresses déjà données (adresse → id),
// pour qu'un lien partagé reste bon même si le titre change ensuite.
const SLUG_FILE = `${OUT}/slugs.json`;
const slugOf = makeSlugs(listings);
let history = {};
try { history = JSON.parse(fs.readFileSync(SLUG_FILE, "utf8")); } catch (e) {}
for (const [id, slug] of Object.entries(slugOf)) history[slug] = id;   // l'adresse actuelle gagne toujours
const sortedHistory = Object.fromEntries(Object.entries(history).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(SLUG_FILE, JSON.stringify(sortedHistory, null, 1) + "\n");

const keep = new Set();
const byId = new Map(listings.map((l) => [l.id, l]));
const names = new Map();   // nom de fichier → annonce
for (const l of listings) {
  names.set(slugOf[l.id], l);   // nouvelle adresse lisible
  names.set(l.id, l);           // ancien lien /stay/<id>
}
for (const [slug, id] of Object.entries(history)) if (!names.has(slug) && byId.has(id)) names.set(slug, byId.get(id));
for (const [name, l] of names) {
  if (!safeId(name)) continue;
  const file = `${name}.html`;
  keep.add(file);
  // Toutes ces pages annoncent l'adresse lisible actuelle (og:url) ; la fiche l'affiche aussi dans la barre d'adresse.
  fs.writeFileSync(`${OUT}/${file}`, page(template, l, imageOf.get(l.id), slugOf[l.id]));
}
// Les annonces retirées ou mises en pause perdent leur page (le lien renvoie alors vers la fiche).
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html") && !keep.has(f)) fs.unlinkSync(`${OUT}/${f}`);
// Les anciennes images d'aperçu (photos ou prix changés, annonce retirée) sont supprimées.
const keepImg = new Set([...imageOf.values()].map((f) => f.slice(IMG.length + 1)));
for (const f of fs.readdirSync(IMG)) if (!keepImg.has(f)) fs.unlinkSync(`${IMG}/${f}`);
writeSitemap(listings.filter((l) => safeId(slugOf[l.id] || "")), slugOf);
console.log(`${listings.length} annonce(s), ${keep.size} page(s) de partage dans ${OUT}/, ${keepImg.size} image(s) d'aperçu dans ${IMG}/`);
