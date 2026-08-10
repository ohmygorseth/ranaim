// ============================================================
// TASTATUR + MUS-MODUS
// ============================================================
// Følger samme modul-grensesnitt: start(canvas, ctx, onComplete) / stop()
//
// Som Tastatur-modusen, men museknappene er med i settet. Spilleren
// trener på å veksle mellom tastatur og mus - venstre og høyre
// museknapp behandles som "taster" på linje med W, Shift osv.
// Musa brukes ikke til å sikte her, kun til å klikke.
//
// Én utfordring om gangen (ingen kombinasjoner).
//
// Poengformel (kombinerer presisjon og reaksjonstid):
//   - Hvert riktig trykk gir 10-100 poeng avhengig av hastighet
//   - Summen multipliseres med presisjon (riktige / alle trykk)
// ============================================================

const ROUND_SECONDS = 30;

const REACTION_FAST_MS = 150;
const REACTION_SLOW_MS = 1200;
const MAX_POINTS_PER_HIT = 100;
const MIN_POINTS_PER_HIT = 10;

// "codes" matcher KeyboardEvent.code for taster, og MOUSE_LEFT /
// MOUSE_RIGHT for museknapper (håndteres separat i input-logikken).
const KEY_SET = [
  { codes: ["MOUSE_LEFT"], label: "VENSTREKLIKK", isMouse: true },
  { codes: ["MOUSE_RIGHT"], label: "HØYREKLIKK", isMouse: true },
  { codes: ["Digit1"], label: "1" },
  { codes: ["Digit2"], label: "2" },
  { codes: ["Digit3"], label: "3" },
  { codes: ["KeyQ"], label: "Q" },
  { codes: ["KeyW"], label: "W" },
  { codes: ["KeyE"], label: "E" },
  { codes: ["KeyR"], label: "R" },
  { codes: ["KeyA"], label: "A" },
  { codes: ["KeyS"], label: "S" },
  { codes: ["KeyD"], label: "D" },
  { codes: ["KeyF"], label: "F" },
  { codes: ["ShiftLeft", "ShiftRight"], label: "SHIFT" },
  { codes: ["ControlLeft", "ControlRight"], label: "CTRL" },
  { codes: ["Space"], label: "SPACE" }
];

// Tastaturdel av layouten, med samme ISO-plassering som et ekte
// tastatur. "filler"-taster kan ikke trykkes, men gjør at plasseringen
// av de spillbare tastene blir riktig.
const KEYBOARD_ROWS = [
  [
    { code: "FILLER_PARAGRAPH", label: "§", width: 1, filler: true },
    { code: "Digit1", width: 1 },
    { code: "Digit2", width: 1 },
    { code: "Digit3", width: 1 }
  ],
  [
    { code: "FILLER_TAB", label: "TAB", width: 1.5, filler: true },
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
    { code: "FILLER_Z", label: "Z", width: 1, filler: true },
    { code: "FILLER_X", label: "X", width: 1, filler: true },
    { code: "FILLER_C", label: "C", width: 1, filler: true }
  ],
  [
    { code: "ControlLeft", width: 1.25 },
    { code: "FILLER_WIN", label: "\u229e", width: 1.25, filler: true },
    { code: "FILLER_ALT", label: "ALT", width: 1.25, filler: true },
    { code: "Space", width: 4 }
  ]
];

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let timeLeft = ROUND_SECONDS;
let running = false;
let timerInterval = null;

let keydownHandler = null;
let mousedownHandler = null;
let contextMenuHandler = null;

let currentKey = null;
let challengeStartTime = 0;

let correctCount = 0;
let wrongCount = 0;
let pointsSum = 0;
let reactionTimes = [];

let flashCode = null;
let flashTimeout = null;

export const keyboardMouseMode = {
  id: "keyboardmouse",
  displayName: "Tastatur + Mus",
  comingSoon: false,
  showCursor: true, // musa brukes ikke til sikting her

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

    mousedownHandler = (e) => handleMousedown(e);
    canvas.addEventListener("mousedown", mousedownHandler);

    // Hindre at høyreklikk åpner nettleserens kontekstmeny
    contextMenuHandler = (e) => e.preventDefault();
    canvas.addEventListener("contextmenu", contextMenuHandler);

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
  if (mousedownHandler && canvas) canvas.removeEventListener("mousedown", mousedownHandler);
  if (contextMenuHandler && canvas) canvas.removeEventListener("contextmenu", contextMenuHandler);
  timerInterval = null;
  flashTimeout = null;
  keydownHandler = null;
  mousedownHandler = null;
  contextMenuHandler = null;
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
  const pressedEntry = KEY_SET.find((k) => !k.isMouse && k.codes.includes(e.code));
  if (!pressedEntry) return;
  e.preventDefault();
  registerPress(pressedEntry, e.code);
}

