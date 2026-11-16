// Carte des logements (page listings.html) : une épingle par quartier, avec le nombre de logements.
// Les épingles montrent le quartier, jamais l'adresse exacte (l'adresse se donne sur WhatsApp).
// Carte gratuite : Leaflet (assets/vendor/leaflet) + fond OpenStreetMap.
(function () {
  "use strict";

  // Position approximative du centre de chaque quartier [latitude, longitude].
  // Pour déplacer une épingle : changer ses deux nombres ici.
  // other-dahab et near-dahab n'ont pas d'épingle (comptés sous la carte).
  var AREA_POINTS = {
    "canyon": [28.5530, 34.5262],
    "blue-hole-road": [28.5300, 34.5290],
    "eel-garden": [28.5082, 34.5192],
    "assala": [28.5055, 34.5135],
    "zarnouk": [28.5010, 34.5070],
    "lighthouse": [28.5000, 34.5196],
    "masbat": [28.4953, 34.5170],
    "mashraba": [28.4895, 34.5125],
    "mubarak": [28.4895, 34.5025],
    "dahab-city": [28.4840, 34.5050],
    "lagoon": [28.4720, 34.5000],
    "south-coast": [28.4310, 34.4610]
  };
  var CENTER = [28.4980, 34.5140];

  var YD, form, wrap, mapEl, noteEl, toggle;
  var map = null, layer = null, last = null, fitted = false;

  function t(k, v) { return YD.t(k, v); }
  function esc(s) { return YD.esc(s); }

  var canHover = window.matchMedia("(hover: hover)").matches;

  function isMobile() { return window.matchMedia("(max-width: 860px)").matches; }

  // Sur téléphone : bouton Liste / Carte. Sur ordinateur : la carte reste au-dessus de la liste.
  function setView(view) {
    document.body.classList.toggle("view-map", view === "map");
    // On garde Liste / Carte pour le retour depuis une annonce.
    try { window.sessionStorage.setItem("yd-view", view); } catch (e) {}
    toggle.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.view === view ? "true" : "false");
    });
    if (view === "map" || !isMobile()) ensureMap();
    if (map) setTimeout(function () { map.invalidateSize(); fit(); }, 0);
    // Sur téléphone, on amène la carte (ou le début de la liste) en haut de l'écran.
    if (isMobile()) {
      var target = document.querySelector(".results-bar");
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80 });
    }
  }

  function chooseArea(area) {
    form.elements.area.value = area || "";
    form.dispatchEvent(new Event("input", { bubbles: true }));
    if (map) map.closePopup();
    if (area && isMobile()) setView("list");
  }

  function ensureMap() {
    if (map || !window.L) return;
    map = L.map(mapEl, { center: CENTER, zoom: 13, scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    layer = L.layerGroup().addTo(map);

    // Bouton « Tout Dahab » : enlève le filtre de quartier.
    var All = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        var b = L.DomUtil.create("button", "map-all");
        b.type = "button";
        b.textContent = t("map.all");
        L.DomEvent.disableClickPropagation(b);
        L.DomEvent.on(b, "click", function () { chooseArea(""); });
        return b;
      }
    });
    map.addControl(new All());

    mapEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-map-area]");
      if (btn) { e.preventDefault(); chooseArea(btn.dataset.mapArea); }
    });
    if (last) draw(last);
  }

  function counts(list) {
    var c = {};
    list.forEach(function (l) { c[l.area] = (c[l.area] || 0) + 1; });
    return c;
  }

  function popupHtml(area, list) {
    var n = list.length;
    var html = '<div class="map-popup"><strong>' + esc(t("area." + area)) + "</strong>";
    if (!n) return html + '<p class="muted">' + esc(t("map.none")) + "</p></div>";
    html += "<p>" + esc(t("listings.count", { n: n })) + "</p>";
    if (n === 1) {
      html += '<a class="btn btn-small" href="stay/' + encodeURIComponent(list[0].id) + '">' + esc(t("map.showOne")) + "</a>";
    } else {
      html += '<button type="button" class="btn btn-small" data-map-area="' + esc(area) + '">' + esc(t("map.show", { n: n })) + "</button>";
    }
    return html + "</div>";
  }

  function draw(detail) {
    last = detail;
    var all = detail.anyArea || [];
    var byArea = counts(all);
    var elsewhere = (byArea["other-dahab"] || 0) + (byArea["near-dahab"] || 0);
    noteEl.innerHTML = '<span>' + esc(t("map.approx")) + "</span>" +
      (elsewhere ? " <span>" + esc(t("map.elsewhere", { n: elsewhere })) + "</span>" : "");
    if (!map) return;
    layer.clearLayers();
    Object.keys(AREA_POINTS).forEach(function (area) {
      var n = byArea[area] || 0;
      var selected = detail.area === area;
      // Pas d'épingle pour un quartier vide (sauf s'il est choisi dans le filtre).
      if (!n && !selected) return;
      var cls = "map-pin" + (n ? "" : " is-empty") + (selected ? " is-selected" : "");
      var icon = L.divIcon({
        className: "map-pin-wrap",
        html: '<span class="' + cls + '"><b>' + n + "</b></span>",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -18]
      });
      var marker = L.marker(AREA_POINTS[area], {
        icon: icon,
        title: t("area." + area) + " · " + t("listings.count", { n: n }),
        alt: t("area." + area),
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : (n ? 500 : 0)
      });
      if (canHover) marker.bindTooltip(esc(t("area." + area)), { direction: "top", offset: [0, -20], className: "map-tip" });
      marker.bindPopup(popupHtml(area, all.filter(function (l) { return l.area === area; })), { closeButton: true, autoPanPadding: [24, 24] });
      layer.addLayer(marker);
    });
    fit();
  }

  // Cadre la carte sur les quartiers qui ont des logements (ou sur le quartier choisi).
  function fit() {
    if (!map || !last || !mapEl.offsetWidth) return;
    var byArea = counts(last.anyArea || []);
    var pts = Object.keys(AREA_POINTS).filter(function (a) {
      return last.area ? a === last.area : byArea[a];
    }).map(function (a) { return AREA_POINTS[a]; });
    if (!pts.length) { map.setView(CENTER, 13); return; }
    if (pts.length === 1) { map.setView(pts[0], last.area ? 15 : 14, { animate: fitted }); }
    else map.fitBounds(pts, { padding: [40, 40], maxZoom: 15, animate: fitted });
    fitted = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    YD = window.YD;
    wrap = document.getElementById("area-map-wrap");
    if (!YD || !wrap) return;
    form = document.getElementById("filters");
    mapEl = document.getElementById("area-map");
    noteEl = document.getElementById("map-note");
    toggle = document.getElementById("view-toggle");
    toggle.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]");
      if (b) setView(b.dataset.view);
    });
    if (!isMobile()) ensureMap();
    window.matchMedia("(max-width: 860px)").addEventListener("change", function () {
      setView(document.body.classList.contains("view-map") ? "map" : "list");
    });
    var savedView = null;
    try { savedView = window.sessionStorage.getItem("yd-view"); } catch (e) {}
    setView(savedView === "map" ? "map" : "list");
  });

  document.addEventListener("yd:results", function (e) {
    if (!wrap) { last = e.detail; return; }
    draw(e.detail);
  });
})();
