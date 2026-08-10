// ============================================================
// TASTATUR-MODUS
// ============================================================
// Følger samme modul-grensesnitt som Gridshot/Tracking:
// start(canvas, ctx, onComplete) / stop()
//
// Viser et visuelt tastatur med riktig tast lyst opp, PLUSS stor
// tekst med tastenavnet - kombinerer begge visningsformer i
// samme runde. Spilleren trykker fysisk på tasten på tastaturet.
//
// Poengformel (kombinerer presisjon og reaksjonstid):
//   - Hvert riktig trykk gir 10-100 poeng avhengig av hvor raskt
//     det ble trykket (raskere = mer poeng)
//   - Summen multipliseres med presisjon (riktige trykk / alle trykk)
//   - Feiltrykk (trykk på feil tast i settet) teller ikke som poeng,
//     men trekker ned presisjonen
// ============================================================

const ROUND_SECONDS = 30;

const REACTION_FAST_MS = 150; // gir maks poeng (100) ved denne hastigheten eller raskere
const REACTION_SLOW_MS = 1200; // gir minimumspoeng (10) ved denne hastigheten eller tregere
const MAX_POINTS_PER_HIT = 100;
const MIN_POINTS_PER_HIT = 10;

// Taster som inngår, med kode(r) fra KeyboardEvent.code (layout-uavhengig,
// matcher fysisk posisjon - viktig siden mange spillere har norsk tastatur,
// men WASD-plasseringen er fysisk lik som på engelsk layout).
const KEY_SET = [
  { codes: ["Tab"], label: "TAB" },
  { codes: ["Digit1"], label: "1" },
  { codes: ["Digit2"], label: "2" },
  { codes: ["Digit3"], label: "3" },
  { codes: ["Digit4"], label: "4" },
  { codes: ["Digit5"], label: "5" },
  { codes: ["KeyQ"], label: "Q" },
  { codes: ["KeyW"], label: "W" },
  { codes: ["KeyE"], label: "E" },
  { codes: ["KeyR"], label: "R" },
  { codes: ["KeyA"], label: "A" },
  { codes: ["KeyS"], label: "S" },
  { codes: ["KeyD"], label: "D" },
  { codes: ["KeyF"], label: "F" },
  { codes: ["KeyZ"], label: "Z" },
  { codes: ["KeyX"], label: "X" },
  { codes: ["KeyC"], label: "C" },
  { codes: ["ShiftLeft", "ShiftRight"], label: "SHIFT" },
  { codes: ["ControlLeft", "ControlRight"], label: "CTRL" },
  { codes: ["AltLeft"], label: "ALT" },
  { codes: ["Space"], label: "SPACE" }
];

// Layout-koordinater for det visuelle tastaturet (rad, kolonne-indeks).
// Brukes kun til tegning - ikke faktisk inputlogikk.
// Layout som speiler venstre halvdel av et ekte (norsk/ISO) tastatur.
// "filler"-taster er med kun for at plasseringen skal stemme visuelt -
// de kan ikke trykkes og tegnes nedtonet.
// Bredder er oppgitt i tasteenheter, som på et fysisk tastatur.
const KEYBOARD_ROWS = [
  [
    { code: "FILLER_PARAGRAPH", label: "§", width: 1, filler: true },
    { code: "Digit1", width: 1 },
    { code: "Digit2", width: 1 },
    { code: "Digit3", width: 1 },
    { code: "Digit4", width: 1 },
    { code: "Digit5", width: 1 }
  ],
  [
    { code: "Tab", width: 1.5 },
    { code: "KeyQ", width: 1 },
    { code: "KeyW", width: 1 },
    { code: "KeyE", width: 1 },
    { code: "KeyR", width: 1 }
  ],
  [
    { code: "FILLER_CAPS", label: "CAPS", width: 1.75, filler: true },
    { code: "KeyA", width: 1 },
    { code: "KeyS", width: 1 },
    { code: "KeyD", width: 1 },
    { code: "KeyF", width: 1 }
  ],
  [
    { code: "ShiftLeft", width: 1.25 },
    { code: "FILLER_ANGLE", label: "<", width: 1, filler: true },
    { code: "KeyZ", width: 1 },
    { code: "KeyX", width: 1 },
    { code: "KeyC", width: 1 }
  ],
  [
    { code: "ControlLeft", width: 1.25 },
    { code: "FILLER_WIN", label: "⊞", width: 1.25, filler: true },
    { code: "AltLeft", width: 1.25 },
    { code: "Space", width: 4.5 }
  ]
];

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let timeLeft = ROUND_SECONDS;
let running = false;
let timerInterval = null;
let keydownHandler = null;

let currentKey = null; // referanse til objekt fra KEY_SET
let challengeStartTime = 0;

let correctCount = 0;
let wrongCount = 0;
let pointsSum = 0;
let reactionTimes = [];

let flashCode = null; // kode som nettopp fikk feil-flash (rødt glimt)
let flashTimeout = null;

