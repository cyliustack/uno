import { COLORS, isWild } from './cards.js?v=20260602-photos';
import { playableCards } from './rules.js?v=20260602-photos';

function scoreCard(card, handSize) {
  let score = 0;
  if (isWild(card)) score += 3;
  if (card.type === 'draw2' || card.type === 'wild4') score += 4;
  if (card.type === 'skip' || card.type === 'reverse') score += 2;
  if (handSize === 1) score += 10;
  return score;
}

export function chooseAiPlay(hand, topCard, currentColor) {
  const legal = playableCards(hand, topCard, currentColor);
  if (legal.length === 0) return null;

  legal.sort((a, b) => scoreCard(b, hand.length) - scoreCard(a, hand.length));
  const card = legal[0];
  let wildColor = null;
  if (isWild(card)) {
    const counts = Object.fromEntries(COLORS.map((c) => [c, 0]));
    for (const c of hand) {
      if (c.color !== 'wild') counts[c.color]++;
    }
    wildColor = COLORS.reduce((best, c) => (counts[c] > counts[best] ? c : best), COLORS[0]);
  }
  return { cardId: card.id, wildColor };
}
