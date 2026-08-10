// ============================================================
// APP.JS - Hovedkontroller
// ============================================================
// Styrer hvilken "skjerm" som vises (gruppevalg, passord,
// nickname, hub, spill, resultat) og highscore-sidepanelet.
// ============================================================

import { GROUPS } from "./groups.js";
import { gridshot } from "./modes/gridshot.js";
import { tracking } from "./modes/tracking.js";
import { wasdMode } from "./modes/wasd.js";
import { keyboardMouseMode } from "./modes/keyboardmouse.js";
import { trackMode } from "./modes/track.js";
import { reflex } from "./modes/reflex.js";
import {
  submitScore,
  getWeeklyLeaderboard,
  getGroupAllTimeLeaderboard,
  getGlobalAllTimeLeaderboard,
  findRank
} from "./highscore.js";

// ------------------------------------------------------------
// Moduler tilgjengelig i hub-en. Legg til nye her når de er klare
// (sett comingSoon: false når modulen er ferdig implementert).
// ------------------------------------------------------------
const MODES = [gridshot, reflex, tracking, trackMode, wasdMode, keyboardMouseMode];

const PLAYABLE_MODES = MODES.filter((m) => !m.comingSoon);

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let state = {
  group: null,
  nickname: null,
  activeMode: null,
  activeTab: "weekly", // weekly | group | global
  leaderboardModeId: PLAYABLE_MODES[0].id // hvilken modus sitt highscore som vises
};

// ------------------------------------------------------------
// DOM-referanser
// ------------------------------------------------------------
const sidebarModeSelect = document.getElementById("sidebar-lb-mode-select");

const screens = {
  groupSelect: document.getElementById("screen-group-select"),
  password: document.getElementById("screen-password"),
  nickname: document.getElementById("screen-nickname"),
  hub: document.getElementById("screen-hub"),
  game: document.getElementById("screen-game"),
  result: document.getElementById("screen-result")
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ------------------------------------------------------------
// 1. Gruppevalg
// ------------------------------------------------------------
function renderGroupSelect() {
  const container = document.getElementById("group-list");
  container.innerHTML = "";
  GROUPS.forEach((group) => {
    const btn = document.createElement("button");
    btn.className = "group-btn";
    btn.textContent = group.name;
    btn.addEventListener("click", () => {
      state.group = group;

      if (!REQUIRE_GROUP_PASSWORD) {
        goToNicknameScreen();
        return;
      }

      showScreen("password");
      document.getElementById("password-error").classList.add("hidden");
      document.getElementById("password-input").value = "";
      document.getElementById("password-group-name").textContent = group.name;
      document.getElementById("password-input").focus();
    });
    container.appendChild(btn);
  });
}

function goToNicknameScreen() {
  showScreen("nickname");
  document.getElementById("nickname-group-name").textContent = state.group.name;
  document.getElementById("nickname-input").value = "";
  document.getElementById("nickname-input").focus();
}

document.getElementById("nickname-back-btn").addEventListener("click", () => {
  state.group = null;
  showScreen("groupSelect");
});

document.getElementById("password-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("password-input").value;
  if (input === state.group.password) {
    goToNicknameScreen();
  } else {
    document.getElementById("password-error").classList.remove("hidden");
  }
});

document.getElementById("back-to-groups").addEventListener("click", () => {
  showScreen("groupSelect");
});

// ------------------------------------------------------------
// 2. Nickname
// ------------------------------------------------------------
document.getElementById("nickname-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = document.getElementById("nickname-input").value.trim();
  if (val.length < 2) return;
  state.nickname = val;
  enterHub();
});

// ------------------------------------------------------------
// 3. Hub (modusvalg)
// ------------------------------------------------------------
// ------------------------------------------------------------
// Sett til true for å kreve gruppepassord igjen.
// Passordene ligger fortsatt i js/groups.js og brukes automatisk.
// ------------------------------------------------------------
const REQUIRE_GROUP_PASSWORD = false;

const MODE_ICONS = {
  gridshot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
  tracking: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 16c4-9 8-9 12 0s6 4 8-2" stroke-linecap="round"/><circle cx="17" cy="9" r="3"/></svg>`,
  reflex: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6z" stroke-linejoin="round"/></svg>`,
  track: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 20c-2.2 0-4-1.6-4-3.6s1.8-3.6 4-3.6h9c1.7 0 3-1.1 3-2.6S16.7 7.6 15 7.6H8" stroke-linecap="round"/><circle cx="6" cy="7.6" r="2.2"/></svg>`,
  keyboardmouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="13" height="11" rx="2"/><path d="M5 11h.01M8 11h.01M11 11h.01M5 14.5h5" stroke-linecap="round"/><rect x="17.5" y="5" width="5" height="9" rx="2.5"/><path d="M20 5v3" stroke-linecap="round"/></svg>`,
  wasd: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="2" y="10" width="6" height="6" rx="1"/><rect x="9" y="10" width="6" height="6" rx="1"/><rect x="16" y="10" width="6" height="6" rx="1"/></svg>`
};

