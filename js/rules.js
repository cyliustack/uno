import { CARD_TYPES, COLORS, WILD, isWild } from './cards.js';

export function canPlay(card, topCard, currentColor) {
  if (isWild(card)) return true;
  if (card.color === currentColor) return true;
  if (card.color === topCard.color) return true;
  if (card.type === topCard.type && card.type !== CARD_TYPES.NUMBER) return true;
  if (card.type === CARD_TYPES.NUMBER && topCard.type === CARD_TYPES.NUMBER && card.value === topCard.value) {
    return true;
  }
  return false;
}

export function playableCards(hand, topCard, currentColor) {
  return hand.filter((c) => canPlay(c, topCard, currentColor));
}

export function resolveWildColor(card, chosenColor) {
  if (!isWild(card)) return card.color;
  return chosenColor && COLORS.includes(chosenColor) ? chosenColor : COLORS[0];
}

export function cardPoints(card) {
  if (card.type === CARD_TYPES.NUMBER) return card.value;
  if (card.type === CARD_TYPES.DRAW_TWO) return 20;
  if (card.type === CARD_TYPES.REVERSE || card.type === CARD_TYPES.SKIP) return 20;
  if (card.type === CARD_TYPES.WILD) return 50;
  if (card.type === CARD_TYPES.WILD_DRAW_FOUR) return 50;
  return 0;
}

export function effectiveColor(topCard, currentColor) {
  if (isWild(topCard)) return currentColor;
  return topCard.color;
}
