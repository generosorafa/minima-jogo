import { formatCard, cardValue, shortCard } from "../core/rules.js";
import { APP_VERSION } from "../config/constants.js";
import {
  hasSeenTutorial,
  markTutorialSeen,
  TUTORIAL_STEPS,
} from "./tutorial.js";

const ROUND_OVERLAY_DELAY_MS = 760;
const ROUND_REVEAL_DELAY_MS = 3200;
const STOP_CONFIRMATION_MS = 3200;

export class DomUi {
  constructor(match) {
    this.match = match;
    this.refs = {
      playerName: document.querySelector("#playerName"),
      playerCount: document.querySelector("#playerCount"),
      startMatchButton: document.querySelector("#startMatchButton"),
      startOverlay: document.querySelector(".start-overlay"),
      tablePlayerName: document.querySelector("#tablePlayerName"),
      tablePlayerCount: document.querySelector("#tablePlayerCount"),
      tableStartMatchButton: document.querySelector("#tableStartMatchButton"),
      savedMatchPanel: document.querySelector("#savedMatchPanel"),
      savedMatchTitle: document.querySelector("#savedMatchTitle"),
      savedMatchMeta: document.querySelector("#savedMatchMeta"),
      continueSavedMatchButton: document.querySelector("#continueSavedMatchButton"),
      startRulesButton: document.querySelector("#startRulesButton"),
      mobileMenuButton: document.querySelector("#mobileMenuButton"),
      betaMenu: document.querySelector("#betaMenu"),
      betaMenuBackdrop: document.querySelector("#betaMenuBackdrop"),
      continueMatchButton: document.querySelector("#continueMatchButton"),
      menuRulesButton: document.querySelector("#menuRulesButton"),
      tutorialButton: document.querySelector("#tutorialButton"),
      feedbackToggle: document.querySelector("#feedbackToggle"),
      resetMatchButton: document.querySelector("#resetMatchButton"),
      rulesOverlay: document.querySelector("#rulesOverlay"),
      closeRulesButton: document.querySelector("#closeRulesButton"),
      confirmOverlay: document.querySelector("#confirmOverlay"),
      confirmKicker: document.querySelector("#confirmKicker"),
      confirmTitle: document.querySelector("#confirmTitle"),
      confirmText: document.querySelector("#confirmText"),
      confirmCancelButton: document.querySelector("#confirmCancelButton"),
      confirmAcceptButton: document.querySelector("#confirmAcceptButton"),
      tutorialOverlay: document.querySelector("#tutorialOverlay"),
      tutorialCard: document.querySelector(".tutorial-card"),
      tutorialKicker: document.querySelector("#tutorialKicker"),
      tutorialTitle: document.querySelector("#tutorialTitle"),
      tutorialText: document.querySelector("#tutorialText"),
      tutorialSkipButton: document.querySelector("#tutorialSkipButton"),
      tutorialNextButton: document.querySelector("#tutorialNextButton"),
      resumeNotice: document.querySelector("#resumeNotice"),
      phaseBadge: document.querySelector("#phaseBadge"),
      statusLine: document.querySelector("#statusLine"),
      tableRound: document.querySelector("#tableRound"),
      tablePlayers: document.querySelector("#tablePlayers"),
      tablePhaseText: document.querySelector("#tablePhaseText"),
      tableStatusText: document.querySelector("#tableStatusText"),
      drawnCard: document.querySelector("#drawnCard"),
      drawnPanel: document.querySelector(".drawn-panel"),
      drawnTitle: document.querySelector("#drawnTitle"),
      drawnMeta: document.querySelector("#drawnMeta"),
      drawStockButton: document.querySelector("#drawStockButton"),
      drawDiscardButton: document.querySelector("#drawDiscardButton"),
      tableActionBar: document.querySelector(".table-action-bar"),
      tableStopButton: document.querySelector("#tableStopButton"),
      tableDiscardDrawnButton: document.querySelector("#tableDiscardDrawnButton"),
      roundOverlay: document.querySelector(".round-overlay"),
      roundKicker: document.querySelector(".round-kicker"),
      roundOverlayTitle: document.querySelector("#roundOverlayTitle"),
      roundOverlaySummary: document.querySelector("#roundOverlaySummary"),
      roundHighlights: document.querySelector("#roundHighlights"),
      roundScoreRows: document.querySelector("#roundScoreRows"),
      nextRoundButton: document.querySelector("#nextRoundButton"),
      scoreboard: document.querySelector("#scoreboard"),
      eventLog: document.querySelector("#eventLog"),
    };
    document.querySelectorAll("[data-app-version]").forEach((node) => {
      node.textContent = APP_VERSION;
    });
    this.resumeNoticeTimer = null;
    this.stopConfirmationTimer = null;
    this.stopConfirmationPending = false;
    this.confirmResolver = null;
    this.tutorialStep = 0;
    this.tutorialActive = false;
    this.actions = null;
  }

