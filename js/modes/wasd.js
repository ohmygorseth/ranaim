// ============================================================
// WASD-MODUS (håndposisjon og bevegelse)
// ============================================================
// Følger samme modul-grensesnitt: start(canvas, ctx, onComplete) / stop()
//
// Formål: lære riktig håndgrep på WASD + Space, og øve på
// kombinasjonstrykk (f.eks. W+A for å gå skrått opp til venstre,
// eller W+A+Space for å hoppe mens man går skrått).
//
// Progresjon gjennom runden:
//   0-33%   : kun enkelttaster (W, A, S, D, Space)
//   33-66%  : enkelttaster + 2-tast-kombinasjoner (W+A, S+D, W+Space ...)
//   66-100% : også 3-tast-kombinasjoner (W+A+Space ...)
//
// Spilleren må HOLDE INNE alle tastene i kombinasjonen samtidig.
// Poeng = riktige kombinasjoner × presisjon × 100.
// ============================================================

const ROUND_SECONDS = 30;
const INTRO_SECONDS = 5; // håndposisjon-forklaring før runden starter

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

// Fingerfarger for håndposisjon-forklaringen
const FINGER_INFO = {
  KeyA: { finger: "Ringfinger", color: "#EF9F27" },
  KeyW: { finger: "Langfinger", color: "#7F77DD" },
  KeyS: { finger: "Langfinger", color: "#7F77DD" },
  KeyD: { finger: "Pekefinger", color: "#1D9E75" },
  Space: { finger: "Tommel", color: "#D85A30" }
};

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

let phase = "intro"; // intro | playing
let introTimeLeft = INTRO_SECONDS;
let timeLeft = ROUND_SECONDS;
let running = false;

let currentChallenge = null;
let correctCount = 0;
let wrongCount = 0;

const heldKeys = new Set();
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

    phase = "intro";
    introTimeLeft = INTRO_SECONDS;
    timeLeft = ROUND_SECONDS;
    correctCount = 0;
    wrongCount = 0;
    heldKeys.clear();
    feedbackFlash = null;
    running = true;

    keydownHandler = (e) => handleKeydown(e);
    keyupHandler = (e) => handleKeyup(e);
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("keyup", keyupHandler);

    draw();

    timerInterval = setInterval(() => {
      if (phase === "intro") {
        introTimeLeft -= 1;
        if (introTimeLeft <= 0) {
          phase = "playing";
          pickNewChallenge();
        }
      } else {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          endRound();
          return;
        }
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
  if (phase !== "playing" || !currentChallenge) return;

  heldKeys.add(e.code);
  checkCombination();
  draw();
}

function handleKeyup(e) {
  if (!isRelevantKey(e.code)) return;
  heldKeys.delete(e.code);
  draw();
}

function checkCombination() {
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

  if (phase === "intro") {
    drawIntro();
  } else {
    drawGame();
  }
}

function drawIntro() {
  ctx.textAlign = "center";

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px 'Saira Condensed', sans-serif";
  ctx.fillText("Slik holder du hånden", canvas.width / 2, canvas.height * 0.12);

  ctx.font = "20px 'Saira Condensed', sans-serif";
  ctx.fillStyle = "#d7dce5";
  ctx.fillText(
    "Legg fingrene på tastene slik som vist under",
    canvas.width / 2,
    canvas.height * 0.18
  );

  drawKeyboard(true);

  ctx.textAlign = "center";
  ctx.fillStyle = "#3ecf6e";
  ctx.font = "bold 32px 'Saira Condensed', sans-serif";
  ctx.fillText(`Starter om ${introTimeLeft}...`, canvas.width / 2, canvas.height * 0.96);
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

  drawKeyboard(false);
}

function drawKeyboard(showFingers) {
  const keyW = Math.min(canvas.width * 0.11, canvas.height * 0.17);
  const keyH = keyW * 0.85;
  const gap = keyW * 0.14;
  const spaceW = keyW * 3 + gap * 2;

  // I intro trenger vi ekstra plass under hver rad til fingernavnet
  const labelSpace = showFingers ? keyW * 0.42 : 0;
  const rowStep = keyH + gap + labelSpace;

  const startY = showFingers ? canvas.height * 0.26 : canvas.height * 0.42;

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
      const isTarget =
        !showFingers && currentChallenge && currentChallenge.codes.includes(key.code);
      const isHeld = heldKeys.has(key.code);
      const finger = FINGER_INFO[key.code];

      // Tastebakgrunn
      ctx.beginPath();
      roundedRect(x, rowY, width, keyH, 10);

      if (showFingers) {
        ctx.fillStyle = finger.color;
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
      ctx.fillStyle = showFingers || isHeld ? "#0d1b33" : "#ffffff";
      ctx.font = `bold ${Math.round(keyW * 0.3)}px 'Saira Condensed', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(key.label, x + width / 2, rowY + keyH / 2);

      // Fingernavn under tasten (kun i intro)
      if (showFingers) {
        ctx.fillStyle = finger.color;
        ctx.font = `bold ${Math.round(keyW * 0.19)}px 'Saira Condensed', sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(finger.finger, x + width / 2, rowY + keyH + 6);
      }

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
