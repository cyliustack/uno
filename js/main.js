import { createGame, GAME_PHASE } from './game.js?v=20260602-photos';
import { chooseAiPlay } from './ai.js?v=20260602-photos';
import { createUIRoot, updateUI } from './ui.js?v=20260602-photos';

const AI_NAMES = ['Stephen', 'Alex', 'Sam', 'Jordan'];
const AI_PHOTOS = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&h=160&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&h=160&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&h=160&q=80',
];
const DEFAULT_HUMAN_PHOTO =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 160%22%3E%3Crect width=%22160%22 height=%22160%22 fill=%22%23237a5f%22/%3E%3Ccircle cx=%2280%22 cy=%2262%22 r=%2230%22 fill=%22%23f4f7fb%22/%3E%3Cpath d=%22M32 144c8-34 30-52 48-52s40 18 48 52%22 fill=%22%23f4f7fb%22/%3E%3C/svg%3E';
const AI_TURN_TIMEOUT_MS = 10000;
const AI_THINK_MS = 700;
const PLAYER_PHOTO_KEY = 'uno-player-photo';

let game = null;
let humanIndex = 0;
let ui = null;
let aiTimer = null;
let aiTimeoutTimer = null;
let aiCountdownTimer = null;
let aiTurnDeadline = null;
let humanPhotoUrl = localStorage.getItem(PLAYER_PHOTO_KEY) || DEFAULT_HUMAN_PHOTO;
let cameraStream = null;

function formatLogDetails(details) {
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function appendDebugLog(source, step, details = {}) {
  if (!ui?.debugLog) return;

  const time = new Date().toLocaleTimeString();
  ui.debugLog.textContent += `[${time}] [${source}] ${step}\n${formatLogDetails(details)}\n\n`;
  ui.debugLog.scrollTop = ui.debugLog.scrollHeight;
}

function logApp(step, details = {}) {
  console.log(`[UNO app] ${step}`, details);
  appendDebugLog('app', step, details);
}

function buildPlayerList(humanName, aiCount) {
  const list = [{ name: humanName.trim() || 'You', isHuman: true, photoUrl: humanPhotoUrl }];
  for (let i = 0; i < aiCount; i++) {
    list.push({ name: AI_NAMES[i], isHuman: false, photoUrl: AI_PHOTOS[i] });
  }
  return list;
}

function setHumanPhoto(photoUrl) {
  humanPhotoUrl = photoUrl;
  localStorage.setItem(PLAYER_PHOTO_KEY, photoUrl);
  if (ui?.setupAvatar) ui.setupAvatar.src = photoUrl;
}

function setCameraActive(active) {
  ui.cameraPreview.classList.toggle('hidden', !active);
  ui.btnCapture.classList.toggle('hidden', !active);
  ui.btnCameraCancel.classList.toggle('hidden', !active);
  ui.btnCamera.classList.toggle('hidden', active);
}

function stopCamera() {
  if (!cameraStream) return;
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  ui.cameraPreview.srcObject = null;
  setCameraActive(false);
}

async function startCamera() {
  logApp('camera:start');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    ui.cameraPreview.srcObject = cameraStream;
    setCameraActive(true);
    logApp('camera:ready');
  } catch (error) {
    logApp('camera:error', {
      message: error?.message ?? String(error),
    });
  }
}

function capturePhoto() {
  if (!cameraStream) return;
  const video = ui.cameraPreview;
  const canvas = ui.cameraCanvas;
  const size = 240;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const sourceSize = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - sourceSize) / 2;
  const sy = (video.videoHeight - sourceSize) / 2;
  ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
  setHumanPhoto(canvas.toDataURL('image/jpeg', 0.85));
  stopCamera();
  logApp('camera:captured');
}

