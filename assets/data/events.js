// Événements d'exemple. Les dates sont relatives à aujourd'hui pour que l'agenda
// ne soit jamais vide pendant la démo. Pour un vrai événement, mettre une date fixe : date: "2026-11-14".
(function () {
  function inDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  window.YD_EVENTS = [
    {
      id: "full-moon-party", date: inDays(2), time: "22:00", category: "party",
      title: { en: "Full moon beach party", fr: "Soirée pleine lune sur la plage" },
      place: "Yalla Bar, Lighthouse", price: "200 EGP", featured: true, hue: 280,
      description: { en: "DJ sets until sunrise on the sand.", fr: "DJ sets jusqu'au lever du soleil sur le sable." }
    },
    {
      id: "sunrise-yoga", date: inDays(1), time: "06:30", category: "yoga",
      title: { en: "Sunrise yoga on the rooftop", fr: "Yoga au lever du soleil sur le rooftop" },
      place: "Assala rooftop", price: "150 EGP", featured: false, hue: 40,
      description: { en: "All levels, mats provided.", fr: "Tous niveaux, tapis fournis." }
    },
    {
      id: "blue-hole-dive", date: inDays(3), time: "08:00", category: "diving",
      title: { en: "Blue Hole & Bells guided dive", fr: "Plongée guidée Blue Hole & Bells" },
      place: "Eel Garden", price: "1 800 EGP", featured: true, hue: 200,
      description: { en: "Two dives, transport and lunch included. Advanced level.", fr: "Deux plongées, transport et déjeuner inclus. Niveau avancé." }
    },
    {
      id: "friday-market", date: inDays(5), time: "17:00", category: "market",
      title: { en: "Friday artisan market", fr: "Marché d'artisans du vendredi" },
      place: "Mashraba promenade", price: "Free", featured: false, hue: 20,
      description: { en: "Local crafts, jewellery and street food.", fr: "Artisanat local, bijoux et street food." }
    },
    {
      id: "live-music-night", date: inDays(6), time: "21:00", category: "music",
      title: { en: "Live Bedouin music night", fr: "Soirée musique bédouine live" },
      place: "Ralph's, Masbat", price: "100 EGP", featured: false, hue: 330,
      description: { en: "Oud, tabla and tea under the stars.", fr: "Oud, darbouka et thé sous les étoiles." }
    },
    {
      id: "freediving-workshop", date: inDays(9), time: "10:00", category: "workshop",
      title: { en: "Freediving discovery workshop", fr: "Atelier découverte de l'apnée" },
      place: "Lighthouse", price: "900 EGP", featured: false, hue: 185,
      description: { en: "Breathing, safety and your first dives to 10 m.", fr: "Respiration, sécurité et vos premières descentes à 10 m." }
    }
  ];
})();
