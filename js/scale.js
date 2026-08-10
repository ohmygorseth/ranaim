// ============================================================
// SKALERING
// ============================================================
// Alle spillelementer (målstørrelse, fart osv.) er tunet for en
// spillflate på ca. 1824 x 950 piksler, som tilsvarer et maksimert
// nettleservindu på en 1920x1080-skjerm.
//
// Spilles det i et mindre vindu, skaleres elementene ned i samme
// forhold. Da beholder målene samme relative størrelse på skjermen,
// slik at det ikke blir kunstig lett å score høyt i et lite vindu.
// ============================================================

const REFERENCE_WIDTH = 1824;
const REFERENCE_HEIGHT = 950;

/**
 * Skaleringsfaktor for en gitt spillflate.
 * 1.0 = full størrelse (maksimert vindu på 1920x1080).
 */
export function getScale(canvas) {
  return Math.min(canvas.width / REFERENCE_WIDTH, canvas.height / REFERENCE_HEIGHT);
}
