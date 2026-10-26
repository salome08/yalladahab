# Yalla Dahab

Site de logements et d'agenda local à Dahab : les hôtes publient gratuitement, les voyageurs les contactent sur WhatsApp, et les bars, centres de plongée et organisateurs d'événements achètent des bannières.

## Ce qu'il y a dans cette première version

| Page | Fichier |
|---|---|
| Accueil (recherche, sélection, agenda de la semaine, bannière) | `index.html` |
| Liste des logements avec filtres (quartier, type, nuit ou mois, budget, wifi, vérifié) | `listings.html` |
| Fiche logement (bouton WhatsApp pré-rempli avec les dates, partage WhatsApp/Facebook) | `listing.html?id=...` |
| Agenda des événements | `events.html` |
| Formulaire pour les hôtes (envoyé sur WhatsApp à l'administratrice) | `host.html` |
| Offres publicitaires et demande de réservation de bannière | `advertise.html` |

Le site est en anglais et en français (sélecteur en haut à droite).

## Modifier le contenu

Tout le contenu se trouve dans trois fichiers simples :

- `assets/data/listings.js` : les logements
- `assets/data/events.js` : les événements
- `assets/data/ads.js` : les bannières publicitaires (mettre `active: false` quand la période payée est finie)

Les réglages (numéro WhatsApp de l'administratrice, nombre de bannières par page) sont dans `assets/js/config.js`.
Les textes de l'interface sont dans `assets/js/i18n.js`.

## Voir le site sur son ordinateur

Ouvrir `index.html` dans un navigateur suffit. Aucune installation n'est nécessaire.

## Mettre le site en ligne gratuitement

Avec GitHub Pages : dans le dépôt GitHub, **Settings → Pages → Branch : main / (root) → Save**. Le site est alors disponible à `https://salome08.github.io/yalladahab/`, et un nom de domaine peut être branché plus tard.

## Prochaines étapes prévues

- Comptes hôtes pour publier et modifier soi-même ses annonces (base de données gratuite type Supabase)
- Vraies photos des logements
- Paiement en ligne des bannières (Paymob)
- Russe et arabe
