// ============================================================
// KALLENAVN-FILTER
// ============================================================
// To lag med kontroll:
//
//   1. TEGNREGEL - bare bokstaver, tall, mellomrom, bindestrek og
//      understrek er tillatt. Fjerner en hel kategori omgåelser med
//      spesialtegn.
//
//   2. ORDLISTE - navnet normaliseres og sjekkes mot lista. Tall
//      tolkes både som bokstaver ("f1tte" -> "fitte") og fjernes
//      ("kuk123" -> "kuk"), gjentatte bokstaver kuttes ("faaaen" ->
//      "faen"), og mellomrom og symboler fjernes ("f a e n" -> "faen").
//
// Ordlisten er delt i to:
//   - BLOCKED_SUBSTRINGS: lange, entydige ord. Matches hvor som helst.
//   - BLOCKED_EXACT: korte eller tvetydige ord. Må utgjøre hele navnet
//     eller en hel del av det, ellers ville "Pulse" blitt stoppet av
//     "pul" og "Pistol" av "piss".
//
// MERK: dette kjører i nettleseren og kan omgås av noen som åpner
// utviklerverktøyene. Det stopper spontane påfunn, ikke en bevisst
// omgåelse - etterkontroll i Firebase er fortsatt nødvendig.
// ============================================================

const BLOCKED_SUBSTRINGS = [
  // Norsk
  "faen", "fitte", "fitta", "jævel", "jaevel", "javel", "jævla", "javla", "jaevla",
  "helvete", "satan", "idiot", "mongo", "mongis", "spasser", "retard",
  "neger", "nigger", "nigga", "voldtekt", "hitler", "selvmord",
  "homse", "lesbe", "ludder", "hore", "hora", "bæsj", "basj", "promp",
  "pikk", "penis", "vagina", "rævhøl", "ravhol",

  // Engelsk
  "fuck", "shit", "bitch", "cunt", "pussy", "boobs", "asshole", "bastard",
  "whore", "faggot", "porn", "nazi", "retarded", "dickhead", "motherfuck"
];

const BLOCKED_EXACT = [
  // Norsk
  "kuk", "pul", "pule", "puler", "pult", "tiss", "piss", "pissa",
  "drit", "dritt", "rompe", "rompa", "homo", "kukk",

  // Engelsk
  "sex", "gay", "fag", "cum", "anal", "rape", "slut", "dick", "cock",
  "wank", "tits", "ass", "damn", "crap"
];

// Tegn som ofte brukes i stedet for bokstaver
const LEET_MAP = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "8": "b", "9": "g", "@": "a", "$": "s",
  "!": "i", "|": "i", "+": "t"
};

/**
 * Sjekker om kallenavnet kun inneholder tillatte tegn.
 * Tillater norske bokstaver, tall, mellomrom, bindestrek og understrek.
 */
export function hasAllowedCharacters(nickname) {
  return /^[a-zA-ZæøåÆØÅ0-9 _-]+$/.test(nickname);
}

/** Kutter gjentatte bokstaver: "faaaen" -> "faen" */
function collapseRepeats(s) {
  return s.replace(/(.)\1+/g, "$1");
}

/** Bytter tall og symboler til bokstavene de etterligner, og beholder kun bokstaver. */
function leetToLetters(s) {
  return s
    .toLowerCase()
    .replace(/[01345789@$!|+]/g, (ch) => LEET_MAP[ch] || ch)
    .replace(/[^a-zæøå]/g, "");
}

/** Fjerner alt som ikke er bokstav, uten å tolke tall som bokstaver. */
function lettersOnly(s) {
  return s.toLowerCase().replace(/[^a-zæøå]/g, "");
}

const NORMALIZED_SUBSTRINGS = BLOCKED_SUBSTRINGS.map((w) => collapseRepeats(w));
const NORMALIZED_EXACT = new Set(BLOCKED_EXACT.map((w) => collapseRepeats(w)));

/**
 * Bygger alle variantene av navnet som skal sjekkes.
 *
 * For hver del av navnet lages to tolkninger:
 *   - tall tolket som bokstaver  ("f1tte" -> "fite")
 *   - tall bare fjernet          ("kuk123" -> "kuk")
 * Begge trengs: uten den første slipper "f1tte" gjennom, uten den
 * andre slipper "kuk123" gjennom.
 */
function buildCandidates(nickname) {
  const parts = nickname.split(/[^a-zA-ZæøåÆØÅ0-9]+/).filter(Boolean);
  const candidates = new Set();

  const add = (v) => {
    if (!v) return;
    candidates.add(v);
    // Uten omkransende x-er, så "XxKuKxX" også fanges
    const trimmed = v.replace(/^x+|x+$/g, "");
    if (trimmed) candidates.add(trimmed);
  };

  parts.forEach((part) => {
    add(collapseRepeats(leetToLetters(part)));
    add(collapseRepeats(lettersOnly(part)));
  });

  // Hele navnet sett under ett, så "f a e n" også fanges
  add(collapseRepeats(leetToLetters(nickname)));
  add(collapseRepeats(lettersOnly(nickname)));

  return [...candidates];
}

/**
 * Sjekker om kallenavnet inneholder et blokkert ord.
 */
export function containsBlockedWord(nickname) {
  const candidates = buildCandidates(nickname);

  // Korte ord: må utgjøre hele delen
  if (candidates.some((c) => NORMALIZED_EXACT.has(c))) return true;

  // Lange ord: kan ligge hvor som helst
  return candidates.some((c) =>
    NORMALIZED_SUBSTRINGS.some((word) => c.includes(word))
  );
}

/**
 * Full sjekk av et kallenavn.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateNickname(nickname) {
  const trimmed = nickname.trim();

  if (trimmed.length < 2) {
    return { ok: false, reason: "Kallenavnet må være minst 2 tegn." };
  }

  if (trimmed.length > 20) {
    return { ok: false, reason: "Kallenavnet kan være maks 20 tegn." };
  }

  if (!hasAllowedCharacters(trimmed)) {
    return {
      ok: false,
      reason: "Bruk bare bokstaver, tall, mellomrom, bindestrek eller understrek."
    };
  }

  if (containsBlockedWord(trimmed)) {
    return { ok: false, reason: "Velg et annet kallenavn." };
  }

  return { ok: true };
}
