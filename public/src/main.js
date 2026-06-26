import { Match } from "./game/match.js";
import {
  clearSavedMatch,
  hasSavedMatch,
  loadSavedMatchSummary,
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
let savedMatchAvailable = false;
const BOT_TURN_DELAY_MS = 1080;

registerServiceWorker();
ui.applySetup(loadSetup() ?? undefined);
ui.applyFeedbackPreference(feedback.isEnabled());
refreshSavedMatchPrompt();

ui.bind({
  async startMatch(playerCount, playerName) {
    if (
      match.phase !== "idle" &&
      match.phase !== "matchOver" &&
      !(await ui.confirmAction({
        kicker: "Nova partida",
        title: "Apagar a partida atual?",
        text: "O progresso desta partida será perdido e uma nova mesa será criada.",
        acceptLabel: "Apagar e começar",
        danger: true,
      }))
    ) {
      return;
    }
    clearBotTimer();
    if (
      savedMatchAvailable &&
      match.phase === "idle" &&
      !(await ui.confirmAction({
        kicker: "Partida salva",
        title: "Começar uma nova partida?",
        text: "Existe uma partida salva neste aparelho. Começar outra apaga esse progresso.",
        acceptLabel: "Nova partida",
        danger: true,
      }))
    ) {
      return;
    }
    clearSavedMatch();
    savedMatchAvailable = false;
    ui.hideSavedMatch();
    match.startMatch(playerCount, playerName);
    announcedResultKey = null;
    feedback.play("start");
    saveSetup({ playerCount, playerName });
    persistMatch();
    ui.startTutorialIfNeeded();
    scheduleAutomation();
  },
  continueSavedMatch() {
    clearBotTimer();
    if (!hasSavedMatch()) {
      savedMatchAvailable = false;
      ui.hideSavedMatch();
      return;
    }
    if (!restoreMatch(match)) {
      savedMatchAvailable = false;
      ui.hideSavedMatch();
      return;
    }
    savedMatchAvailable = false;
    ui.hideSavedMatch();
    const human = match.players.find((player) => player.isHuman);
    ui.applySetup({
      playerName: human?.name ?? "Você",
      playerCount: match.players.length || 4,
    });
    saveSetup(ui.getSetup());
    announcedResultKey = null;
    persistMatch();
    ui.showResumeNotice();
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
      const humanName = match.players.find((player) => player.isHuman)?.name ?? "Você";
      const playerCount = match.players.length || 4;
      match.reset();
      clearSavedMatch();
      savedMatchAvailable = false;
      ui.applySetup({ playerName: humanName, playerCount });
      ui.hideSavedMatch();
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
  modalOpened() {
    clearBotTimer();
  },
  modalClosed() {
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
  async resetMatch() {
    if (
      !(await ui.confirmAction({
        kicker: "Nova partida",
        title: "Voltar para a tela inicial?",
        text: "A partida atual será apagada deste aparelho.",
        acceptLabel: "Apagar partida",
        danger: true,
      }))
    ) {
      return;
    }
    clearBotTimer();
    match.reset();
    clearSavedMatch();
    savedMatchAvailable = false;
    announcedResultKey = null;
    persistMatch();
    ui.closeMenu();
    ui.hideSavedMatch();
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
    ui.isTutorialOpen() ||
    ui.isRulesOpen() ||
    ui.isConfirmOpen()
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
  if (match.phase === "idle" && savedMatchAvailable) return true;
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

requestAnimationFrame(loop);

function refreshSavedMatchPrompt() {
  savedMatchAvailable = hasSavedMatch();
  ui.showSavedMatch(savedMatchAvailable ? loadSavedMatchSummary() : null);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
