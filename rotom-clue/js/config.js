/* Rotom Clue — réglages du jeu.
   Tout ce qui touche aux règles « modifiables » est ici. */
window.RC = {
  // ---------- Réglages ----------
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  // Paquet fantôme : nombre d'exemplaires de CHAQUE fantôme (2 à 12).
  // 3 => 33 cartes, soit 3 ou 4 cartes par pièce.
  GHOST_COPIES: 3,
  // Nombre de dés lancés (2 = résultat de 2 à 12, comme les numéros des fantômes)
  DICE: 2,

  // ---------- Cartes ----------
  ROTOMS: [
    { key: 'base', cell: '15,2', exitDir: 'down',  name: 'Rotom (Base)', color: '#8ff5e0', start: [0.572, 0.077] },
    { key: 'heat', cell: '8,24', exitDir: 'up',  name: 'Rotom Heat',   color: '#ff6b6b', start: [0.325, 0.925] },
    { key: 'wash', cell: '23,7', exitDir: 'left',  name: 'Rotom Wash',   color: '#3d7bff', start: [0.896, 0.288] },
    { key: 'frost', cell: '2,18', exitDir: 'right', name: 'Rotom Frost',  color: '#9b6bff', start: [0.071, 0.673] },
    { key: 'fan', cell: '10,2', exitDir: 'down',   name: 'Rotom Fan',    color: '#ffe680', start: [0.393, 0.077] },
    { key: 'mow', cell: '23,20', exitDir: 'left',   name: 'Rotom Mow',    color: '#6be38a', start: [0.890, 0.746] },
  ],
  ITEMS: [
    { key: 'antidote',   name: 'Antidote' },
    { key: 'bigpearl',   name: 'Big Pearl' },
    { key: 'dreadplate', name: 'Dread Plate' },
    { key: 'honey',      name: 'Honey' },
    { key: 'oldgateau',  name: 'Old Gateau' },
    { key: 'rarecandy',  name: 'Rare Candy' },
    { key: 'secretkey',  name: 'Secret Key' },
    { key: 'tm90',       name: 'TM90 Substitute' },
  ],
  ROOMS: [
    { key: 'Bathroom',   name: 'Bathroom' },
    { key: 'Bedroom',    name: 'Bedroom' },
    { key: 'DiningHall', name: 'Dining Hall' },
    { key: 'GuestRoom',  name: 'Guest Room' },
    { key: 'Kitchen',    name: 'Kitchen' },
    { key: 'Library',    name: 'Library' },
    { key: 'Playroom',   name: 'Playroom' },
    { key: 'Storage',    name: 'Storage' },
    { key: 'TVRoom',     name: 'TV Room' },
  ],
  // Portes : case de couloir devant la porte, direction pour entrer, variantes où la porte est ouverte
  DOORS: {
    GuestRoom:  [{ cell: '5,8',   dir: 'up',    open: [1, 2] }],
    Bedroom:    [{ cell: '8,6',   dir: 'right', open: [1] },  { cell: '17,6', dir: 'left', open: [2] },
                 { cell: '10,9',  dir: 'up',    open: [2] },  { cell: '15,9', dir: 'up',   open: [1] }],
    TVRoom:     [{ cell: '21,7',  dir: 'up',    open: [1, 2] }],
    Playroom:   [{ cell: '9,13',  dir: 'left',  open: [2] },  { cell: '7,17', dir: 'up',   open: [1] }],
    Library:    [{ cell: '18,11', dir: 'right', open: [2] },  { cell: '23,14', dir: 'up',  open: [1] }],
    Bathroom:   [{ cell: '21,14', dir: 'down',  open: [2] },  { cell: '17,17', dir: 'right', open: [1] }],
    Kitchen:    [{ cell: '8,20',  dir: 'left',  open: [1, 2] }],
    DiningHall: [{ cell: '12,18', dir: 'down',  open: [1] },  { cell: '13,18', dir: 'down', open: [2] }, { cell: '16,21', dir: 'left', open: [1] }],
    Storage:    [{ cell: '17,22', dir: 'right', open: [1, 2] }],
  },
  // Passages secrets : la variante (1 ou 2) de la pièce dans laquelle l'entrée est ouverte
  PASSAGES: {
    GuestRoom: { to: 'Storage',   openIn: 2 },
    Storage:   { to: 'GuestRoom', openIn: 1 },
    TVRoom:    { to: 'Kitchen',   openIn: 1 },
    Kitchen:   { to: 'TVRoom',    openIn: 2 },
  },
  GHOSTS: {
    2:  { name: 'Banette',    text: "If there is a ghost token on this card at the start of your turn, you cannot make a suggestion. Resolve all ghost tokens on this card at the end of your turn." },
    3:  { name: 'Duskull',    text: "Other players who roll 3 may randomly choose and peek at one of the cards in this player's hand." },
    4:  { name: 'Drifloon',   text: "Give this card to a player of your choice. They must give you a card of their choice in return. They may not give you a card with unresolved ghost tokens." },
    5:  { name: 'Mismagius',  text: "When you make a suggestion, you must list one additional item for each ghost token on this card. The player to your right chooses which one of these items is used in your suggestion." },
    6:  { name: 'Shuppet',    text: "Subtract 2 from your next move for each ghost token on this card." },
    7:  { name: 'Gastly',     text: "Add 2 to your next move for each ghost token on this card." },
    8:  { name: 'Spiritomb',  text: "Add or remove one ghost token to or from any card that currently has a ghost token on it." },
    9:  { name: 'Misdreavus', text: "At the start of your turn, you may toggle the doors of one room for each ghost token on this card." },
    10: { name: 'Sableye',    text: "Randomly choose and peek at one of the cards in the hand of the player who rolled 10." },
    11: { name: 'Dusknoir',   text: "Immediately draw a ghost card from a room of your choice." },
    12: { name: 'Gengar',     text: "For each ghost token on this card at the start of your turn, you may sacrifice your roll to warp to a room of your choice and make a suggestion." },
  },
  // Zone centrale du plateau (le Peebboof)
  PEEBBOOF: { x: 0.414, y: 0.419, w: 0.169, h: 0.234 },
};
