// ============================================================
// GRIDSHOT-MODUS
// ============================================================
// Følger modul-grensesnittet: start(canvas, ctx, onComplete) / stop()
// Alle moduser som legges til senere (f.eks. Tracking) bør følge
// samme mønster: egen fil i js/modes/, samme grensesnitt.
// ============================================================

const ROUND_SECONDS = 60;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const TARGET_RADIUS = 28;

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let hits = 0;
let shots = 0;
let timeLeft = ROUND_SECONDS;
let target = null; // {x, y}
let timerInterval = null;
let running = false;

let clickHandler = null;

export const gridshot = {
  id: "gridshot",
  displayName: "Gridshot",
  comingSoon: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    hits = 0;
    shots = 0;
    timeLeft = ROUND_SECONDS;
    running = true;

    spawnTarget();
    draw();

    clickHandler = (e) => handleClick(e);
    canvas.addEventListener("mousedown", clickHandler);

    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        endRound();
      }
    }, 1000);
  },

  stop() {
    cleanup();
  }
};

function cleanup() {
  running = false;
  if (timerInterval) clearInterval(timerInterval);
  if (clickHandler && canvas) canvas.removeEventListener("mousedown", clickHandler);
  timerInterval = null;
  clickHandler = null;
}

function endRound() {
  cleanup();
  const finalScore = calculateScore(hits, shots);
  if (onCompleteCallback) {
    onCompleteCallback({ score: finalScore, hits, shots });
  }
}

export function calculateScore(hitCount, shotCount) {
  if (shotCount === 0) return 0;
  const accuracy = hitCount / shotCount;
  return Math.round(hitCount * accuracy * 100); // *100 for et "finere" poengtall
}

function spawnTarget() {
  const cellW = canvas.width / GRID_COLS;
  const cellH = canvas.height / GRID_ROWS;

  const col = Math.floor(Math.random() * GRID_COLS);
  const row = Math.floor(Math.random() * GRID_ROWS);

  target = {
    x: col * cellW + cellW / 2,
    y: row * cellH + cellH / 2
  };
}

function handleClick(e) {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  shots += 1;

  const dx = x - target.x;
  const dy = y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= TARGET_RADIUS) {
    hits += 1;
    playSound("hit");
    spawnTarget();
  } else {
    playSound("miss");
  }

  draw();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bakgrunn
  ctx.fillStyle = "#0d1b33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mål
  if (target) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, TARGET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#1b3a70";
    ctx.stroke();
  }

  // HUD: tid / treff / skudd
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Georgia', serif";
  ctx.textAlign = "left";
  ctx.fillText(`Tid: ${timeLeft}s`, 20, 36);
  ctx.fillText(`Treff: ${hits}`, 20, 66);
  ctx.fillText(`Skudd: ${shots}`, 20, 96);
}

function playSound(type) {
  const el = document.getElementById(type === "hit" ? "sound-hit" : "sound-miss");
  if (el) {
    el.currentTime = 0;
    el.play().catch(() => {
      /* ignorer autoplay-restriksjoner */
    });
  }
}