function renderHub() {
  document.getElementById("hub-group-name").textContent = state.group.name;
  document.getElementById("hub-nickname").textContent = state.nickname;

  const container = document.getElementById("mode-list");
  container.innerHTML = "";
  MODES.forEach((mode) => {
    const card = document.createElement("button");
    card.className = "mode-card" + (mode.comingSoon ? " mode-card-disabled" : "");
    card.innerHTML = `
      <div class="mode-card-icon">${MODE_ICONS[mode.id] || ""}</div>
      <div class="mode-card-title">${mode.displayName}</div>
      <div class="mode-card-sub">${mode.comingSoon ? "Kommer snart" : MODE_DESCRIPTIONS[mode.id] || ""}</div>
    `;
    if (!mode.comingSoon) {
      card.addEventListener("click", () => startCountdown(mode));
    }
    container.appendChild(card);
  });
}

const MODE_DESCRIPTIONS = {
  gridshot: "Treff flest mulig mål",
  tracking: "Følg målet med siktet",
  reflex: "Rask reaksjon under tidspress",
  track: "Følg banen uten å bomme",
  keyboardmouse: "Veksle mellom tast og museknapp",
  wasd: "Lær riktig håndgrep"
};

function enterHub() {
  showScreen("hub");
  renderHub();
  renderSidebarLeaderboard();
}

document.getElementById("change-group-btn").addEventListener("click", () => {
  state.group = null;
  state.nickname = null;
  showScreen("groupSelect");
});

// ------------------------------------------------------------
// 4. Nedtelling + spill
// ------------------------------------------------------------
function startCountdown(mode) {
  state.activeMode = mode;
  showScreen("game");
  const overlay = document.getElementById("countdown-overlay");
  const canvas = document.getElementById("game-canvas");
  canvas.classList.add("hidden");
  overlay.classList.remove("hidden");

  let count = 3;
  const numberEl = document.getElementById("countdown-number");
  numberEl.textContent = count;
  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      numberEl.textContent = count;
    } else {
      clearInterval(interval);
      overlay.classList.add("hidden");
      canvas.classList.remove("hidden");
      launchMode(mode);
    }
  }, 1000);
}

function launchMode(mode) {
  const canvas = document.getElementById("game-canvas");
  // Sett canvasets interne oppløsning til å matche faktisk visningsstørrelse,
  // slik at spillflaten fyller skjermen uansett skjermstørrelse/oppløsning
  // (i stedet for en fast piksel-størrelse med luft rundt).
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  // Noen moduser sikter ikke med musa, og trenger synlig musepeker
  canvas.classList.toggle("show-cursor", mode.showCursor === true);
  const ctx = canvas.getContext("2d");
  mode.start(canvas, ctx, (result) => {
    // Kort pause slik at et klikk/tastetrykk fra slutten av runden ikke
    // treffer knappene som dukker opp på resultatskjermen.
    setTimeout(() => onRoundComplete(mode, result), 400);
  });
}

async function onRoundComplete(mode, result) {
  const { score, stats = [] } = result;

  showScreen("result");
  lockResultButtons();
  document.getElementById("result-score").textContent = score;
  renderResultStats(stats);
  document.getElementById("result-context").textContent = "Lagrer resultat...";
  document.getElementById("result-banner").className = "result-banner hidden";
  document.getElementById("result-personal-best").textContent = "";

  const extra = {};
  stats.forEach((s) => {
    if (typeof s.value === "number") {
      extra[slugify(s.label)] = s.value;
    }
  });

  try {
    const { previousBest, isNewRecord } = await submitScore({
      nickname: state.nickname,
      groupId: state.group.id,
      groupName: state.group.name,
      modeId: mode.id,
      score,
      extra
    });

    showRecordBanner(isNewRecord, previousBest, score);

    state.leaderboardModeId = mode.id;
    sidebarModeSelect.value = mode.id;
    state.activeTab = "weekly";
    syncSidebarTabButtons();

    const weekly = await getWeeklyLeaderboard(state.group.id, mode.id, 200);
    const rank = findRank(weekly, state.nickname);
    document.getElementById("result-context").textContent = rank
      ? `Du er nå #${rank} på treningens ${mode.displayName}-liste for ${state.group.name}`
      : "Resultatet er lagret.";

    renderSidebarLeaderboard();
  } catch (err) {
    console.error(err);
    document.getElementById("result-context").textContent =
      "Klarte ikke å lagre resultatet. Sjekk internettforbindelsen.";
  }
}

