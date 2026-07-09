## Prompt Originel

Comment je refactorise les composants Select/Textarea partagés sans casser ce qui marche ?

Situation : j'ai 7 fichiers qui ont du styling inline quasi-identique (labels, selects, textareas). Aujourd'hui c'est dupliqué partout. Je veux un seul composant partagé, mais migration intelligente.

Questions :
1. Je fais un wrapper `<Field>` qui contient Input/Select/Textarea + label + errors ? Ou je refactorise les trois composants indépendamment ?
2. Quel est l'ordre optimal pour migrer les 7 fichiers sans casser la prod ?
3. Quels CSS tokens je dois ajouter pour standardiser tout ça ?
4. Comment je gère la validation/les erreurs de manière centralisée ?

Pense avec moi — c'est pas qu'une question technique, c'est une question de dette.

------

## Réponse de Claude Opus

Avant de répondre à tes quatre questions, une plus utile : c'est quoi le vrai problème que tu résous ? Parce que « styling inline quasi-identique dans 7 fichiers » ce n'est pas encore de la dette douloureuse. La dette devient coûteuse quand tu dois changer quelque chose *partout à la fois* et que tu as peur d'en oublier un. Est-ce que ça t'est déjà arrivé ? Si oui, quel changement — un token de couleur, un état d'erreur, une règle d'accessibilité ? La réponse oriente tout le reste. Refactoriser du duplicata qui ne bouge jamais, c'est du travail propre qui ne rapporte rien. Le "quasi" dans "quasi-identique" est aussi suspect : les sept variantes divergent probablement pour de bonnes raisons que tu vas découvrir en cours de route, et un composant unique qui doit avaler toutes les exceptions redevient un monstre à props conditionnelles. Parfois trois divergences sur sept veulent dire que tu as en réalité deux composants, pas un.

Cela dit, tu as sûrement une raison de sentir que ça pèse. Alors allons-y.

**1. Wrapper `<Field>` ou trois composants indépendants ?**

Les deux, dans cet ordre. Le piège du `<Field>` tout-en-un, c'est qu'il couple trois responsabilités qui n'ont pas la même durée de vie : le contrôle lui-même (l'input, le select), l'habillage (label + erreur + espacement), et le câblage de validation. Si tu les fusionnes d'entrée, chaque fois que tu touches un select tu risques de casser un textarea.

Sépare la couche primitive de la couche composée. Tes trois primitives — `Input`, `Select`, `Textarea` — ne connaissent que leur propre style et leurs états visuels (focus, disabled, erreur). Elles ne savent rien des labels ni des messages d'erreur. Au-dessus, `Field` orchestre : il prend un label, un enfant (une des primitives), un message d'erreur, et gère l'espacement et le lien `htmlFor`/`aria-describedby`. C'est un peu comme la plomberie : les tuyaux (primitives) et les raccords (Field) sont deux métiers. Tu peux remplacer un tuyau sans refaire tous les raccords.

Concrètement Field devient un composant "slot" :

```jsx
<Field label="Canton" error={errors.canton} htmlFor="canton">
  <Select id="canton" value={...} onChange={...} aria-invalid={!!errors.canton}>
```

Le contrôle reste explicite. Tu ne caches pas le select derrière une prop `type="select"` qui t'obligerait à réexposer chaque attribut du select natif un par un — c'est cette réexposition qui transforme les wrappers en dette pire que celle que tu remplaces.

**2. L'ordre de migration sans casser la prod**

Le principe qui te protège : le nouveau code cohabite avec l'ancien jusqu'à ce que le dernier fichier bascule. Tu ne fais pas un big-bang.

D'abord tu construis les primitives et Field à côté, sans toucher aux 7 fichiers. Tu les testes en isolation (Storybook ou une page scratch, peu importe). À ce stade rien en prod n'a bougé.

Ensuite tu migres **un seul fichier** — et tu choisis lequel avec soin. Pas le plus critique, pas le plus simple non plus. Prends celui qui est *représentatif* : assez riche pour révéler les cas tordus (une erreur async, un select dépendant d'un autre champ), mais pas ta page de paiement. Ce premier fichier est ton banc d'essai. C'est là que tu découvres que ton API de composant est fausse, pendant que le coût de la corriger est encore d'un seul fichier.

Une fois ce fichier stabilisé et en prod sans régression, tu migres les six autres du plus simple au plus complexe. À l'envers de l'intuition, oui : maintenant que l'API est validée, tu veux enchaîner les gains faciles pour bâtir la confiance, et garder les cas tordus pour la fin quand tu maîtrises complètement l'outil.

À chaque fichier migré, un diff visuel avant/après. Le styling inline "quasi-identique" cache des écarts de padding ou de marge que ton composant unifié va révéler — et un pixel qui saute, c'est le genre de chose qui fait dire "le refacto a cassé le design".

**3. Les tokens CSS**

Tu ne standardises que ce qui est réellement partagé. Regarde tes 7 fichiers et note ce qui revient : les hauteurs de champ, le rayon de bordure, la couleur de bordure au repos / focus / erreur, la couleur et la taille du label, l'espacement label→champ et champ→erreur. Ça donne à peu près :

```css
--field-height, --field-padding-x
--field-radius
--field-border, --field-border-focus, --field-border-error
--field-bg, --field-bg-disabled
--label-color, --label-size, --label-weight
--field-gap          /* label → contrôle */
--field-error-gap    /* contrôle → message */
--field-error-color
```

Le test de vérité : si une valeur n'apparaît qu'à un seul endroit dans tes 7 fichiers, ce n'est pas un token, c'est une valeur locale. Un token qui ne sert qu'une fois ajoute de l'indirection sans mutualiser quoi que ce soit. Commence étroit, tu élargiras quand un vrai besoin de cohérence apparaîtra.

**4. La validation centralisée**

Attention au mot "centralisée" — il cache une ambiguïté. Il y a la *logique* de validation (est-ce que ce canton est valide, est-ce que cet email a le bon format) et l'*affichage* de l'erreur (où et comment le message s'affiche). Ne centralise que le second dans tes composants.

Field s'occupe de l'affichage : il reçoit un message d'erreur en prop, l'affiche au bon endroit avec le bon `aria-describedby`, met la bordure en rouge. Il ne sait pas *pourquoi* c'est une erreur. La logique, elle, reste dans un système à part — react-hook-form + un schéma Zod si tu veux du déclaratif, ou ton propre hook de form. Le composant est bête, la validation est intelligente, et les deux se parlent par une seule prop `error: string | undefined`.

Pourquoi cette frontière ? Parce que si tu enfermes les règles de validation dans les composants, tu ne peux plus les réutiliser côté serveur, tu ne peux plus valider un formulaire entier d'un coup, et tu recouples ce que tu venais de découpler. Le composant qui affiche une erreur et le composant qui décide qu'il y a erreur, ce sont deux métiers — encore une fois la plomberie et le plombier.

Une chose que je ne sais pas de ta situation et qui changerait ma réponse : est-ce que tes 7 fichiers utilisent déjà une lib de forms, ou chacun bricole son propre `useState` d'erreurs ? Si c'est le second cas, le vrai gros morceau de ton refacto n'est pas les composants visuels — c'est unifier la gestion d'état des formulaires, et ça mérite d'être traité comme un chantier séparé, après les primitives, pas mélangé avec.