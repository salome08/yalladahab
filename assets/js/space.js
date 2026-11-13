// Espace hôtes (connexion, « Mes annonces ») et espace admin. Fonctionne seulement
// quand la base Supabase est configurée dans config.js.
(function () {
  "use strict";

  var YD = window.YD;
  var DB = window.YD_DB;
  var t = YD.t, esc = YD.esc, loc = YD.loc;
  var MAX_PHOTOS = 30;
  var EVENT_CATEGORIES = ["party", "yoga", "diving", "market", "music", "workshop"];

  // ---------- Outils ----------

  function root() { return document.getElementById("space"); }

  function showError(err) {
    console.error(err);
    var box = document.getElementById("space-message");
    if (box) {
      box.className = "message message-error";
      box.textContent = t("common.error", { msg: (err && err.message) || err });
      box.hidden = false;
      box.scrollIntoView({ block: "center" });
    }
  }

  function showMessage(text, isWarning) {
    var box = document.getElementById("space-message");
    if (!box) return;
    box.className = isWarning ? "message message-error" : "message";
    box.textContent = text;
    box.hidden = false;
    box.scrollIntoView({ block: "center" });
  }

  function hideMessage() {
    var box = document.getElementById("space-message");
    if (box) box.hidden = true;
  }

  function notEnabled() {
    root().innerHTML = '<p class="empty">' + esc(t("space.notEnabled")) + ' <a href="host.html">' + esc(t("nav.host")) + "</a></p>";
  }

  function numberOrNull(v) { return v === "" || v == null ? null : Number(v); }

  // Le formulaire ne doit pas être envoyé deux fois pendant un enregistrement.
  function busy(form, on) {
    Array.prototype.forEach.call(form.querySelectorAll("button"), function (b) { b.disabled = on; });
  }

  // Champs décrits par une liste, pour les formulaires d'événements et de bannières.
  // type : text | number | date | time | textarea | select | checkbox | i18n | i18nText
  function fieldsHtml(spec, values) {
    return spec.map(function (f) {
      var v = values[f.name];
      if (f.type === "i18n" || f.type === "i18nText") {
        v = v || {};
        return ["en", "fr"].map(function (l) {
          var name = f.name + "_" + l;
          var label = esc(t(f.labels[l]));
          return f.type === "i18n"
            ? "<label>" + label + '<input name="' + name + '" value="' + esc(v[l] || "") + '"></label>'
            : '<label class="full">' + label + '<textarea name="' + name + '">' + esc(v[l] || "") + "</textarea></label>";
        }).join("");
      }
      var cls = f.full ? ' class="full"' : "";
      if (f.type === "checkbox") {
        return '<label class="check' + (f.full ? " full" : "") + '"><input type="checkbox" name="' + f.name + '"' + (v ? " checked" : "") + "> " + esc(t(f.label)) + "</label>";
      }
      if (f.type === "select") {
        return "<label" + cls + ">" + esc(t(f.label)) + '<select name="' + f.name + '">' + f.options.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === v ? " selected" : "") + ">" + esc(o.label) + "</option>";
        }).join("") + "</select></label>";
      }
      if (f.type === "textarea") {
        return "<label" + cls + ">" + esc(t(f.label)) + '<textarea name="' + f.name + '">' + esc(v || "") + "</textarea></label>";
      }
      return "<label" + cls + ">" + esc(t(f.label)) + '<input type="' + f.type + '" name="' + f.name + '" value="' + esc(v == null ? "" : v) + '"' +
        (f.required ? " required" : "") + "></label>";
    }).join("");
  }

  function readFields(form, spec) {
    var out = {};
    spec.forEach(function (f) {
      var el = form.elements;
      if (f.type === "i18n" || f.type === "i18nText") {
        out[f.name] = {};
        ["en", "fr"].forEach(function (l) {
          var input = el[f.name + "_" + l];
          var val = input ? input.value.trim() : "";
          if (val) out[f.name][l] = val;
        });
      } else if (f.type === "checkbox") {
        out[f.name] = el[f.name].checked;
      } else if (f.type === "number") {
        out[f.name] = numberOrNull(el[f.name].value);
      } else {
        out[f.name] = el[f.name].value.trim();
      }
    });
    return out;
  }

  // Réduit les photos du téléphone (souvent 5 Mo et plus) à 1600 px de large en JPEG.
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("image")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name)); };
      img.src = url;
    });
  }

  // Admin : demande l'email de l'hôte puis lui donne l'annonce. Renvoie null si annulé.
  function giveToHost(l) {
    var email = window.prompt(t("give.prompt", { name: l.host.name }));
    if (!email || !email.trim()) return null;
    email = email.trim();
    return DB.giveListing(l.id, email).then(function (saved) {
      showMessage(t("give.done", { email: email }));
      return saved;
    }, function (err) {
      var msg = String((err && err.message) || "");
      if (msg.indexOf("NO_ACCOUNT") !== -1) showMessage(t("give.noAccount"), true);
      else if (/give_listing|PGRST202|function/i.test(msg)) showMessage(t("give.notInstalled"), true);
      else showError(err);
      throw err;
    });
  }

  function statusBadge(status) {
    return '<span class="badge status status-' + esc(status) + '">' + esc(t("status." + status)) + "</span>";
  }

  // ---------- Connexion ----------

  function initLogin() {
    if (!DB.enabled) return notEnabled();
    DB.currentUser().then(function (user) {
      if (user) { window.location.replace("account.html"); return; }
      root().innerHTML =
        '<form class="form-card narrow" id="login-form">' +
          '<h1 class="full">' + esc(t("login.title")) + "</h1>" +
          '<p class="full muted">' + esc(t("login.text")) + "</p>" +
          '<label class="full">' + esc(t("login.email")) + '<input type="email" name="email" required autocomplete="email"></label>' +
          '<button class="btn full" type="submit">' + esc(t("login.submit")) + "</button>" +
        "</form>";
      var form = document.getElementById("login-form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = form.elements.email.value.trim();
        busy(form, true);
        DB.signIn(email, new URL("account.html", window.location.href).href).then(function () {
          showCodeForm(email);
        }, function (err) { busy(form, false); showError(err); });
      });
    }).catch(showError);

    // Si le lien de l'email est ouvert dans un autre onglet, cette page se connecte aussi.
    DB.onSignedIn(function () { window.location.replace("account.html"); });
  }

  // Après l'envoi de l'email : on peut taper le code reçu ici, sans changer d'onglet.
  function showCodeForm(email) {
    root().innerHTML =
      '<form class="form-card narrow" id="code-form" novalidate>' +
        '<h1 class="full">' + esc(t("login.checkTitle")) + "</h1>" +
        '<p class="full muted">' + esc(t("login.sent", { email: email })) + "</p>" +
        '<label class="full">' + esc(t("login.code")) +
          '<input name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="14" required placeholder="123456"></label>' +
        '<button class="btn full" type="submit">' + esc(t("login.codeSubmit")) + "</button>" +
        '<p class="full small muted">' + esc(t("login.codeHelp")) + ' <button type="button" class="link-button" id="login-retry">' + esc(t("login.retry")) + "</button></p>" +
      "</form>";
    var form = document.getElementById("code-form");
    form.elements.code.focus();
    document.getElementById("login-retry").addEventListener("click", function () { hideMessage(); initLogin(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = form.elements.code.value.replace(/\D/g, "");
      form.elements.code.value = code;
      if (!/^\d{6,10}$/.test(code)) { showMessage(t("login.codeWrong"), true); return; }
      hideMessage();
      busy(form, true);
      DB.verifyCode(email, code).then(function () {
        window.location.replace("account.html");
      }, function () { busy(form, false); showMessage(t("login.codeWrong"), true); });
    });
  }

  // ---------- Mon espace ----------

  function initAccount() {
    if (!DB.enabled) return notEnabled();
    var user, profile, listings = [];

    DB.currentUser().then(function (u) {
      if (!u) { window.location.replace("login.html"); return null; }
      user = u;
      return Promise.all([DB.profile(u.id), DB.myListings(u.id)]);
    }).then(function (res) {
      if (!res) return;
      profile = res[0] || { id: user.id };
      listings = res[1];
      drawHome();
      // Lien « Ajouter une annonce » de la page Publier mon logement.
      if (new URLSearchParams(window.location.search).get("new") === "1") {
        window.history.replaceState(null, "", "account.html");
        document.getElementById("new-listing").click();
      }
      // Lien « Modifier » de l'espace admin : ouvre l'annonce d'un hôte dans l'éditeur.
      var editId = new URLSearchParams(window.location.search).get("edit");
      if (editId && profile.is_admin) {
        DB.getListing(editId).then(function (l) { drawEditor(l, true); }, showError);
      }
      if (profile.is_admin) { showAdminAlert(); YD.setNoStats(true); }
      loadListingStats();
    }).catch(showError);

    // Vues et contacts WhatsApp de chaque annonce, sur les 30 derniers jours.
    var listingStats = null;
    function loadListingStats() {
      DB.listingStats(30).then(function (rows) {
        listingStats = {};
        (rows || []).forEach(function (r) { listingStats[r.listing_id] = r; });
        if (document.getElementById("my-listings")) drawList();
      }, function () { /* statistiques pas encore installées : rien à afficher */ });
    }
    function statsLine(l) {
      if (!listingStats || l.status !== "published") return "";
      var r = listingStats[l.id] || {};
      return '<p class="small muted listing-stats">' + esc(t("stats.hostLine", { views: Number(r.views || 0), whatsapp: Number(r.whatsapp || 0) })) + "</p>";
    }

    // Pour l'admin : rappel des annonces à valider en haut de son espace.
    function showAdminAlert() {
      DB.pendingCount().then(function (n) {
        var head = root().querySelector(".space-head");
        if (!n || !head) return;
        head.insertAdjacentHTML("beforebegin", '<div class="admin-alert"><span>' + esc(t("account.adminPending", { count: n })) + "</span>" +
          '<a class="btn btn-coral btn-small" href="admin.html">' + esc(t("account.adminPendingLink")) + "</a></div>");
      }, function (err) { console.error(err); });
    }

    function profileReady() { return Boolean(profile.name && profile.whatsapp); }

    function drawHome() {
      root().innerHTML =
        '<div class="space-head"><div><h1>' + esc(t("account.title")) + '</h1><p class="muted">' + esc(user.email) + "</p></div>" +
          '<div class="space-actions">' +
            (profile.is_admin ? '<a class="btn btn-ghost" href="admin.html">' + esc(t("account.admin")) + "</a>" : "") +
            '<button type="button" class="btn btn-ghost" id="logout">' + esc(t("account.logout")) + "</button>" +
          "</div></div>" +
        '<form class="form-card" id="profile-form">' +
          '<h2 class="full">' + esc(t("account.profile")) + '</h2><p class="full small muted">' + esc(t("account.profileHelp")) + "</p>" +
          "<label>" + esc(t("host.name")) + '<input name="name" required value="' + esc(profile.name || "") + '"></label>' +
          "<label>" + esc(t("host.whatsapp")) + '<input name="whatsapp" type="tel" required placeholder="+20 10 1234 5678" value="' + esc(profile.whatsapp || "") + '"></label>' +
          '<button class="btn full" type="submit">' + esc(t("account.save")) + "</button>" +
        "</form>" +
        '<div class="section-head space-section"><h2>' + esc(t("account.myListings")) + "</h2>" +
          '<button type="button" class="btn btn-coral" id="new-listing">+ ' + esc(t("account.new")) + "</button></div>" +
        '<div id="my-listings" class="space-list"></div>';

      document.getElementById("logout").addEventListener("click", function () {
        DB.signOut().then(function () { window.location.href = "index.html"; });
      });

      var pf = document.getElementById("profile-form");
      pf.addEventListener("submit", function (e) {
        e.preventDefault();
        busy(pf, true);
        // Le numéro est gardé sans espaces ni « + », au format attendu par WhatsApp.
        var fields = { name: pf.elements.name.value.trim(), whatsapp: pf.elements.whatsapp.value.replace(/[^\d]/g, "") };
        DB.saveProfile(user.id, fields).then(function (p) {
          profile = p;
          busy(pf, false);
          showMessage(t("account.saved"));
        }, function (err) { busy(pf, false); showError(err); });
      });

      document.getElementById("new-listing").addEventListener("click", function () {
        if (!profileReady()) { showMessage(t("account.needProfile"), true); pf.elements.name.focus(); return; }
        drawEditor(null);
      });
      drawList();
    }

    // Annonce que l'admin gère pour un autre hôte (contact différent du sien).
    function forOther(l) { return profile.is_admin && l.host && l.host.whatsapp !== profile.whatsapp; }

    function drawList() {
      var box = document.getElementById("my-listings");
      if (!listings.length) { box.innerHTML = '<p class="empty">' + esc(t("account.empty")) + "</p>"; return; }
      box.innerHTML = listings.map(function (l) {
        var cover = l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" onerror="this.remove()">' : "";
        var toggle = l.status === "published" ? ["paused", "account.pause"] : l.status === "paused" ? ["published", "account.resume"] : null;
        return '<article class="space-row" data-id="' + esc(l.id) + '">' +
          '<div class="space-thumb" style="--h:' + (l.hue || 190) + '">' + cover + "</div>" +
          '<div class="space-row-body"><h3>' + YD.listingTextHtml(l.title) + "</h3>" + statusBadge(l.status) +
            (forOther(l) ? ' <span class="small muted">' + esc(t("account.forHost", { name: l.host.name })) + "</span>" : "") +
            statsLine(l) +
            '<div class="space-row-actions">' +
              '<button type="button" class="link-button" data-action="edit">' + esc(t("account.edit")) + "</button>" +
              (forOther(l) ? '<button type="button" class="link-button" data-action="give">' + esc(t("give.button")) + "</button>" : "") +
              (toggle ? '<button type="button" class="link-button" data-action="status" data-status="' + toggle[0] + '">' + esc(t(toggle[1])) + "</button>" : "") +
              (l.status === "published" ? '<a href="listing.html?id=' + encodeURIComponent(l.id) + '">' + esc(t("account.view")) + "</a>" : "") +
              '<button type="button" class="link-button danger" data-action="delete">' + esc(t("account.delete")) + "</button>" +
            "</div></div></article>";
      }).join("");
    }

    root().addEventListener("click", function (e) {
      var b = e.target.closest("[data-action]");
      var row = b && b.closest(".space-row");
      if (!row) return;
      var l = listings.filter(function (x) { return x.id === row.dataset.id; })[0];
      if (!l) return;
      hideMessage();
      if (b.dataset.action === "edit") drawEditor(l);
      if (b.dataset.action === "give") {
        var giving = giveToHost(l);
        if (giving) giving.then(function () {
          listings.splice(listings.indexOf(l), 1);
          drawList();
        }, function () {});
      }
      if (b.dataset.action === "status") {
        DB.updateListing(l.id, { status: b.dataset.status }).then(function (saved) {
          listings[listings.indexOf(l)] = saved;
          drawList();
        }, showError);
      }
      if (b.dataset.action === "delete" && window.confirm(t("account.confirmDelete"))) {
        DB.deleteListing(l.id).then(function () {
          listings.splice(listings.indexOf(l), 1);
          drawList();
        }, showError);
      }
    });

    function drawEditor(existing, fromAdmin) {
      var back = fromAdmin ? "admin.html" : "account.html";
      var l = existing || {
        title: {}, description: {}, area: "", type: "", guests: 2, bedrooms: 1, beds: null, currency: "EGP",
        pricePerNight: null, pricePerWeek: null, pricePerMonth: null, wifiMbps: null, amenities: [], photos: [],
        hue: Math.floor(Math.random() * 360)
      };
      var photos = l.photos.slice();
      var host = existing ? existing.host : { name: profile.name, whatsapp: profile.whatsapp };
      root().innerHTML =
        '<a class="back" href="' + back + '"><span class="arrow">←</span> ' + esc(t(fromAdmin ? "admin.title" : "account.myListings")) + "</a>" +
        '<form class="form-card" id="listing-form" novalidate>' +
          '<h1 class="full">' + esc(t(existing ? "editor.titleEdit" : "editor.titleNew")) + "</h1>" +
          (existing ? '<p class="full">' + statusBadge(existing.status) + "</p>" : "") +
          // Import rapide : on colle le lien Airbnb et le formulaire se remplit.
          '<div class="full import-box"><strong>' + esc(t(existing ? "import.titleEdit" : "import.title")) + '</strong><p class="small muted">' + esc(t(existing ? "import.helpEdit" : "import.help")) + "</p>" +
            '<div class="import-row"><input type="url" id="import-url" placeholder="https://www.airbnb.com/rooms/…" inputmode="url">' +
            '<button type="button" class="btn" id="import-go">' + esc(t("import.button")) + "</button></div>" +
            '<span class="small muted" id="import-status"></span></div>' +
          // Admin : le contact affiché peut être celui d'un autre hôte.
          (profile.is_admin ? '<div class="full host-box"><strong>' + esc(t("editor.hostTitle")) + '</strong><p class="small muted">' + esc(t("editor.hostHelp")) + "</p>" +
            '<div class="host-fields"><label>' + esc(t("editor.hostName")) + '<input name="host_name" required value="' + esc(host.name || "") + '"></label>' +
            "<label>" + esc(t("editor.hostWhatsapp")) + '<input name="host_whatsapp" type="tel" required placeholder="+20 10 1234 5678" value="' + esc(host.whatsapp || "") + '"></label></div></div>' : "") +
          // Texte de l'annonce en anglais seulement (compris par tous les voyageurs).
          '<label class="full">' + esc(t("editor.title")) + '<input name="title_en" dir="auto" required value="' + esc(l.title.en || "") + '" placeholder="' + esc(t("editor.titlePlaceholder")) + '"></label>' +
          '<label class="full">' + esc(t("editor.desc")) + '<textarea name="description_en" dir="auto" required>' + esc(l.description.en || "") + "</textarea></label>" +
          '<p class="full small muted">' + esc(t("editor.langHelp")) + "</p>" +
          "<label>" + esc(t("search.area")) + '<select name="area" required>' + YD.optionList(YD.AREAS, "area.", "—") + "</select></label>" +
          "<label>" + esc(t("search.type")) + '<select name="type" required>' + YD.optionList(YD.TYPES, "type.", "—") + "</select></label>" +
          // Capacité : 3 champs sur une ligne.
          '<div class="full field-row field-row-3">' +
          "<label>" + esc(t("host.guests")) + '<input name="guests" type="number" min="1" required value="' + esc(l.guests) + '"></label>' +
          "<label>" + esc(t("host.bedrooms")) + '<input name="bedrooms" type="number" min="0" required value="' + esc(l.bedrooms) + '"></label>' +
          "<label>" + esc(t("host.beds")) + '<input name="beds" type="number" min="1" required value="' + esc(l.beds == null ? "" : l.beds) + '"></label>' +
          "</div>" +
          // Prix : nuit, semaine, mois et devise côte à côte.
          '<fieldset class="full field-group"><legend>' + esc(t("editor.pricesTitle")) + '</legend><div class="field-row field-row-prices">' +
          "<label>" + esc(t("host.priceNight")).replace("(EGP)", "") + '<input name="priceNight" type="number" min="0" value="' + esc(l.pricePerNight == null ? "" : l.pricePerNight) + '"></label>' +
          "<label>" + esc(t("host.priceWeek")).replace("EGP, ", "") + '<input name="priceWeek" type="number" min="0" value="' + esc(l.pricePerWeek == null ? "" : l.pricePerWeek) + '"></label>' +
          "<label>" + esc(t("host.priceMonth")).replace("EGP, ", "") + '<input name="priceMonth" type="number" min="0" value="' + esc(l.pricePerMonth == null ? "" : l.pricePerMonth) + '"></label>' +
          "<label>" + esc(t("editor.currency")) + '<select name="currency"><option value="EGP">EGP</option><option value="USD">USD ($)</option></select></label>' +
          "</div></fieldset>" +
          // Prix selon le nombre de personnes : facultatif, replié par défaut.
          '<details class="full lang-extra" id="guest-prices"' + (l.pricesByGuests ? " open" : "") + "><summary>" + esc(t("editor.pricesByGuests")) + "</summary>" +
            '<div class="lang-extra-body"><p class="small muted">' + esc(t("editor.pricesByGuestsHelp")) + '</p><div class="guest-price-grid" id="guest-price-grid"></div></div></details>' +
          // Équipements par catégorie.
          '<div class="full"><label>' + esc(t("host.amenities")) + "</label>" + YD.AMENITY_GROUPS.map(function (g) {
            return '<div class="amenity-group"><h3>' + esc(t("amenityGroup." + g.id)) + '</h3><div class="checks">' + g.items.map(function (a) {
              return '<label class="check"><input type="checkbox" name="amenities" value="' + a + '"' + (l.amenities.indexOf(a) !== -1 ? " checked" : "") + "> " + esc(t("amenity." + a)) + "</label>";
            }).join("") + "</div></div>";
          }).join("") +
            // Vitesse internet : à côté des équipements (wifi).
            '<label class="wifi-field">' + esc(t("host.wifi")) + '<input name="wifi" type="number" min="0" value="' + esc(l.wifiMbps == null ? "" : l.wifiMbps) + '"></label></div>' +
          '<div class="full"><label>' + esc(t("editor.photos")) + '</label><p class="small muted">' + esc(t("editor.photosHelp")) + "</p>" +
            '<div class="photo-grid" id="photo-grid"></div>' +
            '<label class="btn btn-ghost file-button">+ ' + esc(t("editor.addPhotos")) + '<input type="file" id="photo-input" accept="image/*" multiple hidden></label>' +
            '<span class="small muted" id="upload-status"></span></div>' +
          '<div class="full form-actions"><a class="btn btn-ghost" href="' + back + '">' + esc(t("editor.cancel")) + "</a>" +
            '<button class="btn" type="submit">' + esc(t(existing ? "editor.submitEdit" : "editor.submitNew")) + "</button></div>" +
        "</form>";

      var form = document.getElementById("listing-form");
      form.elements.area.value = l.area;
      form.elements.type.value = l.type;
      form.elements.currency.value = l.currency || "EGP";
      window.scrollTo(0, 0);

      function drawPhotos() {
        document.getElementById("photo-grid").innerHTML = photos.map(function (src, i) {
          return '<figure class="photo-item"><img src="' + esc(src) + '" alt="">' +
            (i === 0 ? '<span class="badge">' + esc(t("editor.cover")) + "</span>"
                     : '<button type="button" class="photo-btn" data-cover="' + i + '">' + esc(t("editor.makeCover")) + "</button>") +
            '<button type="button" class="photo-btn photo-remove" data-remove="' + i + '" aria-label="' + esc(t("editor.remove")) + '">×</button></figure>';
        }).join("");
      }
      drawPhotos();

      // Une case par nombre de personnes, de 1 jusqu'à la capacité du logement.
      // On garde ce qui a déjà été tapé quand la capacité change.
      var guestPriceValues = {};
      Object.keys(l.pricesByGuests || {}).forEach(function (k) { guestPriceValues[k] = String(l.pricesByGuests[k]); });
      function readGuestPrices() {
        form.querySelectorAll("[data-guests-price]").forEach(function (input) { guestPriceValues[input.dataset.guestsPrice] = input.value; });
      }
      function drawGuestPrices() {
        readGuestPrices();
        var max = Math.min(Math.max(Number(form.elements.guests.value) || 1, 1), 30);
        var base = form.elements.priceNight.value;
        var html = "";
        for (var n = 1; n <= max; n++) {
          html += "<label>" + esc(t(n === 1 ? "price.oneGuest" : "price.nGuests", { n: n })) +
            '<input type="number" min="0" inputmode="numeric" data-guests-price="' + n + '" placeholder="' + esc(base) + '" value="' + esc(guestPriceValues[n] || "") + '"></label>';
        }
        document.getElementById("guest-price-grid").innerHTML = html;
      }
      drawGuestPrices();
      form.elements.guests.addEventListener("input", drawGuestPrices);
      form.elements.priceNight.addEventListener("input", function () {
        form.querySelectorAll("[data-guests-price]").forEach(function (input) { input.placeholder = form.elements.priceNight.value; });
      });
      // Ne garde que les cases remplies, jusqu'à la capacité, et seulement si un prix diffère du prix par nuit.
      function collectGuestPrices(guests, base) {
        readGuestPrices();
        var table = {}, differs = false;
        for (var n = 1; n <= guests; n++) {
          var v = Number(guestPriceValues[n]);
          if (guestPriceValues[n] && v > 0) { table[n] = v; if (v !== base) differs = true; }
        }
        return differs ? table : null;
      }

      document.getElementById("photo-grid").addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.remove) photos.splice(Number(b.dataset.remove), 1);
        if (b.dataset.cover) photos.unshift(photos.splice(Number(b.dataset.cover), 1)[0]);
        drawPhotos();
      });

      var importBtn = document.getElementById("import-go");
      if (importBtn) importBtn.addEventListener("click", function () {
        var link = document.getElementById("import-url").value.trim();
        var status = document.getElementById("import-status");
        if (!/airbnb\.|abnb\.me/i.test(link)) { showMessage(t("import.badUrl"), true); return; }
        // Annonce existante : l'import remplace le texte, les chiffres et les photos (rien n'est enregistré avant « Enregistrer »).
        if (existing && !window.confirm(t("import.confirmEdit"))) return;
        hideMessage();
        status.textContent = t("import.loading");
        uploading = true;
        busy(form, true);
        DB.importAirbnb(link).then(function (r) {
          var f = form.elements;
          if (r.title) f.title_en.value = r.title;
          if (r.description) f.description_en.value = r.description;
          if (r.guests) f.guests.value = r.guests;
          if (r.bedrooms != null) f.bedrooms.value = r.bedrooms;
          if (r.beds) f.beds.value = r.beds;
          (r.amenities || []).forEach(function (a) {
            var box = form.querySelector('[name="amenities"][value="' + a + '"]');
            if (box) box.checked = true;
          });
          if (r.type && YD.TYPES.indexOf(r.type) !== -1) f.type.value = r.type;
          // Nouvelle annonce : on ajoute les photos. Annonce existante : on remplace par celles d'Airbnb.
          if (existing && r.photos && r.photos.length) photos = r.photos.slice(0, MAX_PHOTOS);
          else photos = photos.concat(r.photos || []).slice(0, MAX_PHOTOS);
          drawPhotos();
          status.textContent = "";
          showMessage(t(existing ? "import.doneEdit" : "import.done", { count: (r.photos || []).length }));
        }, function (err) {
          status.textContent = "";
          var code = (err && err.message) || "";
          showMessage(t(code === "bad_url" ? "import.badUrl" : "import.failed"), true);
          console.error(err);
        }).then(function () { uploading = false; busy(form, false); });
      });

      var uploading = false;
      document.getElementById("photo-input").addEventListener("change", function (e) {
        var files = Array.prototype.slice.call(e.target.files);
        e.target.value = "";
        if (photos.length + files.length > MAX_PHOTOS) {
          showMessage(t("editor.tooMany"), true);
          files = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length));
        }
        if (!files.length) return;
        var status = document.getElementById("upload-status");
        status.textContent = t("editor.uploading");
        uploading = true;
        busy(form, true);
        files.reduce(function (chain, file) {
          return chain.then(function () { return resizeImage(file); })
            .then(function (blob) { return DB.uploadPhoto(user.id, blob); })
            .then(function (url) { photos.push(url); drawPhotos(); });
        }, Promise.resolve()).catch(showError).then(function () {
          uploading = false;
          status.textContent = "";
          busy(form, false);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (uploading) return;
        hideMessage();
        var text = readFields(form, [{ name: "title", type: "i18n" }, { name: "description", type: "i18nText" }]);
        if (!text.title.en || !text.description.en) { showMessage(t("editor.needText"), true); return; }
        var hostContact = { name: profile.name, whatsapp: profile.whatsapp };
        if (profile.is_admin) {
          hostContact = { name: form.elements.host_name.value.trim(), whatsapp: form.elements.host_whatsapp.value.replace(/[^\d]/g, "") };
          if (!hostContact.name || !hostContact.whatsapp) { showMessage(t("editor.needHost"), true); return; }
        }
        if (!form.reportValidity()) return;
        var f = form.elements;
        var data = {
          id: existing && existing.id,
          // On garde le français déjà enregistré (plus affiché ni modifiable).
          title: Object.assign({}, l.title, text.title), description: Object.assign({}, l.description, text.description),
          area: f.area.value, type: f.type.value,
          guests: Number(f.guests.value), bedrooms: Number(f.bedrooms.value), beds: Number(f.beds.value),
          currency: f.currency.value,
          pricePerNight: numberOrNull(f.priceNight.value), pricePerWeek: numberOrNull(f.priceWeek.value), pricePerMonth: numberOrNull(f.priceMonth.value),
          pricesByGuests: collectGuestPrices(Number(f.guests.value), numberOrNull(f.priceNight.value)),
          wifiMbps: numberOrNull(f.wifi.value),
          amenities: Array.prototype.map.call(form.querySelectorAll('[name="amenities"]:checked'), function (c) { return c.value; }),
          photos: photos, hue: l.hue,
          host: hostContact,
          // L'admin publie directement, et l'annonce reste dans son espace jusqu'à ce qu'elle la donne.
          ownerId: profile.is_admin ? user.id : null,
          status: profile.is_admin ? "published" : null
        };
        busy(form, true);
        DB.saveListing(data).then(function (saved) {
          if (fromAdmin) { window.location.href = "admin.html"; return; }
          if (existing) listings[listings.indexOf(existing)] = saved;
          else listings.unshift(saved);
          drawHome();
          showMessage(t(saved.status === "pending" ? "editor.sentForReview" : "editor.savedOk"));
        }, function (err) { busy(form, false); showError(err); });
      });
    }
  }

  // ---------- Espace admin ----------

  var EVENT_FIELDS = [
    { name: "date", type: "date", label: "admin.date", required: true },
    { name: "time", type: "time", label: "admin.time" },
    { name: "category", type: "select", label: "admin.category" },
    { name: "place", type: "text", label: "admin.place" },
    { name: "price", type: "text", label: "admin.price" },
    { name: "featured", type: "checkbox", label: "admin.featured" },
    { name: "title", type: "i18n", labels: { en: "editor.titleEn", fr: "editor.titleFr" } },
    { name: "description", type: "i18nText", labels: { en: "editor.descEn", fr: "editor.descFr" } }
  ];

  var AD_FIELDS = [
    { name: "advertiser", type: "text", label: "admin.advertiser" },
    { name: "slot", type: "select", label: "admin.slot" },
    { name: "startsOn", type: "date", label: "admin.startsOn" },
    { name: "endsOn", type: "date", label: "admin.endsOn" },
    { name: "active", type: "checkbox", label: "admin.active", full: true },
    { name: "title", type: "i18n", labels: { en: "editor.titleEn", fr: "editor.titleFr" } },
    { name: "text", type: "i18n", labels: { en: "admin.textEn", fr: "admin.textFr" } },
    { name: "cta", type: "i18n", labels: { en: "admin.ctaEn", fr: "admin.ctaFr" } },
    { name: "link", type: "text", label: "admin.link", full: true }
  ];

  function initAdmin() {
    if (!DB.enabled) return notEnabled();
    var state = { tab: "pending", listings: [], events: [], ads: [] };
    EVENT_FIELDS[2].options = EVENT_CATEGORIES.map(function (c) { return { value: c, label: t("cat." + c) }; });
    AD_FIELDS[1].options = ["home", "search"].map(function (s) { return { value: s, label: t("slot." + s) }; });

    DB.currentUser().then(function (u) {
      if (!u) { window.location.replace("login.html"); return null; }
      return DB.profile(u.id).then(function (p) { return p || {}; });
    }).then(function (p) {
      if (!p) return null;
      if (!p.is_admin) { root().innerHTML = '<p class="empty">' + esc(t("admin.denied")) + "</p>"; return null; }
      // Les visites de l'admin ne comptent pas dans les statistiques (sur cet appareil).
      YD.setNoStats(true);
      return Promise.all([DB.allListings(), DB.allEvents(), DB.allAds()]);
    }).then(function (res) {
      if (!res) return;
      state.listings = res[0];
      state.events = res[1];
      state.ads = res[2];
      draw();
    }).catch(showError);

    function pending() { return state.listings.filter(function (l) { return l.status === "pending"; }); }
    // Annonces en ligne pas encore visitées : il reste à passer les voir pour le badge « vérifié ».
    function toVisit() { return state.listings.filter(function (l) { return l.status === "published" && !l.verified; }); }

    function draw() {
      var tabs = [["pending", "admin.tabPending", pending().length], ["visit", "admin.tabToVisit", toVisit().length], ["listings", "admin.tabListings"], ["events", "admin.tabEvents"], ["ads", "admin.tabAds"], ["stats", "stats.tab"]];
      root().innerHTML =
        '<div class="space-head"><h1>' + esc(t("admin.title")) + '</h1><div class="space-actions">' +
          '<a class="btn btn-coral" href="account.html?new=1">' + esc(t("admin.addForHost")) + "</a>" +
          '<a class="btn btn-ghost" href="account.html">' + esc(t("nav.account")) + "</a></div></div>" +
        '<div class="tabs" role="toolbar">' + tabs.map(function (tab) {
          return '<button type="button" data-tab="' + tab[0] + '" aria-pressed="' + (state.tab === tab[0]) + '">' + esc(t(tab[1])) +
            (tab[2] ? ' <span class="count">' + tab[2] + "</span>" : "") + "</button>";
        }).join("") + "</div>" +
        '<div id="admin-panel"></div>';
      ({ pending: drawPending, visit: drawToVisit, listings: drawListings, events: drawEvents, ads: drawAds, stats: drawStats })[state.tab]();
    }

    function panel() { return document.getElementById("admin-panel"); }

    function replaceListing(saved) {
      state.listings = state.listings.map(function (x) { return x.id === saved.id ? saved : x; });
    }

    function drawPending() {
      var list = pending();
      if (!list.length) { panel().innerHTML = '<p class="empty">' + esc(t("admin.noPending")) + "</p>"; return; }
      panel().innerHTML = list.map(function (l) {
        return '<article class="card review-card" data-id="' + esc(l.id) + '"><div class="card-body">' +
          '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + esc(t("type." + l.type)) + " · " + l.guests + " " + esc(t("card.guests")) + YD.bedsText(l) + "</p>" +
          "<h3>" + YD.listingTextHtml(l.title) + "</h3>" +
          (l.createdAt ? '<p class="small muted review-meta">' + esc(t("admin.submittedOn", { date: YD.formatDate(l.createdAt.slice(0, 10), { day: "numeric", month: "long", year: "numeric" }) })) + "</p>" : "") +
          "<p>" + YD.listingTextHtml(l.description) + "</p>" +
          '<p class="price">' + YD.priceHtml(l) + "</p>" + YD.guestPricesHtml(l) +
          (l.photos.length ? YD.photoStrip(l.photos, 0, "thumbs") : "") +
          '<p class="small">' + esc(t("listing.host", { name: l.host.name })) + ' · <a href="https://wa.me/' + esc(l.host.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
          '<div class="form-actions"><a class="btn btn-ghost" href="account.html?edit=' + encodeURIComponent(l.id) + '">' + esc(t("account.edit")) + "</a>" +
            '<button type="button" class="btn btn-ghost" data-set="rejected">' + esc(t("admin.reject")) + "</button>" +
            '<button type="button" class="btn" data-set="published">' + esc(t("admin.approve")) + "</button></div>" +
        "</div></article>";
      }).join("");
      YD.refreshStrips(panel());
    }

    function drawToVisit() {
      var list = toVisit();
      if (!list.length) { panel().innerHTML = '<p class="empty">' + esc(t("admin.noToVisit")) + "</p>"; return; }
      panel().innerHTML = '<p class="muted">' + esc(t("admin.toVisitHelp")) + '</p><div class="space-list">' + list.map(function (l) {
        return '<article class="space-row" data-id="' + esc(l.id) + '">' +
          '<div class="space-thumb" style="--h:' + (l.hue || 190) + '">' + (l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" onerror="this.remove()">' : "") + "</div>" +
          '<div class="space-row-body"><h3><a href="listing.html?id=' + encodeURIComponent(l.id) + '">' + YD.listingTextHtml(l.title) + "</a></h3>" +
            '<p class="small muted">' + esc(t("area." + l.area)) + " · " + esc(l.host.name) + ' · <a href="https://wa.me/' + esc(l.host.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
            '<div class="space-row-actions"><button type="button" class="btn btn-small" data-verify>✓ ' + esc(t("admin.markVerified")) + "</button></div>" +
          "</div></article>";
      }).join("") + "</div>";
    }

    function drawListings() {
      if (!state.listings.length) { panel().innerHTML = '<p class="empty">' + esc(t("admin.empty")) + "</p>"; return; }
      panel().innerHTML = '<div class="space-list">' + state.listings.map(function (l) {
        return '<article class="space-row" data-id="' + esc(l.id) + '">' +
          '<div class="space-thumb" style="--h:' + (l.hue || 190) + '">' + (l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" onerror="this.remove()">' : "") + "</div>" +
          '<div class="space-row-body"><h3><a href="listing.html?id=' + encodeURIComponent(l.id) + '">' + YD.listingTextHtml(l.title) + "</a></h3>" +
            '<p class="small muted">' + esc(l.host.name) + ' · <a href="https://wa.me/' + esc(l.host.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
            '<div class="space-row-actions">' +
              '<select data-field="status" aria-label="' + esc(t("admin.status")) + '">' + ["pending", "published", "paused", "rejected"].map(function (s) {
                return '<option value="' + s + '"' + (s === l.status ? " selected" : "") + ">" + esc(t("status." + s)) + "</option>";
              }).join("") + "</select>" +
              '<label class="check"><input type="checkbox" data-field="verified"' + (l.verified ? " checked" : "") + "> " + esc(t("admin.verified")) + "</label>" +
              '<label class="check"><input type="checkbox" data-field="featured"' + (l.featured ? " checked" : "") + "> " + esc(t("admin.featured")) + "</label>" +
              '<a href="account.html?edit=' + encodeURIComponent(l.id) + '">' + esc(t("account.edit")) + "</a>" +
              '<button type="button" class="link-button" data-give-listing>' + esc(t("give.button")) + "</button>" +
              '<button type="button" class="link-button danger" data-delete-listing>' + esc(t("account.delete")) + "</button>" +
            "</div></div></article>";
      }).join("") + "</div>";
    }

    function drawEvents(editing) { drawCrud("events", EVENT_FIELDS, "admin.newEvent", editing, function (e) {
      return '<strong>' + esc(YD.formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })) + " " + esc(e.time) + "</strong> · " + YD.locHtml(e.title) +
        (e.featured ? ' <span class="badge badge-featured">★</span>' : "");
    }); }

    function drawAds(editing) { drawCrud("ads", AD_FIELDS, "admin.newAd", editing, function (a) {
      var today = new Date().toISOString().slice(0, 10);
      var running = a.active && (!a.startsOn || a.startsOn <= today) && (!a.endsOn || a.endsOn >= today);
      return "<strong>" + esc(a.advertiser || loc(a.title)) + "</strong> · " + esc(t("slot." + a.slot)) +
        (a.startsOn || a.endsOn ? " · " + esc(a.startsOn || "…") + " → " + esc(a.endsOn || "…") : "") +
        ' <span class="badge ' + (running ? "status-published" : "") + '">' + esc(t(running ? "admin.running" : "admin.notRunning")) + "</span>";
    }); }

    // ---------- Statistiques ----------

    var statsDays = 30;

    function drawStats() {
      panel().innerHTML = '<p class="empty">' + esc(t("common.loading")) + "</p>";
      DB.stats(statsDays).then(function (st) {
        if (state.tab !== "stats") return;
        panel().innerHTML = statsHtml(st);
      }, function (err) {
        // Table pas encore créée (supabase/stats.sql pas lancé).
        if (/stats_|site_stats|function/i.test(err && err.message || "")) {
          panel().innerHTML = '<p class="empty">' + esc(t("stats.notInstalled")) + "</p>";
        } else showError(err);
      });
    }

    function sum(rows, key) { return rows.reduce(function (n, r) { return n + Number(r[key] || 0); }, 0); }
    function num(n) { return Number(n || 0).toLocaleString(YD.lang() === "ar" ? "ar-EG" : YD.lang()); }
    function shortDate(iso) { return YD.formatDate(iso, { day: "numeric", month: "short" }); }

    function statsHtml(st) {
      var periods = [7, 30, 90].map(function (d) {
        return '<button type="button" data-stats-days="' + d + '" aria-pressed="' + (d === statsDays) + '">' + esc(t("stats.days", { n: d })) + "</button>";
      }).join("");
      var head = '<div class="tabs stats-periods" role="toolbar">' + periods + "</div>" +
        (st.since ? '<p class="small muted">' + esc(t("stats.since", { date: YD.formatDate(st.since.slice(0, 10), { day: "numeric", month: "long", year: "numeric" }) })) + "</p>" : "");
      if (!st.since) return head + '<p class="empty">' + esc(t("stats.noData")) + "</p>";

      // Tous les jours de la période, même ceux sans visite (le Caire = UTC+2/+3, on compte en dates locales).
      var byDay = {};
      st.daily.forEach(function (r) { byDay[r.day] = r; });
      var days = [];
      for (var i = statsDays - 1; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000);
        var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        days.push(byDay[iso] || { day: iso, visitors: 0, views: 0, whatsapp: 0, ad_clicks: 0 });
      }
      var max = Math.max.apply(null, days.map(function (r) { return Number(r.visitors); }).concat([1]));

      var tiles = [["visitors", "stats.visitors"], ["views", "stats.views"], ["whatsapp", "stats.whatsapp"], ["ad_clicks", "stats.adClicks"]].map(function (k) {
        return '<div class="stat-tile"><strong>' + num(sum(st.daily, k[0])) + "</strong><span>" + esc(t(k[1])) + "</span></div>";
      }).join("");

      var chart = '<figure class="stat-chart"><figcaption>' + esc(t("stats.chartTitle")) + "</figcaption>" +
        '<div class="stat-bars" style="--n:' + days.length + '">' + days.map(function (r) {
          var label = shortDate(r.day) + " · " + t("stats.chartTip", { visitors: num(r.visitors), views: num(r.views) });
          return '<div class="stat-bar" tabindex="0" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
            '<span style="height:' + (Number(r.visitors) / max * 100) + '%"></span></div>';
        }).join("") + "</div>" +
        '<div class="stat-axis small muted"><span>' + esc(shortDate(days[0].day)) + "</span><span>" + esc(t("stats.max", { n: num(max) })) + "</span><span>" + esc(shortDate(days[days.length - 1].day)) + "</span></div></figure>";

      // Annonces : vues de la fiche et clics WhatsApp, de la plus vue à la moins vue.
      var lstats = {};
      st.listings.forEach(function (r) { lstats[r.listing_id] = r; });
      var rows = state.listings.filter(function (l) { return l.status === "published" || lstats[l.id]; }).map(function (l) {
        var r = lstats[l.id] || {};
        return { l: l, views: Number(r.views || 0), whatsapp: Number(r.whatsapp || 0) };
      }).sort(function (a, b) { return b.views - a.views || b.whatsapp - a.whatsapp; });
      var listingTable = '<h2>' + esc(t("stats.listingsTitle")) + "</h2>" +
        '<div class="table-wrap"><table class="stat-table"><thead><tr><th>' + esc(t("stats.listing")) + "</th><th>" + esc(t("stats.listingViews")) + "</th><th>" + esc(t("stats.whatsapp")) + "</th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (x) {
          return '<tr><td><a href="listing.html?id=' + encodeURIComponent(x.l.id) + '">' + YD.listingTextHtml(x.l.title) + "</a>" +
            ' <span class="small muted">' + esc(x.l.host.name || "") + "</span></td><td>" + num(x.views) + "</td><td>" + num(x.whatsapp) + "</td></tr>";
        }).join("") : '<tr><td colspan="3" class="muted">' + esc(t("stats.noData")) + "</td></tr>") + "</tbody></table></div>";

      // Bannières : affichages, clics, taux de clic.
      var astats = {};
      st.ads.forEach(function (r) { astats[r.ad_id] = r; });
      var adRows = state.ads.filter(function (a) { return astats[a.id]; });
      var adTable = '<h2>' + esc(t("stats.adsTitle")) + "</h2>" + '<p class="small muted">' + esc(t("stats.adsHelp")) + "</p>" +
        '<div class="table-wrap"><table class="stat-table"><thead><tr><th>' + esc(t("admin.advertiser")) + "</th><th>" + esc(t("stats.adViews")) + "</th><th>" + esc(t("stats.adClicks")) + "</th><th>%</th></tr></thead><tbody>" +
        (adRows.length ? adRows.map(function (a) {
          var r = astats[a.id], v = Number(r.views), c = Number(r.clicks);
          return "<tr><td>" + esc(a.advertiser || loc(a.title)) + ' <span class="small muted">' + esc(t("slot." + a.slot)) + "</span></td><td>" + num(v) + "</td><td>" + num(c) + "</td><td>" +
            (v ? (c / v * 100).toFixed(1) + "%" : "–") + "</td></tr>";
        }).join("") : '<tr><td colspan="4" class="muted">' + esc(t("stats.noAds")) + "</td></tr>") + "</tbody></table></div>";

      // D'où viennent les visiteurs.
      var srcTable = '<h2>' + esc(t("stats.sourcesTitle")) + "</h2>" +
        '<div class="table-wrap"><table class="stat-table"><thead><tr><th>' + esc(t("stats.source")) + "</th><th>" + esc(t("stats.visitors")) + "</th></tr></thead><tbody>" +
        (st.sources.length ? st.sources.map(function (r) {
          return "<tr><td>" + (r.source === "direct" ? esc(t("stats.direct")) : "<bdi>" + esc(r.source) + "</bdi>") + "</td><td>" + num(r.visitors) + "</td></tr>";
        }).join("") : '<tr><td colspan="2" class="muted">' + esc(t("stats.noData")) + "</td></tr>") + "</tbody></table></div>";

      return head + '<div class="stat-tiles">' + tiles + "</div>" + chart + listingTable + adTable + srcTable +
        '<p class="small muted">' + esc(t("stats.privacy")) + "</p>";
    }

    // Liste + formulaire, partagé par l'agenda et les bannières.
    function drawCrud(kind, spec, newLabel, editing, summary) {
      var items = state[kind];
      var formHtml = editing
        ? '<form class="form-card" id="crud-form">' + fieldsHtml(spec, editing) +
            '<div class="full form-actions"><button type="button" class="btn btn-ghost" data-cancel>' + esc(t("editor.cancel")) + "</button>" +
            '<button class="btn" type="submit">' + esc(t("account.save")) + "</button></div></form>"
        : '<button type="button" class="btn btn-coral" data-new>+ ' + esc(t(newLabel)) + "</button>";
      panel().innerHTML = formHtml +
        '<div class="space-list crud-list">' + (items.length ? items.map(function (item) {
          return '<div class="crud-row" data-id="' + esc(item.id) + '"><span>' + summary(item) + "</span>" +
            '<span class="space-row-actions"><button type="button" class="link-button" data-edit>' + esc(t("account.edit")) + "</button>" +
            '<button type="button" class="link-button danger" data-remove-item>' + esc(t("account.delete")) + "</button></span></div>";
        }).join("") : '<p class="empty">' + esc(t("admin.empty")) + "</p>") + "</div>";

      var redraw = kind === "events" ? drawEvents : drawAds;
      var form = document.getElementById("crud-form");
      if (form) {
        form.scrollIntoView({ block: "start" });
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          if (!form.reportValidity()) return;
          var values = readFields(form, spec);
          values.id = editing.id;
          values.hue = editing.hue != null ? editing.hue : Math.floor(Math.random() * 360);
          busy(form, true);
          (kind === "events" ? DB.saveEvent(values) : DB.saveAd(values)).then(function (saved) {
            state[kind] = values.id
              ? state[kind].map(function (x) { return x.id === saved.id ? saved : x; })
              : [saved].concat(state[kind]);
            redraw();
          }, function (err) { busy(form, false); showError(err); });
        });
      }
      panel().onclick = function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var row = b.closest(".crud-row");
        var item = row && state[kind].filter(function (x) { return x.id === row.dataset.id; })[0];
        if (b.hasAttribute("data-new")) redraw(kind === "events" ? { date: "", category: "party", featured: false } : { slot: "home", active: true });
        if (b.hasAttribute("data-cancel")) redraw();
        if (b.hasAttribute("data-edit") && item) redraw(item);
        if (b.hasAttribute("data-remove-item") && item && window.confirm(t("account.confirmDelete"))) {
          (kind === "events" ? DB.deleteEvent(item.id) : DB.deleteAd(item.id)).then(function () {
            state[kind] = state[kind].filter(function (x) { return x !== item; });
            redraw();
          }, showError);
        }
      };
    }

    root().addEventListener("click", function (e) {
      var tab = e.target.closest("[data-tab]");
      if (tab) { state.tab = tab.dataset.tab; hideMessage(); draw(); return; }
      var period = e.target.closest("[data-stats-days]");
      if (period) { statsDays = Number(period.dataset.statsDays); drawStats(); return; }
      var card = e.target.closest("[data-id]");
      var zoom = e.target.closest("[data-photo]");
      if (zoom && card) {
        var shown = state.listings.filter(function (x) { return x.id === card.dataset.id; })[0];
        if (shown) YD.openLightbox(shown.photos, Number(zoom.dataset.photo), zoom);
        return;
      }
      var set = e.target.closest("[data-set]");
      if (set && card && state.tab === "pending") {
        DB.updateListing(card.dataset.id, { status: set.dataset.set }).then(function (saved) {
          replaceListing(saved);
          draw();
          if (saved.status === "published") showMessage(t("admin.approvedVisit"));
        }, showError);
      }
      if (e.target.closest("[data-verify]") && card) {
        DB.updateListing(card.dataset.id, { verified: true }).then(function (saved) { replaceListing(saved); hideMessage(); draw(); }, showError);
      }
      if (e.target.closest("[data-give-listing]") && card) {
        var l = state.listings.filter(function (x) { return x.id === card.dataset.id; })[0];
        var giving = l && giveToHost(l);
        if (giving) giving.then(function (saved) { replaceListing(saved); }, function () {});
      }
      if (e.target.closest("[data-delete-listing]") && card && window.confirm(t("account.confirmDelete"))) {
        DB.deleteListing(card.dataset.id).then(function () {
          state.listings = state.listings.filter(function (x) { return x.id !== card.dataset.id; });
          draw();
        }, showError);
      }
    });

    root().addEventListener("change", function (e) {
      var field = e.target.dataset.field;
      var row = e.target.closest(".space-row");
      if (!field || !row) return;
      var change = {};
      change[field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      DB.updateListing(row.dataset.id, change).then(function (saved) { replaceListing(saved); }, showError);
    });
  }

  YD.registerPage("login", initLogin);
  YD.registerPage("account", initAccount);
  YD.registerPage("admin", initAdmin);
})();
