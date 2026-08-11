// ============================================================
// GRIDSHOT-MODUS
// ============================================================
// Følger modul-grensesnittet: start(canvas, ctx, onComplete) / stop()
// Alle moduser som legges til senere (f.eks. Tracking) bør følge
// samme mønster: egen fil i js/modes/, samme grensesnitt.
// ============================================================

import { drawCrosshair } from "../crosshair.js";
import { getScale } from "../scale.js";
import { playSound } from "../sound.js";

const ROUND_SECONDS = 30;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const BASE_TARGET_RADIUS = 50;

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let targetRadius = BASE_TARGET_RADIUS;

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

    scale = getScale(canvas);
    targetRadius = BASE_TARGET_RADIUS * scale;

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
    onCompleteCallback({
      score: finalScore,
      stats: [
        { label: "Treff", value: hits },
        { label: "Skudd", value: shots }
      ]
    });
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

  if (dist <= targetRadius) {
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
  ctx.fillStyle = "#0D1730";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mål
  if (target) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, targetRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = "#1F3378";
    ctx.stroke();
  }

  // HUD: tid / treff / skudd
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Treff: ${hits}`, hudX, hudLine * 1.9);
  ctx.fillText(`Skudd: ${shots}`, hudX, hudLine * 2.8);

  drawCrosshair(ctx, mouseX, mouseY, scale);
}


