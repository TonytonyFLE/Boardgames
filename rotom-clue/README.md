# Rotom Clue — version web

Jeu en ligne de 2 à 6 joueurs. Chaque joueur utilise son propre téléphone ou ordinateur. Il n'y a ni compte ni installation.

## Mettre en ligne (GitHub Pages)
1. Crée un dépôt GitHub et dépose-y **tout le contenu** de ce dossier : `index.html`, `style.css`, `js/`, `lib/`, `assets/`.
2. Va dans *Settings → Pages*, choisis *Deploy from a branch*, puis `main` / `root`.
3. Ton jeu est disponible à l'adresse `https://<ton-compte>.github.io/<dépôt>/`.

## Jouer
- **L'hôte** clique sur *Créer une partie*. Il obtient un code de 4 lettres et un lien d'invitation à partager.
- **Les autres joueurs** ouvrent le lien, ou saisissent le code, puis choisissent leur Rotom.
- L'hôte lance la partie. **Sa page doit rester ouverte** pendant toute la partie, car c'est elle qui garde les cartes secrètes.
  Si elle se ferme, l'hôte la rouvre et clique sur *Reprendre ma partie*. Les joueurs se reconnectent alors tout seuls.

## Tester seul
Coche *Mode test* sur la page d'accueil. Crée la partie dans un onglet, puis rejoins-la depuis d'autres onglets du même navigateur. Ce mode fonctionne sans internet.

## Ce qui est automatique
- **Le bouton Start** mélange les cartes, remplit le Peebboof, distribue les mains et répartit les cartes fantômes dans les pièces. Il tire aussi au hasard les portes et les passages secrets (variante A ou B de chaque pièce).
- **Les dés** : 2 dés, avec un total de 2 à 12. Les cartes fantômes dont c'est le numéro se révèlent toutes seules. Une carte déjà révélée reçoit un jeton fantôme supplémentaire.
- **Entrer dans une pièce** en glissant son pion y fait piocher une carte fantôme, s'il en reste.
- **Suggestions** : le Rotom et l'objet suggérés sont déplacés dans la pièce. La réfutation se fait dans l'ordre du tour, et la carte montrée n'est visible que par celui qui a fait la suggestion.
- **Accusation** : clique sur le bouton *Accuser* ou sur le centre du plateau. Une seule accusation est permise par joueur.

## Ce qui reste manuel (« table virtuelle »)
- **Les déplacements** : tu glisses ton pion du nombre de cases indiqué, et le jeu ne compte pas les cases.
- **Les effets des cartes fantômes** se jouent avec le bouton *Effets des cartes fantômes…*, qui permet de :
  - regarder une carte au hasard chez un joueur ;
  - donner une carte ;
  - piocher dans une pièce ;
  - basculer les portes d'une pièce.
  Les jetons fantômes s'ajoutent ou se retirent avec les boutons + / −. Le bouton ↩ remet la carte en main une fois l'effet résolu.

## Réglages
Les réglages sont dans `js/config.js` :
- le nombre de joueurs ;
- les doublons du paquet fantôme (`GHOST_DUPLICATES`) ;
- le nombre de dés ;
- les textes des cartes ;
- les passages secrets.

## Limites connues
- **La connexion en ligne** utilise PeerJS et son serveur public gratuit. Certains réseaux très filtrés, comme un Wi-Fi d'école ou d'entreprise, peuvent bloquer les connexions directes entre appareils.
- **Usage privé** : Pokémon est une marque de The Pokémon Company et de Nintendo. Ce projet de fan doit rester privé, non commercial et non référencé publiquement.

Illustrations : @peebr_koifish
