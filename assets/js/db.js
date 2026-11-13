// Accès aux données : la base Supabase si elle est configurée dans config.js,
// sinon les fichiers de assets/data/.
(function () {
  "use strict";

  var CONFIG = window.YD_CONFIG;
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  var PHOTO_BUCKET = "listing-photos";
  var enabled = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  var clientPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  function client() {
    if (!enabled) return Promise.reject(new Error("Supabase is not configured"));
    if (!clientPromise) {
      clientPromise = (window.supabase ? Promise.resolve() : loadScript(SDK_URL)).then(function () {
        return window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
      });
    }
    return clientPromise;
  }

  function data(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  // ---------- Conversion entre la base et le format des fichiers ----------

  function listingFromRow(r) {
    return {
      id: r.id, ownerId: r.owner_id, status: r.status,
      title: r.title || {}, description: r.description || {},
      area: r.area, type: r.type, guests: r.guests, bedrooms: r.bedrooms, beds: r.beds,
      pricePerNight: r.price_night, pricePerWeek: r.price_week, pricePerMonth: r.price_month, currency: r.currency,
      pricesByGuests: r.price_by_guests || null,
      wifiMbps: r.wifi_mbps, amenities: r.amenities || [], photos: r.photos || [],
      hue: r.hue, verified: r.verified, featured: r.featured,
      host: { name: r.host_name, whatsapp: r.host_whatsapp },
      createdAt: r.created_at
    };
  }

  function listingToRow(l) {
    return {
      title: l.title, description: l.description, area: l.area, type: l.type,
      guests: l.guests, bedrooms: l.bedrooms, beds: l.beds,
      price_night: l.pricePerNight, price_week: l.pricePerWeek, price_month: l.pricePerMonth, currency: l.currency || "EGP",
      price_by_guests: l.pricesByGuests || null,
      wifi_mbps: l.wifiMbps, amenities: l.amenities || [], photos: l.photos || [],
      hue: l.hue, host_name: l.host.name, host_whatsapp: l.host.whatsapp
    };
  }

  // Les événements et bannières ont les mêmes champs dans la base et dans les fichiers.
  function adFromRow(r) {
    return {
      id: r.id, slot: r.slot, active: r.active, startsOn: r.starts_on, endsOn: r.ends_on,
      title: r.title, text: r.text, cta: r.cta, link: r.link, hue: r.hue, advertiser: r.advertiser
    };
  }
  function adToRow(a) {
    return {
      slot: a.slot, active: a.active, starts_on: a.startsOn || null, ends_on: a.endsOn || null,
      title: a.title, text: a.text, cta: a.cta, link: a.link, hue: a.hue, advertiser: a.advertiser
    };
  }

  // ---------- Lecture publique ----------

  function load() {
    if (!enabled) {
      return Promise.resolve({ listings: window.YD_LISTINGS || [], events: window.YD_EVENTS || [], ads: window.YD_ADS || [] });
    }
    return client().then(function (sb) {
      return Promise.all([
        sb.from("listings").select("*").eq("status", "published").order("created_at"),
        sb.from("events").select("*").gte("date", today()).order("date"),
        sb.from("ads").select("*")
      ]);
    }).then(function (res) {
      var t = today();
      return {
        listings: data(res[0]).map(listingFromRow),
        events: data(res[1]),
        // Un admin connecté reçoit toutes les bannières : on ne garde que celles en cours.
        ads: data(res[2]).map(adFromRow).filter(function (a) {
          return a.active && (!a.startsOn || a.startsOn <= t) && (!a.endsOn || a.endsOn >= t);
        })
      };
    });
  }

  // ---------- Compte ----------

  function currentUser() {
    return client().then(function (sb) { return sb.auth.getSession(); }).then(function (res) {
      var session = data(res).session;
      return session ? session.user : null;
    });
  }

  function signIn(email, redirectTo) {
    return client().then(function (sb) {
      return sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectTo } });
    }).then(data);
  }

  // Code à 6 chiffres reçu dans l'email de connexion : se connecter sans quitter la page.
  function verifyCode(email, code) {
    return client().then(function (sb) {
      return sb.auth.verifyOtp({ email: email, token: code, type: "email" });
    }).then(data);
  }

  // Prévient quand la connexion se fait dans un autre onglet (lien de l'email ouvert ailleurs).
  function onSignedIn(callback) {
    window.addEventListener("storage", function (e) {
      if (!e.key || e.key.indexOf("sb-") !== 0) return;
      currentUser().then(function (user) { if (user) callback(user); });
    });
  }

  function signOut() {
    return client().then(function (sb) { return sb.auth.signOut(); });
  }

  function profile(userId) {
    return client().then(function (sb) {
      return sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    }).then(data);
  }

  function saveProfile(userId, fields) {
    return client().then(function (sb) {
      return sb.from("profiles").update(fields).eq("id", userId).select().single();
    }).then(data);
  }

  // ---------- Annonces ----------

  function myListings(userId) {
    return client().then(function (sb) {
      return sb.from("listings").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
    }).then(function (res) { return data(res).map(listingFromRow); });
  }

  function allListings() {
    return client().then(function (sb) {
      return sb.from("listings").select("*").order("created_at", { ascending: false });
    }).then(function (res) { return data(res).map(listingFromRow); });
  }

  function getListing(id) {
    return client().then(function (sb) {
      return sb.from("listings").select("*").eq("id", id).single();
    }).then(function (res) { return listingFromRow(data(res)); });
  }

  function saveListing(l) {
    var row = listingToRow(l);
    // Annonce créée par l'admin pour un hôte : elle est à elle et en ligne tout de suite
    // (la base ignore ces deux champs pour les autres comptes).
    if (!l.id && l.ownerId) row.owner_id = l.ownerId;
    if (!l.id && l.status) row.status = l.status;
    return client().then(function (sb) {
      var q = l.id ? sb.from("listings").update(row).eq("id", l.id) : sb.from("listings").insert(row);
      return q.select().single();
    }).then(function (res) { return listingFromRow(data(res)); });
  }

  // Nombre d'annonces en attente de validation (seule l'admin les voit toutes).
  function pendingCount() {
    return client().then(function (sb) {
      return sb.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending");
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.count || 0;
    });
  }

  // Lit une annonce Airbnb (fonction import-airbnb) : titre, description, voyageurs, chambres, photos.
  function importAirbnb(url) {
    return client().then(function (sb) {
      return sb.functions.invoke("import-airbnb", { body: { url: url } });
    }).then(function (res) {
      if (res.error) {
        // Le message d'erreur de la fonction est dans la réponse.
        var ctx = res.error.context;
        return ctx && ctx.json ? ctx.json().then(function (b) { throw new Error(b.error || res.error.message); }) : Promise.reject(res.error);
      }
      return res.data;
    });
  }

  // Admin : donne une annonce au compte de l'hôte (fonction give_listing, supabase/give-listing.sql).
  function giveListing(id, email) {
    return client().then(function (sb) {
      return sb.rpc("give_listing", { listing_id: id, host_email: email });
    }).then(function (res) { return listingFromRow(data(res)); });
  }

  // fields : colonnes de la base, ex. { status: "published", verified: true }
  function updateListing(id, fields) {
    return client().then(function (sb) {
      return sb.from("listings").update(fields).eq("id", id).select().single();
    }).then(function (res) { return listingFromRow(data(res)); });
  }

  function deleteListing(id) {
    return client().then(function (sb) { return sb.from("listings").delete().eq("id", id); }).then(data);
  }

  function uploadPhoto(userId, blob) {
    var path = userId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    return client().then(function (sb) {
      return sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" })
        .then(data)
        .then(function () { return sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl; });
    });
  }

  // ---------- Agenda et bannières (admin) ----------

  function allEvents() {
    return client().then(function (sb) { return sb.from("events").select("*").order("date", { ascending: false }); }).then(data);
  }
  function saveEvent(e) {
    var row = { date: e.date, time: e.time, category: e.category, title: e.title, description: e.description,
      place: e.place, price: e.price, featured: e.featured, hue: e.hue };
    return client().then(function (sb) {
      return (e.id ? sb.from("events").update(row).eq("id", e.id) : sb.from("events").insert(row)).select().single();
    }).then(data);
  }
  function deleteEvent(id) {
    return client().then(function (sb) { return sb.from("events").delete().eq("id", id); }).then(data);
  }

  function allAds() {
    return client().then(function (sb) { return sb.from("ads").select("*").order("created_at", { ascending: false }); })
      .then(function (res) { return data(res).map(adFromRow); });
  }
  function saveAd(a) {
    return client().then(function (sb) {
      return (a.id ? sb.from("ads").update(adToRow(a)).eq("id", a.id) : sb.from("ads").insert(adToRow(a))).select().single();
    }).then(function (res) { return adFromRow(data(res)); });
  }
  function deleteAd(id) {
    return client().then(function (sb) { return sb.from("ads").delete().eq("id", id); }).then(data);
  }

  // ---------- Statistiques (supabase/stats.sql) ----------

  // Envoie des événements anonymes (pages vues, clics). keepalive : l'envoi continue
  // même si le visiteur quitte la page juste après le clic. Une erreur ne gêne jamais la visite.
  function track(rows) {
    if (!enabled || !rows.length || !window.fetch) return;
    try {
      fetch(CONFIG.supabaseUrl + "/rest/v1/site_stats", {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: CONFIG.supabaseAnonKey,
          Authorization: "Bearer " + CONFIG.supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(rows)
      }).catch(function () {});
    } catch (e) {}
  }

  function rpc(name, args) {
    return client().then(function (sb) { return sb.rpc(name, args); }).then(data);
  }

  // Tous les chiffres de la page Statistiques de l'admin, sur les `days` derniers jours.
  function stats(days) {
    return Promise.all([
      rpc("stats_daily", { days: days }), rpc("stats_listings", { days: days }),
      rpc("stats_ads", { days: days }), rpc("stats_sources", { days: days }), rpc("stats_since")
    ]).then(function (r) { return { daily: r[0] || [], listings: r[1] || [], ads: r[2] || [], sources: r[3] || [], since: r[4] }; });
  }

  // Vues et clics WhatsApp des annonces de l'hôte connecté.
  function listingStats(days) { return rpc("stats_listings", { days: days }); }

  window.YD_DB = {
    enabled: enabled,
    load: load,
    currentUser: currentUser, signIn: signIn, verifyCode: verifyCode, onSignedIn: onSignedIn, signOut: signOut,
    profile: profile, saveProfile: saveProfile,
    myListings: myListings, allListings: allListings, getListing: getListing, pendingCount: pendingCount, importAirbnb: importAirbnb, saveListing: saveListing,
    updateListing: updateListing, giveListing: giveListing, deleteListing: deleteListing, uploadPhoto: uploadPhoto,
    allEvents: allEvents, saveEvent: saveEvent, deleteEvent: deleteEvent,
    allAds: allAds, saveAd: saveAd, deleteAd: deleteAd,
    track: track, stats: stats, listingStats: listingStats
  };
})();