export const keyboardMode = {
  id: "keyboard",
  displayName: "Tastatur",
  comingSoon: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    timeLeft = ROUND_SECONDS;
    running = true;
    correctCount = 0;
    wrongCount = 0;
    pointsSum = 0;
    reactionTimes = [];
    flashCode = null;

    pickNewKey();
    draw();

    keydownHandler = (e) => handleKeydown(e);
    window.addEventListener("keydown", keydownHandler);

    timerInterval = setInterval(() => {
      timeLeft -= 1;
      draw();
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
  if (flashTimeout) clearTimeout(flashTimeout);
  if (keydownHandler) window.removeEventListener("keydown", keydownHandler);
  timerInterval = null;
  flashTimeout = null;
  keydownHandler = null;
}

function endRound() {
  cleanup();

  const totalPresses = correctCount + wrongCount;
  const accuracy = totalPresses > 0 ? correctCount / totalPresses : 0;
  const finalScore = Math.round(pointsSum * accuracy);
  const avgReaction =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

  if (onCompleteCallback) {
    onCompleteCallback({
      score: finalScore,
      stats: [
        { label: "Riktige trykk", value: correctCount },
        { label: "Feiltrykk", value: wrongCount },
        { label: "Snitt reaksjonstid", value: `${avgReaction} ms` }
      ]
    });
  }
}

function pickNewKey() {
  let next;
  do {
    next = KEY_SET[Math.floor(Math.random() * KEY_SET.length)];
  } while (KEY_SET.length > 1 && next === currentKey);
  currentKey = next;
  challengeStartTime = performance.now();
}

function handleKeydown(e) {
  if (!running || !currentKey) return;

  // Se om denne tasten inngår i vårt tastesett i det hele tatt
  const pressedEntry = KEY_SET.find((k) => k.codes.includes(e.code));
  if (!pressedEntry) return; // ignorer taster utenfor settet (f.eks. Escape)

  e.preventDefault();

  if (pressedEntry === currentKey) {
    const reactionMs = performance.now() - challengeStartTime;
    reactionTimes.push(reactionMs);
    correctCount += 1;
    pointsSum += pointsForReaction(reactionMs);
    playSound("hit");
    pickNewKey();
    draw();
  } else {
    wrongCount += 1;
    playSound("miss");
    flashCode = e.code;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      flashCode = null;
      draw();
    }, 150);
    draw();
  }
}

function pointsForReaction(reactionMs) {
  const clamped = Math.max(REACTION_FAST_MS, Math.min(REACTION_SLOW_MS, reactionMs));
  const ratio = (clamped - REACTION_FAST_MS) / (REACTION_SLOW_MS - REACTION_FAST_MS);
  const points = MAX_POINTS_PER_HIT - ratio * (MAX_POINTS_PER_HIT - MIN_POINTS_PER_HIT);
  return Math.round(points);
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bakgrunn
  ctx.fillStyle = "#0d1b33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // HUD: tid / riktige / feil
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Riktige: ${correctCount}`, hudX, hudLine * 1.9);
  ctx.fillText(`Feil: ${wrongCount}`, hudX, hudLine * 2.8);

  // Stor tekst med gjeldende tast
  if (currentKey) {
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(canvas.height * 0.19)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#3ecf6e";
    ctx.fillText(currentKey.label, canvas.width / 2, canvas.height * 0.28);
  }

  drawVirtualKeyboard();
}

function drawVirtualKeyboard() {
  const keyUnit = Math.min(canvas.width * 0.058, canvas.height * 0.095);
  const keyH = keyUnit * 0.88;
  const gap = keyUnit * 0.12;

  const widthFor = (key) => key.width * keyUnit + (key.width - 1) * gap;

  const rowWidths = KEYBOARD_ROWS.map((row) => {
    const keysWidth = row.reduce((sum, k) => sum + widthFor(k), 0);
    return keysWidth + (row.length - 1) * gap;
  });
  const widest = Math.max(...rowWidths);
  const boardLeft = canvas.width / 2 - widest / 2;
  const startY = canvas.height * 0.42;

  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    const rowY = startY + rowIndex * (keyH + gap);
    let x = boardLeft;

    row.forEach((key) => {
      const width = widthFor(key);
      const entry = key.filler ? null : KEY_SET.find((k) => k.codes.includes(key.code));
      const isTarget = !key.filler && currentKey && currentKey.codes.includes(key.code);
      const isFlashing = !key.filler && flashCode === key.code;

      ctx.beginPath();
      roundedRect(x, rowY, width, keyH, 8);

      if (key.filler) {
        ctx.fillStyle = "#101f3b";
      } else if (isFlashing) {
        ctx.fillStyle = "#e6493f";
      } else if (isTarget) {
        ctx.fillStyle = "#3ecf6e";
      } else {
        ctx.fillStyle = "#16294f";
      }
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = key.filler ? "rgba(255,255,255,0.22)" : "#ffffff";
      ctx.stroke();

      const label = key.filler ? key.label : entry ? entry.label : "";
      if (key.filler) {
        ctx.fillStyle = "rgba(255,255,255,0.28)";
      } else {
        ctx.fillStyle = isTarget || isFlashing ? "#0d1b33" : "#ffffff";
      }
      ctx.font = `bold ${Math.round(keyUnit * 0.3)}px 'Saira Condensed', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + width / 2, rowY + keyH / 2);
      ctx.textBaseline = "alphabetic";

      x += width + gap;
    });
  });
}

function roundedRect(x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
