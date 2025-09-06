const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const difficultyEl = document.getElementById('difficulty');
const muteEl = document.getElementById('muteToggle');
const pauseBtn = document.getElementById('pauseBtn');
const settingsBtn = document.getElementById('settingsBtn');
const overlayEl = document.getElementById('settingsOverlay');
const modalDifficulty = document.getElementById('modalDifficulty');
const modalMute = document.getElementById('modalMute');
const modalBestOf = document.getElementById('modalBestOf');
const modalWinScore = document.getElementById('modalWinScore');
const settingsSave = document.getElementById('settingsSave');
const settingsClose = document.getElementById('settingsClose');
const settingsReset = document.getElementById('settingsReset');
const hudPlayerPips = document.getElementById('hudPlayerPips');
const hudAiPips = document.getElementById('hudAiPips');
const hudText = document.getElementById('hudText');

// Game settings
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 14;
const PLAYER_X = 30;
const AI_X = canvas.width - PLAYER_X - PADDLE_WIDTH;
const DIFFICULTY = {
  easy:   { ai: 3, ball: 5 },
  normal: { ai: 4, ball: 6 },
  hard:   { ai: 6, ball: 7 }
};
let difficulty = 'normal';
let aiSpeed = DIFFICULTY[difficulty].ai;
let serveBaseSpeed = DIFFICULTY[difficulty].ball;
let WIN_SCORE = 7;
let bestOf = 3;
let gamesToWin = Math.ceil(bestOf / 2);

let playerY = (canvas.height - PADDLE_HEIGHT) / 2;
let aiY = (canvas.height - PADDLE_HEIGHT) / 2;
let ballX = canvas.width / 2 - BALL_SIZE / 2;
let ballY = canvas.height / 2 - BALL_SIZE / 2;
let ballSpeedX = serveBaseSpeed * (Math.random() > 0.5 ? 1 : -1);
let ballSpeedY = (Math.random() * 4 + 2) * (Math.random() > 0.5 ? 1 : -1);
let playerScore = 0;
let aiScore = 0;
let isRunning = false; // tap/click to start
let gameOver = false;
let winner = null; // 'player' | 'ai'
let paused = false;

let gamesPlayer = 0;
let gamesAI = 0;
let betweenGames = false; // after a game ends but match not over

// Audio
let audioCtx = null;
let muted = false;
let spriteBuffer = null;
const AUDIO_SPRITE = {
  urls: ['assets/sfx-sprite.mp3', 'assets/sfx-sprite.wav'],
  map: {
    paddle:   [0.00, 0.12],
    wall:     [0.14, 0.10],
    scoreUp:  [0.26, 0.20],
    scoreDown:[0.48, 0.20]
  }
};
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  // Lazy-load audio sprite once
  if (audioCtx && !spriteBuffer) {
    // Try candidate URLs in order
    (async () => {
      for (const url of AUDIO_SPRITE.urls) {
        try {
          const r = await fetch(url, { cache: 'force-cache' });
          if (!r.ok) continue;
          const arr = await r.arrayBuffer();
          spriteBuffer = await audioCtx.decodeAudioData(arr);
          return;
        } catch { /* try next */ }
      }
      // Build a tiny procedural sprite as a fallback
      try { spriteBuffer = buildProceduralSprite(audioCtx); } catch {}
    })();
  }
}

