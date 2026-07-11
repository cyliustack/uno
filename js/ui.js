import { cardLabel, COLORS, isWild } from './cards.js?v=20260602-photos';
import { canPlay } from './rules.js?v=20260602-photos';

const COLOR_CLASS = {
  red: 'card-red',
  yellow: 'card-yellow',
  green: 'card-green',
  blue: 'card-blue',
  wild: 'card-wild',
};

export function createUIRoot() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="game-shell">
      <header class="header">
        <h1>UNO</h1>
        <p class="status" id="status"></p>
      </header>
      <div class="table">
        <div class="opponents" id="opponents"></div>
        <div class="center">
          <div class="pile deck-pile" id="deck-pile" title="Draw">
            <span class="deck-count" id="deck-count"></span>
          </div>
          <div class="pile discard-pile" id="discard-pile"></div>
          <div class="color-indicator" id="color-indicator"></div>
        </div>
        <div class="player-area">
          <div class="player-controls">
            <img class="avatar player-avatar" id="player-avatar" alt="" />
            <button type="button" id="btn-uno" class="btn btn-uno">UNO!</button>
            <button type="button" id="btn-draw" class="btn btn-draw">Draw</button>
            <button type="button" id="btn-new" class="btn btn-new">New Game</button>
          </div>
          <div class="hand" id="player-hand"></div>
        </div>
      </div>
      <div class="wild-picker hidden" id="wild-picker">
        <p>Choose a color</p>
        <div class="wild-colors"></div>
      </div>
      <section class="debug-panel" aria-label="Debug log">
        <div class="debug-title">Debug log</div>
        <pre class="debug-log" id="debug-log"></pre>
      </section>
      <div class="overlay hidden" id="overlay">
        <div class="overlay-box">
          <h2 id="overlay-title"></h2>
          <p id="overlay-msg"></p>
          <button type="button" id="overlay-btn" class="btn">Play Again</button>
        </div>
      </div>
      <div class="setup" id="setup">
        <h2>Start a game</h2>
        <img class="avatar setup-avatar" id="setup-avatar" alt="" />
        <label>Your name <input type="text" id="player-name" value="You" maxlength="12" /></label>
        <div class="camera-controls">
          <button type="button" id="btn-camera" class="btn btn-secondary">Use Camera</button>
          <button type="button" id="btn-capture" class="btn btn-secondary hidden">Capture</button>
          <button type="button" id="btn-camera-cancel" class="btn btn-new hidden">Cancel</button>
        </div>
        <video class="camera-preview hidden" id="camera-preview" autoplay playsinline muted></video>
        <canvas class="hidden" id="camera-canvas"></canvas>
        <label>Opponents
          <select id="opponent-count">
            <option value="1">1 AI</option>
            <option value="2" selected>2 AI</option>
            <option value="3">3 AI</option>
          </select>
        </label>
        <button type="button" id="btn-start" class="btn btn-primary">Deal cards</button>
      </div>
    </div>
  `;

  const wildColorsEl = app.querySelector('.wild-colors');
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `wild-color-btn color-${c}`;
    b.dataset.color = c;
    b.setAttribute('aria-label', c);
    wildColorsEl.appendChild(b);
  }

  return {
    status: document.getElementById('status'),
    opponents: document.getElementById('opponents'),
    deckPile: document.getElementById('deck-pile'),
    playerAvatar: document.getElementById('player-avatar'),
    deckCount: document.getElementById('deck-count'),
    discardPile: document.getElementById('discard-pile'),
    colorIndicator: document.getElementById('color-indicator'),
    playerHand: document.getElementById('player-hand'),
    btnUno: document.getElementById('btn-uno'),
    btnDraw: document.getElementById('btn-draw'),
    btnNew: document.getElementById('btn-new'),
    wildPicker: document.getElementById('wild-picker'),
    wildColorBtns: app.querySelectorAll('.wild-color-btn'),
    debugLog: document.getElementById('debug-log'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayMsg: document.getElementById('overlay-msg'),
    overlayBtn: document.getElementById('overlay-btn'),
    setup: document.getElementById('setup'),
    setupAvatar: document.getElementById('setup-avatar'),
    btnCamera: document.getElementById('btn-camera'),
    btnCapture: document.getElementById('btn-capture'),
    btnCameraCancel: document.getElementById('btn-camera-cancel'),
    cameraPreview: document.getElementById('camera-preview'),
    cameraCanvas: document.getElementById('camera-canvas'),
    btnStart: document.getElementById('btn-start'),
    playerName: document.getElementById('player-name'),
    opponentCount: document.getElementById('opponent-count'),
  };
}

export function renderCardElement(card, { playable = false, onClick = null, small = false } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `card ${COLOR_CLASS[card.color] || 'card-wild'} ${small ? 'card-small' : ''}`;
  if (playable) el.classList.add('playable');
  else el.classList.add('disabled');
  el.dataset.cardId = card.id;
  el.innerHTML = `<span class="card-value">${cardLabel(card)}</span>`;
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

export function updateUI(ui, state, humanIndex, handlers, options = {}) {
  const human = state.players[humanIndex];
  const isHumanCurrentPlayer = state.currentIndex === humanIndex;
  const isMyTurn = isHumanCurrentPlayer && state.phase === 'playing';
  const wildPending = state.phase === 'wild_pick' && state.pendingWild && isHumanCurrentPlayer;

  const current = state.players[state.currentIndex];
  let turnLabel = `${current.name}'s turn`;
  if (!current.isHuman && options.aiSecondsRemaining != null) {
    turnLabel += ` (${options.aiSecondsRemaining}s)`;
  }

  ui.status.textContent = state.winner
    ? `${state.winner.name} wins!`
    : `${turnLabel} · ${state.lastAction}`;

  ui.deckCount.textContent = state.deckCount;
  ui.playerAvatar.src = human.photoUrl;
  ui.playerAvatar.alt = `${human.name}'s photo`;
  ui.colorIndicator.className = `color-indicator color-${state.currentColor}`;
  ui.colorIndicator.setAttribute('aria-label', `Active color: ${state.currentColor}`);

  ui.discardPile.innerHTML = '';
  ui.discardPile.appendChild(
    renderCardElement(state.topCard, { playable: false, onClick: null })
  );

  ui.opponents.innerHTML = '';
  state.players.forEach((p, i) => {
    if (i === humanIndex) return;
    const div = document.createElement('div');
    div.className = `opponent ${i === state.currentIndex ? 'active' : ''}`;
    div.innerHTML = `
      <img class="avatar opponent-avatar" src="${p.photoUrl}" alt="${p.name}'s photo" />
      <span class="opponent-name">${p.name}${p.saidUno ? ' <em>UNO</em>' : ''}</span>
      <span class="opponent-cards">${p.handCount} cards</span>
      <div class="opponent-mini-hand"></div>
    `;
    const mini = div.querySelector('.opponent-mini-hand');
    for (let k = 0; k < Math.min(p.handCount, 8); k++) {
      const back = document.createElement('span');
      back.className = 'card-back';
      mini.appendChild(back);
    }
    if (p.handCount > 8) {
      const more = document.createElement('span');
      more.className = 'more-cards';
      more.textContent = `+${p.handCount - 8}`;
      mini.appendChild(more);
    }
    ui.opponents.appendChild(div);
  });

  ui.playerHand.innerHTML = '';
  const top = state.topCard;
  human.hand.forEach((card) => {
    const playable =
      (isMyTurn || wildPending) && canPlay(card, top, state.currentColor);
    const el = renderCardElement(card, {
      playable,
      onClick: playable ? () => handlers.onPlayCard(card.id) : null,
    });
    if (!playable) el.disabled = true;
    ui.playerHand.appendChild(el);
  });

  ui.btnDraw.disabled = !isMyTurn;
  ui.btnUno.disabled = human.hand.length !== 1 || !isMyTurn;
  ui.wildPicker.classList.toggle('hidden', !wildPending);

  if (state.winner) {
    ui.overlay.classList.remove('hidden');
    ui.overlayTitle.textContent = 'Game over';
    ui.overlayMsg.textContent = `${state.winner.name} emptied their hand!`;
  } else {
    ui.overlay.classList.add('hidden');
  }
}
