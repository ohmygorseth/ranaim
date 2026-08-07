// ============================================================
// HIGHSCORE - Firestore-integrasjon
// ============================================================
// Datamodell:
//
//   groups/{groupId}/weekly/{weekId}/entries/{nickname}
//     -> ukens highscore for én gruppe, ett dokument per spiller
//
//   groups/{groupId}/alltime/entries/{nickname}
//     -> evig highscore for én gruppe, ett dokument per spiller
//
//   global/alltime/entries/{nickname__groupId}
//     -> evig highscore på tvers av alle grupper
//
// Hver liste beholder kun spillerens BESTE score (overskrives
// bare hvis ny score er bedre). Sortering: score desc, hits desc,
// timestamp asc (tidligst satt score vinner ved likt resultat).
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
 * @returns {Promise<{weeklyImproved: boolean, allTimeImproved: boolean}>}
 */
export async function submitScore({ nickname, groupId, groupName, score, hits, shots }) {
  const weekId = getCurrentWeekId();
  const payload = {
    nickname,
    groupId,
    groupName,
    score,
    hits,
    shots,
    timestamp: serverTimestamp()
  };

  const weeklyRef = doc(db, "groups", groupId, "weekly", weekId, "entries", nickname);
  const allTimeRef = doc(db, "groups", groupId, "alltime", "entries", nickname);
  const globalRef = doc(db, "global", "alltime", "entries", `${nickname}__${groupId}`);

  const weeklyImproved = await writeIfBetter(weeklyRef, payload);
  const allTimeImproved = await writeIfBetter(allTimeRef, payload);
  await writeIfBetter(globalRef, payload);

  return { weeklyImproved, allTimeImproved };
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
 * Henter topp N fra ukens gruppeliste.
 */
export async function getWeeklyLeaderboard(groupId, max = 200) {
  const weekId = getCurrentWeekId();
  const ref = collection(db, "groups", groupId, "weekly", weekId, "entries");
  return fetchLeaderboard(ref, max);
}

/**
 * Henter topp N fra gruppens evige liste.
 */
export async function getGroupAllTimeLeaderboard(groupId, max = 200) {
  const ref = collection(db, "groups", groupId, "alltime", "entries");
  return fetchLeaderboard(ref, max);
}

/**
 * Henter topp N fra den globale evige listen (alle grupper).
 */
export async function getGlobalAllTimeLeaderboard(max = 200) {
  const ref = collection(db, "global", "alltime", "entries");
  return fetchLeaderboard(ref, max);
}

async function fetchLeaderboard(ref, max) {
  const q = query(
    ref,
    orderBy("score", "desc"),
    orderBy("hits", "desc"),
    orderBy("timestamp", "asc"),
    limit(max)
  );
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