function handleMousedown(e) {
  if (!running || !currentKey) return;
  let code = null;
  if (e.button === 0) code = "MOUSE_LEFT";
  else if (e.button === 2) code = "MOUSE_RIGHT";
  if (!code) return; // ignorer midtklikk osv.

  e.preventDefault();
  const pressedEntry = KEY_SET.find((k) => k.codes.includes(code));
  registerPress(pressedEntry, code);
}

function registerPress(pressedEntry, code) {
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
    flashCode = code;
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

  ctx.fillStyle = "#0d1b33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // HUD
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(canvas.height * 0.042)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "left";
  const hudX = canvas.width * 0.02;
  const hudLine = canvas.height * 0.05;
  ctx.fillText(`Tid: ${timeLeft}s`, hudX, hudLine);
  ctx.fillText(`Riktige: ${correctCount}`, hudX, hudLine * 1.9);
  ctx.fillText(`Feil: ${wrongCount}`, hudX, hudLine * 2.8);

  // Stor tekst med gjeldende utfordring
  if (currentKey) {
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(canvas.height * 0.15)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#3ecf6e";
    ctx.fillText(currentKey.label, canvas.width / 2, canvas.height * 0.27);
  }

  drawKeyboardAndMouse();
}

function drawKeyboardAndMouse() {
  const keyUnit = Math.min(canvas.width * 0.048, canvas.height * 0.088);
  const keyH = keyUnit * 0.88;
  const gap = keyUnit * 0.12;

  const widthFor = (key) => key.width * keyUnit + (key.width - 1) * gap;

  const rowWidths = KEYBOARD_ROWS.map((row) => {
    const keysWidth = row.reduce((sum, k) => sum + widthFor(k), 0);
    return keysWidth + (row.length - 1) * gap;
  });
  const keyboardWidth = Math.max(...rowWidths);

  // Musen tegnes til høyre for tastaturet
  const mouseW = keyUnit * 2.1;
  const mouseGap = keyUnit * 1.3;
  const totalWidth = keyboardWidth + mouseGap + mouseW;

  const boardLeft = canvas.width / 2 - totalWidth / 2;
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
      ctx.fillStyle = key.filler
        ? "rgba(255,255,255,0.28)"
        : isTarget || isFlashing
        ? "#0d1b33"
        : "#ffffff";
      ctx.font = `bold ${Math.round(keyUnit * 0.3)}px 'Saira Condensed', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + width / 2, rowY + keyH / 2);
      ctx.textBaseline = "alphabetic";

      x += width + gap;
    });
  });

  // --- Mus ---
  const mousePosX = boardLeft + keyboardWidth + mouseGap;
  const mouseH = mouseW * 1.6;
  const mousePosY = startY + (KEYBOARD_ROWS.length * (keyH + gap)) / 2 - mouseH / 2;

  drawMouse(mousePosX, mousePosY, mouseW, mouseH);
}

function drawMouse(x, y, w, h) {
  const leftTarget = currentKey && currentKey.codes.includes("MOUSE_LEFT");
  const rightTarget = currentKey && currentKey.codes.includes("MOUSE_RIGHT");
  const leftFlash = flashCode === "MOUSE_LEFT";
  const rightFlash = flashCode === "MOUSE_RIGHT";

  const r = w * 0.42;
  const buttonH = h * 0.42;

  // Muskropp
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r * 1.3);
  ctx.arcTo(x, y + h, x, y, r * 1.3);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = "#16294f";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Venstre knapp
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w / 2, y, x + w / 2, y + buttonH, r);
  ctx.lineTo(x + w / 2, y + buttonH);
  ctx.lineTo(x, y + buttonH);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fillStyle = leftFlash ? "#e6493f" : leftTarget ? "#3ecf6e" : "#1f3a6d";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Høyre knapp
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + buttonH);
  ctx.lineTo(x + w / 2, y + buttonH);
  ctx.closePath();
  ctx.fillStyle = rightFlash ? "#e6493f" : rightTarget ? "#3ecf6e" : "#1f3a6d";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Skillelinje mellom knappene
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + buttonH);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Etiketter
  ctx.font = `bold ${Math.round(w * 0.14)}px 'Saira Condensed', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#d7dce5";
  ctx.fillText("V", x + w * 0.25, y + buttonH * 0.62);
  ctx.fillText("H", x + w * 0.75, y + buttonH * 0.62);
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
