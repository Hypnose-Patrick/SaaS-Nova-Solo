// Contenu du centre d'aide (/aide) : 22 modules avec vidéo + le Compagnon
// terrain (pas encore filmé — cf. note en bas de nova-tutos-elevenlabs.md,
// tournage repoussé après stabilisation de la branche feat/compagnon-terrain
// qui a depuis été fusionnée). Texte 4MAT synchronisé avec le script ElevenLabs
// (C:\Claude-Shared\06_MARKETING-COMM\Nova-solo\audio\vidéo-par-onglet), source
// de vérité déjà auditée contre le code au 2026-07-08.
//
// Vidéos hébergées sur bunny.net, zone de stockage/pull existante "nova-solo"
// (même hostname que l'audio Goban Coach, déjà whitelisté en CSP) : uploader
// chaque mp4 renommé selon `slug` dans le dossier /tutos/ de cette zone.

export interface Tutoriel {
  n: number;
  slug: string; // nom de fichier vidéo sans extension (mp4) sur bunny.net
  title: string;
  route: string; // route app correspondante
  icon: string;
  hasVideo: boolean;
  why: string;
  what: string;
  how: string;
  sowhat: string;
}

// Base CDN bunny.net — même zone que l'audio Goban Coach (déjà whitelistée
// dans .htaccess : media-src 'self' https://nova-solo.b-cdn.net).
export const VIDEO_BASE = "https://nova-solo.b-cdn.net/tutos/";

// Guide d'introduction affiché en tête du centre d'aide : comment mener un
// projet à bien / créer son activité, et dans quel ordre utiliser les 23
// modules pour ça. Ce n'est pas un onglet de l'app — pas de vidéo, pas de
// route propre — donc ce n'est volontairement pas dans le tableau TUTORIELS.
export interface ParcoursGuide {
  title: string;
  why: string;
  what: string;
  how: string;
  sowhat: string;
}

export const PARCOURS_GUIDE: ParcoursGuide = {
  title: "Comment mener ton projet à bien — la structure de Nova Solo",
  why: "23 onglets, ça peut donner l'impression d'un tas d'outils sans lien entre eux. Ce n'est pas le cas : Nova Solo suit le même chemin que la création d'une activité indépendante dans la vraie vie — d'abord comprendre, puis structurer, puis convaincre, puis encaisser. Chaque onglet correspond à une étape de ce chemin, ou à un outil de soutien que tu utilises en continu.",
  what: "Quatre phases. Phase 1 — Comprendre : Diagnostic, Vision symbolique, BMC. Phase 2 — Structurer et chiffrer : Business Plan, Offre & Pricing, Finances. Phase 3 — Convaincre et vendre : CV, Dossier de présentation, Contrat, Pipeline commercial, Marketing & Visibilité, MirrorFisch. Phase 4 — Exécuter et encaisser au quotidien : Agenda, Compagnon terrain, Comptabilité, Factures, Documents. Autour de ces quatre phases, des outils transverses que tu utilises à tout moment : le Tableau de bord (ton point de départ chaque matin), Goban Coach, le Cabinet Hermès, la Simulation Swarm et l'Oracle du jour pour la réflexion et la décision, et les Réglages pour que Nova te connaisse.",
  how: "Si tu démarres de zéro : (1) remplis d'abord les Réglages — sans ça, rien d'autre n'est calibré correctement. (2) Lance le Diagnostic, qui peut ensuite pré-remplir le BMC, le Business Plan et le Pricing automatiquement. (3) Complète le BMC pour poser ton modèle, et si tu en as besoin, la Vision symbolique pour clarifier ce que les chiffres ne disent pas. (4) Rédige ton Business Plan et fixe ton Pricing — ce sont tes fondations chiffrées. (5) Selon ton interlocuteur, prépare ton CV, ton Dossier de présentation ou ton Contrat, et teste ton message avec MirrorFisch avant de l'envoyer. (6) Ouvre le Pipeline commercial pour suivre chaque prospect, et le Marketing pour rester visible dans la durée. (7) Au quotidien, utilise l'Agenda pour ton temps et le Compagnon terrain (sur mobile) pour capturer chaque minute et chaque justificatif sans y penser. (8) Facture au fil de l'eau — chaque facture payée alimente automatiquement la Comptabilité, qui elle-même nourrit tes Finances sur douze mois. Reviens chaque matin au Tableau de bord : il te dit où regarder aujourd'hui, sans que tu aies à tout reparcourir.",
  sowhat: "Créer une activité n'est jamais parfaitement linéaire — tu reviendras sur ton BMC après ton premier client, tu ajusteras ton Pricing après ton dixième devis. Mais suivre cet ordre au démarrage t'évite les trois erreurs les plus fréquentes chez les indépendants : fixer un prix avant de connaître son marché, démarcher avant d'avoir une offre claire, et facturer sans jamais reprendre ses comptes. La structure existe pour que tu n'aies pas à l'inventer toi-même.",
};

