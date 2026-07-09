## Prompt Originel

Comment j'adapte l'app en mobile sans tout refaire ?

Aujourd'hui c'est inutilisable < 1000px. Sidebar 240px fixe, Kanban Pipeline force 6 colonnes.

Les vrais choix :
1. Sidebar : je la cache en mobile et je mets un burger menu ? Ou collapsible mais toujours visible ? Ou caché par défaut, toggle visible ?
2. Kanban Pipeline (6 colonnes) : scrolle horizontalement ? Collapse en accordéon mobile-only ? Afficher que 2 colonnes à la fois ?
3. GobanCoach (board 19×19) : ça vaut le coup de l'adapter vraiment, ou c'est OK si c'est desktop-only ?
4. Breakpoints : je suis les standards Tailwind (640/768/1024) ou j'ai des règles custom pour l'app ?

Aide-moi à arbitrer — c'est un jeu de compromis entre effort et expérience utilisateur.

## Réponse de Claude Opus

Avant d'arbitrer, une question qui vient avant tes quatre questions : est-ce que tu sais qui utilise cette app sur mobile, et pour faire quoi ? Parce que « c'est inutilisable < 1000px » n'est un problème que si quelqu'un essaie vraiment de s'en servir là. Un dashboard de pilotage comme Momentum, tu le consultes peut-être le matin sur ton téléphone pour cocher tes actions du jour, mais tu ne vas pas manipuler un Kanban à six colonnes dans le métro. Si le mobile sert à consulter et cocher, pas à orchestrer, alors la moitié de ton effort d'adaptation porte sur des écrans que personne ne touchera sur petit format. Ça change complètement l'arbitrage : tu n'adaptes pas « l'app », tu adaptes les deux ou trois vues qui ont une raison d'exister dans une poche.

Ceci dit, voilà comment je trancherais chaque point.

La sidebar, caché par défaut avec un toggle burger. Le « collapsible mais toujours visible » — l'icône seule sur 60px — c'est le pire des deux mondes en mobile : ça mange de la largeur sur un écran où chaque pixel compte, et une bande d'icônes sans label est illisible tant que tu n'as pas mémorisé quel pictogramme veut dire quoi. En desktop la sidebar réduite marche parce qu'il te reste 1200px à côté ; en mobile tu pars de 375px. Donc off-canvas : drawer qui glisse par-dessus le contenu, overlay sombre derrière, un tap ferme. Techniquement c'est le changement le moins invasif aussi — ton composant sidebar existe déjà, tu l'enveloppes dans un conteneur `fixed` avec une transform translateX, et tu ajoutes un bouton burger dans un header mobile. Tu ne réécris pas la nav, tu changes son mode d'affichage.

Le Kanban, scroll horizontal, sans hésiter. L'accordéon casse le sens même d'un Kanban — la valeur c'est de voir le flux, les cartes qui avancent d'une colonne à l'autre ; si tu les empiles verticalement en accordéon tu as juste six listes déguisées, autant faire une vraie vue liste à ce moment-là. Le « 2 colonnes à la fois » avec pagination, c'est de la mécanique de navigation en plus pour un gain douteux. Le scroll horizontal avec scroll-snap sur chaque colonne (`scroll-snap-type: x mandatory`), colonnes en largeur fixe genre 85vw pour qu'on devine qu'il y en a une suivante, c'est le geste que les gens connaissent déjà sur mobile. Effort quasi nul : tu enlèves la contrainte grid qui force les 6 colonnes dans la largeur, tu passes en flex avec overflow-x auto.

Sauf que — reviens à ma question du début. Si personne ne bosse le pipeline sur mobile, le meilleur Kanban mobile est peut-être pas un Kanban du tout, mais une vue liste des deals triés par colonne, en lecture. Le scroll horizontal reste le bon choix *si* tu veux garder l'interaction ; c'est juste que tu devrais vérifier que tu la veux.

Le Goban 19×19, desktop-only assumé, et je pèse mes mots. Un plateau de Go a besoin de précision au placement — 361 intersections. Sur 375px de large, chaque intersection fait moins de 20px, en dessous du seuil de confort tactile (44px chez Apple, 48 chez Google). Tu peux techniquement le faire tenir, mais tu livres une frustration : les gens poseront la pierre à côté. L'adapter vraiment voudrait dire pinch-to-zoom, placement à deux temps (tu tapes, un curseur apparaît, tu confirmes), retour visuel agrandi — c'est un chantier à part entière pour un usage que je soupçonne marginal sur téléphone. Mets un message propre « GobanCoach s'utilise sur écran large » plutôt qu'une version dégradée qui donne l'impression que l'app est cassée. Un blocage assumé se lit comme un choix ; une version bancale se lit comme un bug.

Les breakpoints, reste sur Tailwind standard. Tu n'as aucune raison de payer le coût mental de breakpoints custom : chaque valeur non-standard est une chose que toi (ou ton futur toi qui rouvre le code dans six mois) doit re-vérifier au lieu de lire d'un coup d'œil. Le seul ajustement qui vaille : ton vrai point de bascule est vers 1000px d'après ce que tu décris, ce qui tombe entre `md` (768) et `lg` (1024). Cale-toi sur `lg`. En dessous de 1024 tu passes en mode mobile/tablette — sidebar en drawer, Kanban en scroll. Ça t'évite d'inventer un `1000px` qui n'existe nulle part ailleurs dans ton écosystème.

Le fil qui relie tout ça : ton instinct de ne pas tout refaire est bon, et la meilleure façon de l'honorer c'est de refaire encore moins que ce que tu prévoyais. Sidebar en drawer et Kanban en scroll horizontal, c'est peut-être une demi-journée à deux composants près. Le Goban, tu ne le touches pas. Les breakpoints, tu ne les inventes pas. Le gros de ton temps devrait aller à une chose que ta liste ne mentionne pas — vérifier que les vues que les gens consultent vraiment sur mobile (le dashboard, la coche d'action quotidienne) respirent bien en une colonne. C'est là que se joue le « utilisable ou pas », pas dans le Kanban que tu manipuleras toujours assis à ton bureau.