function buildProceduralSprite(ctx) {
  const sr = ctx.sampleRate || 44100;
  const totalSec = 0.7; // covers all mapped segments
  const buf = ctx.createBuffer(1, Math.ceil(totalSec * sr), sr);
  const ch = buf.getChannelData(0);
  function fillTone(startSec, durSec, freq) {
    const start = Math.floor(startSec * sr);
    const len = Math.floor(durSec * sr);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.min(1, i / (0.01 * sr)) * Math.max(0, 1 - i / len);
      ch[start + i] += Math.sin(2 * Math.PI * freq * t) * 0.35 * env;
    }
  }
  // paddle: 0.00-0.12 (800 Hz)
  fillTone(0.00, 0.12, 800);
  // wall: 0.14-0.24 (220 Hz)
  fillTone(0.14, 0.10, 220);
  // scoreUp: 0.26-0.46 (sweep 420->760)
  (function sweep(start, dur, f0, f1) {
    const s = Math.floor(start * sr);
    const n = Math.floor(dur * sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = f0 + (f1 - f0) * (i / n);
      const env = Math.min(1, i / (0.01 * sr)) * Math.max(0, 1 - i / n);
      ch[s + i] += Math.sin(2 * Math.PI * f * t) * 0.3 * env;
    }
  })(0.26, 0.20, 420, 760);
  // scoreDown: 0.48-0.68 (sweep 420->160)
  (function sweep(start, dur, f0, f1) {
    const s = Math.floor(start * sr);
    const n = Math.floor(dur * sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = f0 + (f1 - f0) * (i / n);
      const env = Math.min(1, i / (0.01 * sr)) * Math.max(0, 1 - i / n);
      ch[s + i] += Math.sin(2 * Math.PI * f * t) * 0.3 * env;
    }
  })(0.48, 0.20, 420, 160);
  return buf;
}
function sfx(type) {
  if (muted || !audioCtx) return;
  const now = audioCtx.currentTime;
  if (spriteBuffer && AUDIO_SPRITE.map[type]) {
    const [offset, dur] = AUDIO_SPRITE.map[type];
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = spriteBuffer;
    src.connect(gain).connect(audioCtx.destination);
    gain.gain.value = 0.7;
    src.start(now, offset, dur);
    return;
  }
  // Fallback synth
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain).connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  if (type === 'paddle') {
    osc.type = 'square'; osc.frequency.setValueAtTime(620, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'wall') {
    osc.type = 'triangle'; osc.frequency.setValueAtTime(220, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.start(now); osc.stop(now + 0.06);
  } else if (type === 'scoreUp') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(760, now + 0.15);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now); osc.stop(now + 0.18);
  } else if (type === 'scoreDown') {
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.15);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now); osc.stop(now + 0.18);
  }
}

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2, false);
    ctx.closePath();
    ctx.fill();
}

function drawNet() {
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    for (let i = 0; i < canvas.height; i += 30) {
        ctx.moveTo(canvas.width / 2, i);
        ctx.lineTo(canvas.width / 2, i + 16);
    }
    ctx.stroke();
}

function resetBall() {
    ballX = canvas.width / 2 - BALL_SIZE / 2;
    ballY = canvas.height / 2 - BALL_SIZE / 2;
    ballSpeedX = serveBaseSpeed * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = (Math.random() * 4 + 2) * (Math.random() > 0.5 ? 1 : -1);
}

function resetGame() {
  playerScore = 0; aiScore = 0; winner = null; gameOver = false;
  playerY = (canvas.height - PADDLE_HEIGHT) / 2;
  aiY = (canvas.height - PADDLE_HEIGHT) / 2;
  resetBall();
}

function draw() {
    // Clear
    drawRect(0, 0, canvas.width, canvas.height, '#222');

    // Net
    drawNet();

    // Paddles
    drawRect(PLAYER_X, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, '#fff');
    drawRect(AI_X, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, '#fff');

    // Ball
    drawCircle(ballX + BALL_SIZE / 2, ballY + BALL_SIZE / 2, BALL_SIZE / 2, '#fff');

    // Scoreboard
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(playerScore), canvas.width * 0.25, 40);
    ctx.fillText(String(aiScore), canvas.width * 0.75, 40);

    // Games tally
    ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
    ctx.fillText(`Games ${gamesPlayer}`, canvas.width * 0.25, 64);
    ctx.fillText(`${gamesAI} Games`, canvas.width * 0.75, 64);

    // HUD pips outside canvas
    renderHud();

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial, Helvetica, sans-serif';
        ctx.fillText(winner === 'player' ? 'You Win!' : 'AI Wins!', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '16px Arial, Helvetica, sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Tap or click to play again', canvas.width / 2, canvas.height / 2 + 18);
    } else if (betweenGames) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ddd';
        ctx.font = '600 20px Arial, Helvetica, sans-serif';
        ctx.fillText('Next game — tap to serve', canvas.width / 2, canvas.height / 2 + 8);
    } else if (!isRunning) {
        // Overlay for tap to play
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ddd';
        ctx.font = '600 20px Arial, Helvetica, sans-serif';
        ctx.fillText('Tap or click to play', canvas.width / 2, canvas.height / 2 + 8);
        ctx.font = '14px Arial, Helvetica, sans-serif';
        ctx.fillStyle = '#bbb';
        ctx.fillText('Drag finger or move mouse to control', canvas.width / 2, canvas.height / 2 + 32);
    }
}

