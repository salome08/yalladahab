# Activer l'espace hôtes (Supabase)

Supabase héberge la base de données du site : les comptes des hôtes, leurs annonces, leurs photos, l'agenda et les bannières. Le plan gratuit suffit pour démarrer.

Tant que ces étapes ne sont pas faites, le site continue de fonctionner avec les fichiers de `assets/data/`.

## 1. Créer le projet

1. Crée un compte sur [supabase.com](https://supabase.com) (gratuit).
2. **New project** : nom `yalla-dahab`, région **Central EU (Frankfurt)** (la plus proche de l'Égypte), choisis un mot de passe et garde-le.
3. Attends une minute que le projet soit prêt.

## 2. Créer les tables

1. Menu de gauche : **SQL Editor** → **New query**.
2. Copie tout le contenu du fichier `supabase/schema.sql`, colle-le, puis clique sur **Run**.
3. Le message « Success. No rows returned » veut dire que tout est en place.

## 3. Régler les liens de connexion

Les hôtes se connectent avec un lien reçu par email. Supabase doit savoir vers quelle page les renvoyer.

1. **Authentication** → **URL Configuration**.
2. **Site URL** : `https://yalladahab.com/`
3. **Redirect URLs** → **Add URL** : `https://yalladahab.com/account.html` (et, pour l'ancienne adresse, `https://salome08.github.io/yalladahab/account.html`)

## 4. Brancher le site

1. **Project Settings** → **API** (ou **Data API**).
2. Copie le **Project URL** et la clé **anon public**.
3. Colle-les dans `assets/js/config.js` :

```js
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi..."
```

La clé « anon public » est faite pour être visible sur le site : les règles de sécurité de la base décident qui peut lire et modifier quoi. Ne copie jamais la clé **service_role**.

## 5. Devenir admin et retrouver tes annonces

1. Sur le site, clique sur **Mon espace**, entre ton email et ouvre le lien reçu.
2. Retourne dans **SQL Editor** → **New query**, colle le contenu de `supabase/admin-et-annonces-dar-bahr.sql`.
3. Remplace `ton-email@exemple.com` par ton adresse (deux endroits), puis **Run**.
4. Recharge **Mon espace** : le bouton **Espace admin** apparaît, avec tes deux annonces Dar Bahr.

## Bon à savoir

- **Emails de connexion** : Supabase envoie gratuitement quelques emails par heure seulement. C'est suffisant au lancement ; avec plus d'hôtes, il faudra brancher un service d'email (par exemple Resend, gratuit jusqu'à 3 000 emails par mois).
- **Mise en veille** : un projet gratuit sans aucune visite pendant 7 jours est mis en pause. Il se relance en un clic depuis le tableau de bord.
- **Sauvegardes** : le plan gratuit n'a pas de sauvegarde automatique téléchargeable. Pense à exporter les annonces de temps en temps (**Table Editor** → `listings` → **Export to CSV**).
