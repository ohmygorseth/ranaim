// ============================================================
// LYD
// ============================================================
// Felles lydhåndtering for alle moduser, med av/på-bryter.
// Valget lagres i nettleseren, så det huskes til neste gang.
// ============================================================

const STORAGE_KEY = "ranaim-muted";

let muted = false;

// Les lagret valg (kan feile i private nettleservinduer, derfor try/catch)
try {
  muted = localStorage.getItem(STORAGE_KEY) === "true";
} catch (e) {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch (e) {
    /* ignorer hvis lagring ikke er tilgjengelig */
  }
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

/**
 * Spiller en lydeffekt.
 * @param {"hit"|"miss"} type
 */
export function playSound(type) {
  if (muted) return;
  const el = document.getElementById(type === "hit" ? "sound-hit" : "sound-miss");
  if (el) {
    el.currentTime = 0;
    el.play().catch(() => {
      /* ignorer autoplay-restriksjoner */
    });
  }
}
