(function () {
  "use strict";

  var CONFIG = window.YD_CONFIG;
  var I18N = window.YD_I18N;
  var DB = window.YD_DB;
  // Remplis au chargement de la page, depuis la base ou depuis les fichiers.
  var LISTINGS = [];
  var EVENTS = [];
  var ADS = [];
  var LANGS = ["en", "fr"];
  var AREAS = ["lighthouse", "mashraba", "masbat", "assala", "eel-garden", "lagoon", "blue-hole-road"];
  var TYPES = ["studio", "apartment", "villa", "room"];
  var AMENITIES = ["wifi", "workspace", "seaView", "ac", "kitchen", "terrace", "garden", "washer",
    "rooftop", "pool", "parking", "gearStorage", "backupPower", "beachAccess", "hammock", "pets", "selfCheckin"];
  var AD_PRICES = { home: 1500, search: 800, event: 300 };

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

  function t(key, vars) {
    var str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { str = str.split("{" + k + "}").join(vars[k]); });
    }
    return str;
  }
  function loc(obj) { return obj ? (obj[lang] || obj.en || obj.fr || "") : ""; }

  function applyStaticTexts() {
    document.documentElement.lang = lang;
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
  function priceHtml(l) {
    if (!l.pricePerNight) return "<strong>" + esc(t("card.onRequest")) + "</strong>";
    return "<strong>" + money(l.pricePerNight, l.currency) + "</strong> / " + esc(t("card.night")) +
      (l.pricePerMonth ? ' <span class="muted">· ' + money(l.pricePerMonth, l.currency) + " / " + esc(t("card.month")) + "</span>" : "");
  }
  function formatDate(iso, opts) {
    var d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", opts || { weekday: "short", day: "numeric", month: "short" });
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
      ["listings", "listings.html", "nav.listings"],
      ["events", "events.html", "nav.events"],
      ["advertise", "advertise.html", "nav.advertise"]
    ];
    if (DB.enabled) links.push(["account", "account.html", "nav.account"]);
    var header = document.getElementById("site-header");
    if (header) {
      header.innerHTML =
        '<div class="container header-inner">' +
          '<a class="logo" href="index.html"><svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#0b6e78"/><circle cx="26" cy="15" r="6" fill="#ff8a66"/><path d="M6 25q4.5-4 9 0t9 0 10 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M6 31q4.5-4 9 0t9 0 10 0" fill="none" stroke="#7fd6dc" stroke-width="2.6" stroke-linecap="round"/></svg><span>Yalla <b>Dahab</b></span></a>' +
          '<nav class="main-nav">' +
            links.map(function (l) {
              return '<a href="' + l[1] + '" data-nav="' + l[0] + '"' + (page === l[0] ? ' aria-current="page"' : "") + ">" + esc(t(l[2])) + "</a>";
            }).join("") +
            '<a class="btn btn-small" href="host.html"' + (page === "host" ? ' aria-current="page"' : "") + ">" + esc(t("nav.host")) + "</a>" +
            '<select class="lang-select" aria-label="' + esc(t("lang.label")) + '">' +
              LANGS.map(function (l) { return '<option value="' + l + '"' + (l === lang ? " selected" : "") + ">" + l.toUpperCase() + "</option>"; }).join("") +
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

  // ---------- Bannières ----------

  function renderBanners(slot) {
    var el = document.querySelector('[data-banner-slot="' + slot + '"]');
    if (!el) return;
    var ads = ADS.filter(function (a) { return a.active && a.slot === slot; }).slice(0, CONFIG.maxBannersPerPage);
    var html = ads.map(function (a) {
      var external = /^https?:/.test(a.link);
      return '<a class="banner" style="--h:' + a.hue + '" href="' + esc(a.link) + '"' +
        (external ? ' target="_blank" rel="noopener sponsored"' : "") + ">" +
        '<span class="banner-label">' + esc(t("ad.label")) + "</span>" +
        '<span class="banner-body"><strong>' + esc(loc(a.title)) + "</strong><span>" + esc(loc(a.text)) + "</span></span>" +
        '<span class="banner-cta">' + esc(loc(a.cta)) + " →</span></a>";
    }).join("");
    if (ads.length < CONFIG.maxBannersPerPage) {
      html += '<a class="banner banner-empty" href="advertise.html">' +
        '<span class="banner-body"><strong>' + esc(t("ad.yours")) + "</strong><span>" + esc(t("ad.yoursText")) + "</span></span>" +
        '<span class="banner-cta">' + esc(t("ad.yoursCta")) + " →</span></a>";
    }
    el.innerHTML = html;
  }

  // ---------- Cartes ----------

  function listingCard(l) {
    return '<a class="card listing-card" href="listing.html?id=' + encodeURIComponent(l.id) + '">' +
      photo(l.hue, t("type." + l.type), photoOf(l, 0)) +
      (l.verified ? '<span class="badge badge-verified">✓ ' + esc(t("card.verified")) + "</span>" : "") +
      '<div class="card-body">' +
        '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + l.guests + " " + esc(t("card.guests")) +
          (l.wifiMbps ? " · " + l.wifiMbps + " " + esc(t("card.mbps")) : "") + "</p>" +
        "<h3>" + esc(loc(l.title)) + "</h3>" +
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
        "<h3>" + esc(loc(e.title)) + "</h3>" +
        '<p class="card-meta">' + esc(formatDate(e.date, { weekday: "long" })) + " · " + esc(e.time) + " · " + esc(e.place) + "</p>" +
        "<p>" + esc(loc(e.description)) + "</p>" +
        '<p class="price"><strong>' + esc(e.price) + "</strong></p>" +
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

  function initHome() {
    var form = document.getElementById("hero-search");
    fillSearchSelects(form);
    var featured = LISTINGS.filter(function (l) { return l.featured; }).slice(0, 3);
    document.getElementById("featured-listings").innerHTML = featured.map(listingCard).join("");
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
    form.elements.workspace.checked = params.get("workspace") === "1";
    form.elements.verified.checked = params.get("verified") === "1";

    function update() {
      var area = form.elements.area.value;
      var type = form.elements.type.value;
      var monthly = form.elements.stay.value === "monthly";
      var max = Number(form.elements.max.value) || 0;
      var workspace = form.elements.workspace.checked;
      var verified = form.elements.verified.checked;
      var results = LISTINGS.filter(function (l) {
        var price = inEgp(monthly ? l.pricePerMonth : l.pricePerNight, l.currency);
        var onRequest = !l.pricePerNight;
        if (area && l.area !== area) return false;
        if (type && l.type !== type) return false;
        if (monthly && !l.pricePerMonth && !onRequest) return false;
        if (max && !onRequest && price > max) return false;
        if (workspace && !(l.amenities.indexOf("workspace") !== -1 || l.wifiMbps >= 50)) return false;
        if (verified && !l.verified) return false;
        return true;
      });
      function sortPrice(l) { return inEgp(monthly ? l.pricePerMonth : l.pricePerNight, l.currency) || Infinity; }
      results.sort(function (a, b) { return sortPrice(a) - sortPrice(b); });
      document.getElementById("results-count").textContent = t("listings.count", { n: results.length });
      document.getElementById("results").innerHTML = results.length
        ? results.map(listingCard).join("")
        : '<p class="empty">' + esc(t("listings.empty")) + "</p>";
      var q = new URLSearchParams();
      if (area) q.set("area", area);
      if (type) q.set("type", type);
      if (monthly) q.set("stay", "monthly");
      if (max) q.set("max", max);
      if (workspace) q.set("workspace", "1");
      if (verified) q.set("verified", "1");
      var qs = q.toString();
      window.history.replaceState(null, "", qs ? "?" + qs : window.location.pathname);
    }
    form.addEventListener("input", update);
    form.addEventListener("submit", function (e) { e.preventDefault(); update(); });
    form.addEventListener("reset", function () { setTimeout(update, 0); });
    update();
    renderBanners("search");
  }

  function initListing() {
    // stay/<id>.html (page de partage) donne l'id dans la page ; listing.html?id=… dans l'adresse.
    var id = document.body.dataset.listingId || new URLSearchParams(window.location.search).get("id");
    var l = LISTINGS.filter(function (x) { return x.id === id; })[0];
    var root = document.getElementById("listing");
    if (!l) {
      root.innerHTML = '<p class="empty">' + esc(t("listing.notFound")) + ' <a href="listings.html">' + esc(t("listing.back")) + "</a></p>";
      return;
    }
    var title = loc(l.title);
    document.title = title + " · Yalla Dahab";
    // Lien partagé : la page stay/<id> a sa photo et son titre en aperçu sur WhatsApp et Facebook.
    var pageUrl = "https://yalladahab.com/stay/" + encodeURIComponent(l.id);

    root.innerHTML =
      '<a class="back" href="listings.html">← ' + esc(t("listing.back")) + "</a>" +
      galleryHtml(l) +
      '<div class="listing-layout">' +
        "<div>" +
          '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + esc(t("type." + l.type)) + " · " + l.guests + " " + esc(t("card.guests")) + "</p>" +
          "<h1>" + esc(title) + (l.verified ? ' <span class="badge badge-verified">✓ ' + esc(t("card.verified")) + "</span>" : "") + "</h1>" +
          '<p class="muted">' + esc(t("listing.host", { name: l.host.name })) + "</p>" +
          '<p class="lead">' + esc(loc(l.description)) + "</p>" +
          (l.wifiMbps ? '<p class="wifi-pill">📶 ' + esc(t("listing.wifiTested", { n: l.wifiMbps })) + "</p>" : "") +
          "<h2>" + esc(t("listing.amenities")) + "</h2>" +
          '<ul class="amenities">' + l.amenities.map(function (a) { return "<li>" + esc(t("amenity." + a)) + "</li>"; }).join("") + "</ul>" +
          '<p><a href="https://maps.google.com/?q=' + encodeURIComponent(t("area." + l.area) + ", Dahab, Egypt") + '" target="_blank" rel="noopener">📍 ' + esc(t("listing.map")) + "</a></p>" +
          '<div id="availability"></div>' +
        "</div>" +
        '<aside class="contact-box">' +
          '<p class="price">' + priceHtml(l) + "</p>" +
          '<div class="date-row">' +
            "<label>" + esc(t("listing.from")) + '<input type="date" id="date-from"></label>' +
            "<label>" + esc(t("listing.to")) + '<input type="date" id="date-to"></label>' +
          "</div>" +
          '<p class="message message-error small" id="dates-busy" hidden>' + esc(t("cal.taken")) + "</p>" +
          '<a class="btn btn-whatsapp btn-block" id="wa-contact" target="_blank" rel="noopener">' + esc(t("listing.contact")) + "</a>" +
          '<p class="small muted">' + esc(t("listing.contactNote")) + "</p>" +
          '<div class="share">' +
            "<strong>" + esc(t("listing.share")) + "</strong>" +
            '<a href="' + waLink("", title + " · Yalla Dahab " + pageUrl) + '" target="_blank" rel="noopener">' + esc(t("listing.shareWhatsapp")) + "</a>" +
            '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener">' + esc(t("listing.shareFacebook")) + "</a>" +
            '<button type="button" class="link-button" id="copy-link">' + esc(t("listing.copyLink")) + "</button>" +
          "</div>" +
        "</aside>" +
      "</div>";

    setupGallery(l.photos || []);

    var from = document.getElementById("date-from");
    var to = document.getElementById("date-to");
    var wa = document.getElementById("wa-contact");
    function updateWa() {
      var dates = from.value && to.value
        ? t("listing.waDates", { from: formatDate(from.value, { day: "numeric", month: "long" }), to: formatDate(to.value, { day: "numeric", month: "long" }) })
        : "";
      wa.href = waLink(l.host.whatsapp, t("listing.waMessage", { host: l.host.name, title: title, dates: dates }));
    }
    var busy = [];
    // Prévient si les dates choisies tombent sur une réservation Airbnb (départ non compris).
    function checkBusy() {
      var taken = from.value && to.value && busy.some(function (r) { return from.value < r.ends && to.value > r.starts; });
      document.getElementById("dates-busy").hidden = !taken;
    }
    from.addEventListener("change", function () { to.min = from.value; updateWa(); checkBusy(); });
    to.addEventListener("change", function () { updateWa(); checkBusy(); });
    DB.busyDates(l.id).then(function (ranges) {
      busy = ranges || [];
      if (busy.length) document.getElementById("availability").innerHTML = availabilityHtml(busy);
      checkBusy();
    }, function (err) { console.error(err); });
    var today = new Date().toISOString().slice(0, 10);
    from.min = today; to.min = today;
    updateWa();

    document.getElementById("copy-link").addEventListener("click", function (e) {
      var btn = e.target;
      var done = function () { btn.textContent = t("listing.copied"); };
      if (navigator.clipboard) navigator.clipboard.writeText(pageUrl).then(done, function () { window.prompt("", pageUrl); });
      else window.prompt("", pageUrl);
    });
  }

  // ---------- Disponibilités (calendrier Airbnb synchronisé) ----------

  function isoDay(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  // Deux mois à partir d'aujourd'hui ; les nuits réservées sont barrées.
  function availabilityHtml(busy) {
    var today = isoDay(new Date());
    var first = new Date();
    first.setDate(1);
    var months = [0, 1].map(function (offset) {
      var m = new Date(first.getFullYear(), first.getMonth() + offset, 1);
      var days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      var lead = (m.getDay() + 6) % 7; // semaine qui commence le lundi
      var cells = [];
      for (var i = 0; i < lead; i++) cells.push("<span></span>");
      for (var d = 1; d <= days; d++) {
        var iso = isoDay(new Date(m.getFullYear(), m.getMonth(), d));
        var taken = busy.some(function (r) { return iso >= r.starts && iso < r.ends; });
        cells.push('<span class="' + (iso < today ? "past" : taken ? "taken" : "free") + '">' + d + "</span>");
      }
      var head = [1, 2, 3, 4, 5, 6, 0].map(function (wd) {
        return "<b>" + esc(new Date(2024, 0, 7 + wd).toLocaleDateString(lang, { weekday: "narrow" })) + "</b>";
      }).join("");
      return '<div class="cal-month"><h3>' + esc(m.toLocaleDateString(lang, { month: "long", year: "numeric" })) + "</h3>" +
        '<div class="cal-grid">' + head + cells.join("") + "</div></div>";
    }).join("");
    return "<h2>" + esc(t("cal.title")) + '</h2><div class="cal-months">' + months + "</div>" +
      '<p class="small muted"><span class="cal-key taken"></span> ' + esc(t("cal.legendTaken")) + ' &nbsp; <span class="cal-key free"></span> ' + esc(t("cal.legendFree")) + "</p>";
  }

  // ---------- Photos de la fiche : galerie + carrousel plein écran ----------

  // Ordinateur : grande photo + 2 petites. Téléphone : on fait défiler toutes les photos du doigt.
  // Un clic sur une photo ouvre le carrousel plein écran.
  function galleryHtml(l) {
    var photos = l.photos || [];
    if (!photos.length) {
      return '<div class="gallery">' + photo(l.hue, t("type." + l.type)) + photo(l.hue + 25, "") + photo(l.hue - 25, "") + "</div>";
    }
    return '<div class="gallery-wrap"><div class="gallery has-photos" id="gallery">' + photos.map(function (src, i) {
      return '<button type="button" class="photo" data-photo="' + i + '" aria-label="' + esc(t("listing.photoN", { n: i + 1, total: photos.length })) + '">' +
        '<img src="' + esc(src) + '" alt="" ' + (i ? 'loading="lazy" ' : "") + 'onerror="this.remove()"></button>';
    }).join("") + "</div>" +
      (photos.length > 1 ? '<span class="gallery-count" id="gallery-count">1 / ' + photos.length + "</span>" +
        '<button type="button" class="gallery-all" data-photo="0">▦ ' + esc(t("listing.showAll", { count: photos.length })) + "</button>" : "") +
      "</div>";
  }

  function setupGallery(photos) {
    var gallery = document.getElementById("gallery");
    if (!gallery) return;
    var count = document.getElementById("gallery-count");
    gallery.addEventListener("scroll", function () {
      if (count) count.textContent = (Math.round(gallery.scrollLeft / gallery.clientWidth) + 1) + " / " + photos.length;
    }, { passive: true });
    gallery.parentNode.addEventListener("click", function (e) {
      var b = e.target.closest("[data-photo]");
      if (b) openLightbox(photos, Number(b.dataset.photo));
    });
  }

  function openLightbox(photos, start) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML =
      '<div class="lightbox-bar"><span class="lightbox-count"></span>' +
        '<button type="button" class="lightbox-close" aria-label="' + esc(t("listing.close")) + '">✕</button></div>' +
      '<div class="lightbox-track">' + photos.map(function (src) {
        return '<figure><img src="' + esc(src) + '" alt="" loading="lazy"></figure>';
      }).join("") + "</div>" +
      (photos.length > 1
        ? '<button type="button" class="lightbox-nav prev" aria-label="' + esc(t("listing.prev")) + '">‹</button>' +
          '<button type="button" class="lightbox-nav next" aria-label="' + esc(t("listing.next")) + '">›</button>'
        : "");
    document.body.appendChild(box);
    document.body.classList.add("no-scroll");
    var track = box.querySelector(".lightbox-track");
    var counter = box.querySelector(".lightbox-count");
    function current() { return Math.round(track.scrollLeft / track.clientWidth); }
    function go(i) {
      i = (i + photos.length) % photos.length;
      track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
    }
    function paint() { counter.textContent = (current() + 1) + " / " + photos.length; }
    track.scrollLeft = start * track.clientWidth;
    paint();
    track.addEventListener("scroll", paint, { passive: true });
    function close() {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
      box.remove();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(current() + 1);
      if (e.key === "ArrowLeft") go(current() - 1);
    }
    document.addEventListener("keydown", onKey);
    box.addEventListener("click", function (e) {
      if (e.target.closest(".lightbox-close") || e.target === box) close();
      if (e.target.closest(".next")) go(current() + 1);
      if (e.target.closest(".prev")) go(current() - 1);
    });
    box.querySelector(".lightbox-close").focus();
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

  var PAGES = { home: initHome, listings: initListings, listing: initListing, events: initEvents, host: initHost, advertise: initAdvertise };
  // Pages qui n'affichent pas le catalogue public (espace hôtes, admin) : pas besoin de le charger.
  var PRIVATE_PAGES = { login: true, account: true, admin: true };

  window.YD = {
    t: t, loc: loc, esc: esc, money: money, lang: function () { return lang; },
    formatDate: formatDate, optionList: optionList, applyStaticTexts: applyStaticTexts,
    AREAS: AREAS, TYPES: TYPES, AMENITIES: AMENITIES,
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
      EVENTS = data.events;
      ADS = data.ads;
    }, function (err) {
      console.error("Yalla Dahab: data could not be loaded", err);
    }).then(init);
  });
})();
