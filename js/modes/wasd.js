// ============================================================
// WASD-MODUS (håndposisjon og bevegelse)
// ============================================================
// Følger samme modul-grensesnitt: start(canvas, ctx, onComplete) / stop()
//
// Formål: øve på WASD + Space og kombinasjonstrykk (f.eks. W+A for
// å gå skrått opp til venstre, eller W+A+Space for å hoppe mens man
// går skrått).
//
// Progresjon gjennom runden:
//   0-33%   : kun enkelttaster (W, A, S, D, Space)
//   33-66%  : enkelttaster + 2-tast-kombinasjoner (W+A, S+D, W+Space ...)
//   66-100% : også 3-tast-kombinasjoner (W+A+Space ...)
//
// Spilleren må HOLDE INNE alle tastene i kombinasjonen samtidig.
// Poeng = riktige kombinasjoner × presisjon × 100.
// ============================================================

import { playSound } from "../sound.js";

const ROUND_SECONDS = 30;

// Retningskombinasjoner (kun de som gir mening i spill)
const SINGLE_KEYS = [
  { codes: ["KeyW"], label: "W" },
  { codes: ["KeyA"], label: "A" },
  { codes: ["KeyS"], label: "S" },
  { codes: ["KeyD"], label: "D" },
  { codes: ["Space"], label: "SPACE" }
];

const DOUBLE_KEYS = [
  { codes: ["KeyW", "KeyA"], label: "W + A" },
  { codes: ["KeyW", "KeyD"], label: "W + D" },
  { codes: ["KeyS", "KeyA"], label: "S + A" },
  { codes: ["KeyS", "KeyD"], label: "S + D" },
  { codes: ["KeyW", "Space"], label: "W + SPACE" },
  { codes: ["KeyA", "Space"], label: "A + SPACE" },
  { codes: ["KeyD", "Space"], label: "D + SPACE" },
  { codes: ["KeyS", "Space"], label: "S + SPACE" }
];

const TRIPLE_KEYS = [
  { codes: ["KeyW", "KeyA", "Space"], label: "W + A + SPACE" },
  { codes: ["KeyW", "KeyD", "Space"], label: "W + D + SPACE" },
  { codes: ["KeyS", "KeyA", "Space"], label: "S + A + SPACE" },
  { codes: ["KeyS", "KeyD", "Space"], label: "S + D + SPACE" }
];

// Tastaturlayout for tegning
const KEY_LAYOUT = [
  [{ code: "KeyW", label: "W" }],
  [
    { code: "KeyA", label: "A" },
    { code: "KeyS", label: "S" },
    { code: "KeyD", label: "D" }
  ],
  [{ code: "Space", label: "SPACE", wide: true }]
];

let ctx = null;
let canvas = null;
let onCompleteCallback = null;

let timeLeft = ROUND_SECONDS;
let running = false;

let currentChallenge = null;
let correctCount = 0;
let wrongCount = 0;

const heldKeys = new Set();
let awaitingRelease = false; // venter på at spilleren slipper tastene fra forrige utfordring
let feedbackFlash = null; // "correct" | "wrong" | null
let flashTimeout = null;

let timerInterval = null;
let keydownHandler = null;
let keyupHandler = null;

export const wasdMode = {
  id: "wasd",
  displayName: "WASD",
  comingSoon: false,

  start(canvasEl, context, onComplete) {
    canvas = canvasEl;
    ctx = context;
    onCompleteCallback = onComplete;

    timeLeft = ROUND_SECONDS;
    correctCount = 0;
    wrongCount = 0;
    heldKeys.clear();
    awaitingRelease = false;
    feedbackFlash = null;
    running = true;

    keydownHandler = (e) => handleKeydown(e);
    keyupHandler = (e) => handleKeyup(e);
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    pickNewChallenge();
    draw();

    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        endRound();
        return;
      }
      draw();
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
  if (keyupHandler) window.removeEventListener("keyup", keyupHandler);
  timerInterval = null;
  flashTimeout = null;
  keydownHandler = null;
  keyupHandler = null;
}

function endRound() {
  cleanup();
  const total = correctCount + wrongCount;
  const accuracy = total > 0 ? correctCount / total : 0;
  const finalScore = Math.round(correctCount * accuracy * 100);

  if (onCompleteCallback) {
    onCompleteCallback({
      score: finalScore,
      stats: [
        { label: "Riktige", value: correctCount },
        { label: "Feil", value: wrongCount }
      ]
    });
  }
}

function difficultyPool() {
  const progress = 1 - timeLeft / ROUND_SECONDS;
  if (progress < 0.33) return SINGLE_KEYS;
  if (progress < 0.66) return [...SINGLE_KEYS, ...DOUBLE_KEYS];
  return [...SINGLE_KEYS, ...DOUBLE_KEYS, ...TRIPLE_KEYS];
}

