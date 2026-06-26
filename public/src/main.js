import { Match } from "./game/match.js";
import {
  loadSetup,
  restoreMatch,
  saveMatch,
  saveSetup,
} from "./game/persistence.js";
import { TableRenderer } from "./rendering/tableRenderer.js";
import { DomUi } from "./ui/domUi.js";
import { FeedbackController } from "./ui/feedback.js";

const match = new Match();
const canvas = document.querySelector("#tableCanvas");
const renderer = new TableRenderer(canvas);
const ui = new DomUi(match);
const feedback = new FeedbackController();
let botTimer = null;
let hiddenAt = null;
let tutorialOpenedAt = null;
let announcedResultKey = null;
const BOT_TURN_DELAY_MS = 1080;

registerServiceWorker();
ui.applySetup(loadSetup() ?? undefined);
ui.applyFeedbackPreference(feedback.isEnabled());

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
    announcedResultKey = null;
    feedback.play("start");
    saveSetup({ playerCount, playerName });
    persistMatch();
    ui.startTutorialIfNeeded();
    scheduleAutomation();
  },
  setupChanged(setup) {
    saveSetup(setup);
  },
  drawStock() {
    match.drawFromStock();
    feedback.play("draw");
    persistMatch();
    focusTableForAction();
  },
  drawDiscard() {
    match.drawFromDiscard();
    feedback.play("draw");
    persistMatch();
    focusTableForAction();
  },
  requestStop() {
    match.requestStop();
    feedback.play("stop");
    persistMatch();
  },
  discardDrawn() {
    match.discardDrawn();
    feedback.play("discard");
    persistMatch();
    scheduleAutomation();
  },
  swap(slotIndex) {
    match.swapHuman(slotIndex);
    feedback.play("swap");
    persistMatch();
    scheduleAutomation();
  },
  nextRound() {
    clearBotTimer();
    if (match.phase === "matchOver") {
      const humanName = match.players.find((player) => player.isHuman)?.name ?? "Voce";
      const playerCount = match.players.length || 4;
      match.reset();
      ui.applySetup({ playerName: humanName, playerCount });
      ui.showMatchSetup();
    } else {
      match.startRound();
      feedback.play("start");
    }
    announcedResultKey = null;
    persistMatch();
    scheduleAutomation();
  },
  menuOpened() {
    clearBotTimer();
  },
  menuClosed() {
    scheduleAutomation();
  },
  tutorialOpened() {
    tutorialOpenedAt = performance.now();
    clearBotTimer();
  },
  tutorialClosed() {
    if (tutorialOpenedAt !== null && match.phase === "preview") {
      match.previewEndsAt += performance.now() - tutorialOpenedAt;
    }
    tutorialOpenedAt = null;
    persistMatch();
    scheduleAutomation();
  },
  feedbackChanged(enabled) {
    feedback.setEnabled(enabled);
  },
  resetMatch() {
    if (!window.confirm("Apagar esta partida e voltar para a tela inicial?")) return;
    clearBotTimer();
    match.reset();
    announcedResultKey = null;
    persistMatch();
    ui.closeMenu();
    ui.showMatchSetup();
  },
});

canvas.addEventListener("click", (event) => {
  const hit = renderer.getHitRegion(event.clientX, event.clientY);
  if (!hit?.enabled) return;
  if (hit.type === "stock") {
    match.drawFromStock();
    feedback.play("draw");
    persistMatch();
    return;
  }
  if (hit.type === "discard") {
    match.drawFromDiscard();
    feedback.play("draw");
    persistMatch();
    return;
  }
  if (hit.type === "hand-slot") {
    match.swapHuman(hit.slotIndex);
    feedback.play("swap");
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
  if (
    match.phase === "preview" &&
    !ui.isTutorialOpen() &&
    now >= match.previewEndsAt
  ) {
    match.completePreview();
    persistMatch();
    scheduleAutomation();
  }
  const state = match.snapshot(now);
  renderer.render(state, now);
  ui.update(state);
  announceRoundResult(state);
  requestAnimationFrame(loop);
}

function announceRoundResult(state) {
  if (!state.roundResult || !ui.isRoundOverlayVisible()) return;
  const resultKey = `${state.roundNumber}:${state.phase}`;
  if (announcedResultKey === resultKey) return;
  announcedResultKey = resultKey;
  const human = state.players.find((player) => player.isHuman);
  if (state.phase === "matchOver") {
    feedback.play(state.winner?.isHuman ? "win" : "bad");
    return;
  }
  feedback.play((human?.lastDelta ?? 0) === 0 ? "good" : "bad");
}

function scheduleAutomation() {
  clearBotTimer();
  if (
    match.phase !== "botTurn" ||
    document.hidden ||
    ui.isMenuOpen() ||
    ui.isTutorialOpen()
  ) return;
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
  ui.startTutorialIfNeeded();
  scheduleAutomation();
}

requestAnimationFrame(loop);

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