function refresh() {
  if (!game) {
    logApp('refresh:skipNoGame');
    return;
  }
  const state = game.getState();
  logApp('refresh:start', {
    phase: state.phase,
    currentIndex: state.currentIndex,
    currentPlayer: state.players[state.currentIndex]?.name,
    currentIsHuman: state.players[state.currentIndex]?.isHuman,
    topCard: state.topCard,
    currentColor: state.currentColor,
    winner: state.winner,
    lastAction: state.lastAction,
    aiSecondsRemaining: getAiSecondsRemaining(),
  });
  state.players[humanIndex].hand = game.getHand(humanIndex);
  updateUI(ui, state, humanIndex, {
    onPlayCard: (cardId) => {
      logApp('human:onPlayCard:start', { cardId });
      const result = game.playCard(humanIndex, cardId);
      logApp('human:onPlayCard:result', { cardId, result });
      if (result.needsColor) {
        refresh();
        return;
      }
      if (result.ok) {
        refresh();
        scheduleAi();
      }
    },
  }, { aiSecondsRemaining: getAiSecondsRemaining() });
  logApp('refresh:end');
}

function clearAiScheduling() {
  logApp('clearAiScheduling', {
    hadAiTimer: !!aiTimer,
    hadAiTimeoutTimer: !!aiTimeoutTimer,
    hadAiCountdownTimer: !!aiCountdownTimer,
  });
  clearTimeout(aiTimer);
  clearTimeout(aiTimeoutTimer);
  clearInterval(aiCountdownTimer);
  aiTimer = null;
  aiTimeoutTimer = null;
  aiCountdownTimer = null;
  aiTurnDeadline = null;
}

function getAiSecondsRemaining() {
  if (!aiTurnDeadline) return null;
  return Math.max(0, Math.ceil((aiTurnDeadline - Date.now()) / 1000));
}

function scheduleAi() {
  logApp('scheduleAi:start');
  clearAiScheduling();
  if (!game) {
    logApp('scheduleAi:skipNoGame');
    return;
  }

  const state = game.getState();
  if (state.winner) {
    logApp('scheduleAi:skipWinner', { winner: state.winner });
    return;
  }

  const player = game.players[state.currentIndex];
  if (player.isHuman) {
    logApp('scheduleAi:skipHumanTurn', {
      currentIndex: state.currentIndex,
      player: player.name,
    });
    return;
  }

  if (state.phase !== GAME_PHASE.PLAYING && state.phase !== GAME_PHASE.WILD_PICK) {
    logApp('scheduleAi:skipPhase', { phase: state.phase });
    return;
  }

  aiTurnDeadline = Date.now() + AI_TURN_TIMEOUT_MS;
  logApp('scheduleAi:timersSet', {
    player: player.name,
    currentIndex: state.currentIndex,
    phase: state.phase,
    thinkMs: AI_THINK_MS,
    timeoutMs: AI_TURN_TIMEOUT_MS,
  });
  aiTimer = setTimeout(() => {
    logApp('aiThinkTimer:fired');
    try {
      runAiTurn();
    } catch (error) {
      logApp('aiThinkTimer:error', {
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
      });
      runAiTimeout();
    }
  }, AI_THINK_MS);
  aiTimeoutTimer = setTimeout(() => {
    logApp('aiTimeoutTimer:fired');
    clearAiScheduling();
    runAiTimeout();
  }, AI_TURN_TIMEOUT_MS);

  aiCountdownTimer = setInterval(refresh, 250);
  refresh();
}

function runAiTimeout() {
  logApp('runAiTimeout:start');
  if (!game) {
    logApp('runAiTimeout:skipNoGame');
    return;
  }
  const state = game.getState();
  if (state.winner) {
    logApp('runAiTimeout:skipWinner', { winner: state.winner });
    refresh();
    return;
  }

  const idx = state.currentIndex;
  const player = game.players[idx];

  if (player.isHuman || state.phase !== GAME_PHASE.PLAYING) {
    logApp('runAiTimeout:skipInvalidState', {
      player: player.name,
      isHuman: player.isHuman,
      phase: state.phase,
    });
    return;
  }

  const result = game.timeoutDraw(idx, 3);
  logApp('runAiTimeout:result', { player: player.name, result });
  refresh();
  scheduleAi();
}

