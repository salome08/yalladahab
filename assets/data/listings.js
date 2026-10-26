// Annonces d'exemple. Remplacer par les vraies annonces des hôtes.
// area : lighthouse | mashraba | masbat | assala | eel-garden | lagoon | blue-hole-road
// type : studio | apartment | villa | room
window.YD_LISTINGS = [
  {
    id: "lighthouse-sea-studio",
    title: { en: "Sea-view studio by the Lighthouse", fr: "Studio vue mer près du Lighthouse" },
    description: {
      en: "Bright studio two minutes from the Lighthouse reef. Private terrace facing the sea, fast fibre wifi and a proper desk. Perfect for divers and remote workers.",
      fr: "Studio lumineux à deux minutes du récif du Lighthouse. Terrasse privée face à la mer, wifi fibre rapide et vrai bureau. Idéal pour plongeurs et télétravailleurs."
    },
    area: "lighthouse", type: "studio", guests: 2, bedrooms: 1,
    pricePerNight: 900, pricePerMonth: 18000, wifiMbps: 50,
    amenities: ["wifi", "workspace", "seaView", "ac", "kitchen", "terrace"],
    hue: 190, verified: true, featured: true,
    host: { name: "Salomé", whatsapp: "201000000000" }
  },
  {
    id: "mashraba-garden-apartment",
    title: { en: "Garden apartment in Mashraba", fr: "Appartement avec jardin à Mashraba" },
    description: {
      en: "Quiet two-bedroom apartment with a shaded Bedouin-style garden, a short walk from the promenade, cafés and the supermarket.",
      fr: "Appartement calme de deux chambres avec jardin ombragé façon bédouine, à quelques pas de la promenade, des cafés et du supermarché."
    },
    area: "mashraba", type: "apartment", guests: 4, bedrooms: 2,
    pricePerNight: 1200, pricePerMonth: 22000, wifiMbps: 30,
    amenities: ["wifi", "kitchen", "ac", "garden", "washer"],
    hue: 140, verified: true, featured: true,
    host: { name: "Omar", whatsapp: "201000000001" }
  },
  {
    id: "assala-budget-room",
    title: { en: "Cosy room in Assala", fr: "Chambre douillette à Assala" },
    description: {
      en: "Simple private room in a shared house with other travellers, rooftop with mountain view. The cheapest way to stay longer in Dahab.",
      fr: "Chambre privée simple dans une maison partagée entre voyageurs, rooftop avec vue sur la montagne. Le moyen le moins cher de rester longtemps à Dahab."
    },
    area: "assala", type: "room", guests: 1, bedrooms: 1,
    pricePerNight: 350, pricePerMonth: 7000, wifiMbps: 20,
    amenities: ["wifi", "kitchen", "rooftop"],
    hue: 30, verified: false, featured: false,
    host: { name: "Mona", whatsapp: "201000000002" }
  },
  {
    id: "eel-garden-villa",
    title: { en: "Villa with pool near Eel Garden", fr: "Villa avec piscine près d'Eel Garden" },
    description: {
      en: "Three-bedroom villa with private pool, ten minutes' walk to Eel Garden snorkelling spot. Great for families and groups of friends.",
      fr: "Villa de trois chambres avec piscine privée, à dix minutes à pied du spot de snorkeling d'Eel Garden. Parfaite pour familles et groupes d'amis."
    },
    area: "eel-garden", type: "villa", guests: 6, bedrooms: 3,
    pricePerNight: 3500, pricePerMonth: 65000, wifiMbps: 40,
    amenities: ["wifi", "pool", "kitchen", "ac", "parking", "washer", "terrace"],
    hue: 210, verified: true, featured: true,
    host: { name: "Karim", whatsapp: "201000000003" }
  },
  {
    id: "lagoon-kite-apartment",
    title: { en: "Kite-surfer flat at the Lagoon", fr: "Appartement kitesurf au Lagon" },
    description: {
      en: "One-bedroom flat facing the Lagoon, with storage for your kite gear and an outdoor shower. Kite schools are right on the beach.",
      fr: "Appartement d'une chambre face au Lagon, avec rangement pour le matériel de kite et douche extérieure. Les écoles de kite sont sur la plage."
    },
    area: "lagoon", type: "apartment", guests: 2, bedrooms: 1,
    pricePerNight: 1000, pricePerMonth: 19000, wifiMbps: 25,
    amenities: ["wifi", "seaView", "kitchen", "ac", "gearStorage"],
    hue: 170, verified: false, featured: false,
    host: { name: "Nadia", whatsapp: "201000000004" }
  },
  {
    id: "masbat-nomad-loft",
    title: { en: "Digital nomad loft in Masbat", fr: "Loft pour nomades numériques à Masbat" },
    description: {
      en: "Modern loft above the bay with tested 100 Mbps fibre, backup power for internet and an ergonomic chair. Monthly stays preferred.",
      fr: "Loft moderne au-dessus de la baie avec fibre testée à 100 Mb/s, secours électrique pour internet et chaise ergonomique. Séjours au mois de préférence."
    },
    area: "masbat", type: "studio", guests: 2, bedrooms: 1,
    pricePerNight: 1100, pricePerMonth: 20000, wifiMbps: 100,
    amenities: ["wifi", "workspace", "backupPower", "ac", "kitchen", "seaView"],
    hue: 260, verified: true, featured: false,
    host: { name: "Yara", whatsapp: "201000000005" }
  }
];
