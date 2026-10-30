// Crée une page par annonce en ligne (stay/<id>.html) pour que WhatsApp, Facebook, etc.
// affichent un aperçu avec la photo, le titre et le prix quand on partage le lien.
// Lancé par .github/workflows/share-pages.yml ; peut aussi tourner à la main :
//   node scripts/build-share-pages.mjs            (lit les annonces dans Supabase)
//   node scripts/build-share-pages.mjs data.json  (lit les annonces dans un fichier, pour tester)
import fs from "node:fs";
import vm from "node:vm";

const SITE = "https://yalladahab.com";
const OUT = "stay";

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

function summary(l) {
  const parts = [EN["type." + l.type] || l.type, `${l.guests} guests`];
  if (l.price_night) parts.push(`${money(l.price_night, l.currency)} / night`);
  if (l.price_month) parts.push(`${money(l.price_month, l.currency)} / month`);
  return parts.join(" · ");
}

function page(template, l) {
  const title = `${text(l.title)} · ${EN["area." + l.area] || l.area}, Dahab`;
  let desc = text(l.description).replace(/\s+/g, " ").trim();
  if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  desc = `${summary(l)}. ${desc}`;
  const url = `${SITE}/${OUT}/${l.id}`;
  const image = (l.photos && l.photos[0]) || `${SITE}/assets/img/og-image.png`;
  const meta = [
    `<title>${esc(title)} · Yalla Dahab</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:site_name" content="Yalla Dahab">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:alt" content="${esc(text(l.title))}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("\n  ");
  return template
    // Les liens du site (styles, scripts, menu) partent de la racine.
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="/">')
    // On retire les balises génériques de listing.html pour mettre celles de l'annonce.
    .replace(/\s*<title>[^<]*<\/title>/, "")
    .replace(/\s*<meta (name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/g, "")
    .replace('<meta name="viewport" content="width=device-width, initial-scale=1">', `<meta name="viewport" content="width=device-width, initial-scale=1">\n  ${meta}`)
    .replace('<body data-page="listing">', `<body data-page="listing" data-listing-id="${esc(l.id)}">`);
}

const listings = (await loadListings()).filter((l) => safeId(l.id));
const template = fs.readFileSync("listing.html", "utf8");
fs.mkdirSync(OUT, { recursive: true });
const keep = new Set();
for (const l of listings) {
  const file = `${l.id}.html`;
  keep.add(file);
  fs.writeFileSync(`${OUT}/${file}`, page(template, l));
}
// Les annonces retirées ou mises en pause perdent leur page (le lien renvoie alors vers la fiche).
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html") && !keep.has(f)) fs.unlinkSync(`${OUT}/${f}`);
console.log(`${keep.size} page(s) de partage dans ${OUT}/`);