function runAiTurn() {
  logApp('runAiTurn:start');
  if (!game) {
    logApp('runAiTurn:skipNoGame');
    return;
  }
  const state = game.getState();
  if (state.winner) {
    logApp('runAiTurn:skipWinner', { winner: state.winner });
    refresh();
    return;
  }

  const idx = state.currentIndex;
  const player = game.players[idx];

  if (player.isHuman) {
    logApp('runAiTurn:skipHumanTurn', { idx, player: player.name });
    return;
  }

  if (state.phase === GAME_PHASE.WILD_PICK) {
    const colors = ['red', 'yellow', 'green', 'blue'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    logApp('runAiTurn:wildPick', { idx, player: player.name, color });
    const result = game.pickWildColor(idx, color);
    logApp('runAiTurn:wildPickResult', { result });
    refresh();
    scheduleAi();
    return;
  }

  if (state.phase !== GAME_PHASE.PLAYING) {
    logApp('runAiTurn:skipPhase', { phase: state.phase });
    return;
  }

  const hand = game.getHand(idx);
  const choice = chooseAiPlay(hand, state.topCard, state.currentColor);
  logApp('runAiTurn:choice', {
    idx,
    player: player.name,
    handCount: hand.length,
    choice,
  });

  if (choice) {
    if (choice.wildColor) {
      const result = game.playCard(idx, choice.cardId, choice.wildColor);
      logApp('runAiTurn:playWildResult', { result });
    } else {
      const first = game.playCard(idx, choice.cardId);
      logApp('runAiTurn:playResult', { result: first });
      if (first.needsColor) {
        const colors = ['red', 'yellow', 'green', 'blue'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const result = game.pickWildColor(idx, color);
        logApp('runAiTurn:followupWildPickResult', { color, result });
      }
    }
    if (game.getHand(idx).length === 1) {
      const result = game.callUno(idx);
      logApp('runAiTurn:callUnoResult', { result });
    }
  } else {
    const result = game.drawCard(idx);
    logApp('runAiTurn:drawResult', { result });
  }

  refresh();
  scheduleAi();
}

function startGame() {
  logApp('startGame:start');
  clearAiScheduling();
  const name = ui.playerName.value;
  const aiCount = Number(ui.opponentCount.value);
  const configs = buildPlayerList(name, aiCount);
  logApp('startGame:configs', { configs });
  humanIndex = 0;
  game = createGame(configs);
  ui.setup.classList.add('hidden');
  refresh();
  scheduleAi();
}

function init() {
  logApp('init:start');
  ui = createUIRoot();
  window.UNO_DEBUG_LOG = appendDebugLog;
  ui.setupAvatar.src = humanPhotoUrl;
  ui.setupAvatar.alt = 'Your photo';
  logApp('debugLog:ready');

  ui.btnStart.addEventListener('click', startGame);
  ui.btnNew.addEventListener('click', () => {
    logApp('newGame:click');
    ui.setup.classList.remove('hidden');
    game = null;
    clearAiScheduling();
    refresh();
  });
  ui.overlayBtn.addEventListener('click', () => {
    logApp('overlayPlayAgain:click');
    ui.overlay.classList.add('hidden');
    ui.setup.classList.remove('hidden');
    game = null;
    clearAiScheduling();
  });

  ui.btnCamera.addEventListener('click', startCamera);
  ui.btnCapture.addEventListener('click', capturePhoto);
  ui.btnCameraCancel.addEventListener('click', stopCamera);

  ui.btnDraw.addEventListener('click', () => {
    logApp('human:drawButton:click');
    const result = game?.drawCard(humanIndex);
    logApp('human:drawButton:result', { result });
    if (result?.ok) {
      refresh();
      scheduleAi();
    }
  });

  ui.btnUno.addEventListener('click', () => {
    logApp('human:unoButton:click');
    const result = game?.callUno(humanIndex);
    logApp('human:unoButton:result', { result });
    refresh();
  });

  ui.deckPile.addEventListener('click', () => {
    logApp('human:deckPile:click');
    const result = game?.drawCard(humanIndex);
    logApp('human:deckPile:result', { result });
    if (result?.ok) {
      refresh();
      scheduleAi();
    }
  });

  ui.wildColorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      logApp('human:wildColor:click', { color });
      const result = game?.pickWildColor(humanIndex, color);
      logApp('human:wildColor:result', { color, result });
      if (result?.ok) {
        refresh();
        scheduleAi();
      }
    });
  });
  logApp('init:end');
}

init();
