// ============================================================
// APP.JS - Hovedkontroller
// ============================================================
// Styrer hvilken "skjerm" som vises (gruppevalg, passord,
// nickname, hub, spill, resultat) og highscore-sidepanelet.
// ============================================================

import { GROUPS, getGroupById } from "./groups.js";
import { gridshot, calculateScore } from "./modes/gridshot.js";
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
const MODES = [
  gridshot,
  { id: "tracking", displayName: "Tracking", comingSoon: true },
  { id: "reflex", displayName: "Reflex", comingSoon: true }
];

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let state = {
  group: null,
  nickname: null,
  activeMode: null,
  activeTab: "weekly" // weekly | group | global
};

// ------------------------------------------------------------
// DOM-referanser
// ------------------------------------------------------------
const screens = {
  groupSelect: document.getElementById("screen-group-select"),
  password: document.getElementById("screen-password"),
  nickname: document.getElementById("screen-nickname"),
  hub: document.getElementById("screen-hub"),
  game: document.getElementById("screen-game"),
  result: document.getElementById("screen-result"),
  fullLeaderboard: document.getElementById("screen-full-leaderboard")
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
      showScreen("password");
      document.getElementById("password-error").classList.add("hidden");
      document.getElementById("password-input").value = "";
      document.getElementById("password-group-name").textContent = group.name;
      document.getElementById("password-input").focus();
    });
    container.appendChild(btn);
  });
}

document.getElementById("password-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("password-input").value;
  if (input === state.group.password) {
    showScreen("nickname");
    document.getElementById("nickname-input").value = "";
    document.getElementById("nickname-input").focus();
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
function renderHub() {
  document.getElementById("hub-group-name").textContent = state.group.name;
  document.getElementById("hub-nickname").textContent = state.nickname;

  const container = document.getElementById("mode-list");
  container.innerHTML = "";
  MODES.forEach((mode) => {
    const card = document.createElement("button");
    card.className = "mode-card" + (mode.comingSoon ? " mode-card-disabled" : "");
    card.innerHTML = `
      <div class="mode-card-title">${mode.displayName}</div>
      <div class="mode-card-sub">${mode.comingSoon ? "Kommer snart" : "Klar til å spille"}</div>
    `;
    if (!mode.comingSoon) {
      card.addEventListener("click", () => startCountdown(mode));
    }
    container.appendChild(card);
  });
}

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
  overlay.textContent = count;
  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      overlay.textContent = count;
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
  const ctx = canvas.getContext("2d");
  mode.start(canvas, ctx, (result) => onRoundComplete(mode, result));
}

async function onRoundComplete(mode, result) {
  const { score, hits, shots } = result;

  showScreen("result");
  document.getElementById("result-score").textContent = score;
  document.getElementById("result-hits").textContent = hits;
  document.getElementById("result-shots").textContent = shots;
  document.getElementById("result-context").textContent = "Lagrer resultat...";

  try {
    await submitScore({
      nickname: state.nickname,
      groupId: state.group.id,
      groupName: state.group.name,
      score,
      hits,
      shots
    });

    const weekly = await getWeeklyLeaderboard(state.group.id, 200);
    const rank = findRank(weekly, state.nickname);
    document.getElementById("result-context").textContent = rank
      ? `Du er nå #${rank} på ukens liste for ${state.group.name}!`
      : "Resultatet er lagret.";

    renderSidebarLeaderboard();
  } catch (err) {
    console.error(err);
    document.getElementById("result-context").textContent =
      "Klarte ikke å lagre resultatet. Sjekk internettforbindelsen.";
  }
}

document.getElementById("play-again-btn").addEventListener("click", () => {
  enterHub();
});

document.getElementById("back-to-hub-btn").addEventListener("click", () => {
  enterHub();
});

// ------------------------------------------------------------
// 5. Highscore - sidepanel (faner + topp 200 med scroll)
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

async function fetchLeaderboardForTab(tab) {
  if (!state.group) return [];
  if (tab === "weekly") return getWeeklyLeaderboard(state.group.id, 200);
  if (tab === "group") return getGroupAllTimeLeaderboard(state.group.id, 200);
  return getGlobalAllTimeLeaderboard(200);
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
      showGroup ? ` <span class="lb-group-tag">(${escapeHtml(entry.groupName || "")})</span>` : ""
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

async function renderSidebarLeaderboard() {
  const listEl = document.getElementById("sidebar-lb-list");
  listEl.innerHTML = `<div class="lb-loading">Laster...</div>`;
  const entries = await fetchLeaderboardForTab(state.activeTab);
  renderLeaderboardRows(listEl, entries, state.activeTab === "global");
}

setupTabs("sidebar-lb-tabs", (tab) => {
  state.activeTab = tab;
  renderSidebarLeaderboard();
});

// ------------------------------------------------------------
// 6. Full highscore-side
// ------------------------------------------------------------
let fullBoardTab = "weekly";

document.getElementById("open-full-leaderboard-btn").addEventListener("click", () => {
  showScreen("fullLeaderboard");
  fullBoardTab = state.activeTab;
  syncFullBoardTabButtons();
  renderFullLeaderboard();
});

document.getElementById("close-full-leaderboard-btn").addEventListener("click", () => {
  showScreen("hub");
});

setupTabs("full-lb-tabs", (tab) => {
  fullBoardTab = tab;
  renderFullLeaderboard();
});

function syncFullBoardTabButtons() {
  const container = document.getElementById("full-lb-tabs");
  container.querySelectorAll(".lb-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === fullBoardTab);
  });
}

async function renderFullLeaderboard() {
  const listEl = document.getElementById("full-lb-list");
  listEl.innerHTML = `<div class="lb-loading">Laster...</div>`;
  const entries = await fetchLeaderboardForTab(fullBoardTab);
  renderLeaderboardRows(listEl, entries, fullBoardTab === "global");
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
renderGroupSelect();
showScreen("groupSelect");
