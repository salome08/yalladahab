// Image d'aperçu d'une annonce (1200 x 630) pour Facebook, WhatsApp, etc. :
// la 1re photo en grand au centre, 4 autres photos en miniatures sur les côtés et un
// bandeau vert sauge avec le logo, le titre, le prix et le quartier. Le centre (carré de
// 630 x 630) se suffit à lui-même, car Facebook n'en montre que ce carré dans les commentaires.
// Utilisé par build-share-pages.mjs. Le dessin est fait par Chrome (playwright-core).
import fs from "node:fs";
import crypto from "node:crypto";

// À changer (v2, v3…) quand on modifie le dessin : toutes les images seront refaites
// avec un nouveau nom de fichier, ce qui oblige Facebook à reprendre la nouvelle image.
const DESIGN = "v2";
const THUMBS = 4;

const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#ffffff"/><circle cx="26" cy="15" r="6" fill="#ff8a66"/><path d="M6 25q4.5-4 9 0t9 0 10 0" fill="none" stroke="#4f6f52" stroke-width="2.6" stroke-linecap="round"/><path d="M6 31q4.5-4 9 0t9 0 10 0" fill="none" stroke="#9cbf98" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=block">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#4f6f52;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#fff;position:relative}
/* Facebook (commentaires, petits aperçus) recoupe l'image en carré au centre : x 285 à 915.
   La grande photo, le titre et le prix restent donc dans ce carré ; les miniatures et le logo
   sont sur les côtés, visibles seulement dans le grand aperçu. */
.ph{position:absolute;border-radius:16px;overflow:hidden;background:#3d5840}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.main{left:297px;width:606px;top:14px;height:428px}
.n1 .main{left:14px;width:1172px}
.t1{left:14px;top:14px;width:269px;height:209px}
.t2{left:14px;top:233px;width:269px;height:209px}
.t3{left:917px;top:14px;width:269px;height:209px}
.t4{left:917px;top:233px;width:269px;height:209px}
.n3 .t1{height:428px}.n3 .t2{left:917px;top:14px;height:428px}
.more{position:absolute;inset:0;background:rgba(30,42,34,.55);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px}
.band{position:absolute;left:0;right:0;top:442px;bottom:0}
.logo{position:absolute;left:14px;width:269px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:12px}
.logo svg{width:56px;height:56px;flex:none}
.logo span{font-size:26px;font-weight:700;line-height:1.05}
.logo b{font-weight:800;display:block}
.center{position:absolute;left:297px;width:606px;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center}
.title{font-size:31px;font-weight:800;line-height:1.16;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}
.price{background:#c4673f;color:#fff;border-radius:999px;padding:9px 22px;font-size:26px;font-weight:800;white-space:nowrap}
.price small{font-size:19px;font-weight:700;opacity:.92}
.area{position:absolute;left:917px;width:269px;top:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:10px;font-size:23px;font-weight:600;color:#e3eedf;text-align:left;line-height:1.2}
.area svg{width:26px;height:26px;flex:none}
</style></head><body>
<div id="photos"></div>
<div class="band">
  <div class="logo">${LOGO}<span>Yalla<b>Dahab</b></span></div>
  <div class="center"><div class="title" id="title"></div><div class="price" id="price"></div></div>
  <div class="area"><svg viewBox="0 0 24 24" fill="none" stroke="#e3eedf" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span id="area"></span></div>
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
  var box=document.getElementById("photos");box.className="n"+n;
  imgs.forEach(function(img,k){var c=document.createElement("div");c.className="ph "+(k===0?"main":"t"+k);c.append(img);
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
