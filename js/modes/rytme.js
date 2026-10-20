// ============================================================
// WASD HERO-MODUS (Guitar Hero-stil)
// ============================================================
// Følger samme modul-grensesnitt som de andre: start(canvas, ctx, onComplete) / stop()
//
// Noter faller nedover i fem baner - A, W, S, D og Space - og skal
// treffes når de passerer trefflinjen nederst. Fordi man ser notene
// komme på forhånd, trener modusen noe de andre ikke gjør: å planlegge
// fingrene i forkant i stedet for bare å reagere.
//
// Takten øker gradvis gjennom runden. Treff på rad bygger en combo
// som ganger opp poengene.
//
// Poeng = summen av (BASE_POINTS x combo-multiplikator) for hvert treff.
// Bom (feil tast eller note som passerer) nullstiller comboen.
//
// TUNING: START_BPM / END_BPM styrer tempoet, HIT_WINDOW_MS hvor
// romslig treffsonen er, og FALL_SECONDS hvor lang tid en note bruker
// fra toppen til trefflinjen (altså hvor langt fram man ser).
// ============================================================

import { getScale } from "../scale.js";
import { playSound } from "../sound.js";

const ROUND_SECONDS = 30;

const START_BPM = 64; // noter per minutt ved start
const END_BPM = 108; // ved slutten av runden
const FALL_SECONDS = 1.95; // hvor lenge en note er synlig før trefflinjen
const HIT_WINDOW_MS = 300; // hvor nær i tid trykket må være (romslig for de yngste)

const BASE_POINTS = 25;
const COMBO_STEP = 5; // antall treff per trinn opp i multiplikator
const MAX_MULTIPLIER = 4;

// Banene, i samme rekkefølge som de vises fra venstre
const LANES = [
  { code: "KeyA", label: "A", color: "#E8615A" },
  { code: "KeyW", label: "W", color: "#F2C14E" },
  { code: "KeyS", label: "S", color: "#3ECF6E" },
  { code: "KeyD", label: "D", color: "#4D9BF5" },
  { code: "Space", label: "SPACE", color: "#B07CF0", wide: true }
];

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let scale = 1;
let running = false;
let timeLeft = ROUND_SECONDS;

let startTime = 0;
let notes = []; // { lane, hitTime, state: "pending" | "hit" | "missed" }
let nextNoteTime = 0;

let hits = 0;
let misses = 0;
let combo = 0;
let bestCombo = 0;
let points = 0;

let laneFlash = []; // tidspunkt for siste visuelle blink per bane
let laneFlashType = []; // "hit" | "miss"

let timerInterval = null;
let animationFrameId = null;
let keydownHandler = null;

export const rytmeMode = {
  id: "rytme",
  displayName: "WASD Hero",
  comingSoon: false,
  isNew: true, // gir "NY"-merke på modus-kortet - fjern når den ikke er ny lenger

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    scale = getScale(canvas);

    running = true;
    timeLeft = ROUND_SECONDS;
    notes = [];
    hits = 0;
    misses = 0;
    combo = 0;
    bestCombo = 0;
    points = 0;
    laneFlash = LANES.map(() => 0);
    laneFlashType = LANES.map(() => null);

    startTime = performance.now();
    // Første note lander på trefflinjen etter at den har rukket å falle
    nextNoteTime = FALL_SECONDS * 1000;

    keydownHandler = (e) => handleKeydown(e);
    window.addEventListener("keydown", keydownHandler);

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
  if (keydownHandler) window.removeEventListener("keydown", keydownHandler);
  timerInterval = null;
  animationFrameId = null;
  keydownHandler = null;
}

function endRound() {
  cleanup();

  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;

  if (onCompleteCallback) {
    onCompleteCallback({
      score: Math.round(points),
      stats: [
        { label: "Treff", value: hits },
        { label: "Bom", value: misses },
        { label: "Beste combo", value: bestCombo },
        { label: "Presisjon", value: `${accuracy}%` }
      ]
    });
  }
}

// ------------------------------------------------------------
// Notegenerering
// ------------------------------------------------------------