  bind(actions) {
    this.actions = actions;
    this.refs.startMatchButton.addEventListener("click", () => {
      if (this.match.phase !== "idle") {
        actions.resetMatch();
        return;
      }
      this.startMatch(actions);
    });
    this.refs.tableStartMatchButton.addEventListener("click", () =>
      this.startMatch(actions, true),
    );
    this.refs.continueSavedMatchButton.addEventListener("click", actions.continueSavedMatch);
    this.refs.startRulesButton.addEventListener("click", () => this.openRules());
    this.refs.playerName.addEventListener("input", () => {
      this.syncSetup("side");
      actions.setupChanged?.(this.getSetup());
    });
    this.refs.tablePlayerName.addEventListener("input", () => {
      this.syncSetup("table");
      actions.setupChanged?.(this.getSetup());
    });
    this.refs.playerCount.addEventListener("change", () => {
      this.syncSetup("side");
      actions.setupChanged?.(this.getSetup());
    });
    this.refs.tablePlayerCount.addEventListener("change", () => {
      this.syncSetup("table");
      actions.setupChanged?.(this.getSetup());
    });
    this.refs.drawStockButton.addEventListener("click", actions.drawStock);
    this.refs.drawDiscardButton.addEventListener("click", actions.drawDiscard);
    this.refs.tableStopButton.addEventListener("click", () =>
      this.handleStopRequest(actions),
    );
    this.refs.tableDiscardDrawnButton.addEventListener("click", actions.discardDrawn);
    this.refs.nextRoundButton.addEventListener("click", actions.nextRound);
    this.refs.mobileMenuButton.addEventListener("click", () => {
      this.openMenu();
      actions.menuOpened?.();
    });
    this.refs.betaMenuBackdrop.addEventListener("click", () => {
      this.closeMenu();
      actions.menuClosed?.();
    });
    this.refs.continueMatchButton.addEventListener("click", () => {
      this.closeMenu();
      actions.menuClosed?.();
    });
    this.refs.menuRulesButton.addEventListener("click", () => {
      this.closeMenu();
      actions.menuClosed?.();
      this.openRules();
    });
    this.refs.tutorialButton.addEventListener("click", () => {
      this.closeMenu();
      actions.menuClosed?.();
      this.openTutorial();
    });
    this.refs.feedbackToggle.addEventListener("change", () =>
      actions.feedbackChanged?.(this.refs.feedbackToggle.checked),
    );
    this.refs.tutorialSkipButton.addEventListener("click", () =>
      this.closeTutorial(true),
    );
    this.refs.tutorialNextButton.addEventListener("click", () =>
      this.advanceTutorial(),
    );
    this.refs.closeRulesButton.addEventListener("click", () => this.closeRules());
    this.refs.confirmCancelButton.addEventListener("click", () =>
      this.resolveConfirm(false),
    );
    this.refs.confirmAcceptButton.addEventListener("click", () =>
      this.resolveConfirm(true),
    );
    this.refs.resetMatchButton.addEventListener("click", actions.resetMatch);
  }

  startMatch(actions, fromTable = false) {
    const playerName = normalizePlayerNameForMatch(
      fromTable ? this.refs.tablePlayerName.value : this.refs.playerName.value,
    );
    const playerCount = fromTable
      ? Number(this.refs.tablePlayerCount.value)
      : Number(this.refs.playerCount.value);
    actions.startMatch(playerCount, playerName);
  }

