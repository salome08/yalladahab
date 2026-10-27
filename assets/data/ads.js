// Bannières publicitaires. slot : "home" (accueil) ou "search" (résultats et agenda).
// Mettre active: false quand la semaine payée est terminée.
window.YD_ADS = [
  {
    id: "yalla-bar", slot: "home", active: true, hue: 280,
    title: { en: "Full moon party at Yalla Bar", fr: "Soirée pleine lune au Yalla Bar" },
    text: { en: "This Saturday · DJ sets on the beach · First drink free before 11pm", fr: "Ce samedi · DJ sets sur la plage · Premier verre offert avant 23h" },
    cta: { en: "See the event", fr: "Voir l'événement" },
    link: "events.html#full-moon-party"
  },
  {
    id: "dive-center", slot: "search", active: true, hue: 200,
    title: { en: "Blue Lagoon Divers", fr: "Blue Lagoon Divers" },
    text: { en: "Open Water course 10% off for Yalla Dahab guests", fr: "-10 % sur le cours Open Water pour les voyageurs Yalla Dahab" },
    cta: { en: "Book on WhatsApp", fr: "Réserver sur WhatsApp" },
    link: "https://wa.me/201000000009"
  },
  {
    id: "cafe", slot: "search", active: true, hue: 30,
    title: { en: "Café Mashraba", fr: "Café Mashraba" },
    text: { en: "Best shakshuka in town · Fast wifi for remote work", fr: "La meilleure chakchouka de la ville · Wifi rapide pour télétravailler" },
    cta: { en: "Get directions", fr: "Y aller" },
    link: "https://maps.google.com/?q=Mashraba+Dahab"
  }
];
