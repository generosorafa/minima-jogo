import { formatCard, cardValue } from "../core/rules.js";
import { APP_VERSION } from "../config/constants.js";

const ROUND_OVERLAY_DELAY_MS = 760;
const ROUND_REVEAL_DELAY_MS = 3200;

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
      mobileMenuButton: document.querySelector("#mobileMenuButton"),
      betaMenu: document.querySelector("#betaMenu"),
      betaMenuBackdrop: document.querySelector("#betaMenuBackdrop"),
      continueMatchButton: document.querySelector("#continueMatchButton"),
      resetMatchButton: document.querySelector("#resetMatchButton"),
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
      roundScoreRows: document.querySelector("#roundScoreRows"),
      nextRoundButton: document.querySelector("#nextRoundButton"),
      scoreboard: document.querySelector("#scoreboard"),
      eventLog: document.querySelector("#eventLog"),
    };
    document.querySelectorAll("[data-app-version]").forEach((node) => {
      node.textContent = APP_VERSION;
    });
    this.resumeNoticeTimer = null;
  }

  bind(actions) {
    this.refs.startMatchButton.addEventListener("click", () => this.startMatch(actions));
    this.refs.tableStartMatchButton.addEventListener("click", () =>
      this.startMatch(actions, true),
    );
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
    this.refs.tableStopButton.addEventListener("click", actions.requestStop);
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
    this.refs.resetMatchButton.addEventListener("click", actions.resetMatch);
  }

  startMatch(actions, fromTable = false) {
    const playerName = fromTable ? this.refs.tablePlayerName.value : this.refs.playerName.value;
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

  applySetup({ playerName = "Voce", playerCount = 4 } = {}) {
    this.refs.playerName.value = playerName;
    this.refs.tablePlayerName.value = playerName;
    this.refs.playerCount.value = String(playerCount);
    this.refs.tablePlayerCount.value = String(playerCount);
  }

  getSetup() {
    return {
      playerName: this.refs.tablePlayerName.value,
      playerCount: Number(this.refs.tablePlayerCount.value),
    };
  }

  openMenu() {
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
    document.body.dataset.phase = state.phase;
    this.refs.phaseBadge.textContent = state.phaseLabel;
    this.refs.statusLine.textContent = revealPending ? "Revelando as cartas da rodada." : state.status;
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

function createRoundHeader() {
  const header = document.createElement("div");
  header.className = "round-score-row is-header";
  ["Jogador", "Mao", "+Pts", "Total"].forEach((label) => {
    const cell = document.createElement("span");
    cell.textContent = label;
    header.append(cell);
  });
  return header;
}

function createRoundRow(player, state) {
  const row = document.createElement("div");
  const isStopper = player.id === state.roundResult.stopperId;
  const isWinner = state.phase === "matchOver" && player.id === state.winner?.id;
  const wasEliminated = !player.active && player.lastDelta !== null;
  row.className = [
    "round-score-row",
    isStopper ? "is-stopper" : "",
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

  const hand = document.createElement("span");
  hand.textContent = `${player.lastHandValue ?? state.roundResult.handScores.get(player.id) ?? 0} pts`;

  const deltaValue = player.lastDelta ?? state.roundResult.deltas.get(player.id) ?? 0;
  const delta = document.createElement("span");
  delta.className = deltaValue > 0 ? "round-delta is-added" : "round-delta is-zero";
  delta.textContent = `+${deltaValue}`;

  const total = document.createElement("span");
  total.className = player.score >= 40 ? "round-total is-danger" : "round-total";
  total.textContent = `${player.score} pts`;

  row.append(name, hand, delta, total);
  return row;
}
