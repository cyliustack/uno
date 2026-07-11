import { buildDeck, CARD_TYPES, COLORS, cardName, isWild, WILD } from './cards.js?v=20260602-photos';
import { drawCards, shuffle } from './deck.js?v=20260602-photos';
import { canPlay, effectiveColor, resolveWildColor } from './rules.js?v=20260602-photos';

export const GAME_PHASE = {
  SETUP: 'setup',
  PLAYING: 'playing',
  WILD_PICK: 'wild_pick',
  UNO_CALL: 'uno_call',
  FINISHED: 'finished',
};

export function createPlayer(id, name, isHuman = false, photoUrl = null) {
  return { id, name, isHuman, photoUrl, hand: [], saidUno: false };
}

export function createGame(playerConfigs) {
  const players = playerConfigs.map((p, i) => createPlayer(i, p.name, p.isHuman, p.photoUrl));
  const deck = shuffle(buildDeck());

  for (const player of players) {
    player.hand.push(...drawCards(deck, 7));
  }

  let discard = [];
  while (discard.length === 0) {
    const card = deck.pop();
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      deck.unshift(card);
      continue;
    }
    discard.push(card);
  }

  let direction = 1;
  let currentIndex = 0;
  let currentColor = discard[0].color;
  let drawStack = 0;
  let phase = GAME_PHASE.PLAYING;
  let winner = null;
  let pendingWildCard = null;
  let lastAction = 'Game started!';
  let lastPlayedCardName = null;

  function cardDebug(card) {
    if (!card) return null;
    return {
      id: card.id,
      color: card.color,
      type: card.type,
      value: card.value,
    };
  }

  function stateDebug() {
    return {
      phase,
      currentIndex,
      currentPlayer: currentPlayer()?.name,
      currentColor,
      direction,
      topCard: cardDebug(topCard()),
      deckCount: deck.length,
      discardCount: discard.length,
      drawStack,
      pendingWildCard,
      lastAction,
      winner: winner?.name ?? null,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        handCount: p.hand.length,
        saidUno: p.saidUno,
      })),
    };
  }

  function logGame(step, details = {}) {
    const payload = {
      ...details,
      state: stateDebug(),
    };
    console.log(`[UNO game] ${step}`, payload);
    if (typeof window !== 'undefined') {
      window.UNO_DEBUG_LOG?.('game', step, payload);
    }
  }

  logGame('created');

  function topCard() {
    return discard[discard.length - 1];
  }

  function currentPlayer() {
    return players[currentIndex];
  }

  function nextIndex(from, steps = 1) {
    const n = players.length;
    return ((from + steps * direction) % n + n) % n;
  }

  function advanceTurn(steps = 1) {
    const fromIndex = currentIndex;
    currentIndex = nextIndex(currentIndex, steps);
    const p = currentPlayer();
    p.saidUno = false;
    logGame('advanceTurn', {
      fromIndex,
      toIndex: currentIndex,
      steps,
    });
  }

  function reshuffleIfNeeded() {
    if (deck.length < 5 && discard.length > 1) {
      logGame('reshuffleIfNeeded:start');
      const top = discard.pop();
      const toShuffle = discard.splice(0);
      deck.push(...shuffle(toShuffle));
      discard = [top];
      logGame('reshuffleIfNeeded:end');
    }
  }

  function drawForPlayer(player, count) {
    logGame('drawForPlayer:start', {
      player: player.name,
      requested: count,
    });
    reshuffleIfNeeded();
    const drawn = drawCards(deck, count);
    player.hand.push(...drawn);
    logGame('drawForPlayer:end', {
      player: player.name,
      requested: count,
      drawn: drawn.length,
      cards: drawn.map(cardDebug),
    });
    return drawn.length;
  }

  function checkWinner(player) {
    if (player.hand.length === 0) {
      phase = GAME_PHASE.FINISHED;
      winner = player;
      lastAction = `${player.name} wins!`;
      logGame('checkWinner:winner', { player: player.name });
      return true;
    }
    logGame('checkWinner:none', { player: player.name });
    return false;
  }

  function applyCardEffect(card, wildColor) {
    logGame('applyCardEffect:start', {
      card: cardDebug(card),
      wildColor,
    });
    const color = resolveWildColor(card, wildColor);
    currentColor = color;
    const playedName = cardName(card, isWild(card) ? color : null);
    lastPlayedCardName = playedName;

    if (card.type === CARD_TYPES.SKIP) {
      lastAction = `${currentPlayer().name} played ${playedName}. Skip!`;
      logGame('applyCardEffect:skip');
      return;
    }
    if (card.type === CARD_TYPES.REVERSE) {
      if (players.length > 2) direction *= -1;
      const effect = players.length === 2 ? 'Reverse (skip)!' : 'Direction reversed!';
      lastAction = `${currentPlayer().name} played ${playedName}. ${effect}`;
      logGame('applyCardEffect:reverse');
      return;
    }
    if (card.type === CARD_TYPES.DRAW_TWO) {
      drawStack += 2;
      lastAction = `${currentPlayer().name} played ${playedName}`;
      logGame('applyCardEffect:drawTwo');
      return;
    }
    if (card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      drawStack += 4;
      lastAction = `${currentPlayer().name} played ${playedName}`;
      logGame('applyCardEffect:wildDrawFour');
      return;
    }
    lastAction = `${currentPlayer().name} played ${playedName}`;
    logGame('applyCardEffect:numberOrWild');
  }

  function playCard(playerIndex, cardId, wildColor = null) {
    logGame('playCard:start', {
      playerIndex,
      cardId,
      wildColor,
    });
    if (phase !== GAME_PHASE.PLAYING && phase !== GAME_PHASE.WILD_PICK) {
      logGame('playCard:rejectPhase', { playerIndex, cardId, wildColor });
      return { ok: false, error: 'Not your turn' };
    }
    if (playerIndex !== currentIndex) {
      logGame('playCard:rejectTurn', { playerIndex, expected: currentIndex });
      return { ok: false, error: 'Not your turn' };
    }

    const player = players[playerIndex];
    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      logGame('playCard:rejectMissingCard', { playerIndex, cardId });
      return { ok: false, error: 'Card not in hand' };
    }

    const card = player.hand[cardIndex];
    const top = topCard();

    if (!canPlay(card, top, currentColor)) {
      logGame('playCard:rejectIllegal', {
        card: cardDebug(card),
        top: cardDebug(top),
      });
      return { ok: false, error: 'Illegal play' };
    }

    if (isWild(card) && !wildColor && phase !== GAME_PHASE.WILD_PICK) {
      pendingWildCard = { playerIndex, cardId };
      phase = GAME_PHASE.WILD_PICK;
      logGame('playCard:needsWildColor', { card: cardDebug(card) });
      return { ok: true, needsColor: true };
    }

    const chosen = wildColor || (isWild(card) ? COLORS[0] : null);
    logGame('playCard:accepted', {
      player: player.name,
      card: cardDebug(card),
      chosen,
    });
    player.hand.splice(cardIndex, 1);
    discard.push(card);

    if (player.hand.length === 1) {
      player.saidUno = true;
      lastAction = `${player.name} called UNO!`;
      logGame('playCard:autoUno', { player: player.name });
    }

    if (checkWinner(player)) {
      logGame('playCard:endWon', { player: player.name });
      return { ok: true, won: true };
    }

    applyCardEffect(card, chosen);

    let turnSteps = 1;
    if (card.type === CARD_TYPES.SKIP) turnSteps = 2;
    if (card.type === CARD_TYPES.REVERSE && players.length === 2) turnSteps = 2;
    advanceTurn(turnSteps);

    if (drawStack > 0) {
      const target = currentPlayer();
      logGame('playCard:resolveDrawStack:start', {
        target: target.name,
        drawStack,
      });
      drawForPlayer(target, drawStack);
      lastAction = `${target.name} draws ${drawStack} from ${lastPlayedCardName}`;
      drawStack = 0;
      lastPlayedCardName = null;
      advanceTurn();
      logGame('playCard:resolveDrawStack:end');
    }

    phase = GAME_PHASE.PLAYING;
    pendingWildCard = null;
    logGame('playCard:endOk');
    return { ok: true };
  }

  function pickWildColor(playerIndex, color) {
    logGame('pickWildColor:start', { playerIndex, color });
    if (phase !== GAME_PHASE.WILD_PICK || !pendingWildCard) {
      logGame('pickWildColor:rejectNoPending', { playerIndex, color });
      return { ok: false, error: 'No wild pending' };
    }
    if (playerIndex !== pendingWildCard.playerIndex) {
      logGame('pickWildColor:rejectTurn', {
        playerIndex,
        pendingPlayerIndex: pendingWildCard.playerIndex,
      });
      return { ok: false, error: 'Not your turn' };
    }
    if (!COLORS.includes(color)) {
      logGame('pickWildColor:rejectColor', { color });
      return { ok: false, error: 'Invalid color' };
    }
    const result = playCard(pendingWildCard.playerIndex, pendingWildCard.cardId, color);
    logGame('pickWildColor:end', { result });
    return result;
  }

  function drawCard(playerIndex) {
    logGame('drawCard:start', { playerIndex });
    if (phase !== GAME_PHASE.PLAYING) return { ok: false, error: 'Cannot draw now' };
    if (playerIndex !== currentIndex) return { ok: false, error: 'Not your turn' };

    const player = players[playerIndex];
    const n = drawForPlayer(player, 1);
    if (n === 0) return { ok: false, error: 'Deck empty' };

    lastAction = `${player.name} drew a card`;
    advanceTurn();
    logGame('drawCard:end', { playerIndex, drawn: n });
    return { ok: true };
  }

  function timeoutDraw(playerIndex, count = 3) {
    logGame('timeoutDraw:start', { playerIndex, count });
    if (phase !== GAME_PHASE.PLAYING) return { ok: false, error: 'Cannot draw now' };
    if (playerIndex !== currentIndex) return { ok: false, error: 'Not your turn' };

    const player = players[playerIndex];
    const n = drawForPlayer(player, count);
    if (n === 0) return { ok: false, error: 'Deck empty' };

    lastAction = `${player.name} took too long and drew ${n}`;
    advanceTurn();
    logGame('timeoutDraw:end', { playerIndex, drawn: n });
    return { ok: true };
  }

  function callUno(playerIndex) {
    logGame('callUno:start', { playerIndex });
    const player = players[playerIndex];
    if (player.hand.length !== 1) {
      logGame('callUno:rejectHandCount', {
        playerIndex,
        handCount: player.hand.length,
      });
      return { ok: false, error: 'Not one card' };
    }
    player.saidUno = true;
    lastAction = `${player.name} called UNO!`;
    logGame('callUno:end', { playerIndex });
    return { ok: true };
  }

  function getState() {
    return {
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        photoUrl: p.photoUrl,
        handCount: p.hand.length,
        hand: p.isHuman ? [...p.hand] : [],
        saidUno: p.saidUno,
      })),
      currentIndex,
      currentColor,
      direction,
      topCard: topCard(),
      deckCount: deck.length,
      drawStack,
      phase,
      winner: winner ? { id: winner.id, name: winner.name } : null,
      lastAction,
      pendingWild: !!pendingWildCard,
    };
  }

  function getHand(playerIndex) {
    return [...players[playerIndex].hand];
  }

  return {
    players,
    getState,
    getHand,
    playCard,
    pickWildColor,
    drawCard,
    timeoutDraw,
    callUno,
    currentPlayer,
    topCard,
  };
}
