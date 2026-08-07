// ============================================================
// GRIDSHOT-MODUS
// ============================================================
// Følger modul-grensesnittet: start(canvas, ctx, onComplete) / stop()
// Alle moduser som legges til senere (f.eks. Tracking) bør følge
// samme mønster: egen fil i js/modes/, samme grensesnitt.
// ============================================================

const ROUND_SECONDS = 30;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const TARGET_RADIUS = 28;

const CROSSHAIR_SIZE = 14;
const CROSSHAIR_GAP = 4;

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
let moveHandler = null;
let animationFrameId = null;
let mouseX = 0;
let mouseY = 0;

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

    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;

    spawnTarget();

    clickHandler = (e) => handleClick(e);
    canvas.addEventListener("mousedown", clickHandler);

    moveHandler = (e) => updateMousePosition(e);
    canvas.addEventListener("mousemove", moveHandler);

    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        endRound();
      }
    }, 1000);

    animationLoop();
  },

  stop() {
    cleanup();
  }
};

function animationLoop() {
  if (!running) return;
  draw();
  animationFrameId = requestAnimationFrame(animationLoop);
}

function updateMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
}

function cleanup() {
  running = false;
  if (timerInterval) clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (clickHandler && canvas) canvas.removeEventListener("mousedown", clickHandler);
  if (moveHandler && canvas) canvas.removeEventListener("mousemove", moveHandler);
  timerInterval = null;
  animationFrameId = null;
  clickHandler = null;
  moveHandler = null;
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
  updateMousePosition(e);

  shots += 1;

  const dx = mouseX - target.x;
  const dy = mouseY - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= TARGET_RADIUS) {
    hits += 1;
    playSound("hit");
    spawnTarget();
  } else {
    playSound("miss");
  }
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

  drawCrosshair();
}

function drawCrosshair() {
  const x = mouseX;
  const y = mouseY;
  const size = CROSSHAIR_SIZE;
  const gap = CROSSHAIR_GAP;

  ctx.save();
  ctx.strokeStyle = "#3ecf6e";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  // Venstre strek
  ctx.moveTo(x - gap - size, y);
  ctx.lineTo(x - gap, y);
  // Høyre strek
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + gap + size, y);
  // Øvre strek
  ctx.moveTo(x, y - gap - size);
  ctx.lineTo(x, y - gap);
  // Nedre strek
  ctx.moveTo(x, y + gap);
  ctx.lineTo(x, y + gap + size);
  ctx.stroke();

  // Liten senter-prikk
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#3ecf6e";
  ctx.fill();

  ctx.restore();
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
