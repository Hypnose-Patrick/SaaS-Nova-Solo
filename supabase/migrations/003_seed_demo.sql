-- Données démo — Profil "Camille" (utilisé pour les démonstrations)
-- À exécuter uniquement en environnement de dev/staging

-- Note : nécessite un user auth.users existant avec l'email demo@nova-solo.ch
-- En local : supabase start → créer le user via Auth UI ou Supabase CLI

DO $$
DECLARE
  demo_user_id UUID;
  demo_profile_id UUID;
BEGIN
  -- Récupérer ou ignorer si pas de user démo
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo@nova-solo.ch' LIMIT 1;
  IF demo_user_id IS NULL THEN
    RAISE NOTICE 'No demo user found (demo@nova-solo.ch). Skipping seed.';
    RETURN;
  END IF;

  -- Profil Camille
  INSERT INTO profiles (user_id, name, email, statut, domaine, situation, ville, canton, is_laci,
    capital, charges_fixes, runway_months, brand_name, slogan, pricing_tarif, pricing_clients)
  VALUES (
    demo_user_id,
    'Camille Dubois',
    'demo@nova-solo.ch',
    'laci',
    'Coaching & développement personnel',
    'En reconversion professionnelle depuis 6 mois',
    'Lausanne', 'VD',
    true,
    20000, 2800, 9,
    'Camille Coaching',
    'Révèle ton potentiel, construis ta carrière',
    180, 8
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO demo_profile_id;

  IF demo_profile_id IS NULL THEN
    SELECT id INTO demo_profile_id FROM profiles WHERE user_id = demo_user_id LIMIT 1;
  END IF;

  -- BMC de démo
  INSERT INTO bmc (profile_id, block_key, content) VALUES
    (demo_profile_id, 'segments', 'Cadres en transition (35-50 ans), indépendants en reconversion, managers burnout'),
    (demo_profile_id, 'valeur', 'Retrouver clarté et direction en 90 jours grâce à un accompagnement structuré ICF'),
    (demo_profile_id, 'canaux', 'LinkedIn, bouche-à-oreille, partenariats RH, ORP Vaud'),
    (demo_profile_id, 'relations', 'Séances individuelles hebdomadaires, suivi WhatsApp, bilan mensuel'),
    (demo_profile_id, 'revenus', 'Forfait 90 jours CHF 1''440, séance isolée CHF 220, atelier groupe CHF 180/pers'),
    (demo_profile_id, 'ressources', 'Certification ICF ACC, outils Systémique, Nova Solo, bureau co-working'),
    (demo_profile_id, 'activites', 'Séances coaching, ateliers collectifs, création contenu LinkedIn, réseau ORP'),
    (demo_profile_id, 'partenaires', 'ORP Vaud, DRH PME romandes, co-working L''Écluse Lausanne, réseau ICF Suisse'),
    (demo_profile_id, 'couts', 'Supervision ICF CHF 150/m, logiciels CHF 80/m, co-working CHF 400/m, formation continue')
  ON CONFLICT DO NOTHING;

  -- Quelques prospects démo
  INSERT INTO prospects (profile_id, name, company, email, column_key, soncas, est_value) VALUES
    (demo_profile_id, 'Marc Thévenaz', 'Nestlé SA', 'marc.thevenaz@exemple.ch', 'rdv', 'securite', 1440),
    (demo_profile_id, 'Sophie Ansermet', 'Indépendante', 'sophie.a@exemple.ch', 'contacte', 'nouveaute', 1440),
    (demo_profile_id, 'Jean-Pierre Favre', 'Banque Cantonale VD', 'jp.favre@exemple.ch', 'nouveau', 'argent', 2880)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo seed completed for profile %', demo_profile_id;
END $$;