/** Millisekunder mellom notene, synker gradvis gjennom runden. */
function currentInterval(elapsedMs) {
  const progress = Math.min(elapsedMs / (ROUND_SECONDS * 1000), 1);
  const bpm = START_BPM + (END_BPM - START_BPM) * progress;
  return 60000 / bpm;
}

function spawnNotesIfNeeded(elapsedMs) {
  // Lag noter litt i forkant, slik at de rekker å falle inn i bildet
  while (nextNoteTime < elapsedMs + FALL_SECONDS * 1000 + 500) {
    const lane = pickLane();
    notes.push({ lane, hitTime: nextNoteTime, state: "pending" });
    nextNoteTime += currentInterval(nextNoteTime);
  }
}

let lastLane = -1;
function pickLane() {
  let lane;
  do {
    lane = Math.floor(Math.random() * LANES.length);
  } while (lane === lastLane && Math.random() < 0.6); // unngå for mange like på rad
  lastLane = lane;
  return lane;
}

// ------------------------------------------------------------
// Spillsløyfe
// ------------------------------------------------------------

function loop(now) {
  if (!running) return;

  const elapsed = now - startTime;
  spawnNotesIfNeeded(elapsed);

  // Noter som har passert treffvinduet uten å bli truffet
  notes.forEach((note) => {
    if (note.state === "pending" && elapsed > note.hitTime + HIT_WINDOW_MS) {
      note.state = "missed";
      registerMiss(note.lane);
    }
  });

  // Rydd bort noter som er ute av bildet
  notes = notes.filter((n) => elapsed < n.hitTime + 600);

  draw(elapsed);
  animationFrameId = requestAnimationFrame(loop);
}

function handleKeydown(e) {
  if (!running) return;

  const laneIndex = LANES.findIndex((l) => l.code === e.code);
  if (laneIndex === -1) return;

  e.preventDefault();

  const elapsed = performance.now() - startTime;

  // Finn nærmeste ikke-truffede note i denne banen, innenfor treffvinduet
  let best = null;
  let bestDiff = Infinity;
  notes.forEach((note) => {
    if (note.lane !== laneIndex || note.state !== "pending") return;
    const diff = Math.abs(note.hitTime - elapsed);
    if (diff <= HIT_WINDOW_MS && diff < bestDiff) {
      best = note;
      bestDiff = diff;
    }
  });

  if (best) {
    best.state = "hit";
    hits += 1;
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    points += BASE_POINTS * multiplier();
    flashLane(laneIndex, "hit");
    playSound("hit");
  } else {
    registerMiss(laneIndex);
  }
}

function registerMiss(laneIndex) {
  misses += 1;
  combo = 0;
  flashLane(laneIndex, "miss");
  playSound("miss");
}

function multiplier() {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));
}

function flashLane(laneIndex, type) {
  laneFlash[laneIndex] = performance.now();
  laneFlashType[laneIndex] = type;
}

// ------------------------------------------------------------
// Tegning
// ------------------------------------------------------------

function layout() {
  const boardWidth = Math.min(canvas.width * 0.72, canvas.height * 1.45);
  const laneGap = boardWidth * 0.015;
  const unitCount = LANES.reduce((sum, l) => sum + (l.wide ? 1.9 : 1), 0);
  const unitWidth = (boardWidth - laneGap * (LANES.length - 1)) / unitCount;

  const left = canvas.width / 2 - boardWidth / 2;
  const hitLineY = canvas.height * 0.78;

  const lanes = [];
  let x = left;
  LANES.forEach((lane) => {
    const w = unitWidth * (lane.wide ? 1.9 : 1);
    lanes.push({ ...lane, x, w });
    x += w + laneGap;
  });

  return { lanes, hitLineY, boardWidth, left };
}

