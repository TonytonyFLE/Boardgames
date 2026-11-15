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
- **Déplacement case par case** : on avance avec les flèches (écran ou clavier) ou en touchant les cases en surbrillance. Un mouvement impossible (mur, porte fermée, case occupée, case déjà visitée) ne coûte aucun pas, et le bouton « Annuler le dernier pas » permet de revenir en arrière.
- **Entrer dans une pièce** par une porte ouverte termine le déplacement et fait piocher une carte fantôme, s'il en reste. Pour sortir d'une pièce, on touche une porte verte en surbrillance.
- **Suggestions** : le Rotom et l'objet suggérés sont déplacés dans la pièce. La réfutation se fait dans l'ordre du tour, et la carte montrée n'est visible que par celui qui a fait la suggestion.
- **Accusation** : clique sur le bouton *Accuser* ou sur le centre du plateau. Une seule accusation est permise par joueur.

## Ce qui reste manuel (« table virtuelle »)
- **Les effets des cartes fantômes** se jouent avec le bouton *Effets des cartes fantômes…*, qui permet de :
  - regarder une carte au hasard chez un joueur ;
  - donner une carte ;
  - piocher dans une pièce ;
  - basculer les portes d'une pièce ;
  - modifier son nombre de pas (Shuppet, Gastly) ;
  - se téléporter dans une pièce (Gengar).
  Les jetons fantômes s'ajoutent ou se retirent avec les boutons + / −. Le bouton ↩ remet la carte en main une fois l'effet résolu.

## Réglages
Les réglages sont dans `js/config.js` :
- le nombre de joueurs ;
- le nombre d'exemplaires de chaque fantôme (`GHOST_COPIES`, 3 par défaut, soit 33 cartes) ;
- les portes de chaque pièce (`DOORS`) ;
- le nombre de dés ;
- les textes des cartes ;
- les passages secrets.

## Limites connues
- **La connexion en ligne** utilise PeerJS et son serveur public gratuit. Certains réseaux très filtrés, comme un Wi-Fi d'école ou d'entreprise, peuvent bloquer les connexions directes entre appareils.
- **Usage privé** : Pokémon est une marque de The Pokémon Company et de Nintendo. Ce projet de fan doit rester privé, non commercial et non référencé publiquement.

Illustrations : @peebr_koifish