  syncSetup(source) {
    if (source === "table") {
      this.refs.playerName.value = this.refs.tablePlayerName.value;
      this.refs.playerCount.value = this.refs.tablePlayerCount.value;
      return;
    }
    this.refs.tablePlayerName.value = this.refs.playerName.value;
    this.refs.tablePlayerCount.value = this.refs.playerCount.value;
  }

  applySetup({ playerName = "", playerCount = 4 } = {}) {
    const setupName = normalizeSetupName(playerName);
    this.refs.playerName.value = setupName;
    this.refs.tablePlayerName.value = setupName;
    this.refs.playerCount.value = String(playerCount);
    this.refs.tablePlayerCount.value = String(playerCount);
  }

  getSetup() {
    return {
      playerName: normalizeSetupName(this.refs.tablePlayerName.value),
      playerCount: Number(this.refs.tablePlayerCount.value),
    };
  }

  applyFeedbackPreference(enabled) {
    this.refs.feedbackToggle.checked = Boolean(enabled);
  }

  showSavedMatch(summary) {
    if (!summary) {
      this.refs.savedMatchPanel.hidden = true;
      this.refs.tableStartMatchButton.textContent = "Iniciar partida";
      return;
    }
    this.refs.savedMatchPanel.hidden = false;
    this.refs.tableStartMatchButton.textContent = "Nova partida";
    this.refs.savedMatchTitle.textContent = `Continuar com ${summary.humanName}`;
    this.refs.savedMatchMeta.textContent =
      `Rodada ${summary.roundNumber} · ${summary.activeCount}/${summary.playerCount} ativos · ${summary.humanScore}/50 pts`;
  }

  hideSavedMatch() {
    this.refs.savedMatchPanel.hidden = true;
    this.refs.tableStartMatchButton.textContent = "Iniciar partida";
  }

  showMatchSetup() {
    this.closeMenu();
    this.resetStopConfirmation();
    this.refs.startOverlay.hidden = false;
  }

  isRoundOverlayVisible() {
    return !this.refs.roundOverlay.hidden;
  }

  openMenu() {
    this.resetStopConfirmation();
    this.refs.betaMenu.hidden = false;
    document.body.dataset.menuOpen = "true";
  }

  closeMenu() {
    this.refs.betaMenu.hidden = true;
    delete document.body.dataset.menuOpen;
  }

  isMenuOpen() {
    return !this.refs.betaMenu.hidden;
  }

  openRules() {
    this.resetStopConfirmation();
    this.refs.rulesOverlay.hidden = false;
    document.body.dataset.rulesOpen = "true";
    this.refs.closeRulesButton.focus({ preventScroll: true });
    this.actions?.modalOpened?.();
  }

  closeRules() {
    this.refs.rulesOverlay.hidden = true;
    delete document.body.dataset.rulesOpen;
    this.actions?.modalClosed?.();
  }

  isRulesOpen() {
    return !this.refs.rulesOverlay.hidden;
  }