function draw(elapsed) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0D1730";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { lanes, hitLineY } = layout();
  const fallDistance = hitLineY;
  const pxPerMs = fallDistance / (FALL_SECONDS * 1000);

  // Tasteboksen er like høy som treffvinduet er langt, slik at det man
  // ser faktisk tilsvarer slingringsmonnet man har. Juster
  // HIT_WINDOW_MS for å gjøre modusen mer eller mindre tilgivende.
  const keyHeight = Math.max(
    90 * scale,
    Math.min(2 * HIT_WINDOW_MS * pxPerMs, 190 * scale)
  );
  const boardBottom = hitLineY + keyHeight / 2;

  // Banebakgrunn
  lanes.forEach((lane) => {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(lane.x, 0, lane.w, boardBottom);
  });

  // Noter
  notes.forEach((note) => {
    if (note.state !== "pending") return;
    const lane = lanes[note.lane];
    const y = hitLineY - (note.hitTime - elapsed) * pxPerMs;
    if (y < -60 * scale || y > boardBottom + 20 * scale) return;

    // Høy nok til at tastenavnet får plass inni
    const h = 46 * scale;
    ctx.beginPath();
    roundedRect(lane.x + 3 * scale, y - h / 2, lane.w - 6 * scale, h, 9 * scale);
    ctx.fillStyle = lane.color;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.stroke();

    // Tastenavnet inni selve noten, i mørk tekst mot banefargen
    ctx.fillStyle = "#0D1730";
    const noteLabelSize = lane.wide ? 20 : 26;
    ctx.font = `bold ${Math.round(noteLabelSize * scale)}px 'Saira Condensed', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lane.label, lane.x + lane.w / 2, y);
    ctx.textBaseline = "alphabetic";
  });

  // Trefflinje
  ctx.beginPath();
  ctx.moveTo(lanes[0].x - 8 * scale, hitLineY);
  ctx.lineTo(lanes[lanes.length - 1].x + lanes[lanes.length - 1].w + 8 * scale, hitLineY);
  ctx.lineWidth = 3 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.stroke();

  // Tasteknapper på trefflinjen
  const now = performance.now();
  lanes.forEach((lane, i) => {
    const sinceFlash = now - laneFlash[i];
    const flashing = sinceFlash < 160;
    const h = keyHeight;

    // Glød under tasten så den skiller seg tydelig ut
    ctx.save();
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = (flashing ? 26 : 12) * scale;

    ctx.beginPath();
    roundedRect(lane.x, hitLineY - h / 2, lane.w, h, 12 * scale);

    if (flashing && laneFlashType[i] === "hit") {
      ctx.fillStyle = lane.color;
    } else if (flashing) {
      ctx.fillStyle = "#e6493f";
    } else {
      ctx.fillStyle = "#1B2E66";
    }
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    roundedRect(lane.x, hitLineY - h / 2, lane.w, h, 12 * scale);
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = flashing ? "#ffffff" : lane.color;
    ctx.stroke();

    // Tastenavnet, stort og i banefargen når den er i ro
    ctx.fillStyle = flashing ? "#0D1730" : lane.color;
    const labelSize = lane.wide ? 26 : 34;
    ctx.font = `bold ${Math.round(labelSize * scale)}px 'Saira Condensed', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lane.label, lane.x + lane.w / 2, hitLineY);
    ctx.textBaseline = "alphabetic";
  });

  // Forklaring under tastene
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `bold ${Math.round(canvas.height * 0.03)}px 'Saira Condensed', sans-serif`;
  ctx.fillText(
    "TRYKK TASTEN NÅR NOTEN ER I BOKSEN",
    canvas.width / 2,
    hitLineY + keyHeight / 2 + 34 * scale
  );

  drawHud();
}

function drawHud() {
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Poeng: ${Math.round(points)}`, hudX, hudLine * 1.9);
  ctx.fillText(`Treff: ${hits}`, hudX, hudLine * 2.8);

  // Combo vises stort til høyre når den er i gang
  if (combo >= COMBO_STEP) {
    ctx.textAlign = "right";
    const x = canvas.width - canvas.width * 0.02;
    ctx.fillStyle = "#3ECF6E";
    ctx.font = `bold italic ${Math.round(canvas.height * 0.075)}px 'Saira Condensed', sans-serif`;
    ctx.fillText(`${multiplier()}x`, x, hudLine * 1.5);
    ctx.font = `bold ${Math.round(canvas.height * 0.032)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#d7dce5";
    ctx.fillText(`${combo} på rad`, x, hudLine * 2.2);
  }
}

function roundedRect(x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
