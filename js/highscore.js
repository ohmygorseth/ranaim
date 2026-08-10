// ============================================================
// HIGHSCORE - Firestore-integrasjon
// ============================================================
// Datamodell (modeId skiller Gridshot/Tracking/fremtidige moduser
// fra hverandre, siden poengskalaene ikke er sammenlignbare):
//
//   groups/{groupId}/modes/{modeId}/weekly/{weekId}/entries/{nickname}
//     -> ukens highscore for én gruppe/modus, ett dokument per spiller
//
//   groups/{groupId}/modes/{modeId}/alltime/{nickname}
//     -> evig highscore for én gruppe/modus, ett dokument per spiller
//
//   globalAllTime/{modeId}/entries/{nickname__groupId}
//     -> evig highscore for én modus, på tvers av alle grupper
//
// Hver liste beholder kun spillerens BESTE score (overskrives
// bare hvis ny score er bedre). Sortering: score desc, timestamp asc
// (tidligst satt score vinner ved likt resultat).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { getCurrentWeekId } from "./weekId.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Lagrer en ny runde-score i alle relevante lister
 * (ukentlig-gruppe, evig-gruppe, evig-global), men kun hvis
 * scoren er bedre enn spillerens tidligere beste i hver liste.
 *
 * @param {object} params
 * @param {string} params.modeId - f.eks. "gridshot" eller "tracking"
 * @param {object} [params.extra] - modus-spesifikke ekstra felt (f.eks. hits/shots)
 * @returns {Promise<{weeklyImproved: boolean, allTimeImproved: boolean}>}
 */
export async function submitScore({ nickname, groupId, groupName, modeId, score, extra = {} }) {
  const weekId = getCurrentWeekId();
  const payload = {
    nickname,
    groupId,
    groupName,
    modeId,
    score,
    ...extra,
    timestamp: serverTimestamp()
  };

  const weeklyRef = doc(db, "groups", groupId, "modes", modeId, "weekly", weekId, "entries", nickname);
  const allTimeRef = doc(db, "groups", groupId, "modes", modeId, "alltime", nickname);
  const globalRef = doc(db, "globalAllTime", modeId, "entries", `${nickname}__${groupId}`);

  // Hent tidligere personlig rekord FØR vi skriver, slik at vi kan
  // fortelle spilleren om de nettopp slo sin egen rekord.
  const previousDoc = await getDoc(allTimeRef);
  const previousBest = previousDoc.exists() ? previousDoc.data().score : null;
  const isNewRecord = previousBest === null || score > previousBest;

  const weeklyImproved = await writeIfBetter(weeklyRef, payload);
  const allTimeImproved = await writeIfBetter(allTimeRef, payload);
  await writeIfBetter(globalRef, payload);

  return { weeklyImproved, allTimeImproved, previousBest, isNewRecord };
}

async function writeIfBetter(ref, payload) {
  const existing = await getDoc(ref);
  if (!existing.exists() || payload.score > existing.data().score) {
    await setDoc(ref, payload);
    return true;
  }
  return false;
}

/**
 * Henter topp N fra ukens gruppeliste for en gitt modus.
 */
export async function getWeeklyLeaderboard(groupId, modeId, max = 200) {
  const weekId = getCurrentWeekId();
  const ref = collection(db, "groups", groupId, "modes", modeId, "weekly", weekId, "entries");
  return fetchLeaderboard(ref, max);
}

/**
 * Henter topp N fra gruppens evige liste for en gitt modus.
 */
export async function getGroupAllTimeLeaderboard(groupId, modeId, max = 200) {
  const ref = collection(db, "groups", groupId, "modes", modeId, "alltime");
  return fetchLeaderboard(ref, max);
}

/**
 * Henter topp N fra den globale evige listen (alle grupper) for en gitt modus.
 */
export async function getGlobalAllTimeLeaderboard(modeId, max = 200) {
  const ref = collection(db, "globalAllTime", modeId, "entries");
  return fetchLeaderboard(ref, max);
}

async function fetchLeaderboard(ref, max) {
  const q = query(ref, orderBy("score", "desc"), orderBy("timestamp", "asc"), limit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
}

/**
 * Finner en spillers rangering i en gitt liste (brukes på
 * resultatskjermen: "Du er nå #X på ukens liste").
 */
export function findRank(leaderboard, nickname) {
  const entry = leaderboard.find((e) => e.nickname === nickname);
  return entry ? entry.rank : null;
}