  confirmAction({
    kicker = "Confirmar",
    title = "Confirmar ação",
    text = "Esta ação não pode ser desfeita.",
    acceptLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
  } = {}) {
    this.resolveConfirm(false);
    this.resetStopConfirmation();
    this.refs.confirmKicker.textContent = kicker;
    this.refs.confirmTitle.textContent = title;
    this.refs.confirmText.textContent = text;
    this.refs.confirmAcceptButton.textContent = acceptLabel;
    this.refs.confirmCancelButton.textContent = cancelLabel;
    this.refs.confirmAcceptButton.classList.toggle("is-danger", danger);
    this.refs.confirmOverlay.hidden = false;
    document.body.dataset.confirmOpen = "true";
    this.refs.confirmCancelButton.focus({ preventScroll: true });
    this.actions?.modalOpened?.();
    return new Promise((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  resolveConfirm(accepted) {
    const resolver = this.confirmResolver;
    this.confirmResolver = null;
    this.refs.confirmOverlay.hidden = true;
    delete document.body.dataset.confirmOpen;
    this.actions?.modalClosed?.();
    resolver?.(accepted);
  }

  isConfirmOpen() {
    return !this.refs.confirmOverlay.hidden;
  }

  startTutorialIfNeeded() {
    if (hasSeenTutorial()) return false;
    this.openTutorial();
    return true;
  }

  openTutorial() {
    this.resetStopConfirmation();
    this.tutorialStep = 0;
    this.tutorialActive = true;
    this.renderTutorial();
    this.refs.tutorialOverlay.hidden = false;
    document.body.dataset.tutorialOpen = "true";
    this.refs.tutorialNextButton.focus({ preventScroll: true });
    this.actions?.tutorialOpened?.();
  }

  advanceTutorial() {
    if (!this.tutorialActive) return;
    if (this.tutorialStep < TUTORIAL_STEPS.length - 1) {
      this.tutorialStep += 1;
      this.renderTutorial();
      return;
    }
    this.closeTutorial(true);
  }

  closeTutorial(markSeen = false) {
    if (!this.tutorialActive) return;
    if (markSeen) markTutorialSeen();
    this.tutorialActive = false;
    this.refs.tutorialOverlay.hidden = true;
    delete document.body.dataset.tutorialOpen;
    this.actions?.tutorialClosed?.();
  }

  isTutorialOpen() {
    return this.tutorialActive;
  }

  renderTutorial() {
    const step = TUTORIAL_STEPS[this.tutorialStep];
    this.refs.tutorialCard.dataset.tutorialStep = String(this.tutorialStep);
    this.refs.tutorialKicker.textContent =
      `Passo ${this.tutorialStep + 1} de ${TUTORIAL_STEPS.length}`;
    this.refs.tutorialTitle.textContent = step.title;
    this.refs.tutorialText.textContent = step.text;
    this.refs.tutorialNextButton.textContent =
      this.tutorialStep === TUTORIAL_STEPS.length - 1 ? "Comecar" : "Proximo";
    this.refs.tutorialCard
      .querySelectorAll(".tutorial-progress span")
      .forEach((node, index) => node.classList.toggle("is-current", index === this.tutorialStep));
  }

  handleStopRequest(actions) {
    if (this.stopConfirmationPending) {
      this.resetStopConfirmation();
      actions.requestStop();
      return;
    }
    this.stopConfirmationPending = true;
    this.refs.tableStopButton.dataset.confirming = "true";
    this.refs.tableStopButton.textContent = "Confirmar parada";
    this.refs.tableStatusText.textContent =
      "Confirme a parada. Empate tambem faz voce perder.";
    this.refs.statusLine.textContent =
      "Confirme a parada. Empate tambem faz voce perder.";
    window.clearTimeout(this.stopConfirmationTimer);
    this.stopConfirmationTimer = window.setTimeout(
      () => this.resetStopConfirmation(),
      STOP_CONFIRMATION_MS,
    );
  }

  resetStopConfirmation() {
    window.clearTimeout(this.stopConfirmationTimer);
    this.stopConfirmationTimer = null;
    this.stopConfirmationPending = false;
    this.refs.tableStopButton.removeAttribute("data-confirming");
    this.refs.tableStopButton.textContent = "Pedir para parar";
  }

  showResumeNotice() {
    window.clearTimeout(this.resumeNoticeTimer);
    this.refs.resumeNotice.hidden = false;
    this.resumeNoticeTimer = window.setTimeout(() => {
      this.refs.resumeNotice.hidden = true;
    }, 2600);
  }

  update(state) {
    const now = performance.now();
    const revealPending = isRoundRevealPending(state, now);
    if (
      this.stopConfirmationPending &&
      (state.phase !== "humanAction" || state.stopRequestedBy)
    ) {
      this.resetStopConfirmation();
    }
    document.body.dataset.phase = state.phase;
    this.refs.phaseBadge.textContent = state.phaseLabel;
    this.refs.statusLine.textContent = revealPending
      ? "Revelando as cartas da rodada."
      : this.stopConfirmationPending
        ? "Confirme a parada. Empate tambem faz voce perder."
        : state.status;
    this.updateTableHud(state, revealPending);
    this.updateDrawn(state);
    this.updateButtons(state);
    this.updateScoreboard(state.players, revealPending);
    this.updateRoundOverlay(state, now);
    this.updateLog(state.events);
  }

  updateTableHud(state, revealPending = false) {
    const activeCount = state.players.filter((player) => player.active).length;
    this.refs.tableRound.textContent = state.roundNumber
      ? `Rodada ${state.roundNumber}`
      : "Nova partida";
    this.refs.tablePlayers.textContent = `${activeCount || state.players.length || 0} jogadores`;
    this.refs.tablePhaseText.textContent = state.phaseLabel;
    this.refs.tableStatusText.textContent = revealPending
      ? "Revelando as cartas."
      : this.stopConfirmationPending
        ? "Confirme a parada. Empate tambem faz voce perder."
        : shortStatus(state);
  }

  updateDrawn(state) {
    if (!state.currentDrawn) {
      this.refs.drawnPanel.hidden = true;
      this.refs.drawnCard.textContent = "--";
      this.refs.drawnTitle.textContent = "Sem carta";
      this.refs.drawnMeta.textContent = "Compre do baralho ou do morto.";
      return;
    }
    this.refs.drawnPanel.hidden = false;
    this.refs.drawnCard.textContent = formatCard(state.currentDrawn);
    this.refs.drawnTitle.textContent = `${formatCard(state.currentDrawn)} - ${cardValue(state.currentDrawn)} pts`;
    this.refs.drawnMeta.textContent =
      state.currentDrawSource === "discard"
        ? "Veio do morto; precisa entrar na sua mao."
        : "Pode trocar, descartar ou pedir para parar antes da acao.";
  }

  updateButtons(state) {
    const canDraw = state.phase === "humanTurn";
    const canAct = state.phase === "humanAction";
    const canDiscardDrawn = canAct && state.currentDrawSource === "stock";
    const canStop = canAct && !state.stopRequestedBy;
    const canAdvance = state.phase === "roundOver" || state.phase === "matchOver";

    this.refs.drawStockButton.disabled = !canDraw;
    this.refs.drawDiscardButton.disabled = !canDraw || !state.discardTop;
    this.refs.tableStopButton.disabled = !canStop;
    this.refs.tableDiscardDrawnButton.disabled = !canDiscardDrawn;
    this.refs.nextRoundButton.disabled = !canAdvance;
    this.refs.nextRoundButton.textContent =
      state.phase === "matchOver" ? "Nova partida" : "Proxima rodada";
    this.refs.playerCount.disabled = state.phase !== "idle" && state.phase !== "matchOver";
    this.refs.playerName.disabled = state.phase !== "idle" && state.phase !== "matchOver";
    this.refs.tablePlayerCount.disabled = state.phase !== "idle";
    this.refs.tablePlayerName.disabled = state.phase !== "idle";
    this.refs.tableStartMatchButton.disabled = state.phase !== "idle";
    this.refs.mobileMenuButton.hidden =
      state.phase === "idle" || state.phase === "matchOver";

    this.refs.startOverlay.hidden = state.phase !== "idle";
    this.refs.drawStockButton.hidden = !canDraw;
    this.refs.drawDiscardButton.hidden = !canDraw;
    this.refs.tableActionBar.hidden = !canAct;
    this.refs.tableStopButton.hidden = !canStop;
    this.refs.tableDiscardDrawnButton.hidden = !(canAct && state.currentDrawSource === "stock");
    this.refs.nextRoundButton.hidden = !canAdvance;
    if (state.phase === "idle" || state.phase === "matchOver") {
      this.closeMenu();
    }
  }

  updateScoreboard(players, holdRoundScore = false) {
    this.refs.scoreboard.replaceChildren(
      ...players.map((player) => {
        const displayScore = holdRoundScore
          ? Math.max(0, player.score - (player.lastDelta ?? 0))
          : player.score;
        const displayActive = holdRoundScore && player.lastDelta !== null ? true : player.active;
        const row = document.createElement("div");
        row.className = `score-row${displayActive ? "" : " is-out"}`;
        const name = document.createElement("span");
        name.className = "score-name";
        name.textContent = displayActive ? player.name : `${player.name} saiu`;
        const points = document.createElement("span");
        points.className = `score-points${displayScore >= 40 ? " is-danger" : ""}`;
        points.textContent = `${displayScore}`;
        row.append(name, points);
        return row;
      }),
    );
  }

  updateRoundOverlay(state, now = performance.now()) {
    const revealStartedAt = roundRevealStartedAt(state);
    const revealAge = revealStartedAt === null ? Infinity : now - revealStartedAt;
    const showOverlay =
      Boolean(state.roundResult) &&
      (state.phase === "roundOver" || state.phase === "matchOver") &&
      revealAge >= ROUND_REVEAL_DELAY_MS;
    this.refs.roundOverlay.hidden = !showOverlay;
    if (!showOverlay) return;

    this.refs.roundOverlay.dataset.kind = state.phase === "matchOver" ? "match" : "round";
    this.refs.roundKicker.textContent = roundOverlayKicker(state);
    this.refs.roundOverlayTitle.textContent = roundOverlayTitle(state);
    this.refs.roundOverlaySummary.textContent = roundOverlaySummary(state);
    this.refs.roundHighlights.replaceChildren(...createRoundHighlights(state));
    const playedPlayers = state.players.filter(
      (player) => player.lastHandValue !== null || state.roundResult.handScores.has(player.id),
    );
    this.refs.roundScoreRows.replaceChildren(
      createRoundHeader(),
      ...playedPlayers.map((player) => createRoundRow(player, state)),
    );
  }

  updateLog(events) {
    this.refs.eventLog.replaceChildren(
      ...events.map((event) => {
        const item = document.createElement("li");
        item.textContent = event;
        return item;
      }),
    );
  }
}

function shortStatus(state) {
  if (state.phase === "preview") return "Memorize suas duas cartas das pontas.";
  if (state.phase === "humanTurn") return "Toque no baralho ou no morto.";
  if (state.phase === "humanAction") {
    if (state.stopRequestedBy) return "Toque em uma carta da sua mao.";
    return state.currentDrawSource === "stock"
      ? "Toque em uma carta, descarte ou pare."
      : "Toque em uma carta para trocar.";
  }
  if (state.phase === "botTurn") return `${currentPlayerName(state)} jogando.`;
  if (state.phase === "roundOver") return state.roundResult?.message ?? "Rodada encerrada.";
  return state.status;
}

function currentPlayerName(state) {
  return state.players.find((player) => player.id === state.currentPlayerId)?.name ?? "Bot";
}

function roundRevealStartedAt(state) {
  if (!state.roundEndedAt) return null;
  const lastActionAt = state.lastAction?.at ?? 0;
  return Math.max(state.roundEndedAt, lastActionAt + ROUND_OVERLAY_DELAY_MS);
}

function isRoundRevealPending(state, now = performance.now()) {
  if (!state.roundResult || (state.phase !== "roundOver" && state.phase !== "matchOver")) {
    return false;
  }
  const revealStartedAt = roundRevealStartedAt(state);
  return revealStartedAt !== null && now - revealStartedAt < ROUND_REVEAL_DELAY_MS;
}

function roundOverlayTitle(state) {
  if (state.phase === "matchOver") {
    return `${state.winner?.name ?? "Alguem"} venceu a partida!`;
  }
  const stopper = state.players.find((player) => player.id === state.roundResult.stopperId);
  const name = stopper?.name ?? "Jogador";
  return state.roundResult.success ? `${name} parou e venceu!` : `${name} parou e perdeu!`;
}

function roundOverlayKicker(state) {
  if (state.phase === "matchOver") return "Fim da partida";
  const hasEliminated = state.players.some(
    (player) => !player.active && player.lastDelta !== null,
  );
  return hasEliminated ? "Fim da rodada - eliminado" : "Fim da rodada";
}

function roundOverlaySummary(state) {
  if (state.phase === "matchOver") {
    return "Partida encerrada. Confira a última mão e o total final.";
  }
  return state.roundResult?.message ?? "Confira as mãos, os pontos da rodada e o total.";
}

function createRoundHeader() {
  const header = document.createElement("div");
  header.className = "round-score-row is-header";
  ["Jogador", "Cartas", "Mão", "+Pts", "Total"].forEach((label) => {
    const cell = document.createElement("span");
    cell.textContent = label;
    header.append(cell);
  });
  return header;
}

function createRoundHighlights(state) {
  if (!state.roundResult) return [];
  const stopper = state.players.find((player) => player.id === state.roundResult.stopperId);
  const lowestPlayers = lowestHandPlayers(state);
  const eliminated = state.players.filter(
    (player) => !player.active && player.lastDelta !== null,
  );
  const highlights = [
    createHighlight(`Parou: ${stopper?.name ?? "Jogador"}`, state.roundResult.success ? "is-good" : "is-bad"),
    createHighlight(
      `Menor mão: ${lowestPlayers.map((player) => player.name).join(", ")}`,
      "is-gold",
    ),
  ];
  if (eliminated.length) {
    highlights.push(createHighlight(`Eliminado: ${eliminated.map((player) => player.name).join(", ")}`, "is-bad"));
  }
  if (state.phase === "matchOver" && state.winner) {
    highlights.push(createHighlight(`Vencedor: ${state.winner.name}`, "is-good"));
  }
  return highlights;
}

function createHighlight(text, kind = "") {
  const node = document.createElement("span");
  node.className = ["round-highlight", kind].filter(Boolean).join(" ");
  node.textContent = text;
  return node;
}

function createRoundRow(player, state) {
  const row = document.createElement("div");
  const isStopper = player.id === state.roundResult.stopperId;
  const isFailedStopper = isStopper && !state.roundResult.success;
  const isLowest = lowestHandPlayers(state).some((lowest) => lowest.id === player.id);
  const isWinner = state.phase === "matchOver" && player.id === state.winner?.id;
  const wasEliminated = !player.active && player.lastDelta !== null;
  row.className = [
    "round-score-row",
    isStopper ? "is-stopper" : "",
    isFailedStopper ? "is-failed-stopper" : "",
    isLowest ? "is-lowest" : "",
    isWinner ? "is-winner" : "",
    wasEliminated ? "is-eliminated" : "",
    player.active ? "" : "is-out",
  ].filter(Boolean).join(" ");

  const name = document.createElement("span");
  name.className = "round-player";
  name.textContent = player.name;
  if (isWinner || wasEliminated) {
    const badge = document.createElement("em");
    badge.className = isWinner ? "round-badge is-winner" : "round-badge is-eliminated";
    badge.textContent = isWinner ? "Vencedor" : "Eliminado";
    name.append(" ", badge);
  }
  if (isStopper) {
    const badge = document.createElement("em");
    badge.className = state.roundResult.success ? "round-badge is-winner" : "round-badge is-eliminated";
    badge.textContent = "Parou";
    name.append(" ", badge);
  }
  if (isLowest) {
    const badge = document.createElement("em");
    badge.className = "round-badge is-winner";
    badge.textContent = "Menor";
    name.append(" ", badge);
  }

  const hand = document.createElement("span");
  hand.className = "round-hand-value";
  hand.textContent = `${player.lastHandValue ?? state.roundResult.handScores.get(player.id) ?? 0}`;

  const cards = document.createElement("span");
  cards.className = "round-hand";
  player.hand.forEach((card) => cards.append(createRoundCard(card)));

  const deltaValue = player.lastDelta ?? state.roundResult.deltas.get(player.id) ?? 0;
  const delta = document.createElement("span");
  delta.className = deltaValue > 0 ? "round-delta is-added" : "round-delta is-zero";
  delta.textContent = `+${deltaValue}`;

  const total = document.createElement("span");
  total.className = player.score >= 40 ? "round-total is-danger" : "round-total";
  total.textContent = `${player.score} pts`;

  row.append(name, cards, hand, delta, total);
  return row;
}

function lowestHandPlayers(state) {
  if (!state.roundResult) return [];
  const played = state.players.filter((player) => state.roundResult.handScores.has(player.id));
  const values = played.map((player) => state.roundResult.handScores.get(player.id) ?? 0);
  const lowest = Math.min(...values);
  return played.filter((player) => (state.roundResult.handScores.get(player.id) ?? 0) === lowest);
}

function createRoundCard(card) {
  const node = document.createElement("span");
  node.className = `round-hand-card${isRedCard(card) ? " is-red" : ""}`;
  node.textContent = shortCard(card);
  node.title = `${formatCard(card)} - ${cardValue(card)} pts`;
  return node;
}

function isRedCard(card) {
  return card?.suit === "H" || card?.suit === "D";
}

function normalizeSetupName(name) {
  const setupName = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 14);
  return isLegacyDefaultName(setupName) ? "" : setupName;
}

function normalizePlayerNameForMatch(name) {
  return normalizeSetupName(name) || "Você";
}

function isLegacyDefaultName(name) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized === "voce";
}