function lockResultButtons() {
  // Hindrer at et klikk fra siste sekund av spillet "faller gjennom"
  // og trykker på en knapp som nettopp dukket opp.
  const buttons = [
    document.getElementById("play-again-btn"),
    document.getElementById("back-to-hub-btn")
  ];
  buttons.forEach((b) => {
    b.disabled = true;
    b.classList.add("btn-locked");
  });
  setTimeout(() => {
    buttons.forEach((b) => {
      b.disabled = false;
      b.classList.remove("btn-locked");
    });
  }, 1000);
}

function showRecordBanner(isNewRecord, previousBest, score) {
  const banner = document.getElementById("result-banner");
  const pbText = document.getElementById("result-personal-best");

  if (previousBest === null) {
    banner.className = "result-banner result-banner-first";
    banner.textContent = "Første resultat lagret!";
    pbText.textContent = "Dette blir din personlige rekord å slå neste gang.";
  } else if (isNewRecord) {
    banner.className = "result-banner result-banner-record";
    banner.textContent = "NY PERSONLIG REKORD!";
    pbText.textContent = `Forrige beste: ${previousBest} — du forbedret deg med ${score - previousBest} poeng`;
  } else {
    banner.className = "result-banner result-banner-normal";
    banner.textContent = `${previousBest - score} poeng unna din rekord`;
    pbText.textContent = `Din beste: ${previousBest}`;
  }
}

function renderResultStats(stats) {
  const container = document.getElementById("result-extra-stats");
  container.innerHTML = "";
  stats.forEach((s) => {
    const block = document.createElement("div");
    block.className = "stat-block";
    block.innerHTML = `
      <span class="stat-value">${s.value}</span>
      <span class="stat-label">${escapeHtml(s.label)}</span>
    `;
    container.appendChild(block);
  });
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_");
}

document.getElementById("play-again-btn").addEventListener("click", () => {
  if (state.activeMode) {
    startCountdown(state.activeMode);
  } else {
    enterHub();
  }
});

document.getElementById("back-to-hub-btn").addEventListener("click", () => {
  enterHub();
});

// ------------------------------------------------------------
// 5. Highscore - sidepanel (modusvalg + faner + topp 200 med scroll)
// ------------------------------------------------------------
function setupTabs(tabContainerId, onChange) {
  const container = document.getElementById(tabContainerId);
  container.querySelectorAll(".lb-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      container.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      onChange(tabBtn.dataset.tab);
    });
  });
}

function populateModeSelect(selectEl) {
  selectEl.innerHTML = "";
  PLAYABLE_MODES.forEach((mode) => {
    const opt = document.createElement("option");
    opt.value = mode.id;
    opt.textContent = mode.displayName;
    selectEl.appendChild(opt);
  });
  selectEl.value = state.leaderboardModeId;
}

async function fetchLeaderboardForTab(tab, modeId) {
  if (!state.group) return [];
  if (tab === "weekly") return getWeeklyLeaderboard(state.group.id, modeId, 200);
  if (tab === "group") return getGroupAllTimeLeaderboard(state.group.id, modeId, 200);
  return getGlobalAllTimeLeaderboard(modeId, 200);
}

function renderLeaderboardRows(listEl, entries, showGroup) {
  listEl.innerHTML = "";
  if (entries.length === 0) {
    listEl.innerHTML = `<div class="lb-empty">Ingen scorer ennå</div>`;
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `
      <span class="lb-rank">${entry.rank}</span>
      <span class="lb-name">${escapeHtml(entry.nickname)}${
      showGroup ? `<span class="lb-group-tag">${escapeHtml(entry.groupName || "")}</span>` : ""
    }</span>
      <span class="lb-score">${entry.score}</span>
    `;
    listEl.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function syncSidebarTabButtons() {
  const container = document.getElementById("sidebar-lb-tabs");
  container.querySelectorAll(".lb-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === state.activeTab);
  });
}

async function renderSidebarLeaderboard() {
  const listEl = document.getElementById("sidebar-lb-list");
  listEl.innerHTML = `<div class="lb-loading">Laster...</div>`;
  const entries = await fetchLeaderboardForTab(state.activeTab, state.leaderboardModeId);
  renderLeaderboardRows(listEl, entries, state.activeTab === "global");
}

setupTabs("sidebar-lb-tabs", (tab) => {
  state.activeTab = tab;
  renderSidebarLeaderboard();
});

populateModeSelect(sidebarModeSelect);
sidebarModeSelect.addEventListener("change", () => {
  state.leaderboardModeId = sidebarModeSelect.value;
  renderSidebarLeaderboard();
});

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
renderGroupSelect();
showScreen("groupSelect");
