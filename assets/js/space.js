// Espace hôtes (connexion, « Mes annonces ») et espace admin. Fonctionne seulement
// quand la base Supabase est configurée dans config.js.
(function () {
  "use strict";

  var YD = window.YD;
  var DB = window.YD_DB;
  var t = YD.t, esc = YD.esc, loc = YD.loc;
  var MAX_PHOTOS = 12;
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
          var val = el[f.name + "_" + l].value.trim();
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
      if (profile.is_admin) showAdminAlert();
    }).catch(showError);

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

    function drawList() {
      var box = document.getElementById("my-listings");
      if (!listings.length) { box.innerHTML = '<p class="empty">' + esc(t("account.empty")) + "</p>"; return; }
      box.innerHTML = listings.map(function (l) {
        var cover = l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" onerror="this.remove()">' : "";
        var toggle = l.status === "published" ? ["paused", "account.pause"] : l.status === "paused" ? ["published", "account.resume"] : null;
        return '<article class="space-row" data-id="' + esc(l.id) + '">' +
          '<div class="space-thumb" style="--h:' + (l.hue || 190) + '">' + cover + "</div>" +
          '<div class="space-row-body"><h3>' + esc(loc(l.title)) + "</h3>" + statusBadge(l.status) +
            '<div class="space-row-actions">' +
              '<button type="button" class="link-button" data-action="edit">' + esc(t("account.edit")) + "</button>" +
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

    function drawEditor(existing) {
      var l = existing || {
        title: {}, description: {}, area: "", type: "", guests: 2, bedrooms: 1, currency: "EGP",
        pricePerNight: null, pricePerMonth: null, wifiMbps: null, amenities: [], photos: [],
        hue: Math.floor(Math.random() * 360)
      };
      var photos = l.photos.slice();
      root().innerHTML =
        '<a class="back" href="account.html">← ' + esc(t("account.myListings")) + "</a>" +
        '<form class="form-card" id="listing-form" novalidate>' +
          '<h1 class="full">' + esc(t(existing ? "editor.titleEdit" : "editor.titleNew")) + "</h1>" +
          (existing ? '<p class="full">' + statusBadge(existing.status) + "</p>" : "") +
          // Import rapide : on colle le lien Airbnb et le formulaire se remplit.
          (existing ? "" : '<div class="full import-box"><strong>' + esc(t("import.title")) + '</strong><p class="small muted">' + esc(t("import.help")) + "</p>" +
            '<div class="import-row"><input type="url" id="import-url" placeholder="https://www.airbnb.com/rooms/…" inputmode="url">' +
            '<button type="button" class="btn btn-coral" id="import-go">' + esc(t("import.button")) + "</button></div>" +
            '<span class="small muted" id="import-status"></span></div>') +
          // Anglais demandé (compris par tous les voyageurs) ; le français est un plus, replié par défaut.
          '<label class="full">' + esc(t("editor.title")) + '<input name="title_en" required value="' + esc(l.title.en || "") + '" placeholder="' + esc(t("editor.titlePlaceholder")) + '"></label>' +
          '<label class="full">' + esc(t("editor.desc")) + '<textarea name="description_en" required>' + esc(l.description.en || "") + "</textarea></label>" +
          '<p class="full small muted">' + esc(t("editor.langHelp")) + "</p>" +
          '<details class="full lang-extra"' + (l.title.fr || l.description.fr ? " open" : "") + "><summary>" + esc(t("editor.addFrench")) + "</summary>" +
            '<div class="lang-extra-body">' +
              "<label>" + esc(t("editor.titleFr")) + '<input name="title_fr" value="' + esc(l.title.fr || "") + '"></label>' +
              "<label>" + esc(t("editor.descFr")) + '<textarea name="description_fr">' + esc(l.description.fr || "") + "</textarea></label>" +
            "</div></details>" +
          "<label>" + esc(t("search.area")) + '<select name="area" required>' + YD.optionList(YD.AREAS, "area.", "—") + "</select></label>" +
          "<label>" + esc(t("search.type")) + '<select name="type" required>' + YD.optionList(YD.TYPES, "type.", "—") + "</select></label>" +
          "<label>" + esc(t("host.guests")) + '<input name="guests" type="number" min="1" required value="' + esc(l.guests) + '"></label>' +
          "<label>" + esc(t("host.bedrooms")) + '<input name="bedrooms" type="number" min="0" required value="' + esc(l.bedrooms) + '"></label>' +
          "<label>" + esc(t("editor.currency")) + '<select name="currency"><option value="EGP">EGP</option><option value="USD">USD ($)</option></select></label>' +
          "<label>" + esc(t("host.wifi")) + '<input name="wifi" type="number" min="0" value="' + esc(l.wifiMbps == null ? "" : l.wifiMbps) + '"></label>' +
          "<label>" + esc(t("host.priceNight")).replace("(EGP)", "") + '<input name="priceNight" type="number" min="0" value="' + esc(l.pricePerNight == null ? "" : l.pricePerNight) + '"></label>' +
          "<label>" + esc(t("host.priceMonth")).replace("EGP, ", "") + '<input name="priceMonth" type="number" min="0" value="' + esc(l.pricePerMonth == null ? "" : l.pricePerMonth) + '"></label>' +
          '<div class="full"><label>' + esc(t("host.amenities")) + '</label><div class="checks">' + YD.AMENITIES.map(function (a) {
            return '<label class="check"><input type="checkbox" name="amenities" value="' + a + '"' + (l.amenities.indexOf(a) !== -1 ? " checked" : "") + "> " + esc(t("amenity." + a)) + "</label>";
          }).join("") + "</div></div>" +
          '<div class="full"><label>' + esc(t("editor.photos")) + '</label><p class="small muted">' + esc(t("editor.photosHelp")) + "</p>" +
            '<div class="photo-grid" id="photo-grid"></div>' +
            '<label class="btn btn-ghost file-button">+ ' + esc(t("editor.addPhotos")) + '<input type="file" id="photo-input" accept="image/*" multiple hidden></label>' +
            '<span class="small muted" id="upload-status"></span></div>' +
          // Synchronisation : lien « Exporter le calendrier » d'Airbnb, lu toutes les heures.
          '<div class="full calendar-field"><label>' + esc(t("cal.label")) +
            '<input name="ical" type="url" inputmode="url" placeholder="https://www.airbnb.com/calendar/ical/….ics?s=…"></label>' +
            '<details class="small muted"><summary>' + esc(t("cal.how")) + "</summary><ol>" +
              ["cal.step1", "cal.step2", "cal.step3"].map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("") + "</ol></details>" +
            '<p class="small" id="cal-status"></p></div>' +
          '<div class="full form-actions"><a class="btn btn-ghost" href="account.html">' + esc(t("editor.cancel")) + "</a>" +
            '<button class="btn" type="submit">' + esc(t(existing ? "editor.submitEdit" : "editor.submitNew")) + "</button></div>" +
        "</form>";

      var form = document.getElementById("listing-form");
      form.elements.area.value = l.area;
      var calendarBefore = "";
      if (existing) DB.calendarOf(existing.id).then(function (cal) {
        if (!cal) return;
        calendarBefore = cal.ical_url;
        form.elements.ical.value = cal.ical_url;
        document.getElementById("cal-status").textContent = cal.last_error
          ? t("cal.error")
          : cal.last_sync ? t("cal.synced", { date: new Date(cal.last_sync).toLocaleString(YD.lang()) }) : "";
      }, console.error);
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
          if (r.type && YD.TYPES.indexOf(r.type) !== -1) f.type.value = r.type;
          photos = photos.concat(r.photos || []).slice(0, MAX_PHOTOS);
          drawPhotos();
          status.textContent = "";
          showMessage(t("import.done", { count: (r.photos || []).length }));
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
        if (!form.reportValidity()) return;
        var f = form.elements;
        var data = {
          id: existing && existing.id,
          title: text.title, description: text.description,
          area: f.area.value, type: f.type.value,
          guests: Number(f.guests.value), bedrooms: Number(f.bedrooms.value),
          currency: f.currency.value,
          pricePerNight: numberOrNull(f.priceNight.value), pricePerMonth: numberOrNull(f.priceMonth.value),
          wifiMbps: numberOrNull(f.wifi.value),
          amenities: Array.prototype.map.call(form.querySelectorAll('[name="amenities"]:checked'), function (c) { return c.value; }),
          photos: photos, hue: l.hue,
          host: { name: profile.name, whatsapp: profile.whatsapp }
        };
        busy(form, true);
        var ical = f.ical.value.trim();
        if (ical && !/^https:\/\//.test(ical)) { busy(form, false); showMessage(t("cal.badUrl"), true); return; }
        DB.saveListing(data).then(function (saved) {
          // Le calendrier ne bloque pas l'enregistrement de l'annonce : en cas d'erreur, on le signale seulement.
          if (ical !== calendarBefore) DB.saveCalendar(saved.id, ical).catch(function (err) { console.error(err); showMessage(t("cal.error"), true); });
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
      var tabs = [["pending", "admin.tabPending", pending().length], ["visit", "admin.tabToVisit", toVisit().length], ["listings", "admin.tabListings"], ["events", "admin.tabEvents"], ["ads", "admin.tabAds"]];
      root().innerHTML =
        '<div class="space-head"><h1>' + esc(t("admin.title")) + '</h1><a class="btn btn-ghost" href="account.html">' + esc(t("nav.account")) + "</a></div>" +
        '<div class="tabs" role="toolbar">' + tabs.map(function (tab) {
          return '<button type="button" data-tab="' + tab[0] + '" aria-pressed="' + (state.tab === tab[0]) + '">' + esc(t(tab[1])) +
            (tab[2] ? ' <span class="count">' + tab[2] + "</span>" : "") + "</button>";
        }).join("") + "</div>" +
        '<div id="admin-panel"></div>';
      ({ pending: drawPending, visit: drawToVisit, listings: drawListings, events: drawEvents, ads: drawAds })[state.tab]();
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
          '<p class="card-meta">' + esc(t("area." + l.area)) + " · " + esc(t("type." + l.type)) + " · " + l.guests + " " + esc(t("card.guests")) + "</p>" +
          "<h3>" + esc(loc(l.title)) + "</h3>" +
          (l.createdAt ? '<p class="small muted review-meta">' + esc(t("admin.submittedOn", { date: YD.formatDate(l.createdAt.slice(0, 10), { day: "numeric", month: "long", year: "numeric" }) })) + "</p>" : "") +
          "<p>" + esc(loc(l.description)) + "</p>" +
          '<p class="price">' + (l.pricePerNight ? YD.money(l.pricePerNight, l.currency) + " / " + esc(t("card.night")) : esc(t("card.onRequest"))) +
            (l.pricePerMonth ? " · " + YD.money(l.pricePerMonth, l.currency) + " / " + esc(t("card.month")) : "") + "</p>" +
          '<div class="thumbs">' + l.photos.map(function (src) { return '<img src="' + esc(src) + '" alt="">'; }).join("") + "</div>" +
          '<p class="small">' + esc(t("listing.host", { name: l.host.name })) + ' · <a href="https://wa.me/' + esc(l.host.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
          '<div class="form-actions"><button type="button" class="btn btn-ghost" data-set="rejected">' + esc(t("admin.reject")) + "</button>" +
            '<button type="button" class="btn" data-set="published">' + esc(t("admin.approve")) + "</button></div>" +
        "</div></article>";
      }).join("");
    }

    function drawToVisit() {
      var list = toVisit();
      if (!list.length) { panel().innerHTML = '<p class="empty">' + esc(t("admin.noToVisit")) + "</p>"; return; }
      panel().innerHTML = '<p class="muted">' + esc(t("admin.toVisitHelp")) + '</p><div class="space-list">' + list.map(function (l) {
        return '<article class="space-row" data-id="' + esc(l.id) + '">' +
          '<div class="space-thumb" style="--h:' + (l.hue || 190) + '">' + (l.photos[0] ? '<img src="' + esc(l.photos[0]) + '" alt="" onerror="this.remove()">' : "") + "</div>" +
          '<div class="space-row-body"><h3><a href="listing.html?id=' + encodeURIComponent(l.id) + '">' + esc(loc(l.title)) + "</a></h3>" +
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
          '<div class="space-row-body"><h3><a href="listing.html?id=' + encodeURIComponent(l.id) + '">' + esc(loc(l.title)) + "</a></h3>" +
            '<p class="small muted">' + esc(l.host.name) + ' · <a href="https://wa.me/' + esc(l.host.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a></p>' +
            '<div class="space-row-actions">' +
              '<select data-field="status" aria-label="' + esc(t("admin.status")) + '">' + ["pending", "published", "paused", "rejected"].map(function (s) {
                return '<option value="' + s + '"' + (s === l.status ? " selected" : "") + ">" + esc(t("status." + s)) + "</option>";
              }).join("") + "</select>" +
              '<label class="check"><input type="checkbox" data-field="verified"' + (l.verified ? " checked" : "") + "> " + esc(t("admin.verified")) + "</label>" +
              '<label class="check"><input type="checkbox" data-field="featured"' + (l.featured ? " checked" : "") + "> " + esc(t("admin.featured")) + "</label>" +
              '<button type="button" class="link-button danger" data-delete-listing>' + esc(t("account.delete")) + "</button>" +
            "</div></div></article>";
      }).join("") + "</div>";
    }

    function drawEvents(editing) { drawCrud("events", EVENT_FIELDS, "admin.newEvent", editing, function (e) {
      return '<strong>' + esc(YD.formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })) + " " + esc(e.time) + "</strong> · " + esc(loc(e.title)) +
        (e.featured ? ' <span class="badge badge-featured">★</span>' : "");
    }); }

    function drawAds(editing) { drawCrud("ads", AD_FIELDS, "admin.newAd", editing, function (a) {
      var today = new Date().toISOString().slice(0, 10);
      var running = a.active && (!a.startsOn || a.startsOn <= today) && (!a.endsOn || a.endsOn >= today);
      return "<strong>" + esc(a.advertiser || loc(a.title)) + "</strong> · " + esc(t("slot." + a.slot)) +
        (a.startsOn || a.endsOn ? " · " + esc(a.startsOn || "…") + " → " + esc(a.endsOn || "…") : "") +
        ' <span class="badge ' + (running ? "status-published" : "") + '">' + esc(t(running ? "admin.running" : "admin.notRunning")) + "</span>";
    }); }

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
      var card = e.target.closest("[data-id]");
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
