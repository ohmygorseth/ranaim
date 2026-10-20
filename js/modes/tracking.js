// ============================================================
// TRACKING-MODUS
// ============================================================
// Følger samme modul-grensesnitt som Gridshot: start(canvas, ctx, onComplete) / stop()
//
// Målet beveger seg i rene sveip: vannrett (venstre-høyre), loddrett
// (opp-ned) og på skrå mot motsatt hjørne. Etter hvert sveip velges en
// ny retning, og en pil varsler hvilken vei det snur.
// En rød pil inne i målet viser retningen like før snuingen skjer.
// Farten øker gradvis gjennom runden (starter sakte, blir vanskeligere).
// Poeng = prosent av runden crosshair var innenfor målet, ganget med 10
// (f.eks. 72% treffprosent = 720 poeng).
// ============================================================

import { drawCrosshair } from "../crosshair.js";
import { getScale } from "../scale.js";

const ROUND_SECONDS = 30;
const BASE_TARGET_RADIUS = 46;
const BASE_START_SPEED = 147; // piksler per sekund
const BASE_END_SPEED = 473; // piksler per sekund ved slutten av runden
const BASE_EDGE_MARGIN = 80; // hvor nær kanten sveipene snur
const ARROW_WARNING_SECONDS = 0.75; // hvor lenge før snuing pilen vises

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let targetRadius = BASE_TARGET_RADIUS;
let edgeMargin = BASE_EDGE_MARGIN;

let timeLeft = ROUND_SECONDS;
let elapsed = 0;
let onTargetTime = 0;
let lastFrameTime = 0;

let target = null; // {x, y}
let waypoint = null; // {x, y} - der målet er på vei nå
let nextWaypoint = null; // {x, y} - der det skal etterpå (brukes til retningspil)
let lastAxis = null; // "x" eller "y" - brukes for å variere retningene
let nextAxis = null;

let timerInterval = null;
let animationFrameId = null;
let running = false;

let moveHandler = null;
let mouseX = 0;
let mouseY = 0;

export const tracking = {
  id: "tracking",
  displayName: "Tracking",
  comingSoon: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    scale = getScale(canvas);
    targetRadius = BASE_TARGET_RADIUS * scale;
    edgeMargin = BASE_EDGE_MARGIN * scale;

    timeLeft = ROUND_SECONDS;
    elapsed = 0;
    onTargetTime = 0;
    running = true;

    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;

    target = { x: canvas.width / 2, y: canvas.height / 2 };
    lastAxis = null;
    nextAxis = null;
    initWaypoints();

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
  if (moveHandler && canvas) canvas.removeEventListener("mousemove", moveHandler);
  timerInterval = null;
  animationFrameId = null;
  moveHandler = null;
}

function endRound() {
  cleanup();
  const percentage = ROUND_SECONDS > 0 ? (onTargetTime / ROUND_SECONDS) * 100 : 0;
  const score = Math.round(percentage * 10);

  if (onCompleteCallback) {
    onCompleteCallback({
      score,
      stats: [{ label: "Treffprosent", value: `${percentage.toFixed(1)}%` }]
    });
  }
}

function loop(now) {
  if (!running) return;

  const dt = Math.min((now - lastFrameTime) / 1000, 0.1); // capp for å unngå hopp ved tab-bytte
  lastFrameTime = now;
  elapsed += dt;

  updateTargetPosition(dt);

  const dx = mouseX - target.x;
  const dy = mouseY - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isOnTarget = dist <= targetRadius;

  if (isOnTarget) {
    onTargetTime += dt;
  }

  draw(isOnTarget);

  animationFrameId = requestAnimationFrame(loop);
}

function currentSpeed() {
  const progress = Math.min(elapsed / ROUND_SECONDS, 1);
  return (BASE_START_SPEED + (BASE_END_SPEED - BASE_START_SPEED) * progress) * scale;
}

// Beregner et sveip-mål ut fra et startpunkt og forrige akse.
// Returnerer både punktet og hvilken akse som ble valgt.
// Aksene er "x" (vannrett), "y" (loddrett) og "diag" (på skrå).
function computeWaypoint(from, prevAxis) {
  const marginX = Math.max(edgeMargin, targetRadius + 20 * scale);
  const marginY = Math.max(edgeMargin, targetRadius + 20 * scale);

  const minX = marginX;
  const maxX = canvas.width - marginX;
  const minY = marginY;
  const maxY = canvas.height - marginY;

  // Velg en annen akse enn forrige, slik at bevegelsen varierer.
  const axes = ["x", "y", "diag"];
  let candidates = prevAxis === null ? ["x"] : axes.filter((a) => a !== prevAxis);
  // Av og til (25%) gjentas samme akse, som gir "frem og tilbake"-sveip
  if (prevAxis !== null && Math.random() < 0.25) {
    candidates = [prevAxis];
  }
  const axis = candidates[Math.floor(Math.random() * candidates.length)];

  let point;
  if (axis === "x") {
    const goRight = from.x < (minX + maxX) / 2;
    point = { x: goRight ? maxX : minX, y: clamp(from.y, minY, maxY) };
  } else if (axis === "y") {
    const goDown = from.y < (minY + maxY) / 2;
    point = { x: clamp(from.x, minX, maxX), y: goDown ? maxY : minY };
  } else {
    // Diagonal: sveip mot et motsatt hjørne-område, slik at bevegelsen
    // går på skrå gjennom skjermen i stedet for langs en kant.
    const goRight = from.x < (minX + maxX) / 2;
    const goDown = from.y < (minY + maxY) / 2;
    point = {
      x: goRight ? maxX : minX,
      y: goDown ? maxY : minY
    };
  }

  return { point, axis };
}