function update() {
    if (paused || !isRunning) return;
    // Move ball
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Collision: Top or bottom wall
    if (ballY <= 0 || ballY + BALL_SIZE >= canvas.height) {
        ballSpeedY = -ballSpeedY;
        sfx('wall');
    }

    // Collision: Player paddle
    if (
        ballX <= PLAYER_X + PADDLE_WIDTH &&
        ballY + BALL_SIZE >= playerY &&
        ballY <= playerY + PADDLE_HEIGHT
    ) {
        ballSpeedX = -ballSpeedX;
        // Add some "english"
        let hitPos = (ballY + BALL_SIZE / 2) - (playerY + PADDLE_HEIGHT / 2);
        ballSpeedY += hitPos * 0.15;
        ballX = PLAYER_X + PADDLE_WIDTH; // Prevent sticking
        sfx('paddle');
    }

    // Collision: AI paddle
    if (
        ballX + BALL_SIZE >= AI_X &&
        ballY + BALL_SIZE >= aiY &&
        ballY <= aiY + PADDLE_HEIGHT
    ) {
        ballSpeedX = -ballSpeedX;
        let hitPos = (ballY + BALL_SIZE / 2) - (aiY + PADDLE_HEIGHT / 2);
        ballSpeedY += hitPos * 0.15;
        ballX = AI_X - BALL_SIZE; // Prevent sticking
        sfx('paddle');
    }

    // Score: Ball out of bounds
    if (ballX < 0) {
        aiScore += 1;
        sfx('scoreDown');
        if (aiScore >= WIN_SCORE) {
          gamesAI += 1;
          if (gamesAI >= gamesToWin) {
            winner = 'ai'; gameOver = true; isRunning = false; betweenGames = false;
          } else {
            betweenGames = true; isRunning = false; resetBall();
          }
        } else {
          resetBall(); isRunning = false;
        }
        saveMatch(); renderHud();
    } else if (ballX > canvas.width) {
        playerScore += 1;
        sfx('scoreUp');
        if (playerScore >= WIN_SCORE) {
          gamesPlayer += 1;
          if (gamesPlayer >= gamesToWin) {
            winner = 'player'; gameOver = true; isRunning = false; betweenGames = false;
          } else {
            betweenGames = true; isRunning = false; resetBall();
          }
        } else {
          resetBall(); isRunning = false;
        }
        saveMatch(); renderHud();
    }

    // AI paddle movement: Track the ball, but limited speed
    let aiCenter = aiY + PADDLE_HEIGHT / 2;
    if (aiCenter < ballY + BALL_SIZE / 2 - 10) {
        aiY += aiSpeed;
    } else if (aiCenter > ballY + BALL_SIZE / 2 + 10) {
        aiY -= aiSpeed;
    }
    // Keep AI paddle in bounds
    aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Mouse movement controls player paddle
function handlePointer(y) {
    playerY = y - PADDLE_HEIGHT / 2;
    playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
}

canvas.addEventListener('pointermove', (evt) => {
    const rect = canvas.getBoundingClientRect();
    handlePointer(evt.clientY - rect.top);
});

canvas.addEventListener('pointerdown', (evt) => {
    const rect = canvas.getBoundingClientRect();
    handlePointer(evt.clientY - rect.top);
    ensureAudio();
    if (gameOver) {
      resetGame();
      gamesPlayer = 0; gamesAI = 0; betweenGames = false;
      isRunning = true; paused = false;
    } else if (!isRunning) {
      if (betweenGames) { betweenGames = false; }
      isRunning = true; paused = false;
    }
});

// UI controls
if (difficultyEl) {
  difficultyEl.addEventListener('change', () => {
    difficulty = difficultyEl.value;
    aiSpeed = DIFFICULTY[difficulty].ai;
    serveBaseSpeed = DIFFICULTY[difficulty].ball;
    saveSettings();
    resetGame();
  });
}
if (muteEl) {
  muteEl.addEventListener('change', () => {
    muted = muteEl.checked;
    saveSettings();
  });
}

// Pause button
if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    ensureAudio();
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  });
}

