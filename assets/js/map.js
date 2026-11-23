// Carte des logements (page listings.html) : une épingle par quartier, avec le nombre de logements.
// Les épingles montrent le quartier, jamais l'adresse exacte (l'adresse se donne sur WhatsApp).
// Carte gratuite : Leaflet (assets/vendor/leaflet) + fond OpenStreetMap.
(function () {
  "use strict";

  // Centres des quartiers : YD.AREA_POINTS (assets/js/app.js).
  // other-dahab et near-dahab n'ont pas d'épingle (comptés sous la carte).
  // Une annonce dont l'hôte a coché « localisation approximative » a sa propre petite épingle.
  var AREA_POINTS, CENTER;

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

  // Nombre de logements par quartier, sans ceux qui ont leur propre épingle.
  function counts(list) {
    var c = {};
    list.forEach(function (l) { if (!YD.hasPoint(l)) c[l.area] = (c[l.area] || 0) + 1; });
    return c;
  }

  function pointPopupHtml(l) {
    return '<div class="map-popup"><strong dir="auto">' + esc(YD.listingText(l.title)) + "</strong>" +
      '<p class="muted">' + esc(t("area." + l.area)) + " · " + esc(t("map.point")) + "</p>" +
      '<a class="btn btn-small" href="stay/' + encodeURIComponent(l.id) + '" target="_blank" rel="noopener">' + esc(t("map.showOne")) + "</a></div>";
  }

  function popupHtml(area, list) {
    var n = list.length;
    var html = '<div class="map-popup"><strong>' + esc(t("area." + area)) + "</strong>";
    if (!n) return html + '<p class="muted">' + esc(t("map.none")) + "</p></div>";
    html += "<p>" + esc(t("listings.count", { n: n })) + "</p>";
    if (n === 1) {
      html += '<a class="btn btn-small" href="stay/' + encodeURIComponent(list[0].id) + '" target="_blank" rel="noopener">' + esc(t("map.showOne")) + "</a>";
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
      var inArea = all.filter(function (l) { return l.area === area; });
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
      marker.bindPopup(popupHtml(area, inArea), { closeButton: true, autoPanPadding: [24, 24] });
      layer.addLayer(marker);
    });
    // Logements avec localisation approximative : une petite épingle chacun.
    all.filter(YD.hasPoint).forEach(function (l) {
      var selected = detail.area === l.area;
      var icon = L.divIcon({
        className: "map-pin-wrap",
        html: '<span class="map-pin map-pin-point' + (selected ? " is-selected" : "") + '"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14]
      });
      var title = YD.listingText(l.title);
      var marker = L.marker([l.lat, l.lng], { icon: icon, title: title, alt: title, keyboard: true, riseOnHover: true, zIndexOffset: selected ? 1100 : 600 });
      if (canHover) marker.bindTooltip(esc(title), { direction: "top", offset: [0, -16], className: "map-tip" });
      marker.bindPopup(pointPopupHtml(l), { closeButton: true, autoPanPadding: [24, 24] });
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
    (last.anyArea || []).forEach(function (l) {
      if (YD.hasPoint(l) && (!last.area || l.area === last.area)) pts.push([l.lat, l.lng]);
    });
    if (!pts.length) { map.setView(CENTER, 13); return; }
    if (pts.length === 1) { map.setView(pts[0], last.area ? 15 : 14, { animate: fitted }); }
    else map.fitBounds(pts, { padding: [40, 40], maxZoom: 15, animate: fitted });
    fitted = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    YD = window.YD;
    wrap = document.getElementById("area-map-wrap");
    if (YD) { AREA_POINTS = YD.AREA_POINTS; CENTER = YD.DAHAB_CENTER; }
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