// Setter opp første sveip og forhåndsberegner det neste,
// slik at vi kan vise hvilken vei målet skal etterpå.
function initWaypoints() {
  const first = computeWaypoint(target, null);
  waypoint = first.point;
  lastAxis = first.axis;

  const second = computeWaypoint(waypoint, lastAxis);
  nextWaypoint = second.point;
  nextAxis = second.axis;
}

function advanceWaypoint() {
  waypoint = nextWaypoint;
  lastAxis = nextAxis;

  const upcoming = computeWaypoint(waypoint, lastAxis);
  nextWaypoint = upcoming.point;
  nextAxis = upcoming.axis;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updateTargetPosition(dt) {
  if (!waypoint) return;

  const dx = waypoint.x - target.x;
  const dy = waypoint.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const speed = currentSpeed();
  const moveDist = speed * dt;

  if (dist <= moveDist) {
    // Nådd enden av sveipet - snap til punktet og gå videre til neste
    target.x = waypoint.x;
    target.y = waypoint.y;
    advanceWaypoint();
    return;
  }

  const ratio = moveDist / dist;
  target.x += dx * ratio;
  target.y += dy * ratio;
}

/**
 * Hvor lenge (i sekunder) det er igjen til målet snur.
 */
function timeUntilTurn() {
  if (!waypoint) return Infinity;
  const dx = waypoint.x - target.x;
  const dy = waypoint.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist / currentSpeed();
}

/**
 * Retningsvektor for det kommende sveipet (normalisert).
 */
function nextDirection() {
  if (!nextWaypoint || !waypoint) return null;
  const dx = nextWaypoint.x - waypoint.x;
  const dy = nextWaypoint.y - waypoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Tegner en pil inne i målet som viser hvilken vei det snur,
 * men kun de siste ARROW_WARNING_SECONDS før snuingen skjer.
 * Pilen blir tydeligere jo nærmere snuingen kommer.
 */
function drawTurnArrow() {
  const timeLeftToTurn = timeUntilTurn();
  if (timeLeftToTurn > ARROW_WARNING_SECONDS) return;

  const dir = nextDirection();
  if (!dir) return;

  // Fader inn: 0 ved terskelen, 1 idet snuingen skjer
  const strength = 1 - timeLeftToTurn / ARROW_WARNING_SECONDS;

  const len = targetRadius * 0.62;
  const headLen = targetRadius * 0.36;
  const cx = target.x;
  const cy = target.y;

  const tipX = cx + dir.x * len;
  const tipY = cy + dir.y * len;
  const tailX = cx - dir.x * len * 0.55;
  const tailY = cy - dir.y * len * 0.55;

  // Vinkelrett vektor for pilhodet
  const px = -dir.y;
  const py = dir.x;

  ctx.save();
  ctx.globalAlpha = 0.35 + strength * 0.65;

  // Pilstammen
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX - dir.x * headLen * 0.8, tipY - dir.y * headLen * 0.8);
  ctx.lineWidth = targetRadius * 0.16;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e6493f";
  ctx.stroke();

  // Pilhodet
  const baseX = tipX - dir.x * headLen;
  const baseY = tipY - dir.y * headLen;
  const halfW = headLen * 0.62;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX + px * halfW, baseY + py * halfW);
  ctx.lineTo(baseX - px * halfW, baseY - py * halfW);
  ctx.closePath();
  ctx.fillStyle = "#e6493f";
  ctx.fill();

  ctx.restore();
}

function updateMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
}

function draw(isOnTarget) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bakgrunn
  ctx.fillStyle = "#0D1730";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mål - grønn kant når crosshair er på målet, hvit ellers
  if (target) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, targetRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = isOnTarget ? "#3ecf6e" : "#1F3378";
    ctx.stroke();

    drawTurnArrow();
  }

  // HUD: tid / treffprosent så langt
  const currentPercent = elapsed > 0 ? ((onTargetTime / elapsed) * 100).toFixed(0) : 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Treffprosent: ${currentPercent}%`, hudX, hudLine * 1.9);

  drawCrosshair(ctx, mouseX, mouseY, scale);
}