// Settings modal handlers
if (settingsBtn && overlayEl && settingsSave && settingsClose) {
  settingsBtn.addEventListener('click', () => {
    overlayEl.hidden = false;
  });
  settingsClose.addEventListener('click', () => {
    overlayEl.hidden = true;
  });
  if (settingsReset) {
    settingsReset.addEventListener('click', () => {
      difficulty = 'normal'; muted = false; bestOf = 3; WIN_SCORE = 7;
      gamesToWin = Math.ceil(bestOf / 2);
      aiSpeed = DIFFICULTY[difficulty].ai; serveBaseSpeed = DIFFICULTY[difficulty].ball;
      if (difficultyEl) difficultyEl.value = difficulty;
      if (muteEl) muteEl.checked = muted;
      if (modalDifficulty) modalDifficulty.value = difficulty;
      if (modalMute) modalMute.checked = muted;
      if (modalBestOf) modalBestOf.value = String(bestOf);
      if (modalWinScore) modalWinScore.value = String(WIN_SCORE);
      gamesPlayer = 0; gamesAI = 0; resetGame(); saveSettings(); saveMatch(); renderHud();
    });
  }
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) overlayEl.hidden = true;
  });
  settingsSave.addEventListener('click', () => {
    // Read from modal
    const d = modalDifficulty.value;
    const m = modalMute.checked;
    const b = parseInt(modalBestOf.value, 10) || 3;
    const ws = Math.max(3, Math.min(21, parseInt((modalWinScore && modalWinScore.value) || '7', 10) || 7));
    difficulty = d;
    muted = m;
    bestOf = b;
    WIN_SCORE = ws;
    gamesToWin = Math.ceil(bestOf / 2);
    aiSpeed = DIFFICULTY[difficulty].ai;
    serveBaseSpeed = DIFFICULTY[difficulty].ball;
    // Sync top controls
    if (difficultyEl) difficultyEl.value = difficulty;
    if (muteEl) muteEl.checked = muted;
    if (modalWinScore) modalWinScore.value = String(WIN_SCORE);
    saveSettings();
    // Reset match
    gamesPlayer = 0; gamesAI = 0;
    resetGame();
    overlayEl.hidden = true;
  });
}

// Persistence
function saveSettings() {
  const settings = { difficulty, muted, bestOf, winScore: WIN_SCORE };
  try { localStorage.setItem('pongSettings', JSON.stringify(settings)); } catch {}
}
function loadSettings() {
  try {
    const raw = localStorage.getItem('pongSettings');
    if (!raw) return;
    const conf = JSON.parse(raw);
    if (conf.difficulty && DIFFICULTY[conf.difficulty]) difficulty = conf.difficulty;
    if (typeof conf.muted === 'boolean') muted = conf.muted;
    if (conf.bestOf === 3 || conf.bestOf === 5) bestOf = conf.bestOf;
    if (conf.winScore && Number.isFinite(conf.winScore)) WIN_SCORE = conf.winScore;
  } catch {}
}

// Initialize from saved settings
loadSettings();
gamesToWin = Math.ceil(bestOf / 2);
aiSpeed = DIFFICULTY[difficulty].ai;
serveBaseSpeed = DIFFICULTY[difficulty].ball;
if (difficultyEl) difficultyEl.value = difficulty;
if (muteEl) muteEl.checked = muted;
if (modalDifficulty) modalDifficulty.value = difficulty;
if (modalMute) modalMute.checked = muted;
if (modalBestOf) modalBestOf.value = String(bestOf);
if (modalWinScore) modalWinScore.value = String(WIN_SCORE);

// HUD render
function renderHud() {
  if (!hudPlayerPips || !hudAiPips) return;
  hudPlayerPips.innerHTML = '';
  hudAiPips.innerHTML = '';
  for (let i = 0; i < gamesToWin; i++) {
    const p = document.createElement('span'); p.className = 'pip' + (i < gamesPlayer ? ' on' : '');
    hudPlayerPips.appendChild(p);
  }
  for (let i = 0; i < gamesToWin; i++) {
    const p = document.createElement('span'); p.className = 'pip' + (i < gamesAI ? ' on' : '');
    hudAiPips.appendChild(p);
  }
  if (hudText) {
    hudText.textContent = `Best of ${bestOf} (first to ${gamesToWin} games) • Win score: ${WIN_SCORE}`;
  }
}
renderHud();

// Persist and restore match progress
function saveMatch() {
  const match = { playerScore, aiScore, gamesPlayer, gamesAI, bestOf, winScore: WIN_SCORE };
  try { localStorage.setItem('pongMatch', JSON.stringify(match)); } catch {}
}
function loadMatch() {
  try {
    const raw = localStorage.getItem('pongMatch');
    if (!raw) return;
    const m = JSON.parse(raw);
    if (Number.isFinite(m.playerScore)) playerScore = m.playerScore;
    if (Number.isFinite(m.aiScore)) aiScore = m.aiScore;
    if (Number.isFinite(m.gamesPlayer)) gamesPlayer = m.gamesPlayer;
    if (Number.isFinite(m.gamesAI)) gamesAI = m.gamesAI;
    if (m.bestOf === 3 || m.bestOf === 5) { bestOf = m.bestOf; gamesToWin = Math.ceil(bestOf/2); }
    if (Number.isFinite(m.winScore)) WIN_SCORE = m.winScore;
    if (modalBestOf) modalBestOf.value = String(bestOf);
    if (modalWinScore) modalWinScore.value = String(WIN_SCORE);
    renderHud();
  } catch {}
}
loadMatch();

// Keyboard: P to pause
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') {
    paused = !paused;
    if (pauseBtn) {
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
  }
});

// Start the game
gameLoop();
