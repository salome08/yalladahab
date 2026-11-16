// Image d'aperçu d'une annonce (1200 x 630) pour Facebook, WhatsApp, etc. :
// la 1re photo en grand, 4 autres photos en miniatures et un bandeau vert sauge
// avec le logo, le titre, le quartier et le prix.
// Utilisé par build-share-pages.mjs. Le dessin est fait par Chrome (playwright-core).
import fs from "node:fs";
import crypto from "node:crypto";

// À changer (v2, v3…) quand on modifie le dessin : toutes les images seront refaites
// avec un nouveau nom de fichier, ce qui oblige Facebook à reprendre la nouvelle image.
const DESIGN = "v1";
const THUMBS = 4;

const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#ffffff"/><circle cx="26" cy="15" r="6" fill="#ff8a66"/><path d="M6 25q4.5-4 9 0t9 0 10 0" fill="none" stroke="#4f6f52" stroke-width="2.6" stroke-linecap="round"/><path d="M6 31q4.5-4 9 0t9 0 10 0" fill="none" stroke="#9cbf98" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#4f6f52;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff;position:relative}
.photos{position:absolute;left:18px;top:18px;right:18px;height:452px;display:grid;gap:10px}
.photos.n5{grid-template-columns:740px 1fr 1fr;grid-template-rows:1fr 1fr}
.photos.n5 .main{grid-row:1/3}
.photos.n3{grid-template-columns:740px 1fr;grid-template-rows:1fr 1fr}
.photos.n3 .main{grid-row:1/3}
.photos.n1{grid-template-columns:1fr}
.ph{position:relative;border-radius:16px;overflow:hidden;background:#3d5840}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.more{position:absolute;inset:0;background:rgba(30,42,34,.55);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:30px}
.band{position:absolute;left:18px;right:18px;bottom:0;height:160px;display:flex;align-items:center;gap:22px}
.logo{display:flex;align-items:center;gap:12px;flex:none;padding-right:22px;border-right:2px solid rgba(255,255,255,.25)}
.logo svg{width:58px;height:58px}
.logo span{font-size:27px;font-weight:700;line-height:1.05}
.logo b{font-weight:800;display:block}
.info{flex:1;min-width:0}
.title{font-size:31px;font-weight:800;line-height:1.18;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.area{margin-top:5px;font-size:22px;font-weight:500;color:#dbe8d6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.price{flex:none;background:#c4673f;color:#fff;border-radius:999px;padding:14px 26px;font-size:28px;font-weight:800;white-space:nowrap}
.price small{font-size:20px;font-weight:700;opacity:.9}
</style></head><body>
<div class="photos" id="photos"></div>
<div class="band">
  <div class="logo">${LOGO}<span>Yalla<b>Dahab</b></span></div>
  <div class="info"><div class="title" id="title"></div><div class="area" id="area"></div></div>
  <div class="price" id="price"></div>
</div>
<script>
// Charge les photos ; celles qui ne se chargent pas sont simplement laissées de côté.
function load(src){return new Promise(function(ok){var i=new Image();var t=setTimeout(function(){ok(null)},20000);i.onload=function(){clearTimeout(t);ok(i)};i.onerror=function(){clearTimeout(t);ok(null)};i.src=src})}
window.render=async function(d){
  document.getElementById("title").textContent=d.title;
  document.getElementById("area").textContent=d.area;
  var p=document.getElementById("price");
  if(d.price){p.innerHTML="";p.append(d.price.amount);var s=document.createElement("small");s.textContent=" "+d.price.unit;p.append(s);if(d.price.from){var f=document.createElement("small");f.textContent=d.price.from+" ";p.prepend(f)}}else p.remove();
  var imgs=(await Promise.all(d.photos.map(load))).filter(Boolean);
  if(!imgs.length)return 0;
  var n=imgs.length>=5?5:imgs.length>=3?3:1;imgs=imgs.slice(0,n);
  var box=document.getElementById("photos");box.className="photos n"+n;
  imgs.forEach(function(img,k){var c=document.createElement("div");c.className="ph"+(k===0?" main":"");c.append(img);
    if(k===n-1&&n>1&&d.total>n){var m=document.createElement("div");m.className="more";m.textContent="+"+(d.total-n)+(d.total-n===1?" photo":" photos");c.append(m)}
    box.append(c)});
  await document.fonts.ready;
  return imgs.length;
};
</script></body></html>`;

export function shareImageName(l, info) {
  const photos = (l.photos || []).slice(0, THUMBS + 1);
  const key = JSON.stringify([DESIGN, photos, (l.photos || []).length, info]);
  return `${l.id}-${crypto.createHash("sha1").update(key).digest("hex").slice(0, 10)}.jpg`;
}

async function launch() {
  let mod;
  try { mod = await import("playwright-core"); } catch { mod = await import("playwright"); }
  const chromium = mod.chromium || mod.default.chromium;
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  return chromium.launch(opts);
}

// jobs : [{ listing, info: {title, area, price}, file }] → crée les fichiers manquants.
// Renvoie l'ensemble des fichiers réussis.
export async function makeShareImages(jobs) {
  const ok = new Set();
  const todo = jobs.filter((j) => {
    if (fs.existsSync(j.file)) { ok.add(j.file); return false; }
    return true;
  });
  if (!todo.length) return ok;
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    for (const j of todo) {
      try {
        await page.setContent(PAGE, { waitUntil: "load", timeout: 30000 });
        const photos = (j.listing.photos || []).slice(0, THUMBS + 1);
        const count = await page.evaluate((d) => window.render(d), { ...j.info, photos, total: (j.listing.photos || []).length });
        if (!count) { console.log(`  ${j.listing.id} : aucune photo chargée, image non créée`); continue; }
        await page.screenshot({ path: j.file, type: "jpeg", quality: 86 });
        ok.add(j.file);
        console.log(`  ${j.file} (${count} photo(s))`);
      } catch (e) {
        console.log(`  ${j.listing.id} : erreur ${e.message.split("\n")[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  return ok;
}
