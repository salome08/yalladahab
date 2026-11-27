(function () {
  "use strict";

  var CONFIG = window.YD_CONFIG;
  var I18N = window.YD_I18N;
  var DB = window.YD_DB;
  // Remplis au chargement de la page, depuis la base ou depuis les fichiers.
  var LISTINGS = [];
  // Adresse lisible de chaque annonce en ligne : { id: "dar-bahr-horizon-assala" } (assets/js/slug.js).
  var SLUGS = {};
  var EVENTS = [];
  var ADS = [];
  var LANGS = ["en", "fr", "ar"];
  var LANG_NAMES = { en: "EN", fr: "FR", ar: "عربي" };
  var RTL_LANGS = ["ar"];
  var AREAS = ["blue-hole-road", "canyon", "eel-garden", "assala", "mashraba", "masbat", "lighthouse", "dahab-city", "mubarak", "zarnouk", "tanmeia", "lagoon", "south-coast", "other-dahab", "near-dahab"];
  var TYPES = ["studio", "apartment", "villa", "room"];
  // Position approximative du centre de chaque quartier [latitude, longitude] (carte et import Airbnb).
  // Pour déplacer une épingle : changer ses deux nombres ici.
  // other-dahab et near-dahab n'ont pas d'épingle.
  var AREA_POINTS = {
    "canyon": [28.5530, 34.5262],
    "blue-hole-road": [28.5300, 34.5290],
    "eel-garden": [28.5082, 34.5192],
    "assala": [28.5055, 34.5135],
    "zarnouk": [28.5010, 34.5070],
    "tanmeia": [28.4935, 34.5075],
    "lighthouse": [28.5000, 34.5196],
    "masbat": [28.4953, 34.5170],
    "mashraba": [28.4895, 34.5125],
    "mubarak": [28.4895, 34.5025],
    "dahab-city": [28.4840, 34.5050],
    "lagoon": [28.4720, 34.5000],
    "south-coast": [28.4310, 34.4610]
  };
  var DAHAB_CENTER = [28.4980, 34.5140];

  // Distance en km entre deux points [lat, lng].
  function distanceKm(a, b) {
    var r = Math.PI / 180;
    var dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 12742 * Math.asin(Math.sqrt(h));
  }

  // Quartier le plus proche d'un point (import Airbnb). Loin de tout quartier : « Autre quartier de Dahab »
  // ou « Près de Dahab » ; trop loin (plus de 40 km) : rien.
  function areaFromPoint(lat, lng) {
    if (lat == null || lng == null) return "";
    var p = [Number(lat), Number(lng)], best = "", bestKm = Infinity;
    Object.keys(AREA_POINTS).forEach(function (a) {
      var d = distanceKm(p, AREA_POINTS[a]);
      if (d < bestKm) { bestKm = d; best = a; }
    });
    if (bestKm <= 1.2) return best;
    var fromCenter = distanceKm(p, DAHAB_CENTER);
    if (fromCenter <= 6) return "other-dahab";
    if (fromCenter <= 40) return "near-dahab";
    return "";
  }

  // Annonce dont l'hôte a choisi d'afficher la localisation approximative.
  // Lien d'une annonce : /stay/<adresse lisible> (l'id seulement si l'adresse n'est pas encore connue).
  function stayPath(l) {
    return "stay/" + encodeURIComponent(SLUGS[l.id] || l.id);
  }

  function hasPoint(l) {
    return Boolean(l && l.showLocation && l.lat != null && l.lng != null);
  }
  // Équipements rangés par catégorie (formulaire et page annonce). Titres : clés amenityGroup.*
  var AMENITY_GROUPS = [
    { id: "essentials", items: ["wifi", "workspace", "ac", "fan", "heating", "hotWater", "backupPower", "tv", "bedLinens", "essentials", "safe", "firstAid"] },
    { id: "kitchen", items: ["kitchen", "fridge", "microwave", "coffeeMaker", "kettle", "cookingBasics", "dishes"] },
    { id: "bath", items: ["bathtub", "hairDryer", "washer", "iron"] },
    { id: "outdoor", items: ["beachfront", "seaView", "beachAccess", "terrace", "rooftop", "garden", "pool", "heatedPool", "hammock", "bbq", "outdoorShower", "outdoorDining"] },
    { id: "building", items: ["parking", "elevator", "gearStorage", "selfCheckin", "luggage", "cleaning", "longStays", "pets"] }
  ];
  // Filtres « je cherche » de la page logements : clé d'URL → test sur l'annonce.
  function hasAny(l, list) { return list.some(function (a) { return (l.amenities || []).indexOf(a) !== -1; }); }
  var FEATURE_FILTERS = [
    { key: "beach", test: function (l) { return hasAny(l, ["beachfront", "beachAccess"]); } },
    { key: "seaview", test: function (l) { return hasAny(l, ["seaView"]); } },
    { key: "rooftop", test: function (l) { return hasAny(l, ["rooftop"]); } },
    { key: "garden", test: function (l) { return hasAny(l, ["garden"]); } },
    { key: "workspace", test: function (l) { return hasAny(l, ["workspace"]) || l.wifiMbps >= 50; } },
    { key: "pets", test: function (l) { return hasAny(l, ["pets"]); } }
  ];
  var AMENITIES = AMENITY_GROUPS.reduce(function (all, g) { return all.concat(g.items); }, []);
  var AD_PRICES = { home: 1500, search: 800, event: 300 };

  // Dernière recherche (filtres) de l'onglet, pour y revenir depuis une annonce ou le menu.
  function searchUrl() {
    var qs = "";
    try { qs = window.sessionStorage.getItem("yd-search") || ""; } catch (e) {}
    return "listings.html" + (qs ? "?" + qs : "");
  }

  // ---------- Langue ----------

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* stockage indisponible */ }
  }

  function detectLang() {
    var saved = storageGet("yd-lang");
    if (LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || "en").slice(0, 2);
    return LANGS.indexOf(nav) !== -1 ? nav : "en";
  }

  var lang = detectLang();
  // Appliqué tout de suite (avant l'affichage) pour éviter un "saut" de mise en page.
  document.documentElement.lang = lang;
  if (RTL_LANGS.indexOf(lang) !== -1) {
    document.documentElement.dir = "rtl";
    var arFont = document.createElement("link");
    arFont.rel = "stylesheet";
    arFont.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(arFont);
  }
  // Chiffres occidentaux (123) même en arabe : c'est ce que les Égyptiens utilisent pour les prix et les numéros.
  var LOCALES = { en: "en-GB", fr: "fr-FR", ar: "ar-EG-u-nu-latn" };

  function t(key, vars) {
    var str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { str = str.split("{" + k + "}").join(vars[k]); });
    }
    return str;
  }
  function loc(obj) { return obj ? (obj[lang] || obj.en || obj.fr || "") : ""; }
  // Texte écrit par un hôte (souvent en anglais) : isolé pour qu'il s'affiche bien dans une page en arabe.
  function locHtml(obj) { return "<bdi>" + esc(loc(obj)) + "</bdi>"; }
  // Titre et description d'une annonce : toujours en anglais (le français n'est plus proposé).
  function listingText(obj) { return obj ? (obj.en || obj.fr || "") : ""; }
  function listingTextHtml(obj) { return "<bdi>" + esc(listingText(obj)) + "</bdi>"; }
  function bidi(s) { return "<bdi>" + esc(s) + "</bdi>"; }

  function applyStaticTexts() {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.indexOf(lang) !== -1 ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  // ---------- Petits outils ----------

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n, currency) {
    var amount = Number(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
    if (lang === "ar") return currency === "USD" ? amount + " دولار" : amount + " جنيه";
    return currency === "USD" ? (lang === "fr" ? amount + " $" : "$" + amount) : amount + " EGP";
  }
  function inEgp(n, currency) { return n && currency === "USD" ? n * CONFIG.usdToEgp : n; }
  function waLink(number, text) { return "https://wa.me/" + number + "?text=" + encodeURIComponent(text); }
  function photo(hue, label, src) {
    return '<div class="photo" style="--h:' + hue + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
      "<span>" + esc(label || "") + "</span></div>";
  }
  function photoOf(l, i) { return l.photos && l.photos[i]; }
  // Prix selon le nombre de personnes (facultatif) : { "3": 2750, "4": 3000, … }.
  // Une case vide = le prix par nuit normal. Renvoie des groupes [{ from, to, price }]
  // (ex. 1–2 pers. 2500), ou null si le prix ne change pas avec le nombre de personnes.
  function guestPrices(l) {
    var table = l.pricesByGuests;
    if (!table || typeof table !== "object") return null;
    var max = Math.max(l.guests || 1, 1);
    var groups = [];
    for (var n = 1; n <= max; n++) {
      var p = Number(table[n]) > 0 ? Number(table[n]) : l.pricePerNight;
      if (!p) continue;
      var last = groups[groups.length - 1];
      if (last && last.price === p && last.to === n - 1) last.to = n;
      else groups.push({ from: n, to: n, price: p });
    }
    return groups.some(function (g) { return g.price !== groups[0].price; }) ? groups : null;
  }
  // Le plus petit prix par nuit : c'est lui qui sert aux cartes, au filtre et au tri.
  function nightFrom(l) {
    var groups = guestPrices(l);
    if (!groups) return l.pricePerNight;
    return Math.min.apply(null, groups.map(function (g) { return g.price; }));
  }
  function guestsLabel(g) {
    if (g.from === g.to) return t(g.from === 1 ? "price.oneGuest" : "price.nGuests", { n: g.from });
    return t("price.rangeGuests", { from: g.from, to: g.to });
  }
  function guestPricesHtml(l) {
    var groups = guestPrices(l);
    if (!groups) return "";
    return '<div class="guest-prices"><strong>' + esc(t("price.byGuests")) + "</strong><ul>" + groups.map(function (g) {
      return "<li><span>" + esc(guestsLabel(g)) + "</span><span>" + money(g.price, l.currency) + "</span></li>";
    }).join("") + "</ul></div>";
  }
  function priceHtml(l) {
    var night = nightFrom(l);
    if (!night) return "<strong>" + esc(t("card.onRequest")) + "</strong>";
    return (guestPrices(l) ? esc(t("price.from")) + " " : "") +
      "<strong>" + money(night, l.currency) + "</strong> / " + esc(t("card.night")) +
      (l.pricePerWeek ? ' <span class="muted">· ' + money(l.pricePerWeek, l.currency) + " / " + esc(t("card.week")) + "</span>" : "") +
      (l.pricePerMonth ? ' <span class="muted">· ' + money(l.pricePerMonth, l.currency) + " / " + esc(t("card.month")) + "</span>" : "");
  }
  function formatDate(iso, opts) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(LOCALES[lang] || "en-GB", opts || { weekday: "short", day: "numeric", month: "short" });
  }
  function optionList(values, prefix, anyLabel) {
    return '<option value="">' + esc(anyLabel) + "</option>" + values.map(function (v) {
      return '<option value="' + v + '">' + esc(t(prefix + v)) + "</option>";
    }).join("");
  }

  // ---------- En-tête et pied de page ----------

  // ---------- Thème clair / sombre ----------
  // Sans choix enregistré, le site suit le réglage du téléphone ; le bouton force l'autre thème.

  var ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function currentTheme() {
    var forced = document.documentElement.getAttribute("data-theme");
    if (forced) return forced;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function setupThemeToggle(button) {
    function paint() {
      var dark = currentTheme() === "dark";
      button.innerHTML = dark ? ICON_SUN : ICON_MOON;
      var label = t(dark ? "theme.toLight" : "theme.toDark");
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    button.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      storageSet("yd-theme", next);
      paint();
    });
    paint();
  }

  // ---------- Connexion ----------

  // Compte connecté et son profil, ou null. Chargé une seule fois par page.
  var sessionPromise = null;
  function session() {
    if (!sessionPromise) {
      sessionPromise = !DB.enabled ? Promise.resolve(null) : DB.currentUser().then(function (user) {
        if (!user) return null;
        return DB.profile(user.id).then(function (p) { return { user: user, profile: p || {} }; });
      }).catch(function (err) { console.error(err); return null; });
    }
    return sessionPromise;
  }

  // Point vert sur « Mon espace » quand on est connecté ; pour l'admin, le nombre d'annonces à valider.
  function showSession(header) {
    session().then(function (s) {
      var link = header.querySelector('[data-nav="account"]');
      if (!s || !link) return;
      header.classList.add("signed-in");
      link.title = t("nav.online", { email: s.user.email });
      link.insertAdjacentHTML("afterbegin", '<span class="online-dot" aria-hidden="true"></span>');
      if (!s.profile.is_admin) return;
      DB.pendingCount().then(function (n) {
        if (!n) return;
        link.insertAdjacentHTML("beforeend", ' <span class="nav-count" title="' + esc(t("admin.tabPending")) + '">' + n + "</span>");
      }, function (err) { console.error(err); });
    });
  }

  function renderChrome() {
    var page = document.body.dataset.page;
    var links = [
      ["listings", searchUrl(), "nav.listings"],
      ["events", "events.html", "nav.events"],
      ["advertise", "advertise.html", "nav.advertise"]
    ];
    if (DB.enabled) links.push(["account", "account.html", "nav.account"]);
    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<div class="container header-inner">' +
          '<a class="logo" href="index.html"><svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#5e7d62"/><circle cx="26" cy="15" r="6" fill="#ff8a66"/><path d="M6 25q4.5-4 9 0t9 0 10 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M6 31q4.5-4 9 0t9 0 10 0" fill="none" stroke="#c3d9bd" stroke-width="2.6" stroke-linecap="round"/></svg><span>Yalla <b>Dahab</b></span></a>' +
          '<nav class="main-nav">' +
            links.map(function (l) {
              return '<a href="' + l[1] + '" data-nav="' + l[0] + '"' + (page === l[0] ? ' aria-current="page"' : "") + ">" + esc(t(l[2])) + "</a>";
            }).join("") +
            '<a class="btn btn-small" href="host.html"' + (page === "host" ? ' aria-current="page"' : "") + ">" + esc(t("nav.host")) + "</a>" +
            '<select class="lang-select" aria-label="' + esc(t("lang.label")) + '">' +
              LANGS.map(function (l) { return '<option value="' + l + '"' + (l === lang ? " selected" : "") + ">" + LANG_NAMES[l] + "</option>"; }).join("") +
            "</select>" +
          "</nav>" +
          '<div class="header-tools">' +
            '<button class="theme-toggle" type="button"></button>' +
            '<button class="menu-toggle" aria-label="Menu" aria-expanded="false">☰</button>' +
          "</div>" +
        "</div>";
      header.querySelector(".lang-select").addEventListener("change", function (e) {
        storageSet("yd-lang", e.target.value);
        window.location.reload();
      });
      setupThemeToggle(header.querySelector(".theme-toggle"));
      var toggle = header.querySelector(".menu-toggle");
      toggle.addEventListener("click", function () {
        var open = header.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    if (header && DB.enabled) showSession(header);
    var footer = document.getElementById("site-footer");
    if (footer) {
      footer.innerHTML =
        '<div class="container footer-inner">' +
          "<div><strong>Yalla Dahab</strong><p>" + esc(t("footer.tagline")) + "</p></div>" +
          '<nav><a href="listings.html">' + esc(t("nav.listings")) + '</a><a href="events.html">' + esc(t("nav.events")) +
          '</a><a href="host.html">' + esc(t("nav.host")) + '</a><a href="advertise.html">' + esc(t("nav.advertise")) + "</a></nav>" +
          '<p class="demo-note">' + esc(t("footer.demo")) + "</p>" +
        "</div>";
    }
  }

  // ---------- Statistiques de visites (supabase/stats.sql) ----------
  // Anonyme : pas de cookie, le navigateur garde seulement la date du jour (« yd-seen »)
  // pour savoir si c'est la première page de la journée. Rien n'est compté pour l'admin
  // (marqueur « yd-no-stats » posé quand elle ouvre son espace) ni pour les robots.

  function statsOff() { return storageGet("yd-no-stats") === "1" || navigator.webdriver === true; }

  // Site d'où vient le visiteur : « facebook.com », « google.com »… vide s'il vient du site lui-même.
  function referrerSource() {
    try {
      var host = new URL(document.referrer).hostname.toLowerCase().replace(/^(www|m|l|lm|mobile)\./, "");
      return host === window.location.hostname.replace(/^www\./, "") ? "" : host.slice(0, 100);
    } catch (e) { return ""; }
  }

  function track(rows) { if (!statsOff()) DB.track(rows); }

  function trackView(page, listingId) {
    if (statsOff()) return;
    var d = new Date();
    var today = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    var first = storageGet("yd-seen") !== today;
    if (first) storageSet("yd-seen", today);
    track([{ kind: "view", page: page, listing_id: listingId || null, first_today: first, source: first ? referrerSource() : null }]);
  }

  // ---------- Bannières ----------

  function renderBanners(slot) {
    var el = document.querySelector('[data-banner-slot="' + slot + '"]');
    if (!el) return;
    var ads = ADS.filter(function (a) { return a.active && a.slot === slot; }).slice(0, CONFIG.maxBannersPerPage);
    var html = ads.map(function (a) {
      var external = /^https?:/.test(a.link);
      return '<a class="banner" data-ad="' + esc(a.id) + '" style="--h:' + a.hue + '" href="' + esc(a.link) + '"' +
        (external ? ' target="_blank" rel="noopener sponsored"' : "") + ">" +
        '<span class="banner-label">' + esc(t("ad.label")) + "</span>" +
        '<span class="banner-body"><strong>' + locHtml(a.title) + "</strong><span>" + locHtml(a.text) + "</span></span>" +
        '<span class="banner-cta">' + locHtml(a.cta) + ' <span class="arrow">→</span></span></a>';
    }).join("");
    if (ads.length < CONFIG.maxBannersPerPage) {
      html += '<a class="banner banner-empty" href="advertise.html">' +
        '<span class="banner-body"><strong>' + esc(t("ad.yours")) + "</strong><span>" + esc(t("ad.yoursText")) + "</span></span>" +
        '<span class="banner-cta">' + esc(t("ad.yoursCta")) + ' <span class="arrow">→</span></span></a>';
    }
    el.innerHTML = html;
    // Affichages et clics de chaque bannière : les chiffres à montrer aux annonceurs.
    if (ads.length) track(ads.map(function (a) { return { kind: "ad_view", ad_id: a.id, page: document.body.dataset.page }; }));
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ad]");
      if (b) track([{ kind: "ad_click", ad_id: b.dataset.ad, page: document.body.dataset.page }]);
    });
  }

  // ---------- Cartes ----------

  // « · 3 lits » (rien si l'hôte n'a pas encore indiqué le nombre de lits).
  function bedsText(l) {
    return l.beds > 0 ? " · " + l.beds + " " + esc(t(l.beds === 1 ? "card.bed" : "card.beds")) : "";
  }

  // Photos de la carte : on peut les faire défiler sans ouvrir l'annonce
  // (glisser du doigt sur téléphone, flèches au survol sur ordinateur, points en bas).
  // Au plus 10 photos pour garder la page légère ; la 1re garde l'étiquette du type.
  var CARD_MAX_PHOTOS = 10;
  function cardPhotos(l) {
    var photos = (l.photos || []).filter(Boolean).slice(0, CARD_MAX_PHOTOS);
    if (photos.length < 2) return photo(l.hue, t("type." + l.type), photos[0]);
    var slides = "", dots = "";
    photos.forEach(function (src, i) {
      slides += i === 0 ? photo(l.hue, t("type." + l.type), src) : photo(l.hue, "", src);
      dots += '<i' + (i === 0 ? ' class="on"' : "") + "></i>";
    });
    return '<div class="card-photos" data-at-start="true">' +
      '<div class="card-track">' + slides + "</div>" +
      '<button type="button" class="card-nav card-prev" data-card-step="-1" tabindex="-1" aria-label="' + esc(t("lightbox.prev")) + '">' + CHEVRON + "</button>" +
      '<button type="button" class="card-nav card-next" data-card-step="1" tabindex="-1" aria-label="' + esc(t("lightbox.next")) + '">' + CHEVRON + "</button>" +
      '<span class="card-dots" aria-hidden="true">' + dots + "</span></div>";
  }
  // Met à jour les points et les flèches selon la photo affichée.
  function updateCardPhotos(box) {
    var track = box.querySelector(".card-track");
    var w = track.clientWidth || 1;
    var pos = Math.abs(track.scrollLeft); // en arabe (RTL) scrollLeft est négatif
    var max = track.scrollWidth - w;
    var i = Math.round(pos / w);
    box.dataset.atStart = String(pos <= 2);
    box.dataset.atEnd = String(pos >= max - 2);
    Array.prototype.forEach.call(box.querySelectorAll(".card-dots i"), function (d, k) { d.className = k === i ? "on" : ""; });
  }
  // Les flèches sont dans le lien de la carte : on empêche d'ouvrir l'annonce.
  document.addEventListener("click", function (e) {
    var nav = e.target.closest && e.target.closest("[data-card-step]");
    if (!nav) return;
    e.preventDefault(); e.stopPropagation();
    var track = nav.parentNode.querySelector(".card-track");
    var rtl = getComputedStyle(track).direction === "rtl";
    var step = Number(nav.dataset.cardStep) * track.clientWidth;
    track.scrollBy({ left: rtl ? -step : step, behavior: "smooth" });
  }, true);
  document.addEventListener("scroll", function (e) {
    if (e.target.classList && e.target.classList.contains("card-track")) updateCardPhotos(e.target.parentNode);
  }, true);

  // Partage d'une annonce : WhatsApp, Facebook, Telegram, e-mail, copier le lien,
  // et sur téléphone le menu de partage du téléphone (navigator.share).
  // Le lien est toujours l'adresse lisible /stay/<adresse> : sa page a la photo de l'annonce en aperçu.
  var ICONS = {
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21.5v-8h2.7l.4-3.2h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5v3.2h2.7v8h3.3Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.4 4.3 2.9 11.5c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.9-1.4-1.5ZM9 14.2l8.6-5.4c.4-.3.8-.1.5.2l-7.1 6.4-.3 3.1L9 14.2Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Zm-1 1 9 7 9-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.7 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>'
  };
  function canNativeShare() { return typeof navigator.share === "function"; }
  function shareInfo(l) {
    var title = listingText(l.title);
    return { title: title, url: "https://yalladahab.com/" + stayPath(l), text: t("share.text", { title: title }) };
  }
  // Rangée de boutons ronds (fiche logement et fenêtre de partage).
  function shareButtons(l) {
    var s = shareInfo(l);
    function link(kind, href, label) {
      return '<a class="share-btn share-' + kind + '" href="' + esc(href) + '" target="_blank" rel="noopener" data-share="' + kind + '">' +
        '<span class="share-icon">' + ICONS[kind] + "</span><span>" + esc(label) + "</span></a>";
    }
    function button(kind, label) {
      return '<button type="button" class="share-btn share-' + kind + '" data-share="' + kind + '" data-share-id="' + esc(l.id) + '">' +
        '<span class="share-icon">' + ICONS[kind] + "</span><span>" + esc(label) + "</span></button>";
    }
    return '<div class="share-buttons">' +
      link("whatsapp", waLink("", s.text + "\n" + s.url), "WhatsApp") +
      link("facebook", "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(s.url), "Facebook") +
      link("telegram", "https://t.me/share/url?url=" + encodeURIComponent(s.url) + "&text=" + encodeURIComponent(s.text), t("share.telegram")) +
      link("email", "mailto:?subject=" + encodeURIComponent(s.title + " · Yalla Dahab") + "&body=" + encodeURIComponent(s.text + "\n" + s.url), t("share.email")) +
      button("link", t("share.copy")) +
      (canNativeShare() ? button("more", t("share.more")) : "") +
      "</div>";
  }
  function showToast(text) {
    var el = document.getElementById("yd-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "yd-toast"; el.className = "toast"; el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("on");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      return ok ? Promise.resolve() : Promise.reject();
    }
    return navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text).catch(fallback) : fallback();
  }
  function copyLink(l) {
    var url = shareInfo(l).url;
    copyText(url).then(function () { showToast(t("listing.copied")); }, function () { window.prompt("", url); });
  }
  function nativeShare(l) {
    var s = shareInfo(l);
    return navigator.share({ title: s.title + " · Yalla Dahab", text: s.text, url: s.url });
  }
  // Fenêtre de partage (ordinateur, ou bouton « Partager » d'une carte sans menu du téléphone).
  function openShareSheet(l, opener) {
    closeShareSheet();
    var box = document.createElement("div");
    box.className = "share-sheet";
    box.innerHTML = '<div class="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">' +
      '<button type="button" class="share-close" aria-label="' + esc(t("lightbox.close")) + '">×</button>' +
      '<h2 id="share-sheet-title">' + esc(t("share.title")) + "</h2>" +
      '<p class="muted">' + bidi(listingText(l.title)) + "</p>" +
      shareButtons(l) + "</div>";
    box._opener = opener;
    document.body.appendChild(box);
    document.body.classList.add("sheet-open");
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".share-close")) closeShareSheet();
    });
    requestAnimationFrame(function () { box.classList.add("on"); box.querySelector(".share-btn").focus(); });
  }
  function closeShareSheet() {
    var box = document.querySelector(".share-sheet");
    if (!box) return;
    box.remove();
    document.body.classList.remove("sheet-open");
    if (box._opener && box._opener.focus) box._opener.focus();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeShareSheet(); });
  function listingById(id) { return LISTINGS.filter(function (x) { return x.id === id; })[0]; }
  // « Partager » (carte ou haut de la fiche) : menu du téléphone s'il existe, sinon la fenêtre.
  function startShare(l, opener) {
    if (canNativeShare()) nativeShare(l).catch(function (err) { if (err && err.name !== "AbortError") openShareSheet(l, opener); });
    else openShareSheet(l, opener);
  }
  // Les boutons de partage des cartes sont dans le lien de la carte : on empêche d'ouvrir l'annonce.
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-share-id]");
    if (!btn) return;
    var l = listingById(btn.dataset.shareId);
    if (!l) return;
    e.preventDefault(); e.stopPropagation();
    var kind = btn.dataset.share;
    if (kind === "link") copyLink(l);
    else if (kind === "more") nativeShare(l).catch(function () {});
    else startShare(l, btn);
  }, true);
  // Après un clic sur WhatsApp, Facebook… la fenêtre se ferme.
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".share-sheet a.share-btn")) setTimeout(closeShareSheet, 0);
  });
  function shareIconButton(l, extraClass) {
    return '<button type="button" class="share-fab ' + (extraClass || "") + '" data-share="open" data-share-id="' + esc(l.id) + '" aria-label="' + esc(t("share.cardLabel", { title: listingText(l.title) })) + '" title="' + esc(t("share.button")) + '">' + ICONS.share + "</button>";
  }

  function listingCard(l) {
    return '<a class="card listing-card" href="' + stayPath(l) + '" target="_blank" rel="noopener">' +
      cardPhotos(l) +
      shareIconButton(l) +
      (l.verified ? '<span class="badge badge-verified">✓ ' + esc(t("card.verified")) + "</span>" : "") +
      '<div class="card-body">' +
        '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + l.guests + " " + esc(t("card.guests")) + bedsText(l) +
          (l.wifiMbps ? " · " + l.wifiMbps + " " + esc(t("card.mbps")) : "") + "</p>" +
        "<h3>" + listingTextHtml(l.title) + "</h3>" +
        '<p class="price">' + priceHtml(l) + "</p>" +
      "</div></a>";
  }

  function eventCard(e) {
    var d = new Date(e.date + "T12:00:00");
    return '<article class="card event-card' + (e.featured ? " is-featured" : "") + '" id="' + esc(e.id) + '">' +
      '<div class="event-date" style="--h:' + e.hue + '"><span>' + d.getDate() + "</span><small>" +
        esc(formatDate(e.date, { month: "short" })) + "</small></div>" +
      '<div class="card-body">' +
        (e.featured ? '<span class="badge badge-featured">★ ' + esc(t("events.featured")) + "</span> " : "") +
        '<span class="badge">' + esc(t("cat." + e.category)) + "</span>" +
        "<h3>" + locHtml(e.title) + "</h3>" +
        '<p class="card-meta">' + esc(formatDate(e.date, { weekday: "long" })) + " · " + esc(e.time) + " · " + bidi(e.place) + "</p>" +
        "<p>" + locHtml(e.description) + "</p>" +
        '<p class="price"><strong>' + bidi(e.price) + "</strong></p>" +
      "</div></article>";
  }

  function upcomingEvents() {
    var today = new Date().toISOString().slice(0, 10);
    return EVENTS.filter(function (e) { return e.date >= today; }).sort(function (a, b) {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  // ---------- Pages ----------

  function fillSearchSelects(form) {
    form.querySelector('[name="area"]').innerHTML = optionList(AREAS, "area.", t("search.anyArea"));
    form.querySelector('[name="type"]').innerHTML = optionList(TYPES, "type.", t("search.anyType"));
  }

  // ---------- Carrousel « Notre sélection » (page d'accueil) ----------
  // 12 logements : d'abord ceux marqués « À la une », complétés par d'autres
  // logements avec photo. L'ordre est mélangé au hasard, mais reste le même
  // toute la journée (heure du Caire) et change chaque jour.
  var HOME_PICKS = 12;
  function cairoDay() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function seededRandom(seedText) {
    var h = 2166136261;
    for (var i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { // mulberry32
      h = (h + 0x6D2B79F5) | 0;
      var r = Math.imul(h ^ (h >>> 15), 1 | h);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dailyShuffle(list, rand) {
    var a = list.slice().sort(function (x, y) { return String(x.id) < String(y.id) ? -1 : 1; });
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
    return a;
  }
  function homePicks() {
    var rand = seededRandom("yalladahab-" + cairoDay());
    var hasPhoto = function (l) { return (l.photos || []).filter(Boolean).length > 0; };
    var picks = dailyShuffle(LISTINGS.filter(function (l) { return l.featured; }), rand).slice(0, HOME_PICKS);
    var others = dailyShuffle(LISTINGS.filter(function (l) { return !l.featured && hasPhoto(l); }), rand);
    picks = picks.concat(others.slice(0, Math.max(0, HOME_PICKS - picks.length)));
    return dailyShuffle(picks, rand);
  }
  // Flèches sur ordinateur, glisser du doigt sur téléphone, sens inversé en arabe.
  function initHomeCarousel(row) {
    var box = row.closest(".carousel");
    if (!box) return;
    function update() {
      var pos = Math.abs(row.scrollLeft), max = row.scrollWidth - row.clientWidth;
      box.dataset.atStart = String(pos <= 2);
      box.dataset.atEnd = String(pos >= max - 2);
    }
    box.querySelectorAll("[data-row-step]").forEach(function (btn) {
      btn.innerHTML = CHEVRON;
      btn.addEventListener("click", function () {
        var card = row.querySelector(".card");
        var step = card ? card.getBoundingClientRect().width + 20 : row.clientWidth * 0.8;
        var n = Math.max(1, Math.floor(row.clientWidth / step));
        var d = Number(btn.dataset.rowStep) * step * n;
        row.scrollBy({ left: getComputedStyle(row).direction === "rtl" ? -d : d, behavior: "smooth" });
      });
    });
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initHome() {
    var form = document.getElementById("hero-search");
    fillSearchSelects(form);
    var featured = homePicks();
    var quick = document.getElementById("quick-filters");
    if (quick) {
      quick.innerHTML = [["beach=1", "filter.beach"], ["seaview=1", "filter.seaview"], ["rooftop=1", "filter.rooftop"], ["garden=1", "filter.garden"], ["stay=monthly", "filter.monthly"], ["pets=1", "filter.pets"]]
        .map(function (q) { return '<a href="listings.html?' + q[0] + '">' + esc(t(q[1])) + "</a>"; }).join("");
    }
    var row = document.getElementById("featured-listings");
    row.innerHTML = featured.map(listingCard).join("");
    initHomeCarousel(row);
    document.getElementById("home-events").innerHTML = upcomingEvents().slice(0, 3).map(eventCard).join("");
    renderBanners("home");
  }

  function initListings() {
    var form = document.getElementById("filters");
    fillSearchSelects(form);
    var params = new URLSearchParams(window.location.search);
    ["area", "type", "stay", "max"].forEach(function (k) {
      if (params.get(k)) form.elements[k].value = params.get(k);
    });
    document.getElementById("feature-filters").innerHTML = FEATURE_FILTERS.map(function (f) {
      return '<label class="chip"><input type="checkbox" name="' + f.key + '"' + (params.get(f.key) === "1" ? " checked" : "") +
        "><span>" + esc(t("filter." + f.key)) + "</span></label>";
    }).join("");
    form.elements.verified.checked = params.get("verified") === "1";

    function update() {
      var area = form.elements.area.value;
      var type = form.elements.type.value;
      var monthly = form.elements.stay.value === "monthly";
      var weekly = form.elements.stay.value === "weekly";
      // À la semaine : le prix semaine de l'hôte, sinon 7 nuits.
      function stayPrice(l) {
        if (monthly) return l.pricePerMonth;
        if (weekly) return l.pricePerWeek || (nightFrom(l) ? nightFrom(l) * 7 : null);
        return nightFrom(l);
      }
      var max = Number(form.elements.max.value) || 0;
      var features = FEATURE_FILTERS.filter(function (f) { return form.elements[f.key].checked; });
      var verified = form.elements.verified.checked;
      // anyArea : même filtre sans le quartier (la carte compte les logements de chaque quartier).
      function matches(l, anyArea) {
        var price = inEgp(stayPrice(l), l.currency);
        var onRequest = !nightFrom(l);
        if (area && !anyArea && l.area !== area) return false;
        if (type && l.type !== type) return false;
        if (monthly && !l.pricePerMonth && !onRequest) return false;
        if (max && !onRequest && price > max) return false;
        if (!features.every(function (f) { return f.test(l); })) return false;
        if (verified && !l.verified) return false;
        return true;
      }
      var results = LISTINGS.filter(function (l) { return matches(l); });
      // Les logements les plus récents en premier (date d'ajout sur le site).
      results.sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
      document.getElementById("results-count").textContent = t("listings.count", { n: results.length });
      document.getElementById("results").innerHTML = results.length
        ? results.map(listingCard).join("")
        : '<p class="empty">' + esc(t("listings.empty")) + "</p>";
      var q = new URLSearchParams();
      if (area) q.set("area", area);
      if (type) q.set("type", type);
      if (monthly || weekly) q.set("stay", form.elements.stay.value);
      if (max) q.set("max", max);
      features.forEach(function (f) { q.set(f.key, "1"); });
      if (verified) q.set("verified", "1");
      var qs = q.toString();
      window.history.replaceState(null, "", qs ? "?" + qs : window.location.pathname);
      try { window.sessionStorage.setItem("yd-search", qs); } catch (e) {}
      // Carte des quartiers (assets/js/map.js).
      document.dispatchEvent(new CustomEvent("yd:results", { detail: { area: area, results: results, anyArea: LISTINGS.filter(function (l) { return matches(l, true); }) } }));
    }
    form.addEventListener("input", update);
    form.addEventListener("submit", function (e) { e.preventDefault(); update(); });
    form.addEventListener("reset", function () { setTimeout(update, 0); });
    update();
    renderBanners("search");
  }

  // Équipements de l'annonce, par catégorie (seulement les catégories remplies).
  function amenitiesHtml(list) {
    var html = AMENITY_GROUPS.map(function (g) {
      var items = g.items.filter(function (a) { return list.indexOf(a) !== -1; });
      if (!items.length) return "";
      return '<div class="amenity-group"><h3>' + esc(t("amenityGroup." + g.id)) + '</h3><ul class="amenities">' +
        items.map(function (a) { return "<li>" + esc(t("amenity." + a)) + "</li>"; }).join("") + "</ul></div>";
    }).join("");
    return html;
  }

  function initListing(known) {
    // stay/<adresse>.html (page de partage) donne l'id dans la page ; listing.html?id=… dans l'adresse.
    // L'id peut aussi être une adresse lisible (annonce publiée depuis peu, ou ancienne adresse après un changement de titre).
    var id = known || document.body.dataset.listingId || new URLSearchParams(window.location.search).get("id");
    var l = LISTINGS.filter(function (x) { return x.id === id || SLUGS[x.id] === id; })[0];
    var root = document.getElementById("listing");
    if (!l && id && !known && window.fetch) {
      // Ancienne adresse lisible : stay/slugs.json garde toutes les adresses déjà données.
      return fetch("stay/slugs.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; })
        .then(function (map) { return initListing((map && map[id]) || id); });
    }
    if (!l) {
      root.innerHTML = '<p class="empty">' + esc(t("listing.notFound")) + ' <a href="listings.html">' + esc(t("listing.back")) + "</a></p>";
      return;
    }
    var title = listingText(l.title);
    viewedListing = l.id;
    document.title = title + " · Yalla Dahab";
    // L'adresse affichée devient l'adresse lisible de la page de partage (aussi quand on arrive par un ancien
    // lien /stay/<id>) : copier-coller le lien donne la photo en aperçu.
    if (window.history.replaceState && window.location.pathname !== "/" + stayPath(l)) {
      try { window.history.replaceState(null, "", "/" + stayPath(l) + window.location.hash); } catch (e) {}
    }
    var photos = l.photos || [];
    // Une photo de la fiche devient cliquable (plein écran) seulement si elle existe vraiment.
    function zoomable(html, i) {
      return photos[i] ? html.replace('<div class="photo"', '<div class="photo zoomable" data-photo="' + i + '" tabindex="0" role="button" aria-label="' + esc(t("lightbox.open")) + '"') : html;
    }

    root.innerHTML =
      '<div class="listing-top">' +
        '<a class="back" href="' + esc(searchUrl()) + '"><span class="arrow">←</span> ' + esc(t("listing.back")) + "</a>" +
        '<button type="button" class="btn btn-ghost share-top" data-share="open" data-share-id="' + esc(l.id) + '">' + ICONS.share + " " + esc(t("share.button")) + "</button>" +
      "</div>" +
      '<div class="gallery">' + zoomable(photo(l.hue, t("type." + l.type), photoOf(l, 0)), 0) + zoomable(photo(l.hue + 25, "", photoOf(l, 1)), 1) + zoomable(photo(l.hue - 25, "", photoOf(l, 2)), 2) +
        (photos.length > 1 ? '<button type="button" class="gallery-all" data-photo="0"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor"/></svg> ' + esc(t("listing.allPhotos", { n: photos.length })) + "</button>" : "") +
      "</div>" +
      // Les petites photos défilent dans un carrousel. Sur ordinateur il commence à la 4e photo
      // (les 3 premières sont déjà en grand) ; sur téléphone, où seule la 1re est en grand, à la 2e.
      (photos.length > 1 ? photoStrip(photos, 1, "more-photos", 3) : "") +
      '<div class="listing-layout">' +
        "<div>" +
          '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + esc(t("type." + l.type)) + " · " + l.guests + " " + esc(t("card.guests")) +
            (l.bedrooms > 0 ? " · " + l.bedrooms + " " + esc(t(l.bedrooms === 1 ? "card.bedroom" : "card.bedrooms")) : "") + bedsText(l) + "</p>" +
          "<h1>" + bidi(title) + (l.verified ? ' <span class="badge badge-verified">✓ ' + esc(t("card.verified")) + "</span>" : "") + "</h1>" +
          '<p class="muted">' + esc(t("listing.host", { name: l.host.name })) + "</p>" +
          '<p class="lead">' + listingTextHtml(l.description) + "</p>" +
          (l.wifiMbps ? '<p class="wifi-pill">📶 ' + esc(t("listing.wifiTested", { n: l.wifiMbps })) + "</p>" : "") +
          "<h2>" + esc(t("listing.amenities")) + "</h2>" +
          amenitiesHtml(l.amenities) +
          // Carte : la localisation approximative si l'hôte l'a choisie, sinon le quartier.
          (hasPoint(l)
            ? '<p><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.lat + "," + l.lng) + '" target="_blank" rel="noopener">📍 ' + esc(t("listing.mapPoint")) + '</a><br><span class="small muted">' + esc(t("listing.mapPointNote")) + "</span></p>"
            : '<p><a href="https://maps.google.com/?q=' + encodeURIComponent((l.area === "near-dahab" || l.area === "other-dahab" ? "" : t("area." + l.area) + ", ") + "Dahab, Egypt") + '" target="_blank" rel="noopener">📍 ' + esc(t("listing.map")) + "</a></p>") +
        "</div>" +
        '<aside class="contact-box">' +
          '<p class="price">' + priceHtml(l) + "</p>" +
          guestPricesHtml(l) +
          '<div class="date-row">' +
            "<label>" + esc(t("listing.from")) + '<input type="date" id="date-from"></label>' +
            "<label>" + esc(t("listing.to")) + '<input type="date" id="date-to"></label>' +
          "</div>" +
          '<a class="btn btn-whatsapp btn-block" id="wa-contact" target="_blank" rel="noopener">' + esc(t("listing.contact")) + "</a>" +
          '<p class="small muted">' + esc(t("listing.contactNote")) + "</p>" +
          '<div class="share">' +
            "<strong>" + esc(t("listing.share")) + "</strong>" +
            shareButtons(l) +
          "</div>" +
        "</aside>" +
      "</div>";

    var from = document.getElementById("date-from");
    var to = document.getElementById("date-to");
    var wa = document.getElementById("wa-contact");
    function updateWa() {
      var dates = from.value && to.value
        ? t("listing.waDates", { from: formatDate(from.value, { day: "numeric", month: "long" }), to: formatDate(to.value, { day: "numeric", month: "long" }) })
        : "";
      wa.href = waLink(l.host.whatsapp, t("listing.waMessage", { host: l.host.name, title: title, dates: dates }));
    }
    from.addEventListener("change", function () { to.min = from.value; updateWa(); });
    to.addEventListener("change", updateWa);
    wa.addEventListener("click", function () { track([{ kind: "whatsapp", page: "listing", listing_id: l.id }]); });
    var today = new Date().toISOString().slice(0, 10);
    from.min = today; to.min = today;
    updateWa();

    if (photos.length) {
      root.addEventListener("click", function (e) {
        var el = e.target.closest("[data-photo]");
        if (el) openLightbox(photos, Number(el.dataset.photo), el);
      });
      root.addEventListener("keydown", function (e) {
        var el = e.target.closest && e.target.closest("[data-photo]");
        if (el && el.tagName !== "BUTTON" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openLightbox(photos, Number(el.dataset.photo), el); }
      });
    }

    refreshStrips(root);
  }

  // Carrousel de petites photos : une rangée qui défile (doigt, molette, flèches),
  // et chaque photo s'ouvre en plein écran. `desktopFrom` : sur ordinateur, les photos
  // avant cet index sont masquées (déjà affichées en grand au-dessus).
  var CHEVRON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function photoStrip(photos, from, extraClass, desktopFrom) {
    var items = "";
    for (var i = from || 0; i < photos.length; i++) {
      items += '<button type="button" class="strip-item' + (desktopFrom && i < desktopFrom ? " strip-mobile-only" : "") + '" data-photo="' + i + '" aria-label="' + esc(t("lightbox.open")) + " (" + esc(t("lightbox.count", { n: i + 1, total: photos.length })) + ')">' +
        '<img src="' + esc(photos[i]) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>';
    }
    return '<div class="strip ' + (extraClass || "") + '" data-at-start="true">' +
      '<button type="button" class="strip-nav strip-prev" data-strip-step="-1" tabindex="-1" aria-label="' + esc(t("lightbox.prev")) + '">' + CHEVRON + "</button>" +
      '<div class="strip-track">' + items + "</div>" +
      '<button type="button" class="strip-nav strip-next" data-strip-step="1" tabindex="-1" aria-label="' + esc(t("lightbox.next")) + '">' + CHEVRON + "</button></div>";
  }
  // Montre ou cache les flèches selon qu'on est au début / à la fin de la rangée.
  function updateStrip(strip) {
    var track = strip.querySelector(".strip-track");
    if (!track) return;
    var max = track.scrollWidth - track.clientWidth;
    var pos = Math.abs(track.scrollLeft); // en arabe (RTL) scrollLeft est négatif
    strip.dataset.atStart = String(pos <= 2);
    strip.dataset.atEnd = String(pos >= max - 2);
  }
  function refreshStrips(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll(".strip"), updateStrip);
  }
  document.addEventListener("click", function (e) {
    var nav = e.target.closest && e.target.closest("[data-strip-step]");
    if (!nav) return;
    var track = nav.parentNode.querySelector(".strip-track");
    var rtl = getComputedStyle(track).direction === "rtl";
    var step = Number(nav.dataset.stripStep) * Math.max(track.clientWidth * 0.8, 120);
    track.scrollBy({ left: rtl ? -step : step, behavior: "smooth" });
  });
  // L'événement scroll ne remonte pas : on l'écoute en phase de capture.
  document.addEventListener("scroll", function (e) {
    if (e.target.classList && e.target.classList.contains("strip-track")) updateStrip(e.target.parentNode);
  }, true);
  window.addEventListener("resize", function () { refreshStrips(); });

  // Photos en plein écran : flèches, clavier (← → Échap), et glisser du doigt sur téléphone.
  // En arabe (de droite à gauche) le sens des flèches et du glissement est inversé.
  function openLightbox(photos, start, opener) {
    var i = start;
    var rtl = document.documentElement.dir === "rtl";
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", t("lightbox.title"));
    var many = photos.length > 1;
    box.innerHTML =
      '<button type="button" class="lb-close" aria-label="' + esc(t("lightbox.close")) + '"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      (many ? '<p class="lb-count" aria-live="polite"></p>' : "") +
      '<figure class="lb-stage"><img alt=""></figure>' +
      (many ? '<button type="button" class="lb-nav lb-prev" aria-label="' + esc(t("lightbox.prev")) + '"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
              '<button type="button" class="lb-nav lb-next" aria-label="' + esc(t("lightbox.next")) + '"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : "");
    var img = box.querySelector("img");
    var count = box.querySelector(".lb-count");
    function show() {
      img.src = photos[i];
      if (count) count.textContent = t("lightbox.count", { n: i + 1, total: photos.length });
      // Précharge la photo suivante pour un défilement fluide.
      if (many) new Image().src = photos[(i + 1) % photos.length];
    }
    function go(step) { i = (i + step + photos.length) % photos.length; show(); }
    function close() {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("lb-open");
      box.remove();
      if (opener && opener.focus) opener.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      else if (many && e.key === "ArrowRight") go(rtl ? -1 : 1);
      else if (many && e.key === "ArrowLeft") go(rtl ? 1 : -1);
      else if (e.key === "Tab") {
        var f = box.querySelectorAll("button");
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    box.querySelector(".lb-close").addEventListener("click", close);
    if (many) {
      box.querySelector(".lb-prev").addEventListener("click", function () { go(-1); });
      box.querySelector(".lb-next").addEventListener("click", function () { go(1); });
    }
    // Un clic sur le fond noir (pas sur la photo ni les boutons) ferme.
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lb-stage")) close(); });
    var x0 = null, y0 = 0;
    box.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (many) go((dx < 0) !== rtl ? 1 : -1); }
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.classList.add("lb-open");
    document.body.appendChild(box);
    show();
    box.querySelector(".lb-close").focus();
  }

  function initEvents() {
    var cats = [];
    EVENTS.forEach(function (e) { if (cats.indexOf(e.category) === -1) cats.push(e.category); });
    var tabs = document.getElementById("event-tabs");
    var current = "";
    function draw() {
      tabs.innerHTML = [""].concat(cats).map(function (c) {
        return '<button type="button" data-cat="' + c + '"' + (c === current ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" +
          esc(c ? t("cat." + c) : t("events.all")) + "</button>";
      }).join("");
      var list = upcomingEvents().filter(function (e) { return !current || e.category === current; });
      document.getElementById("events-list").innerHTML = list.length
        ? list.map(eventCard).join("")
        : '<p class="empty">' + esc(t("events.empty")) + "</p>";
    }
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      current = b.dataset.cat;
      draw();
    });
    draw();
    renderBanners("search");
    if (window.location.hash) {
      var target = document.querySelector(window.location.hash);
      if (target) { target.scrollIntoView(); target.classList.add("highlight"); }
    }
  }

  // Page « Publier mon logement » : le bouton change selon qu'on est connecté ou non.
  function initHost() {
    var box = document.getElementById("host-cta");
    if (!DB.enabled) {
      box.innerHTML = "<p>" + esc(t("host.noDb")) + '</p><a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' +
        esc(waLink(CONFIG.adminWhatsapp, "")) + '">' + esc(t("host.noDbButton")) + "</a>";
      return;
    }
    session().then(function (s) {
      if (!s) {
        box.innerHTML = "<div><h2>" + esc(t("host.account.title")) + "</h2><p>" + esc(t("host.account.text")) + "</p></div>" +
          '<a class="btn btn-coral" href="login.html">' + esc(t("host.account.button")) + "</a>";
        return;
      }
      box.innerHTML = '<div><h2><span class="online-dot" aria-hidden="true"></span>' +
          esc(t("host.loggedTitle", { name: s.profile.name || s.user.email })) + "</h2><p>" + esc(t("host.loggedText")) + "</p></div>" +
        '<div class="space-actions"><a class="btn btn-ghost" href="account.html">' + esc(t("host.myListings")) + "</a>" +
        '<a class="btn btn-coral" href="account.html?new=1">' + esc(t("host.addListing")) + "</a></div>";
    });
  }

  function initAdvertise() {
    document.querySelectorAll("[data-price]").forEach(function (el) { el.textContent = money(AD_PRICES[el.dataset.price]); });
    var form = document.getElementById("ad-form");
    var offerNames = { home: t("ads.homeBanner"), search: t("ads.searchBanner"), event: t("ads.featuredEvent") };
    form.elements.offer.innerHTML = Object.keys(AD_PRICES).map(function (k) {
      return '<option value="' + k + '">' + esc(offerNames[k]) + " · " + money(AD_PRICES[k]) + "</option>";
    }).join("");
    var params = new URLSearchParams(window.location.search);
    if (AD_PRICES[params.get("offer")]) form.elements.offer.value = params.get("offer");
    form.elements.start.min = new Date().toISOString().slice(0, 10);
    var totalEl = document.getElementById("ad-total");
    function total() { return AD_PRICES[form.elements.offer.value] * Math.max(1, Number(form.elements.weeks.value) || 1); }
    function updateTotal() { totalEl.textContent = money(total()); }
    form.addEventListener("input", updateTotal);
    updateTotal();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements;
      var lines = [
        t("ads.waIntro"), "",
        "• " + t("ads.business") + " : " + f.business.value,
        "• " + t("ads.offer") + " : " + offerNames[f.offer.value],
        "• " + t("ads.startDate") + " : " + (f.start.value ? formatDate(f.start.value, { day: "numeric", month: "long", year: "numeric" }) : "-"),
        "• " + t("ads.weeks") + " : " + f.weeks.value,
        "• " + t("ads.total") + " : " + money(total()),
        "", f.message.value
      ];
      window.open(waLink(CONFIG.adminWhatsapp, lines.join("\n")), "_blank", "noopener");
    });
  }

  var viewedListing = null; // annonce affichée par initListing (pour les statistiques)

  var PAGES = { home: initHome, listings: initListings, listing: initListing, events: initEvents, host: initHost, advertise: initAdvertise };
  // Pages qui n'affichent pas le catalogue public (espace hôtes, admin) : pas besoin de le charger.
  var PRIVATE_PAGES = { login: true, account: true, admin: true };

  window.YD = {
    t: t, loc: loc, locHtml: locHtml, listingText: listingText, listingTextHtml: listingTextHtml, esc: esc, money: money, lang: function () { return lang; },
    formatDate: formatDate, photoStrip: photoStrip, refreshStrips: refreshStrips, openLightbox: openLightbox, bedsText: bedsText, priceHtml: priceHtml, guestPricesHtml: guestPricesHtml, optionList: optionList, applyStaticTexts: applyStaticTexts,
    AREAS: AREAS, TYPES: TYPES, AMENITIES: AMENITIES, AMENITY_GROUPS: AMENITY_GROUPS,
    AREA_POINTS: AREA_POINTS, DAHAB_CENTER: DAHAB_CENTER, areaFromPoint: areaFromPoint, hasPoint: hasPoint, stayPath: stayPath,
    setNoStats: function (off) { storageSet("yd-no-stats", off ? "1" : "0"); },
    registerPage: function (name, init) { PAGES[name] = init; PRIVATE_PAGES[name] = true; }
  };

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.dataset.page;
    if (DB.enabled) document.body.classList.add("db-on");
    renderChrome();
    applyStaticTexts();
    var init = PAGES[page];
    if (!init) return;
    if (PRIVATE_PAGES[page]) { init(); return; }
    DB.load().then(function (data) {
      LISTINGS = data.listings;
      if (window.YD_SLUGS) SLUGS = window.YD_SLUGS(LISTINGS);
      EVENTS = data.events;
      ADS = data.ads;
    }, function (err) {
      console.error("Yalla Dahab: data could not be loaded", err);
    }).then(init).then(function () { trackView(page, viewedListing); });
  });
})();
