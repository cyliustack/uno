export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const WILD = 'wild';

export const CARD_TYPES = {
  NUMBER: 'number',
  SKIP: 'skip',
  REVERSE: 'reverse',
  DRAW_TWO: 'draw2',
  WILD: 'wild',
  WILD_DRAW_FOUR: 'wild4',
};

const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function createCard(color, type, value = null) {
  return { id: `${color}-${type}-${value ?? 'x'}-${Math.random().toString(36).slice(2, 7)}`, color, type, value };
}

export function buildDeck() {
  const deck = [];

  for (const color of COLORS) {
    deck.push(createCard(color, CARD_TYPES.NUMBER, 0));
    for (let n = 1; n <= 9; n++) {
      deck.push(createCard(color, CARD_TYPES.NUMBER, n));
      deck.push(createCard(color, CARD_TYPES.NUMBER, n));
    }
    for (const type of [CARD_TYPES.SKIP, CARD_TYPES.REVERSE, CARD_TYPES.DRAW_TWO]) {
      deck.push(createCard(color, type));
      deck.push(createCard(color, type));
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push(createCard(WILD, CARD_TYPES.WILD));
    deck.push(createCard(WILD, CARD_TYPES.WILD_DRAW_FOUR));
  }

  return deck;
}

export function cardLabel(card) {
  if (card.type === CARD_TYPES.NUMBER) return String(card.value);
  if (card.type === CARD_TYPES.SKIP) return '⊘';
  if (card.type === CARD_TYPES.REVERSE) return '⇄';
  if (card.type === CARD_TYPES.DRAW_TWO) return '+2';
  if (card.type === CARD_TYPES.WILD) return 'W';
  if (card.type === CARD_TYPES.WILD_DRAW_FOUR) return '+4';
  return '?';
}

export function cardName(card, chosenColor = null) {
  if (card.type === CARD_TYPES.NUMBER) return `${card.color} ${card.value}`;
  if (card.type === CARD_TYPES.SKIP) return `${card.color} skip`;
  if (card.type === CARD_TYPES.REVERSE) return `${card.color} reverse`;
  if (card.type === CARD_TYPES.DRAW_TWO) return `${card.color} +2`;
  if (card.type === CARD_TYPES.WILD) return chosenColor ? `wild (${chosenColor})` : 'wild';
  if (card.type === CARD_TYPES.WILD_DRAW_FOUR) return chosenColor ? `+4 (${chosenColor})` : '+4';
  return cardLabel(card);
}

export function isWild(card) {
  return card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR;
}
