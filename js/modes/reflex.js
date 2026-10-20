// ============================================================
// REFLEX-MODUS
// ============================================================
// Følger samme modul-grensesnitt som de andre: start(canvas, ctx, onComplete) / stop()
//
// Ett mål av gangen, fast 6x4 grid-posisjon (som Gridshot), men
// målet forsvinner automatisk etter TARGET_LIFETIME_MS hvis det
// ikke treffes - tester reaksjonsevne, ikke bare presisjon.
//
// Poeng = treff × presisjon × 100 (samme formel som Gridshot).
// "Skudd" i presisjonsberegningen inkluderer både faktiske klikk
// OG mål som rakk å utløpe uten å bli truffet, siden begge deler
// representerer et "tapt" mål.
// ============================================================

import { drawCrosshair } from "../crosshair.js";
import { getScale } from "../scale.js";
import { playSound } from "../sound.js";

const ROUND_SECONDS = 30;
const TARGET_LIFETIME_MS = 1400;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const BASE_TARGET_RADIUS = 50;

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let targetRadius = BASE_TARGET_RADIUS;

let hits = 0;
let totalClicks = 0;
let expiredCount = 0;
let timeLeft = ROUND_SECONDS;

let target = null; // {x, y}
let targetSpawnTime = 0;

let timerInterval = null;
let animationFrameId = null;
let running = false;

let clickHandler = null;
let moveHandler = null;
let mouseX = 0;
let mouseY = 0;

export const reflex = {
  id: "reflex",
  displayName: "Reflex",
  comingSoon: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    scale = getScale(canvas);
    targetRadius = BASE_TARGET_RADIUS * scale;

    hits = 0;
    totalClicks = 0;
    expiredCount = 0;
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

    animationFrameId = requestAnimationFrame(loop);
  },

  stop() {
    cleanup();
  }
};

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
  const shots = totalClicks + expiredCount;
  const finalScore = calculateScore(hits, shots);

  if (onCompleteCallback) {
    onCompleteCallback({
      score: finalScore,
      stats: [
        { label: "Treff", value: hits },
        { label: "Bom", value: Math.max(0, totalClicks - hits) },
        { label: "Utløpt", value: expiredCount }
      ]
    });
  }
}

function calculateScore(hitCount, shotCount) {
  if (shotCount === 0) return 0;
  const accuracy = hitCount / shotCount;
  return Math.round(hitCount * accuracy * 100);
}

function loop(now) {
  if (!running) return;

  if (now - targetSpawnTime >= TARGET_LIFETIME_MS) {
    expiredCount += 1;
    spawnTarget();
  }

  draw(now);
  animationFrameId = requestAnimationFrame(loop);
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
  targetSpawnTime = performance.now();
}

function updateMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
}

function handleClick(e) {
  if (!running) return;
  updateMousePosition(e);

  totalClicks += 1;

  const dx = mouseX - target.x;
  const dy = mouseY - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= targetRadius) {
    hits += 1;
    playSound("hit");
    spawnTarget();
  } else {
    playSound("miss");
  }
}

function draw(now) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bakgrunn
  ctx.fillStyle = "#0D1730";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mål med krympende ring som viser gjenværende tid
  if (target) {
    const lifeRatio = Math.max(0, 1 - (now - targetSpawnTime) / TARGET_LIFETIME_MS);

    ctx.beginPath();
    ctx.arc(target.x, target.y, targetRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = "#1F3378";
    ctx.stroke();

    // Krympende tidsring rundt målet
    ctx.beginPath();
    ctx.arc(target.x, target.y, targetRadius + 8 * scale, -Math.PI / 2, -Math.PI / 2 + lifeRatio * Math.PI * 2);
    ctx.lineWidth = 3 * scale;
    ctx.strokeStyle = lifeRatio > 0.3 ? "#3ecf6e" : "#e6493f";
    ctx.stroke();
  }

  // HUD
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Treff: ${hits}`, hudX, hudLine * 1.9);
  ctx.fillText(`Utløpt: ${expiredCount}`, hudX, hudLine * 2.8);

  drawCrosshair(ctx, mouseX, mouseY, scale);
}


