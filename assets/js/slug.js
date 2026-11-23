// Adresses lisibles des annonces : /stay/dar-bahr-horizon-assala au lieu de /stay/<id>.
// L'adresse vient du titre (en anglais) et du quartier. Si deux annonces donnent la même,
// la plus ancienne la garde et les suivantes reçoivent en plus le début de leur id (…-3a6e).
// Ce fichier sert au site (app.js) ET à scripts/build-share-pages.mjs : un seul calcul pour les deux.
(function (w) {
  var RESERVED = { img: 1, slugs: 1 };                       // noms déjà pris dans le dossier stay/
  var NO_AREA = { "near-dahab": 1, "other-dahab": 1 };        // « autour de Dahab » : pas de quartier dans l'adresse

  function words(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function base(l) {
    var title = String((l.title && (l.title.en || l.title.fr)) || "");
    // On garde le nom avant « : » ou « , » (« Dar Bahr · Horizon: sea and mountain view » → dar-bahr-horizon).
    var short = title.split(/[:,]/)[0];
    var s = words(words(short).length >= 3 ? short : title);
    if (s.length > 50) {
      s = s.slice(0, 50);
      var cut = s.lastIndexOf("-");
      s = (cut > 20 ? s.slice(0, cut) : s).replace(/-+$/, "");
    }
    // Le quartier est ajouté, sauf s'il est déjà dans le titre (« Light House » compte pour lighthouse).
    if (l.area && !NO_AREA[l.area] && s.replace(/-/g, "").indexOf(l.area.replace(/-/g, "")) === -1) s = s ? s + "-" + l.area : l.area;
    return s || "stay";
  }

  // listings : les annonces en ligne. Rend { id: adresse }.
  function slugs(listings) {
    var created = function (l) { return String(l.created_at || l.createdAt || ""); };
    var sorted = (listings || []).slice().sort(function (a, b) {
      var ca = created(a), cb = created(b);
      if (ca !== cb) return ca < cb ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    var used = {}, out = {};
    sorted.forEach(function (l) {
      var id = String(l.id), s = base(l);
      // Jamais une adresse qui ressemble à un id (les anciens liens /stay/<id> restent à eux).
      if (/^[0-9a-f]{32}$/.test(s)) s = "stay-" + s;
      var tries = [s, s + "-" + id.slice(0, 4), s + "-" + id.slice(0, 8), s + "-" + id];
      s = tries.filter(function (x) { return !used[x] && !RESERVED[x]; })[0] || tries[3];
      used[s] = 1;
      out[id] = s;
    });
    return out;
  }

  w.YD_SLUGS = slugs;
})(window);