export const TUTORIELS: Tutoriel[] = [
  {
    n: 1,
    slug: "01-dashboard",
    title: "Tableau de bord",
    route: "/",
    icon: "◈",
    hasVideo: true,
    why: "Lundi matin, 8h. Tu n'as pas le temps de chercher. En trente secondes, le tableau de bord te dit où tu en es — revenus, dépenses, trésorerie, et combien de temps tu peux encore tenir avant que ça devienne urgent.",
    what: "Quatre chiffres en haut. Ton agenda à gauche, tes rituels du jour au centre, des raccourcis d'action en bas. Et si tu es au bénéfice du LACI, ton plan de route est là avec chaque jalon à cocher.",
    how: "Les quatre KPIs d'abord : revenus, dépenses, trésorerie disponible, et le runway en nombre de mois — ce dernier n'apparaît que si tu as renseigné ton capital et tes charges fixes dans les Réglages. Ton agenda affiche les prochains rendez-vous sans que tu quittes cet écran. Les rituels du jour sont une checklist rapide — réseau, visibilité, avancée sur un livrable clé, relance de prospect — coche-les au fil de ta journée. Les actions rapides t'envoient en un clic vers une nouvelle facture, un nouveau prospect, une dépense à saisir, ou directement dans le chat avec Nova. Le simulateur ROI te permet de sélectionner les modules Nova que tu utilises et de voir, selon ton taux horaire, combien d'heures et de CHF tu récupères chaque mois — jusqu'au ROI annuel estimé. En bas, la section Bien-être te propose un bilan rapide de ton énergie, avec des ressources ciblées si tu traverses une période difficile.",
    sowhat: "Ce tableau n'est pas une décoration. C'est ta réunion de direction du matin — elle dure trente secondes et te dit exactement quoi faire aujourd'hui.",
  },
  {
    n: 2,
    slug: "02-diagnostic",
    title: "Diagnostic",
    route: "/diagnostic",
    icon: "◎",
    hasVideo: true,
    why: "Avant de choisir une stratégie, tu dois savoir où tu en es vraiment. Le diagnostic ne te donne pas de conseils génériques — il lit ta situation, identifie tes freins réels, et te dit par quoi commencer.",
    what: "Trois questions. Un bouton. Et un rapport structuré en quatre blocs : forces, freins, capacité de mise en œuvre, et actions prioritaires. Si les autres onglets sont vides, le diagnostic peut les pré-remplir automatiquement.",
    how: "Réponds aux trois questions : ta situation actuelle, ce que tu cherches à accomplir, et ton profil d'entrepreneur. Clique sur « Lancer le diagnostic ». Nova génère quatre blocs : tes Forces — ce sur quoi t'appuyer maintenant ; tes Freins — ce qui ralentit ou bloque ; ta Capacité — réaliste ou non pour ton timing ; et tes Actions prioritaires dans les trente jours. En bas du rapport, une section « Cascade » apparaît. Si ton BMC, ton Business Plan, ton CV ou ta stratégie de pricing sont encore vides, un bouton te permet de les pré-remplir depuis le diagnostic — ce qui économise trente minutes de saisie.",
    sowhat: "Le diagnostic, c'est le point de départ honnête. Pas ce que tu veux entendre — ce qui est vrai maintenant. Le reste de l'espace s'articule autour de ce premier bilan.",
  },
  {
    n: 3,
    slug: "03-bmc",
    title: "BMC — Business Model Canvas",
    route: "/bmc",
    icon: "⊞",
    hasVideo: true,
    why: "Beaucoup d'indépendants construisent leur offre sans jamais poser les fondations. Le BMC, c'est neuf blocs qui cartographient ton modèle complet — en une page, sans jargon, avec une IA qui challenge chaque réponse.",
    what: "Neuf blocs, de la proposition de valeur jusqu'aux sources de revenus. Chaque bloc est éditable, sauvegardable, challengeable. Nova peut enrichir chaque section, et une analyse globale est disponible quand les neuf blocs sont remplis.",
    how: "Commence par la Proposition de valeur — c'est le cœur. Clique sur le bloc, saisis ton texte, puis utilise le bouton « Challenger » pour que Nova joue l'avocat du diable. Le bouton « Enrichir » génère des suggestions concrètes si tu bloques. Fais de même pour chacun des huit autres blocs : Partenaires clés, Activités clés, Relations clients, Segments clients, Ressources clés, Canaux de distribution, Structure de coûts, Sources de revenus. Chaque bloc se sauvegarde individuellement — inutile de tout remplir d'une traite. Une fois les neuf blocs complétés, clique sur « Analyse globale » : Nova identifie les contradictions entre blocs et les opportunités d'optimisation.",
    sowhat: "Un BMC bien rempli, c'est la colonne vertébrale de tout le reste — il alimente ton Business Plan, ton Dossier, ta stratégie Pricing. Traite-le comme ton premier vrai actif.",
  },
  {
    n: 4,
    slug: "04-business-plan",
    title: "Business Plan",
    route: "/business-plan",
    icon: "◻",
    hasVideo: true,
    why: "La banque, le fonds de garantie ou ton futur partenaire ne lisent pas les pitchs — ils lisent les chiffres et la cohérence. Le Business Plan de Nova est structuré au standard bancaire suisse. Pas pour faire joli — pour convaincre.",
    what: "Dix sections organisées de l'exécutif à la feuille de route. Chaque section est éditable, pré-remplissable depuis ton diagnostic ou ton BMC, et exportable en PDF ou Word.",
    how: "Les dix sections suivent la structure exigée : Résumé exécutif, Porteur de projet, Offre et positionnement, Marché cible, Stratégie commerciale, Forme juridique, Organisation et ressources, Plan financier, Risques et mesures, Roadmap 12 mois. Si tu as déjà rempli le Diagnostic ou le BMC, clique sur « Générer depuis le diagnostic » — Nova pré-remplit les sections de contexte automatiquement. Chaque section s'édite en texte libre. Si tu bloques sur une section, un bouton de génération IA est disponible pour chacune. Une fois satisfait, « Exporter en PDF » produit un document propre et mis en page. « Exporter en Word » te donne la main pour une mise en forme personnalisée.",
    sowhat: "Ce n'est pas un document qu'on soumet une fois et qu'on oublie. C'est ton document de référence — mets-le à jour à chaque pivot. La banque, c'est peut-être dans six mois. Sois prêt avant qu'elle demande.",
  },
  {
    n: 5,
    slug: "05-vision-symbolique",
    title: "Vision symbolique",
    route: "/symbolique",
    icon: "✦",
    hasVideo: true,
    why: "Il y a ce qu'on sait de son projet. Et il y a ce qu'on n'a pas encore articulé — des intuitions, des peurs, des aspirations qu'on n'ose pas nommer. La Vision Symbolique travaille sur ce deuxième niveau. C'est le seul outil dans Nova qui ne commence pas par des données.",
    what: "Trois questions introspectives, posées une à une dans un chat. Une métaphore et un plan d'action générés par l'IA à partir de tes réponses. Une carte symbolique interactive, une lecture de coach, un plan d'action SMART, et un chat libre pour aller plus loin.",
    how: "Le chat te pose trois questions, une à la fois : d'abord « Si votre projet était un animal, lequel serait-il et pourquoi ? », puis « Quelle transformation profonde souhaitez-vous offrir à vos clients ? », et enfin « Quel impact voulez-vous avoir dans 5 ans ? ». Réponds directement dans le champ de chat en bas de page. Une fois les trois réponses données, Nova compose ta métaphore et un premier plan d'action, puis génère automatiquement un tableau symbolique interactif avec des nœuds — Vision, Offre, Client, Partenaire, Concurrent, Ressource, Obstacle, Frein, Levier, Action. Double-clique sur un nœud pour l'éditer, le relier à un autre, ou le supprimer ; le bouton « + Symbole » permet d'en ajouter un manuellement. Régénère la carte à tout moment avec « Générer ma vision (IA) ». La section « La lecture de ton coach » propose une interprétation et des questions de réflexion — « Nouveau feedback » la régénère. Le bouton « Actions SMART » transforme cette lecture en plan d'action concret et daté.",
    sowhat: "La stratégie sans la vision, c'est de l'exécution dans le vide. Fais cet exercice une fois par trimestre. Ta carte changera. C'est bon signe.",
  },
  {
    n: 6,
    slug: "06-offre-pricing",
    title: "Offre & Pricing",
    route: "/pricing",
    icon: "◇",
    hasVideo: true,
    why: "Fixer son prix au feeling, c'est la principale erreur des indépendants en démarrage. Soit trop bas pour se vendre, soit trop haut sans pouvoir se justifier. Ce module calcule ta réalité — et génère une stratégie tarifaire avec des chiffres qui tiennent.",
    what: "Un calculateur de revenu net, un vérificateur de viabilité, une checklist MVP, et un générateur de stratégie tarifaire. Tout sur un seul écran.",
    how: "Commence par décrire ton offre en quelques lignes. Ensuite le calculateur : les libellés s'adaptent à ton type d'activité défini dans les Réglages — prix par client pour une prestation intellectuelle, par chantier pour l'artisanat, par commande pour le commerce. Saisis ton prix unitaire, le volume visé par mois, et tes charges fixes mensuelles. Si ton activité est artisanat ou commerce, un champ supplémentaire apparaît pour le coût du matériel ou des marchandises — Nova calcule alors ta marge brute avant charges. Nova calcule automatiquement ton chiffre d'affaires brut, ta cotisation AVS estimée, ton revenu net disponible, et ton seuil de rentabilité. Sous le calculateur, la checklist MVP liste cinq étapes pour valider ton offre avant de la lancer. Clique sur « Générer une stratégie tarifaire » pour recevoir une analyse de ton positionnement.",
    sowhat: "Un prix, c'est pas une décision — c'est un calcul. Fais-le ici. Et reviens le refaire chaque fois que ton offre évolue.",
  },
  {
    n: 7,
    slug: "07-goban-coach",
    title: "Goban Coach — Victor",
    route: "/goban-coach",
    icon: "⊙",
    hasVideo: true,
    why: "Le Go est le jeu de stratégie le plus complexe qui soit. Il développe une chose qu'aucune formation ne peut enseigner directement : la pensée à long terme sous contrainte. Victor est ton instructeur IA — patient, précis, et disponible à trois heures du matin.",
    what: "Un goban interactif, un instructeur IA en temps réel, et en option, des métaphores professionnelles qui connectent chaque leçon de Go à la réalité de l'indépendant.",
    how: "À l'écran de configuration, choisis la taille du goban : 9x9 pour débuter, 13x13 pour progresser, 19x19 pour la pratique complète. Sélectionne ton niveau — débutant, intermédiaire, ou avancé. Active ou désactive le « mode carrière » selon que tu veux les métaphores professionnelles. Joue. Victor commente chaque coup en temps réel dans les bulles de coaching à côté du goban — il explique les règles, identifie les coups dangereux avant que tu les joues, et te propose des alternatives. En fin de partie, l'analyse d'endgame détaille les erreurs stratégiques et les opportunités manquées. En mode carrière, chaque concept de Go est relié à une situation professionnelle : territoire égale parts de marché, influence égale réseau, sacrifice égale choix de positionnement.",
    sowhat: "Le Go ne t'apprend pas à jouer au Go. Il t'apprend à penser différemment. Victor est là pour ça — pas pour te battre, pour te faire progresser.",
  },
  {
    n: 8,
    slug: "08-cv",
    title: "CV personnalisé",
    route: "/cv",
    icon: "◻",
    hasVideo: true,
    why: "Un CV standard en 2026, c'est un billet dans une loterie à deux cents candidats. Le CV personnalisé ne cible pas un poste — il cible un lecteur précis, avec ses codes et ses attentes à lui.",
    what: "Trois types de CV, cinq champs de saisie, génération IA, optimisation ATS, et export PDF ou Word. Tout s'adapte au destinataire que tu choisis.",
    how: "Commence par choisir le type de CV : « Banque » si tu constitues un dossier de financement, « Client » si tu pitches une mission, « LinkedIn » si tu veux optimiser ton profil public. Remplis les cinq champs : ton profil en quelques lignes, tes compétences clés, ton expérience professionnelle, ta formation, et tes langues. Clique sur « Générer le CV » — Nova construit un document structuré, adapté au type choisi, avec le bon vocabulaire selon le destinataire. La checklist ATS vérifie que le CV contient les mots-clés attendus par les logiciels de tri automatique. Tu peux éditer le résultat directement dans la prévisualisation. Exporte en PDF pour l'envoi final, ou en Word pour continuer la mise en page.",
    sowhat: "Un CV générique, ça dit « je cherche ». Un CV personnalisé, ça dit « j'ai réfléchi à ce que vous cherchez ». La différence, c'est un entretien.",
  },
  {
    n: 9,
    slug: "09-dossier",
    title: "Dossier de présentation",
    route: "/dossier",
    icon: "◻",
    hasVideo: true,
    why: "Un dossier de présentation, c'est la version longue de ton pitch — structuré, cohérent, adapté au lecteur. Pas une brochure. Un argument.",
    what: "Quatre templates selon le destinataire, un formulaire court, et une génération IA qui s'appuie sur tout ce que tu as déjà saisi dans Nova — BMC, pricing, profil.",
    how: "Sélectionne d'abord le template selon le destinataire : Dossier ORP / LACI pour faire valider ton projet par un conseiller ORP, Dossier Client pour convaincre un client final, Dossier B2B / Banque pour un financement ou un partenariat, ou Pitch Investisseur si tu lèves des fonds. Renseigne le nom du destinataire, son titre et son organisation. Clique sur « Générer le dossier » : Nova construit automatiquement un document en quatre parties suivant le 4MAT — Pourquoi maintenant, Ce que je propose, Comment ça marche, Ce que vous gagnez — en s'appuyant sur tes données BMC, ton positionnement Pricing, et ton Profil. Prévisualise le résultat, édite les passages qui demandent une touche personnelle, puis exporte en PDF ou Word.",
    sowhat: "Ce dossier est prêt à partir en vingt minutes au lieu de trois heures. Et il parle le langage du lecteur — pas le tien.",
  },
  {
    n: 10,
    slug: "10-contrat",
    title: "Contrat",
    route: "/contrat",
    icon: "◻",
    hasVideo: true,
    why: "Une prestation sans contrat, c'est une confiance à sens unique. Pas nécessairement parce que l'autre est malhonnête — parce que sans écrit, personne ne s'en souvient de la même façon.",
    what: "Cinq types de contrat, quatre durées, génération automatique, prévisualisation et export. Un contrat clair, en cinq minutes — y compris pour les métiers manuels.",
    how: "Choisis le type de contrat : Prestation de services pour un accompagnement individuel, Mandat de conseil pour une mission, Formation / atelier pour un programme, Prestation de services récurrente pour un retainer mensuel, ou Contrat d'entreprise / chantier pour un artisan qui réalise un ouvrage — ce dernier applique automatiquement les articles 363 et suivants du Code des obligations : réception de l'ouvrage, garantie des défauts, fourniture des matériaux. Choisis ensuite la durée — ou le délai d'exécution pour un chantier : Ponctuel, ou trois, six, douze mois. Clique sur « Générer le contrat » — Nova produit un contrat structuré avec les clauses essentielles adaptées au type choisi. Relis dans la prévisualisation, chaque clause est éditable. Exporte en PDF pour envoi ou signature électronique, ou en Word pour remise à un juriste.",
    sowhat: "Ce n'est pas un document légal au sens strict — c'est un cadre clair entre toi et ton client. Un cadre clair, c'est ce qui évite 90% des malentendus.",
  },
  {
    n: 11,
    slug: "11-pipeline",
    title: "Pipeline commercial",
    route: "/pipeline",
    icon: "◈",
    hasVideo: true,
    why: "Un prospect dans ta tête, c'est un prospect perdu. Le pipeline te force à externaliser ton suivi commercial dans un système que tu contrôles — et qui te dit exactement où regarder chaque matin.",
    what: "Un kanban en six colonnes, un formulaire de prospect enrichi par l'IA, des templates d'emails, des réponses aux objections, et la génération de dossier directement depuis la fiche prospect.",
    how: "Ajoute un nouveau prospect via le formulaire : nom, entreprise, email, valeur estimée de la mission, et profil SONCAS — Sympathie, Orgueil, Nouveauté, Confort, Argent, ou Sécurité — pour calibrer ton approche commerciale. Le prospect apparaît dans la colonne « Nouveau ». Fais-le glisser vers « Contacté » quand tu as pris contact, « RDV » quand un rendez-vous est fixé, « Proposition » quand tu as envoyé une offre, puis « Gagné » ou « Perdu » selon l'issue. Sur chaque fiche prospect, quatre outils : « Recherche IA » pour un briefing sur le contact, « Email de prospection » pour générer un message personnalisé selon le profil SONCAS, « Gestion d'objections » pour préparer les réponses aux freins probables, et « Générer le dossier » pour créer une présentation ciblée en un clic.",
    sowhat: "Le pipeline ne te trouve pas des clients. Il t'empêche d'en perdre. Regarde-le chaque matin — cinq minutes. Les opportunités ne tombent pas dans l'oubli.",
  },
  {
    n: 12,
    slug: "12-marketing",
    title: "Marketing & Visibilité",
    route: "/marketing",
    icon: "◫",
    hasVideo: true,
    why: "La visibilité sans stratégie, c'est du bruit. Ce module te donne une ligne éditoriale, un calendrier, et des contenus générés — pour ne plus jamais ouvrir LinkedIn en te demandant quoi écrire.",
    what: "Un calendrier de contenu hebdomadaire, cinq formats de posts, un générateur éditorial trimestriel, un tracker de présence digitale, et un générateur de page vitrine.",
    how: "Le calendrier affiche ta semaine. Pour chaque jour, choisis un format parmi cinq : Témoignage client, Conseil pratique, Hook accrocheur, Carousel thématique, ou Annonce d'offre. Clique sur « Générer » — Nova crée le post dans ta voix, prêt à copier-coller. Le « Générateur éditorial trimestriel » te propose un plan thématique sur trois mois en une seule génération. Le tracker de présence digitale liste tes canaux par défaut — LinkedIn, site web, newsletter — avec un statut pour chacun ; ajoute un canal personnalisé comme Instagram si tu l'utilises. Les « Insights marketing » classent tes actions par priorité P1, P2, P3. Le générateur de site vitrine produit une page HTML prête à déployer ou à transmettre à un développeur.",
    sowhat: "La constance bat l'inspiration. Ce calendrier ne te demande pas d'être créatif chaque jour — il te demande d'être présent. C'est différent.",
  },
  {
    n: 13,
    slug: "13-mirrorfisch",
    title: "MirrorFisch — Test d'audience",
    route: "/mirrorfisch",
    icon: "◎",
    hasVideo: true,
    why: "Ton pitch te semble clair — mais c'est toi qui l'as écrit. MirrorFisch te montre comment cinq profils d'audience différents réagissent à ton message, avant que tu l'envoies à de vraies personnes.",
    what: "Cinq personas prédéfinis, un champ texte pour ton pitch, et une simulation de réaction avec deux scores : taux de conversion et niveau d'engagement.",
    how: "Choisis les personas que tu veux tester parmi cinq profils : le DRH en reconversion, le demandeur d'emploi sceptique, le dirigeant de PME pressé, le solopreneur prudent, et l'acheteur public. Saisis ton message dans le champ texte — un pitch, une page de vente, un email de prospection. Clique sur « Simuler ». Nova joue le rôle de chaque persona et génère : un score de conversion en pourcentage avec un code couleur selon le seuil, un score d'engagement sur cent, et un retour qualitatif — ce que chaque persona pense, ressent, et ce qui le convainc ou le freine. Utilise ces retours pour retravailler ton message avant le vrai envoi.",
    sowhat: "Tu ne peux pas parler à tout le monde de la même façon. MirrorFisch te force à choisir ton audience avant de parler — et à vérifier que ton message y arrive vraiment.",
  },
  {
    n: 14,
    slug: "14-hermes",
    title: "Cabinet Hermès",
    route: "/hermes",
    icon: "♟",
    hasVideo: true,
    why: "Un conseil de direction, ça coûte cher et ça prend du temps à organiser. Le Cabinet Hermès est ton board personnel — six conseillers spécialisés, disponibles instantanément, avec la mémoire de chaque échange.",
    what: "Six personas conseillers avec des expertises distinctes, une interface de chat persistante pour chacun, et des prompts de démarrage si tu ne sais pas comment formuler ta question.",
    how: "Six conseillers sont à ta disposition. Le Stratège pour le positionnement et les décisions long terme. Le Financier pour les simulations, les marges et la trésorerie. Le Communicant pour le message et les contenus. Le Commercial pour la vente et le pipeline. Le Juriste pour les contrats et les questions légales suisses. Et le Technicien pour les outils et ta stack digitale. Clique sur un conseiller pour ouvrir son chat. L'historique de chaque conversation est sauvegardé — tu reprends là où tu t'es arrêté. Chaque conseiller propose des prompts de démarrage sur sa carte si tu manques d'inspiration.",
    sowhat: "Ces six conseillers ne sont pas là pour être gentils — ils sont là pour être utiles. Pose-leur de vraies questions difficiles. Tu auras de vraies réponses.",
  },
  {
    n: 15,
    slug: "15-swarm",
    title: "Simulation Swarm",
    route: "/simulation",
    icon: "◍",
    hasVideo: true,
    why: "Certaines décisions sont trop importantes pour être prises seul, et trop spécifiques pour un conseiller généraliste. La Simulation Swarm crée une chambre de délibération artificielle autour de ta question.",
    what: "Une question, un panel de huit personas générés par l'IA, une phase de débat, et une synthèse finale avec recommandation.",
    how: "Saisis ta question dans le champ texte — sois précis. Ajuste le curseur pour la taille du panel — huit personas par défaut. Clique sur « Lancer la simulation ». Phase 1 : Nova génère les personas avec leurs profils et leurs biais. Phase 2 : ils délibèrent — chaque persona argumente, répond aux autres, et change parfois de position en cours de débat. Phase 3 : Nova synthétise les positions, les points de consensus, les désaccords majeurs, et formule une recommandation finale. Chaque carte persona affiche son verdict — Pour, Contre, ou Nuancé — avec son raisonnement détaillé.",
    sowhat: "Ce n'est pas un sondage. C'est une chambre de délibération. La décision reste la tienne — mais tu ne peux plus dire que tu n'avais pas envisagé les angles.",
  },
  {
    n: 16,
    slug: "16-finances",
    title: "Finances",
    route: "/finances",
    icon: "◇",
    hasVideo: true,
    why: "La trésorerie, c'est l'oxygène. Tu peux avoir des clients, des contrats et une bonne réputation — si la trésorerie tombe à zéro en mars, c'est terminé. Ce module te donne une visibilité sur douze mois pour éviter ça.",
    what: "Quatre KPIs en temps réel, un modèle financier mensuel sur deux scénarios, un suivi des charges d'exploitation, un tracker de sources de financement, et un import/export Excel ou CSV.",
    how: "En haut, les quatre KPIs : le chiffre d'affaires cumulé sur l'année 1, les charges cumulées, le résultat en EBITDA, et le pic de trésorerie sur les douze mois avec son plancher. Le modèle financier sur douze mois te permet de saisir mois par mois tes prévisions de chiffre d'affaires, tes charges et tes prélèvements, selon deux scénarios : A pour Optimiste et B pour Prudent. Nova calcule automatiquement l'EBITDA et le cash flow pour chaque mois. Le budget des charges d'exploitation propose deux templates : Raison individuelle ou Sàrl. Le tracker de sources de financement liste tes apports. En bas, importe un budget prévisionnel au format Excel (.xlsx/.xls) ou CSV — Nova détecte les colonnes mois, chiffre d'affaires et charges — ou exporte tes données.",
    sowhat: "Tu n'as pas besoin d'être comptable pour piloter tes finances. Tu as besoin de regarder ces douze cases une fois par mois et de savoir ce que tu cherches. Ce module fait le reste.",
  },
  {
    n: 17,
    slug: "17-compta",
    title: "Comptabilité",
    route: "/compta",
    icon: "◈",
    hasVideo: true,
    why: "Chaque reçu dans ta poche et chaque virement sur ton compte, c'est une donnée. Non classée, elle ne vaut rien. Classée, elle te dit exactement où part ton argent et ce que tu peux encore dépenser.",
    what: "Un formulaire de saisie, un scanner de reçus par IA, un import CSV, des filtres par mois et par type, et une liste de transactions organisée par catégorie. Chaque facture marquée « Payée » y génère automatiquement une écriture de revenu.",
    how: "Pour saisir une écriture : sélectionne la date, la description, le montant, le type — revenu ou dépense — la TVA applicable, le fournisseur ou client, et la catégorie. « Facturation client » est ajoutée automatiquement dès qu'une facture passe au statut Payée — inutile de la ressaisir. Si tu as un reçu en photo, utilise le scanner de reçus — Nova extrait les données du ticket et pré-remplit le formulaire. Pour les imports en masse, le bouton « Importer CSV » accepte un fichier au format fourni. Les filtres en haut te permettent d'afficher uniquement les revenus, uniquement les dépenses, ou tout, par mois et par année.",
    sowhat: "Une heure de saisie en fin de mois, c'est une heure que ton comptable ne te facture pas en fin d'année. Et surtout, c'est toi qui connais tes chiffres — pas lui.",
  },
  {
    n: 18,
    slug: "18-factures",
    title: "Factures",
    route: "/facture",
    icon: "◻",
    hasVideo: true,
    why: "Une prestation non facturée le jour même, c'est une prestation oubliée ou retardée. Ce module te permet de créer, corriger et exporter une facture propre, conforme TVA suisse, en quelques minutes — sans jamais devoir tout recommencer si tu t'es trompé.",
    what: "Un formulaire de facturation, un calcul TVA automatique, une numérotation automatique, trois statuts de suivi, la modification et la suppression de toute facture existante, et trois formats d'export — PDF, Word et CSV.",
    how: "Trois KPIs en haut : le total encaissé TTC, le montant en attente TTC, et le nombre de factures. Pour créer une facture : saisis le nom du client, son email, puis ajoute tes lignes de prestation. La TVA à 8,1% est calculée automatiquement, la numérotation aussi. Clique sur « Créer la facture » — elle apparaît en statut « Brouillon ». Change le statut en « Envoyée » puis en « Payée » quand le virement arrive — le passage à Payée génère automatiquement l'écriture correspondante dans la Comptabilité. Sur chaque ligne, l'icône crayon rouvre le formulaire pré-rempli pour corriger le client, l'email ou les lignes de prestation. L'icône corbeille supprime définitivement la facture, après confirmation. Deux icônes exportent la facture individuellement en PDF ou en Word — réservés aux comptes abonnés. En haut de la liste, « Export CSV » télécharge l'ensemble de tes factures, accessible sans condition d'abonnement.",
    sowhat: "La facturation n'est pas une tâche administrative — c'est l'acte final de chaque mission. Fais-le le soir même, corrige-la en dix secondes si tu t'es trompé, et garde toujours une trace exportable pour ton comptable ou tes archives.",
  },
  {
    n: 19,
    slug: "19-agenda",
    title: "Agenda",
    route: "/agenda",
    icon: "◎",
    hasVideo: true,
    why: "Un agenda dispersé entre ton téléphone, ton email et ta tête, c'est une source de rendez-vous manqués et de semaines mal construites. L'agenda Nova est là où tout ce qui concerne ton activité professionnelle se retrouve au même endroit.",
    what: "Une vue mensuelle, un formulaire de création d'événements, quatre types d'événements avec code couleur, une liste journalière au clic, et une Matrice d'Eisenhower pour prioriser tes tâches en quatre quadrants.",
    how: "La vue mensuelle affiche les semaines du lundi au dimanche. Navigue entre les mois avec les flèches. Clique sur un jour pour voir la liste de ses événements dans le panneau à droite. Pour créer un événement : saisis le titre, la date, l'heure de début, et le type — Rendez-vous, Tâche, Formation, ou Autre. Ajoute la localisation ou le lien de visioconférence. En bas de page, la Matrice d'Eisenhower te permet de prioriser tes tâches selon deux axes — urgence et importance — répartis en quatre quadrants. Ajoute une tâche directement dans un quadrant via son champ de saisie, ou glisse-dépose une tâche d'une case à l'autre. Chaque quadrant est limité à quatre tâches maximum — le but n'est pas de tout lister, mais de forcer un vrai choix sur ce qui compte aujourd'hui. Et surtout : depuis la liste des événements du jour, quatre petits boutons numérotés à côté de chaque événement l'envoient directement dans le quadrant de ton choix, sans ressaisir le titre.",
    sowhat: "Chaque rendez-vous dans Nova peut être croisé avec ton pipeline et tes rituels du jour — et transformé en priorité claire dans la matrice, d'un clic. Ce n'est pas juste un calendrier — c'est ta semaine en contexte d'activité, avec une vraie hiérarchie de ce qui compte.",
  },
  {
    n: 20,
    slug: "20-documents",
    title: "Documents",
    route: "/documents",
    icon: "◻",
    hasVideo: true,
    why: "Les documents éparpillés entre ton bureau, ton email et ton Dropbox, ça donne des contrats introuvables au moment où tu en as besoin. Le centre de documents Nova est ton espace de stockage lié directement à ton activité.",
    what: "Un dépôt par glisser-déposer, une organisation automatique, des badges de type de fichier, la taille affichée, et une analyse IA pour les PDF et documents Word.",
    how: "Pour déposer un fichier, glisse-le dans la zone de dépôt ou clique pour parcourir tes dossiers. Les formats acceptés incluent PDF, images, et documents Word (.docx). Chaque fichier s'affiche dans la liste avec son nom, son type, sa taille en kilooctets, et sa date de dépôt. Un bouton « Télécharger » permet de récupérer le fichier à tout moment. Pour les documents lisibles — PDF ou Word — le bouton « Analyser » demande à Nova d'en extraire les points clés directement dans le navigateur, sans envoyer le fichier ailleurs qu'au moteur IA. Idéal pour analyser un contrat reçu, un rapport ou une proposition partenaire sans devoir tout lire en détail.",
    sowhat: "Un document analysé par Nova en trente secondes, c'est trente minutes de lecture dense économisées. Dépose tout ce qui arrive. L'IA fait le tri.",
  },
  {
    n: 21,
    slug: "21-reglages",
    title: "Réglages",
    route: "/settings",
    icon: "◈",
    hasVideo: true,
    why: "Nova est aussi précis que les informations que tu lui donnes. Les Réglages, c'est ta fiche de contexte — plus elle est complète, plus tout le reste de l'espace fonctionne juste.",
    what: "Cinq blocs d'informations, un sélecteur de type d'activité, un sélecteur de moteur IA, une connexion Telegram optionnelle, un choix de couleur d'accent, la gestion de ton abonnement, et une zone de danger pour réinitialiser ou supprimer ton compte.",
    how: "Le premier bloc, informations personnelles : ton nom, ton domaine d'activité, ton statut juridique, un sélecteur de type d'activité — prestation intellectuelle, artisanat, ou commerce — qui adapte automatiquement le vocabulaire et les calculs dans tout Nova, ta situation, et ta localisation. Le deuxième bloc : nom de marque, slogan, logo, bio. Le troisième bloc : email, téléphone, adresse, site web. Le quatrième bloc : capital de départ, charges fixes mensuelles, ton tarif, et le nombre de clients cibles. Le sélecteur de moteur IA choisit entre Claude Sonnet et Claude Opus. La connexion Telegram optionnelle envoie des notifications sur ton téléphone. En bas de page, la Zone de danger propose deux actions avec double confirmation : réinitialiser ton projet actuel, ou supprimer ton compte avec un délai de grâce de 30 jours.",
    sowhat: "Prends vingt minutes pour compléter les Réglages au démarrage. Après, Nova sait qui tu es — et chaque outil s'adapte à ta situation sans que tu aies à te répéter.",
  },
  {
    n: 22,
    slug: "22-oracle",
    title: "Oracle du jour",
    route: "/oracle",
    icon: "🦅",
    hasVideo: true,
    why: "Certaines décisions n'ont pas besoin d'un tableau Excel de plus — elles ont besoin d'un temps d'arrêt. L'Oracle du jour t'offre une minute de recul symbolique avant de trancher. Ce n'est pas une prédiction. C'est un miroir.",
    what: "Vingt animaux symboliques, cinq contextes business, trois formats de tirage — du plus rapide au plus profond — et une lecture approfondie générée par Nova à partir des cartes que tu as tirées.",
    how: "Choisis d'abord ton contexte parmi cinq options : clarifier ton offre, trouver des clients, mieux communiquer, prendre une décision, ou te repositionner. Ajoute en option ton intention du jour. Sélectionne ensuite ton tirage : le Tirage du jour en trois cartes, le Tirage de décision en quatre cartes, ou le Tirage de lancement en cinq cartes. Retourne chaque carte une par une — chaque animal révèle un message, une face d'ombre, une action concrète, et une question de journaling liée à ton contexte business. Une fois toutes les cartes retournées, clique sur « Lire mon tirage ». Pour aller plus loin, « Lecture approfondie par IA » génère un texte personnalisé qui relie les cartes entre elles, identifie un angle mort, et termine par une action à faire aujourd'hui.",
    sowhat: "L'Oracle ne prédit rien. C'est un miroir qui t'oblige à ralentir avant de foncer. Utilise-le les matins où ta tête va plus vite que tes décisions ne le devraient.",
  },
  {
    n: 23,
    slug: "23-terrain",
    title: "Compagnon terrain",
    route: "/terrain",
    icon: "▤",
    hasVideo: false, // pas encore tourné — cf. note en bas de nova-tutos-elevenlabs.md
    why: "Sur un chantier, en visite client ou entre deux rendez-vous, tu n'as ni le temps ni les deux mains libres pour ouvrir un ordinateur. Le Compagnon terrain tient dans ta poche : un chrono, trois boutons de capture, et rien d'autre à penser sur le moment.",
    what: "Un chrono lié à un mandat (ou chantier, ou commande selon ton métier), trois captures rapides — photo, vocal, note — une inbox pour trier ce qui n'a pas de mandat au moment de la capture, et une vue de synthèse sur ordinateur.",
    how: "Sur mobile, l'onglet central de la barre du bas ouvre le Compagnon terrain (`/terrain`). Appuie sur « Démarrer », choisis ou crée le mandat concerné — le chrono se lance immédiatement. Pendant qu'il tourne, les trois boutons Photo / Vocal / Note capturent en une main, sans question posée : tout est rattaché automatiquement au mandat en cours. Appuie sur « Arrêter » pour figer la durée — ajustable par pas de 15 minutes — ajoute une note optionnelle, puis confirme : le temps rejoint la file « à facturer ». Si tu captures sans chrono actif, la capture atterrit dans l'inbox « à trier » : tu la rattaches plus tard à un mandat, l'archives, ou — pour une photo de reçu — la convertis directement en dépense grâce à l'OCR intégré. Sur ordinateur, l'onglet Mandats (dans la section Gestion) affiche la vue de synthèse : temps cumulé et captures par mandat, pour préparer sereinement chaque facture.",
    sowhat: "Chaque minute et chaque justificatif capturés sur le terrain arrivent déjà classés dans Nova — plus besoin de reconstituer sa semaine de mémoire le vendredi soir pour facturer juste.",
  },
];
