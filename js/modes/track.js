// ============================================================
// BANE-MODUS (Steady Hand)
// ============================================================
// Følger samme modul-grensesnitt: start(canvas, ctx, onComplete) / stop()
//
// Spilleren holder inne venstre museknapp og fører crosshairet gjennom
// en fast, lukket løype. Banen går i loop, så man fortsetter runde
// etter runde til tiden er ute.
//
// Regler:
//   - Hold venstre museknapp inne hele veien
//   - Kommer du utenfor banen (eller slipper knappen) = minuspoeng
//   - Kontrollpunkter må passeres i rekkefølge, så man kan ikke
//     ta snarveier tvers over banen
//
// Poeng = passerte kontrollpunkter x 50, minus 100 per bom.
// ============================================================

import { drawCrosshair } from "../crosshair.js";
import { getScale } from "../scale.js";

const ROUND_SECONDS = 30;
const BASE_TRACK_WIDTH = 54; // full bredde på korridoren
const CHECKPOINTS = 24; // antall kontrollpunkter per runde
const POINTS_PER_CHECKPOINT = 50;
const PENALTY_PER_MISS = 100;
const SAMPLES = 720; // hvor finmasket senterlinjen samples

// Fast bane, definert som kontrollpunkter i normaliserte koordinater
// (0-1). Glattes ut til en myk, lukket kurve ved oppstart.
const TRACK_CONTROL_POINTS = [
  [0.16, 0.5],
  [0.17, 0.26],
  [0.31, 0.14],
  [0.5, 0.29],
  [0.69, 0.14],
  [0.83, 0.26],
  [0.84, 0.5],
  [0.83, 0.74],
  [0.66, 0.86],
  [0.5, 0.71],
  [0.34, 0.86],
  [0.17, 0.74]
];

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let trackWidth = BASE_TRACK_WIDTH;
let path = []; // {x, y} samplet senterlinje

let phase = "waiting"; // waiting | running
let timeLeft = ROUND_SECONDS;
let running = false;
let timerInterval = null;
let animationFrameId = null;

let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let wasOffTrack = true; // true = utenfor / ikke aktiv, brukes for å telle bom kun én gang

let checkpointsPassed = 0;
let nextCheckpoint = 0;
let laps = 0;
let misses = 0;
let flashUntil = 0;

let moveHandler = null;
let downHandler = null;
let upHandler = null;
let leaveHandler = null;

export const trackMode = {
  id: "track",
  displayName: "Bane",
  comingSoon: false,
  showCursor: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    scale = getScale(canvas);
    trackWidth = BASE_TRACK_WIDTH * scale;

    buildPath();

    phase = "waiting";
    timeLeft = ROUND_SECONDS;
    running = true;
    checkpointsPassed = 0;
    nextCheckpoint = 1;
    laps = 0;
    misses = 0;
    mouseDown = false;
    wasOffTrack = true;
    flashUntil = 0;

    mouseX = canvas.width / 2;
    mouseY = canvas.height / 2;

    moveHandler = (e) => updateMousePosition(e);
    downHandler = () => {
      mouseDown = true;
    };
    upHandler = () => {
      mouseDown = false;
    };
    leaveHandler = () => {
      mouseDown = false;
    };

    canvas.addEventListener("mousemove", moveHandler);
    canvas.addEventListener("mousedown", downHandler);
    window.addEventListener("mouseup", upHandler);
    canvas.addEventListener("mouseleave", leaveHandler);

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
  if (downHandler && canvas) canvas.removeEventListener("mousedown", downHandler);
  if (upHandler) window.removeEventListener("mouseup", upHandler);
  if (leaveHandler && canvas) canvas.removeEventListener("mouseleave", leaveHandler);
  timerInterval = null;
  animationFrameId = null;
  moveHandler = null;
  downHandler = null;
  upHandler = null;
  leaveHandler = null;
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 0) {
      endRound();
    }
  }, 1000);
}

function endRound() {
  cleanup();
  const raw = checkpointsPassed * POINTS_PER_CHECKPOINT - misses * PENALTY_PER_MISS;
  const score = Math.max(0, raw);

  if (onCompleteCallback) {
    onCompleteCallback({
      score,
      stats: [
        { label: "Runder", value: laps },
        { label: "Punkter", value: checkpointsPassed },
        { label: "Bom", value: misses }
      ]
    });
  }
}

// ------------------------------------------------------------
// Baneoppbygging
// ------------------------------------------------------------

function buildPath() {
  const pts = TRACK_CONTROL_POINTS.map(([nx, ny]) => ({
    x: nx * canvas.width,
    y: ny * canvas.height
  }));

  path = [];
  const n = pts.length;
  const perSegment = Math.ceil(SAMPLES / n);

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      path.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
}

