const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const difficultyEl = document.getElementById('difficulty');
const muteEl = document.getElementById('muteToggle');

// Game settings
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 14;
const PLAYER_X = 30;
const AI_X = canvas.width - PLAYER_X - PADDLE_WIDTH;
const PADDLE_SPEED = 6;
const DIFFICULTY = {
  easy:   { ai: 3, ball: 5 },
  normal: { ai: 4, ball: 6 },
  hard:   { ai: 6, ball: 7 }
};
let difficulty = 'normal';
let aiSpeed = DIFFICULTY[difficulty].ai;
let serveBaseSpeed = DIFFICULTY[difficulty].ball;
const WIN_SCORE = 7;

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

// Audio
let audioCtx = null;
let muted = false;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
}
function playBeep(freq = 440, time = 0.05, vol = 0.05) {
  if (muted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.value = vol;
  osc.connect(gain).connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  osc.start(now);
  osc.stop(now + time);
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

    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial, Helvetica, sans-serif';
        ctx.fillText(winner === 'player' ? 'You Win!' : 'AI Wins!', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '16px Arial, Helvetica, sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Tap or click to play again', canvas.width / 2, canvas.height / 2 + 18);
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
    if (!isRunning) return;
    // Move ball
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Collision: Top or bottom wall
    if (ballY <= 0 || ballY + BALL_SIZE >= canvas.height) {
        ballSpeedY = -ballSpeedY;
        playBeep(220, 0.04, 0.04);
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
        playBeep(880, 0.05, 0.06);
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
        playBeep(760, 0.05, 0.05);
    }

    // Score: Ball out of bounds
    if (ballX < 0) {
        aiScore += 1;
        playBeep(160, 0.1, 0.08);
        if (aiScore >= WIN_SCORE) {
          winner = 'ai'; gameOver = true; isRunning = false;
        } else {
          resetBall(); isRunning = false;
        }
    } else if (ballX > canvas.width) {
        playerScore += 1;
        playBeep(480, 0.1, 0.08);
        if (playerScore >= WIN_SCORE) {
          winner = 'player'; gameOver = true; isRunning = false;
        } else {
          resetBall(); isRunning = false;
        }
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
      isRunning = true;
    } else if (!isRunning) {
      isRunning = true;
    }
});

// UI controls
if (difficultyEl) {
  difficultyEl.addEventListener('change', () => {
    difficulty = difficultyEl.value;
    aiSpeed = DIFFICULTY[difficulty].ai;
    serveBaseSpeed = DIFFICULTY[difficulty].ball;
    resetGame();
  });
}
if (muteEl) {
  muteEl.addEventListener('change', () => {
    muted = muteEl.checked;
  });
}

// Start the game
gameLoop();
