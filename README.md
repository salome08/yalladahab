# Yalla Dahab

Site de logements et d'agenda local à Dahab : les hôtes publient gratuitement, les voyageurs les contactent sur WhatsApp, et les bars, centres de plongée et organisateurs d'événements achètent des bannières.

## Ce qu'il y a dans cette première version

| Page | Fichier |
|---|---|
| Accueil (recherche, sélection, agenda de la semaine, bannière) | `index.html` |
| Liste des logements avec filtres (quartier, type, nuit ou mois, budget, wifi, vérifié) | `listings.html` |
| Fiche logement (bouton WhatsApp pré-rempli avec les dates, partage WhatsApp/Facebook) | `listing.html?id=...` |
| Agenda des événements | `events.html` |
| Page pour les hôtes : création de compte, puis ajout de l'annonce depuis « Mon espace » | `host.html` |
| Offres publicitaires et formulaire de demande de bannière ou d'événement à la une | `advertise.html` |
| Connexion des hôtes par lien email | `login.html` |
| Mon espace : coordonnées, mes annonces (ajout, modification, photos, pause) | `account.html` |
| Espace admin : validation des annonces, badge vérifié, demandes de pub, agenda, bannières | `admin.html` |

Le site est en anglais et en français (sélecteur en haut à droite).

## Base de données et espace hôtes

L'espace hôtes et l'espace admin fonctionnent avec [Supabase](https://supabase.com) (gratuit). Pour l'activer, suivre [supabase/GUIDE.md](supabase/GUIDE.md).

- Un hôte crée son compte avec son email, puis publie et modifie ses annonces et ses photos lui-même.
- Une nouvelle annonce reste invisible jusqu'à sa validation dans l'espace admin. Ensuite, l'hôte peut la modifier ou la mettre en pause librement.
- Le badge « vérifié », la mise en avant, l'agenda et les bannières sont réservés à l'admin.
- Une bannière s'arrête toute seule à sa date de fin.

## Bannières et événements payants

Un bar, un centre de plongée ou un organisateur remplit le formulaire de la page Publicité (sans compte) : offre, dates, texte de la bannière ou détails de l'événement. La demande arrive dans l'espace admin, onglet « Demandes pub », avec le montant calculé par la base. Une fois le paiement reçu (espèces, InstaPay, Vodafone Cash, ou offert), l'admin choisit le moyen de paiement et clique sur « Payé : mettre en ligne » : la bannière est créée pour les semaines payées (à partir du jour du paiement si la date de début est passée), ou l'événement est ajouté à l'agenda à la une. L'onglet affiche aussi le total encaissé du mois.

À installer une fois : coller `supabase/ad-requests.sql` dans Supabase → SQL Editor → Run. Les tarifs sont dans ce fichier (`ad_price`) et dans `assets/js/app.js` (`AD_PRICES`) : les changer aux deux endroits.

Ces règles sont appliquées par la base elle-même (`supabase/schema.sql`), pas seulement par les pages.

## Modifier le contenu sans base de données

Tant que Supabase n'est pas configuré, tout le contenu se trouve dans trois fichiers simples :

- `assets/data/listings.js` : les logements
- `assets/data/events.js` : les événements
- `assets/data/ads.js` : les bannières publicitaires (mettre `active: false` quand la période payée est finie)

Les réglages (numéro WhatsApp de l'administratrice, nombre de bannières par page) sont dans `assets/js/config.js`.
Les textes de l'interface sont dans `assets/js/i18n.js`.

## Voir le site sur son ordinateur

Ouvrir `index.html` dans un navigateur suffit. Aucune installation n'est nécessaire.

## Mettre le site en ligne gratuitement

Le site est hébergé gratuitement par GitHub Pages (**Settings → Pages → Branch : main / (root)**) et répond sur **https://yalladahab.com** grâce au fichier `CNAME`. Chez Namecheap (Advanced DNS), le domaine pointe vers GitHub avec quatre enregistrements `A` sur `@` (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) et un `CNAME` `www` vers `salome08.github.io`.

## Prochaines étapes prévues

- Paiement en ligne des bannières (Paymob), quand une société sera enregistrée en Égypte
- Russe et arabe