// Catmull-Rom-interpolasjon gir en myk kurve gjennom kontrollpunktene
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

// Nærmeste punkt på banen: returnerer {index, distance}
function nearestOnPath(x, y) {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const dx = path[i].x - x;
    const dy = path[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distance: Math.sqrt(bestDist) };
}

function checkpointIndexFor(pathIndex) {
  return Math.floor((pathIndex / path.length) * CHECKPOINTS);
}

function checkpointPosition(cpIndex) {
  const i = Math.round((cpIndex / CHECKPOINTS) * path.length) % path.length;
  return path[i];
}

// ------------------------------------------------------------
// Spillsløyfe
// ------------------------------------------------------------

function loop() {
  if (!running) return;

  const nearest = nearestOnPath(mouseX, mouseY);
  const onTrack = nearest.distance <= trackWidth / 2;

  if (phase === "waiting") {
    // Runden starter når spilleren holder inne museknappen på startpunktet
    const startPt = checkpointPosition(0);
    const dx = mouseX - startPt.x;
    const dy = mouseY - startPt.y;
    const atStart = Math.sqrt(dx * dx + dy * dy) <= trackWidth * 0.9;

    if (mouseDown && atStart) {
      phase = "running";
      wasOffTrack = false;
      startTimer();
    }
  } else {
    const active = mouseDown && onTrack;

    if (active) {
      // Registrer kontrollpunkter i rekkefølge
      const cp = checkpointIndexFor(nearest.index);
      if (cp === nextCheckpoint) {
        checkpointsPassed += 1;
        nextCheckpoint = (nextCheckpoint + 1) % CHECKPOINTS;
        if (nextCheckpoint === 1) {
          laps += 1;
        }
      }
      wasOffTrack = false;
    } else if (!wasOffTrack) {
      // Telles kun én gang per gang man går utenfor / slipper knappen
      misses += 1;
      wasOffTrack = true;
      flashUntil = performance.now() + 250;
      playSound("miss");
    }
  }

  draw(onTrack);
  animationFrameId = requestAnimationFrame(loop);
}

function updateMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * sx;
  mouseY = (e.clientY - rect.top) * sy;
}

// ------------------------------------------------------------
// Tegning
// ------------------------------------------------------------

function draw(onTrack) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0d1b33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawTrack(onTrack);
  drawCheckpointMarkers();
  drawHud();

  drawCrosshair(ctx, mouseX, mouseY, scale);
}

function drawTrack(onTrack) {
  const flashing = performance.now() < flashUntil;

  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.closePath();

  // Vegger (ytterkant)
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = flashing ? "#e6493f" : "#ffffff";
  ctx.lineWidth = trackWidth + 6 * scale;
  ctx.stroke();

  // Selve korridoren
  ctx.strokeStyle = "#16294f";
  ctx.lineWidth = trackWidth;
  ctx.stroke();

  // Senterlinje
  ctx.save();
  ctx.setLineDash([10 * scale, 12 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.restore();
}

function drawCheckpointMarkers() {
  // Neste kontrollpunkt vises tydelig, resten svakt
  for (let i = 0; i < CHECKPOINTS; i++) {
    const p = checkpointPosition(i);
    const isNext = phase === "running" && i === nextCheckpoint;
    const isStart = i === 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, (isNext ? 7 : 3.5) * scale, 0, Math.PI * 2);
    if (isNext) {
      ctx.fillStyle = "#00E5FF";
    } else if (isStart) {
      ctx.fillStyle = "rgba(62, 207, 110, 0.8)";
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
    }
    ctx.fill();
  }
}

function drawHud() {
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Runder: ${laps}`, hudX, hudLine * 1.9);
  ctx.fillText(`Bom: ${misses}`, hudX, hudLine * 2.8);

  if (phase === "waiting") {
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(canvas.height * 0.055)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#3ecf6e";
    ctx.fillText(
      "Hold venstre museknapp på det grønne punktet for å starte",
      canvas.width / 2,
      canvas.height * 0.5
    );
    ctx.font = `${Math.round(canvas.height * 0.032)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#d7dce5";
    ctx.fillText(
      "Følg banen uten å treffe veggene - slipper du knappen får du minuspoeng",
      canvas.width / 2,
      canvas.height * 0.56
    );
  } else if (!mouseDown) {
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(canvas.height * 0.045)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#e6493f";
    ctx.fillText("Hold inne venstre museknapp!", canvas.width / 2, canvas.height * 0.5);
  }
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
