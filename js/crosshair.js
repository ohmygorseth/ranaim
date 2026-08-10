// ============================================================
// CROSSHAIR (felles for alle mus-baserte moduser)
// ============================================================
// Tegnes med mørk kontur rundt selve streken, slik at den er
// tydelig synlig BÅDE mot mørk bakgrunn og mot hvite mål -
// samme prinsipp som ekte aim-trainere bruker.
// ============================================================

const COLOR = "#00E5FF"; // cyan - skiller seg tydelig fra hvite mål og mørkeblå bakgrunn
const OUTLINE = "#001018"; // nesten svart kontur
const BASE_SIZE = 16; // lengden på hver strek
const BASE_GAP = 5; // åpning i midten
const BASE_THICKNESS = 3;
const BASE_DOT_RADIUS = 2;

/**
 * Tegner crosshair på gitt posisjon.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [scale] skaleringsfaktor for spillflaten
 */
export function drawCrosshair(ctx, x, y, scale = 1) {
  const SIZE = BASE_SIZE * scale;
  const GAP = BASE_GAP * scale;
  const THICKNESS = BASE_THICKNESS * scale;
  const OUTLINE_THICKNESS = THICKNESS + 3 * scale;
  const DOT_RADIUS = BASE_DOT_RADIUS * scale;

  ctx.save();
  ctx.lineCap = "round";

  // Bygg strekene én gang, tegn dem to ganger (kontur under, farge over)
  const strokeLines = () => {
    ctx.beginPath();
    ctx.moveTo(x - GAP - SIZE, y);
    ctx.lineTo(x - GAP, y);
    ctx.moveTo(x + GAP, y);
    ctx.lineTo(x + GAP + SIZE, y);
    ctx.moveTo(x, y - GAP - SIZE);
    ctx.lineTo(x, y - GAP);
    ctx.moveTo(x, y + GAP);
    ctx.lineTo(x, y + GAP + SIZE);
    ctx.stroke();
  };

  // 1. Mørk kontur
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = OUTLINE_THICKNESS;
  strokeLines();

  // 2. Selve fargen oppå
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = THICKNESS;
  strokeLines();

  // Senterprikk, også med kontur
  ctx.beginPath();
  ctx.arc(x, y, DOT_RADIUS + 1.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = COLOR;
  ctx.fill();

  ctx.restore();
}
