// Annonces. Les deux premières sont les vraies annonces de Dar Bahr ; les suivantes sont des exemples.
// area : lighthouse | mashraba | masbat | assala | eel-garden | lagoon | blue-hole-road
// type : studio | apartment | villa | room
// pricePerNight / pricePerMonth : mettre null pour afficher « Prix sur demande ».
// photos : liste d'adresses d'images (facultatif ; sans photo, une illustration est affichée).
window.YD_LISTINGS = [
  {
    id: "dar-bahr-coral",
    title: { en: "Dar Bahr · Coral: sea view, hammock and fast wifi", fr: "Dar Bahr · Coral : vue mer, hamac et wifi rapide" },
    description: {
      en: "Dar Bahr, \"the House of the Sea\", is a small boho-chic building of three apartments facing the Red Sea, in the quiet Bedouin area of Assala, one minute from the beach and two from the market. This first-floor apartment has a sea-view living room with a hammock nook, a proper workspace with wifi tested at 50 Mbps and backup power, a queen bed, a fully equipped kitchen, air conditioning and a washing machine. Ideal for remote workers, divers and snorkellers. Discounts for weekly and monthly stays. Pets welcome, self check-in. Under Egyptian law, unmarried couples where one partner is Egyptian cannot be hosted.",
      fr: "Dar Bahr, « la Maison de la Mer », est un petit immeuble bohème de trois appartements face à la mer Rouge, dans le quartier bédouin calme d'Assala, à une minute de la plage et deux du marché. Cet appartement au premier étage a un salon vue mer avec coin hamac, un vrai espace de travail avec wifi testé à 50 Mb/s et secours électrique, un lit queen size, une cuisine équipée, la climatisation et un lave-linge. Idéal pour télétravailleurs, plongeurs et amateurs de snorkeling. Réductions à la semaine et au mois. Animaux bienvenus, arrivée autonome. Selon la loi égyptienne, les couples non mariés dont l'un est égyptien ne peuvent pas être accueillis."
    },
    area: "assala", type: "apartment", guests: 2, bedrooms: 1,
    pricePerNight: null, pricePerMonth: null, wifiMbps: 50,
    amenities: ["wifi", "workspace", "seaView", "beachAccess", "hammock", "ac", "kitchen", "washer", "backupPower", "pets", "selfCheckin"],
    photos: [
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/ccf1db38-8aa1-411e-b008-34ba1987b687.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/998c9bb2-392f-4f64-b762-71eb7f35553c.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/a65ab5a3-88d4-4f9f-8f8f-bc8e7d6535cd.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/d498c3ed-5aa5-4717-94f2-148a14ff788e.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/f7c83674-20cb-42d9-91fa-5c3a19cef4a9.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/f0077d4a-5623-4bf3-86fe-e2eedba1ec67.jpeg?im_w=1200"
    ],
    hue: 190, verified: true, featured: true,
    host: { name: "Salomé", whatsapp: "33659213813" }
  },
  {
    id: "dar-bahr-horizon",
    title: { en: "Dar Bahr · Horizon: sea and mountain view rooftop", fr: "Dar Bahr · Horizon : rooftop vue mer et montagne" },
    description: {
      en: "Recently renovated top-floor studio in Dar Bahr, Assala, one minute from the beach and close to the dive and snorkel spots. Double bed, wooden walls and a sea-view window. Its big private rooftop terrace has a panoramic view of the sea and the mountains, a Bedouin lounge with cushions, and a table for breakfast or working outside. Fridge, hot water, 50 Mbps wifi, air conditioning. Sleeps up to 4 with the extra floor mattress. Discounts for weekly and monthly stays, self check-in. Under Egyptian law, unmarried couples where one partner is Egyptian cannot be hosted.",
      fr: "Studio rénové au dernier étage de Dar Bahr, à Assala, à une minute de la plage et près des spots de plongée et de snorkeling. Lit double, murs en bois et fenêtre vue mer. Sa grande terrasse privée sur le toit offre une vue panoramique sur la mer et les montagnes, avec un salon bédouin et ses coussins, et une table pour le petit-déjeuner ou travailler dehors. Réfrigérateur, eau chaude, wifi 50 Mb/s, climatisation. Jusqu'à 4 personnes avec le matelas d'appoint. Réductions à la semaine et au mois, arrivée autonome. Selon la loi égyptienne, les couples non mariés dont l'un est égyptien ne peuvent pas être accueillis."
    },
    area: "assala", type: "studio", guests: 4, bedrooms: 1,
    pricePerNight: null, pricePerMonth: null, wifiMbps: 50,
    amenities: ["wifi", "seaView", "rooftop", "terrace", "beachAccess", "ac", "kitchen", "washer", "pets", "selfCheckin"],
    photos: [
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/53c35449-a26b-41ea-8e17-8520fb69957f.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/e5fa79b0-acba-40c6-879b-dfeee324ddfe.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/ca0daf2d-0010-4599-ac67-74121072668f.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/e7def9ce-b744-4bdd-b882-802354f8e146.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/a2debf9b-9d05-4e57-a8c0-5d68f4ba3276.jpeg?im_w=1200",
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/201c7022-0122-4b09-b9a1-fdd20f8b64a9.jpeg?im_w=1200"
    ],
    hue: 30, verified: true, featured: true,
    host: { name: "Salomé", whatsapp: "33659213813" }
  },
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
    hue: 190, verified: true, featured: false,
    host: { name: "Leila", whatsapp: "201000000006" }
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
    hue: 140, verified: true, featured: false,
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
