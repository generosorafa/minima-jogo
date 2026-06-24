import { Match } from "./game/match.js";
import {
  loadSetup,
  restoreMatch,
  saveMatch,
  saveSetup,
} from "./game/persistence.js";
import { TableRenderer } from "./rendering/tableRenderer.js";
import { DomUi } from "./ui/domUi.js";

const match = new Match();
const canvas = document.querySelector("#tableCanvas");
const renderer = new TableRenderer(canvas);
const ui = new DomUi(match);
let botTimer = null;
let hiddenAt = null;
const BOT_TURN_DELAY_MS = 1080;

ui.applySetup(loadSetup() ?? undefined);

ui.bind({
  startMatch(playerCount, playerName) {
    if (
      match.phase !== "idle" &&
      match.phase !== "matchOver" &&
      !window.confirm("Comecar uma nova partida e apagar o progresso atual?")
    ) {
      return;
    }
    clearBotTimer();
    match.startMatch(playerCount, playerName);
    saveSetup({ playerCount, playerName });
    persistMatch();
    scheduleAutomation();
  },
  setupChanged(setup) {
    saveSetup(setup);
  },
  drawStock() {
    match.drawFromStock();
    persistMatch();
    focusTableForAction();
  },
  drawDiscard() {
    match.drawFromDiscard();
    persistMatch();
    focusTableForAction();
  },
  requestStop() {
    match.requestStop();
    persistMatch();
  },
  discardDrawn() {
    match.discardDrawn();
    persistMatch();
    scheduleAutomation();
  },
  swap(slotIndex) {
    match.swapHuman(slotIndex);
    persistMatch();
    scheduleAutomation();
  },
  nextRound() {
    clearBotTimer();
    if (match.phase === "matchOver") {
      const humanName = match.players.find((player) => player.isHuman)?.name ?? "Voce";
      const playerCount = match.players.length || 4;
      match.startMatch(playerCount, humanName);
    } else {
      match.startRound();
    }
    persistMatch();
    scheduleAutomation();
  },
  menuOpened() {
    clearBotTimer();
  },
  menuClosed() {
    scheduleAutomation();
  },
  resetMatch() {
    if (!window.confirm("Apagar esta partida e voltar para a tela inicial?")) return;
    clearBotTimer();
    match.reset();
    persistMatch();
    ui.closeMenu();
  },
});

canvas.addEventListener("click", (event) => {
  const hit = renderer.getHitRegion(event.clientX, event.clientY);
  if (!hit?.enabled) return;
  if (hit.type === "stock") {
    match.drawFromStock();
    persistMatch();
    return;
  }
  if (hit.type === "discard") {
    match.drawFromDiscard();
    persistMatch();
    return;
  }
  if (hit.type === "hand-slot") {
    match.swapHuman(hit.slotIndex);
    persistMatch();
    scheduleAutomation();
  }
});

canvas.addEventListener("mousemove", (event) => {
  const hit = renderer.getHitRegion(event.clientX, event.clientY);
  canvas.style.cursor = hit?.enabled ? "pointer" : "default";
});

canvas.addEventListener("mouseleave", () => {
  canvas.style.cursor = "default";
});

function loop(now) {
  if (match.phase === "preview" && now >= match.previewEndsAt) {
    match.completePreview();
    persistMatch();
    scheduleAutomation();
  }
  const state = match.snapshot(now);
  renderer.render(state, now);
  ui.update(state);
  requestAnimationFrame(loop);
}

function scheduleAutomation() {
  clearBotTimer();
  if (match.phase !== "botTurn" || document.hidden || ui.isMenuOpen()) return;
  botTimer = window.setTimeout(() => {
    match.runBotTurn();
    persistMatch();
    scheduleAutomation();
  }, BOT_TURN_DELAY_MS);
}

function focusTableForAction() {
  if (match.phase === "humanAction" && window.innerWidth <= 980) {
    canvas.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function clearBotTimer() {
  if (botTimer) {
    window.clearTimeout(botTimer);
    botTimer = null;
  }
}

function persistMatch() {
  saveMatch(match);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    clearBotTimer();
    persistMatch();
    return;
  }

  if (hiddenAt !== null && match.phase === "preview") {
    match.previewEndsAt += performance.now() - hiddenAt;
  }
  hiddenAt = null;
  persistMatch();
  scheduleAutomation();
});

window.addEventListener("pagehide", persistMatch);

if (restoreMatch(match)) {
  const human = match.players.find((player) => player.isHuman);
  ui.applySetup({
    playerName: human?.name ?? "Voce",
    playerCount: match.players.length || 4,
  });
  saveSetup(ui.getSetup());
  persistMatch();
  ui.showResumeNotice();
  scheduleAutomation();
}

requestAnimationFrame(loop);
