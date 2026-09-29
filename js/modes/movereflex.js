// ============================================================
// JAKT-MODUS (Reflex med bevegelige mål)
// ============================================================
// Følger samme modul-grensesnitt som de andre: start(canvas, ctx, onComplete) / stop()
//
// Som Reflex: ett mål av gangen som forsvinner av seg selv etter
// TARGET_LIFETIME_MS hvis det ikke treffes. Forskjellen er at målet
// GLIR rundt i en myk, tilfeldig bane mens det lever - da må man både
// reagere raskt og treffe noe som flytter på seg.
//
// Bevegelsen er en "wander": målet har en retning som dreier sakte og
// tilfeldig, i stedet for å gå i rette linjer. Treffer det kanten,
// spretter det innover igjen.
//
// Poeng = treff × presisjon × 100 (samme formel som Reflex/Gridshot).
// "Skudd" inkluderer både bomklikk og mål som rakk å utløpe.
//
// TUNING: juster BASE_TARGET_SPEED for fart og TURN_RATE for hvor
// krokete banen blir. Begge er de eneste knappene du normalt trenger.
// ============================================================

import { drawCrosshair } from "../crosshair.js";
import { getScale } from "../scale.js";
import { playSound } from "../sound.js";

const ROUND_SECONDS = 30;
const TARGET_LIFETIME_MS = 1400; // samme levetid som Reflex
const GRID_COLS = 6;
const GRID_ROWS = 4;
const BASE_TARGET_RADIUS = 50;

const BASE_TARGET_SPEED = 195; // piksler per sekund (ved full skjermstørrelse)
const TURN_RATE = 1.5; // hvor raskt retningen kan dreie (radianer per sekund)
const EDGE_MARGIN = 20; // hvor nær kanten målet får komme

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let targetRadius = BASE_TARGET_RADIUS;
let targetSpeed = BASE_TARGET_SPEED;

let hits = 0;
let totalClicks = 0;
let expiredCount = 0;
let timeLeft = ROUND_SECONDS;

let target = null; // {x, y}
let heading = 0; // retning i radianer
let turnVelocity = 0; // hvor raskt retningen dreier akkurat nå
let targetSpawnTime = 0;
let lastFrameTime = 0;

let timerInterval = null;
let animationFrameId = null;
let running = false;

let clickHandler = null;
let moveHandler = null;
let mouseX = 0;
let mouseY = 0;

export const moveReflex = {
  id: "movereflex",
  displayName: "Jakt",
  comingSoon: false,
  isNew: true, // gir "NY"-merke på modus-kortet - fjern denne når den ikke er ny lenger

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    scale = getScale(canvas);
    targetRadius = BASE_TARGET_RADIUS * scale;
    targetSpeed = BASE_TARGET_SPEED * scale;

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

    lastFrameTime = performance.now();
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

  // Tid siden forrige bilde, i sekunder. Kappes for å unngå at målet
  // hopper langt hvis fanen har vært i bakgrunnen.
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  if (now - targetSpawnTime >= TARGET_LIFETIME_MS) {
    expiredCount += 1;
    spawnTarget();
  } else {
    moveTarget(dt);
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

  heading = Math.random() * Math.PI * 2;
  turnVelocity = (Math.random() * 2 - 1) * TURN_RATE;
  targetSpawnTime = performance.now();
}

/**
 * Myk, tilfeldig bevegelse: retningen dreier gradvis i stedet for å
 * skifte brått, så banen blir en slak kurve i stedet for sikksakk.
 */
function moveTarget(dt) {
  if (!target) return;

  // La svingfarten selv drive litt tilfeldig, så kurven varierer
  turnVelocity += (Math.random() * 2 - 1) * TURN_RATE * dt * 3;
  turnVelocity = Math.max(-TURN_RATE, Math.min(TURN_RATE, turnVelocity));
  heading += turnVelocity * dt;

  target.x += Math.cos(heading) * targetSpeed * dt;
  target.y += Math.sin(heading) * targetSpeed * dt;

  // Sprett innover ved kantene
  const margin = targetRadius + EDGE_MARGIN * scale;
  const minX = margin;
  const maxX = canvas.width - margin;
  const minY = margin;
  const maxY = canvas.height - margin;

  if (target.x < minX) {
    target.x = minX;
    heading = Math.PI - heading;
  } else if (target.x > maxX) {
    target.x = maxX;
    heading = Math.PI - heading;
  }

  if (target.y < minY) {
    target.y = minY;
    heading = -heading;
  } else if (target.y > maxY) {
    target.y = maxY;
    heading = -heading;
  }
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
    ctx.arc(
      target.x,
      target.y,
      targetRadius + 8 * scale,
      -Math.PI / 2,
      -Math.PI / 2 + lifeRatio * Math.PI * 2
    );
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