function pickNewChallenge() {
  const pool = difficultyPool();
  let next;
  do {
    next = pool[Math.floor(Math.random() * pool.length)];
  } while (pool.length > 1 && currentChallenge && next.label === currentChallenge.label);
  currentChallenge = next;
}

function isRelevantKey(code) {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(code);
}

function handleKeydown(e) {
  if (!running || !isRelevantKey(e.code)) return;
  e.preventDefault();
  if (!currentChallenge) return;

  heldKeys.add(e.code);
  checkCombination();
  draw();
}

function handleKeyup(e) {
  if (!isRelevantKey(e.code)) return;
  heldKeys.delete(e.code);
  if (heldKeys.size === 0) {
    awaitingRelease = false;
  }
  draw();
}

function checkCombination() {
  // Etter en fullført utfordring holder spilleren fortsatt tastene nede.
  // Vi venter til alt er sluppet, ellers ville de gamle tastene telt som
  // "ekstra taster" på den nye utfordringen og gitt feil.
  if (awaitingRelease) return;

  const required = currentChallenge.codes;

  // Alle nødvendige taster holdt inne?
  const allHeld = required.every((c) => heldKeys.has(c));
  if (!allHeld) return;

  // Ingen ekstra taster holdt inne (f.eks. W+A når kun W var etterspurt)?
  const noExtras = [...heldKeys].every((c) => required.includes(c));

  if (noExtras) {
    correctCount += 1;
    flash("correct");
    playSound("hit");
  } else {
    wrongCount += 1;
    flash("wrong");
    playSound("miss");
  }
  awaitingRelease = true;
  pickNewChallenge();
}

function flash(type) {
  feedbackFlash = type;
  if (flashTimeout) clearTimeout(flashTimeout);
  flashTimeout = setTimeout(() => {
    feedbackFlash = null;
    draw();
  }, 200);
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0d1b33";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGame();
}

function drawGame() {
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
  if (currentChallenge) {
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(canvas.height * 0.13)}px 'Saira Condensed', sans-serif`;
    if (feedbackFlash === "correct") {
      ctx.fillStyle = "#3ecf6e";
    } else if (feedbackFlash === "wrong") {
      ctx.fillStyle = "#e6493f";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillText(currentChallenge.label, canvas.width / 2, canvas.height * 0.25);

    ctx.font = `${Math.round(canvas.height * 0.032)}px 'Saira Condensed', sans-serif`;
    ctx.fillStyle = "#d7dce5";
    const hint =
      currentChallenge.codes.length > 1 ? "Hold inne alle samtidig" : "Trykk tasten";
    ctx.fillText(hint, canvas.width / 2, canvas.height * 0.31);
  }

  drawKeyboard();
}

function drawKeyboard() {
  const keyW = Math.min(canvas.width * 0.11, canvas.height * 0.17);
  const keyH = keyW * 0.85;
  const gap = keyW * 0.14;
  const spaceW = keyW * 3 + gap * 2;

  const rowStep = keyH + gap;
  const startY = canvas.height * 0.42;

  KEY_LAYOUT.forEach((row, rowIndex) => {
    const rowY = startY + rowIndex * rowStep;

    let rowWidth;
    if (row[0].wide) {
      rowWidth = spaceW;
    } else {
      rowWidth = row.length * keyW + (row.length - 1) * gap;
    }
    let x = canvas.width / 2 - rowWidth / 2;

    row.forEach((key) => {
      const width = key.wide ? spaceW : keyW;
      const isTarget = currentChallenge && currentChallenge.codes.includes(key.code);
      const isHeld = heldKeys.has(key.code);

      // Tastebakgrunn
      ctx.beginPath();
      roundedRect(x, rowY, width, keyH, 10);

      if (awaitingRelease && isHeld) {
        // Taster som fortsatt holdes fra forrige utfordring - nøytral farge,
        // ikke rødt, siden det ikke er en feil
        ctx.fillStyle = "#2b4a86";
      } else if (isHeld && isTarget) {
        ctx.fillStyle = "#3ecf6e";
      } else if (isHeld) {
        ctx.fillStyle = "#e6493f";
      } else if (isTarget) {
        ctx.fillStyle = "#1b3a70";
      } else {
        ctx.fillStyle = "#16294f";
      }
      ctx.fill();

      ctx.lineWidth = isTarget ? 4 : 2;
      ctx.strokeStyle = isTarget && !isHeld ? "#3ecf6e" : "#ffffff";
      ctx.stroke();

      // Tastebokstav
      ctx.fillStyle = isHeld && !awaitingRelease ? "#0d1b33" : "#ffffff";
      ctx.font = `bold ${Math.round(keyW * 0.3)}px 'Saira Condensed', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(key.label, x + width / 2, rowY + keyH / 2);

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

