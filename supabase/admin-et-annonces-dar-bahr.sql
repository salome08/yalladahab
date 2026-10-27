-- À lancer APRÈS t'être connectée une première fois au site avec ton email.
-- Remplace ton-email@exemple.com par ton adresse (aux deux endroits), puis Run.

-- 1. Te donner les droits d'admin
update public.profiles
set is_admin = true, name = 'Salomé', whatsapp = '33659213813'
where id = (select id from auth.users where email = 'ton-email@exemple.com');

-- 2. Ajouter tes deux annonces Dar Bahr, rattachées à ton compte
insert into public.listings
  (id, owner_id, status, title, description, area, type, guests, bedrooms,
   price_night, price_month, currency, wifi_mbps, amenities, photos, hue, verified, featured, host_name, host_whatsapp)
values
(
  'dar-bahr-coral',
  (select id from auth.users where email = 'ton-email@exemple.com'),
  'published',
  '{"en": "Dar Bahr · Coral: sea view, hammock and fast wifi", "fr": "Dar Bahr · Coral : vue mer, hamac et wifi rapide"}',
  '{"en": "Dar Bahr, \"the House of the Sea\", is a small boho-chic building of three apartments facing the Red Sea, in the quiet Bedouin area of Assala, one minute from the beach and two from the market. This first-floor apartment has a sea-view living room with a hammock nook, a proper workspace with wifi tested at 50 Mbps and backup power, a queen bed, a fully equipped kitchen, air conditioning and a washing machine. Ideal for remote workers, divers and snorkellers. Discounts for weekly and monthly stays. Pets welcome, self check-in. Under Egyptian law, unmarried couples where one partner is Egyptian cannot be hosted.", "fr": "Dar Bahr, « la Maison de la Mer », est un petit immeuble bohème de trois appartements face à la mer Rouge, dans le quartier bédouin calme d''Assala, à une minute de la plage et deux du marché. Cet appartement au premier étage a un salon vue mer avec coin hamac, un vrai espace de travail avec wifi testé à 50 Mb/s et secours électrique, un lit queen size, une cuisine équipée, la climatisation et un lave-linge. Idéal pour télétravailleurs, plongeurs et amateurs de snorkeling. Réductions à la semaine et au mois. Animaux bienvenus, arrivée autonome. Selon la loi égyptienne, les couples non mariés dont l''un est égyptien ne peuvent pas être accueillis."}',
  'assala', 'apartment', 2, 1, 40, 750, 'USD', 50,
  array['wifi','workspace','seaView','beachAccess','hammock','ac','kitchen','washer','backupPower','pets','selfCheckin'],
  array[
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/ccf1db38-8aa1-411e-b008-34ba1987b687.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/998c9bb2-392f-4f64-b762-71eb7f35553c.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/a65ab5a3-88d4-4f9f-8f8f-bc8e7d6535cd.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/d498c3ed-5aa5-4717-94f2-148a14ff788e.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/f7c83674-20cb-42d9-91fa-5c3a19cef4a9.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1785608202126798337/original/f0077d4a-5623-4bf3-86fe-e2eedba1ec67.jpeg?im_w=1200'
  ],
  190, true, true, 'Salomé', '33659213813'
),
(
  'dar-bahr-horizon',
  (select id from auth.users where email = 'ton-email@exemple.com'),
  'published',
  '{"en": "Dar Bahr · Horizon: sea and mountain view rooftop", "fr": "Dar Bahr · Horizon : rooftop vue mer et montagne"}',
  '{"en": "Recently renovated top-floor studio in Dar Bahr, Assala, one minute from the beach and close to the dive and snorkel spots. Double bed, wooden walls and a sea-view window. Its big private rooftop terrace has a panoramic view of the sea and the mountains, a Bedouin lounge with cushions, and a table for breakfast or working outside. Fridge, hot water, 50 Mbps wifi, air conditioning. Sleeps up to 4 with the extra floor mattress. Discounts for weekly and monthly stays, self check-in. Under Egyptian law, unmarried couples where one partner is Egyptian cannot be hosted.", "fr": "Studio rénové au dernier étage de Dar Bahr, à Assala, à une minute de la plage et près des spots de plongée et de snorkeling. Lit double, murs en bois et fenêtre vue mer. Sa grande terrasse privée sur le toit offre une vue panoramique sur la mer et les montagnes, avec un salon bédouin et ses coussins, et une table pour le petit-déjeuner ou travailler dehors. Réfrigérateur, eau chaude, wifi 50 Mb/s, climatisation. Jusqu''à 4 personnes avec le matelas d''appoint. Réductions à la semaine et au mois, arrivée autonome. Selon la loi égyptienne, les couples non mariés dont l''un est égyptien ne peuvent pas être accueillis."}',
  'assala', 'studio', 4, 1, 60, 1050, 'USD', 50,
  array['wifi','seaView','rooftop','terrace','beachAccess','ac','kitchen','washer','pets','selfCheckin'],
  array[
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/53c35449-a26b-41ea-8e17-8520fb69957f.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/e5fa79b0-acba-40c6-879b-dfeee324ddfe.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/ca0daf2d-0010-4599-ac67-74121072668f.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/e7def9ce-b744-4bdd-b882-802354f8e146.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/a2debf9b-9d05-4e57-a8c0-5d68f4ba3276.jpeg?im_w=1200',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1789168428475450808/original/201c7022-0122-4b09-b9a1-fdd20f8b64a9.jpeg?im_w=1200'
  ],
  30, true, true, 'Salomé', '33659213813'
)
on conflict (id) do nothing;
