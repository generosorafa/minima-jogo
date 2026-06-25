import {
  BOT_PROFILES,
  CARD_RANKS,
  CARD_SUITS,
  GAME_CONFIG,
} from "../config/constants.js";
import { createDeck, draw, shuffle } from "../core/deck.js";
import { cardValue, evaluateStopRound, formatCard, handValue } from "../core/rules.js";
import { chooseBotMove } from "./bot.js";

const PHASES = Object.freeze({
  idle: "idle",
  preview: "preview",
  humanTurn: "humanTurn",
  humanAction: "humanAction",
  botTurn: "botTurn",
  roundOver: "roundOver",
  matchOver: "matchOver",
});

const MATCH_STATE_VERSION = 1;

export class Match {
  constructor({ randomInt = null } = {}) {
    this.randomInt = typeof randomInt === "function" ? randomInt : null;
    this.reset();
  }

  reset() {
    this.phase = PHASES.idle;
    this.players = [];
    this.stock = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.currentDrawn = null;
    this.currentDrawSource = null;
    this.stopRequestedBy = null;
    this.roundNumber = 0;
    this.starterOffset = 0;
    this.previewEndsAt = 0;
    this.roundResult = null;
    this.winner = null;
    this.lastAction = null;
    this.roundEndedAt = null;
    this.lastBotDecision = null;
    this.events = ["Pronto para iniciar."];
  }

  startMatch(playerCount, humanName = "Voce") {
    const totalPlayers = clamp(
      Number(playerCount),
      GAME_CONFIG.minPlayers,
      GAME_CONFIG.maxPlayersMvp,
    );
    this.players = [
      createHumanPlayer(cleanPlayerName(humanName)),
      ...Array.from({ length: totalPlayers - 1 }, (_, index) =>
        createBotPlayer(index + 1),
      ),
    ];
    this.roundNumber = 0;
    this.starterOffset = 0;
    this.winner = null;
    this.roundEndedAt = null;
    this.events = ["Partida iniciada."];
    this.startRound();
  }

  startRound(now = performance.now()) {
    this.roundNumber += 1;
    this.roundResult = null;
    this.currentDrawn = null;
    this.currentDrawSource = null;
    this.stopRequestedBy = null;
    this.lastAction = null;
    this.roundEndedAt = null;
    this.lastBotDecision = null;
    const activeCount = this.players.filter((player) => player.active).length;
    const deckCount = activeCount <= GAME_CONFIG.maxPlayersOneDeck ? 1 : 2;
    this.stock = shuffle(createDeck(deckCount), this.randomInt ?? undefined);
    this.discardPile = [];

    for (const player of this.players) {
      player.hand = [];
      player.known = [null, null, null];
      player.lastDelta = null;
      player.lastHandValue = null;
      if (!player.active) continue;
      for (let slot = 0; slot < 3; slot += 1) {
        player.hand.push(draw(this.stock));
      }
      player.known[0] = player.hand[0];
      player.known[2] = player.hand[2];
    }

    this.discardPile.push(draw(this.stock));
    this.currentPlayerIndex = this.findNextActiveIndex(this.starterOffset - 1);
    this.starterOffset = this.findNextActiveIndex(this.currentPlayerIndex);
    this.phase = PHASES.preview;
    this.previewEndsAt = now + GAME_CONFIG.previewSeconds * 1000;
    this.pushEvent(`Rodada ${this.roundNumber}: memorize as pontas.`);
  }

  completePreview() {
    if (this.phase !== PHASES.preview) return;
    this.phase = this.currentPlayer.isHuman ? PHASES.humanTurn : PHASES.botTurn;
    this.pushEvent(`${this.currentPlayer.name} comeca.`);
  }

  drawFromStock() {
    if (!this.canHumanDraw()) return;
    this.currentDrawn = this.drawFromStockInternal();
    this.currentDrawSource = "stock";
    this.phase = PHASES.humanAction;
    this.noteAction("draw-stock", "Comprada", {
      card: this.currentDrawn,
      source: "stock",
    });
    this.pushEvent(`Voce comprou ${formatCard(this.currentDrawn)}.`);
  }

  drawFromDiscard() {
    if (!this.canHumanDraw() || this.discardPile.length === 0) return;
    this.currentDrawn = this.discardPile.pop();
    this.currentDrawSource = "discard";
    this.phase = PHASES.humanAction;
    this.noteAction("draw-discard", "Morto", {
      card: this.currentDrawn,
      source: "discard",
    });
    this.pushEvent(`Voce pegou ${formatCard(this.currentDrawn)} do morto.`);
  }

  requestStop() {
    if (this.phase !== PHASES.humanAction || !this.currentPlayer.isHuman) return;
    this.stopRequestedBy = this.currentPlayer.id;
    this.noteAction("stop", "Parar", { playerId: this.currentPlayer.id });
    this.pushEvent("Voce pediu para parar antes da acao final.");
  }

  discardDrawn() {
    if (this.phase !== PHASES.humanAction || this.currentDrawSource !== "stock") return;
    const discardedCard = this.currentDrawn;
    this.discardPile.push(discardedCard);
    this.noteAction("discard", "Descarte", {
      card: discardedCard,
      source: "drawn",
    });
    this.pushEvent(`Voce descartou ${formatCard(this.currentDrawn)}.`);
    this.finishTurnOrRound();
  }

  swapHuman(slotIndex) {
    if (this.phase !== PHASES.humanAction) return;
    if (slotIndex < 0 || slotIndex > 2) return;
    this.swapCurrentDrawnIntoSlot(this.currentPlayer, slotIndex);
    this.finishTurnOrRound();
  }

  runBotTurn() {
    if (this.phase !== PHASES.botTurn || this.currentPlayer.isHuman) return;
    const player = this.currentPlayer;
    const move = chooseBotMove(this, player);
    this.lastBotDecision = move.debug;
    if (isBotDebugEnabled()) {
      console.debug("[Minima bot]", move.debug);
    }
    this.currentDrawn = move.drawnCard;
    this.currentDrawSource = move.source;
    this.pushEvent(
      `${player.name} comprou ${move.source === "discard" ? "do morto" : "do baralho"}.`,
    );

    if (move.shouldStop) {
      this.stopRequestedBy = player.id;
      this.pushEvent(`${player.name} pediu para parar.`);
    }

    if (move.action.type === "swap") {
      this.swapCurrentDrawnIntoSlot(player, move.action.slotIndex);
    } else {
      const discardedCard = this.currentDrawn;
      this.discardPile.push(discardedCard);
      this.noteAction("discard", "Descarte", {
        card: discardedCard,
        source: move.source,
        playerId: player.id,
      });
      this.pushEvent(`${player.name} descartou a carta comprada.`);
    }

    this.finishTurnOrRound();
  }

  takeDiscardForBot() {
    return this.discardPile.pop();
  }

  drawStockForBot() {
    return this.drawFromStockInternal();
  }

  peekDiscard() {
    return this.discardPile[this.discardPile.length - 1] ?? null;
  }

  canHumanDraw() {
    return this.phase === PHASES.humanTurn && this.currentPlayer?.isHuman;
  }

  exportState(now = performance.now(), savedAt = Date.now()) {
    if (this.phase === PHASES.idle) return null;
    return {
      version: MATCH_STATE_VERSION,
      savedAt,
      phase: this.phase,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHuman: player.isHuman,
        active: player.active,
        score: player.score,
        lastDelta: player.lastDelta,
        lastHandValue: player.lastHandValue,
        hand: copyCards(player.hand),
        known: player.known.map(copyCard),
        profileIndex: player.isHuman ? null : BOT_PROFILES.indexOf(player.profile),
      })),
      stock: copyCards(this.stock),
      discardPile: copyCards(this.discardPile),
      currentPlayerIndex: this.currentPlayerIndex,
      currentDrawn: copyCard(this.currentDrawn),
      currentDrawSource: this.currentDrawSource,
      stopRequestedBy: this.stopRequestedBy,
      roundNumber: this.roundNumber,
      starterOffset: this.starterOffset,
      previewRemainingMs:
        this.phase === PHASES.preview ? Math.max(0, this.previewEndsAt - now) : 0,
      roundResult: serializeRoundResult(this.roundResult),
      winnerId: this.winner?.id ?? null,
      events: this.events.slice(-60),
    };
  }

  restoreState(savedState, now = performance.now()) {
    if (!isValidSavedState(savedState)) return false;

    this.phase = savedState.phase;
    this.players = savedState.players.map((player, index) => ({
      id: player.id,
      name: cleanPlayerName(player.name),
      isHuman: player.isHuman,
      active: player.active,
      score: player.score,
      lastDelta: player.lastDelta,
      lastHandValue: player.lastHandValue,
      hand: copyCards(player.hand),
      known: player.known.map(copyCard),
      profile: player.isHuman
        ? null
        : BOT_PROFILES[player.profileIndex] ?? BOT_PROFILES[index - 1] ?? BOT_PROFILES[0],
    }));
    this.stock = copyCards(savedState.stock);
    this.discardPile = copyCards(savedState.discardPile);
    this.currentPlayerIndex = savedState.currentPlayerIndex;
    this.currentDrawn = copyCard(savedState.currentDrawn);
    this.currentDrawSource = savedState.currentDrawSource;
    this.stopRequestedBy = savedState.stopRequestedBy;
    this.roundNumber = savedState.roundNumber;
    this.starterOffset = savedState.starterOffset;
    this.previewEndsAt =
      this.phase === PHASES.preview
        ? now + clamp(savedState.previewRemainingMs, 0, GAME_CONFIG.previewSeconds * 1000)
        : 0;
    this.roundResult = deserializeRoundResult(savedState.roundResult);
    this.winner =
      this.players.find((player) => player.id === savedState.winnerId) ?? null;
    this.lastAction = null;
    this.roundEndedAt = this.roundResult ? now - 10000 : null;
    this.lastBotDecision = null;
    this.events = savedState.events.slice(-60);
    this.pushEvent("Partida retomada.");
    return true;
  }

  snapshot(now = performance.now()) {
    return {
      phase: this.phase,
      phaseLabel: this.phaseLabel(now),
      status: this.statusText(now),
      players: this.players,
      currentPlayerId: this.currentPlayer?.id ?? null,
      stockCount: this.stock.length,
      discardTop: this.peekDiscard(),
      discardCount: this.discardPile.length,
      currentDrawn: this.currentDrawn,
      currentDrawSource: this.currentDrawSource,
      stopRequestedBy: this.stopRequestedBy,
      roundNumber: this.roundNumber,
      roundResult: this.roundResult,
      winner: this.winner,
      lastAction: this.lastAction,
      roundEndedAt: this.roundEndedAt,
      lastBotDecision: this.lastBotDecision,
      events: this.events.slice(-10).reverse(),
    };
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  phaseLabel(now) {
    if (this.phase === PHASES.preview) {
      return `Memorize ${Math.max(0, Math.ceil((this.previewEndsAt - now) / 1000))}s`;
    }
    const labels = {
      [PHASES.idle]: "Aguardando",
      [PHASES.humanTurn]: "Seu turno",
      [PHASES.humanAction]: "Acao final",
      [PHASES.botTurn]: "Bot jogando",
      [PHASES.roundOver]: "Rodada encerrada",
      [PHASES.matchOver]: "Partida encerrada",
    };
    return labels[this.phase] ?? "Jogo";
  }

  statusText(now) {
    if (this.phase === PHASES.idle) return "Escolha a quantidade de jogadores.";
    if (this.phase === PHASES.preview) {
      const seconds = Math.max(0, Math.ceil((this.previewEndsAt - now) / 1000));
      return `Olhe apenas suas cartas das pontas. Elas somem em ${seconds}s.`;
    }
    if (this.phase === PHASES.humanTurn) {
      return "Clique no baralho fechado ou no morto para comprar.";
    }
    if (this.phase === PHASES.humanAction) {
      if (this.stopRequestedBy) {
        return "Pedido feito. Clique em uma carta da sua mao para trocar ou descarte a comprada.";
      }
      return this.currentDrawSource === "discard"
        ? "Clique em uma das suas cartas para trocar pela carta do morto."
        : "Clique em uma carta da sua mao para trocar, descarte ou peca para parar antes.";
    }
    if (this.phase === PHASES.botTurn) return `${this.currentPlayer.name} esta pensando.`;
    if (this.phase === PHASES.roundOver) return this.roundResult?.message ?? "Rodada encerrada.";
    if (this.phase === PHASES.matchOver) return `${this.winner?.name} venceu a partida.`;
    return "";
  }

  drawFromStockInternal() {
    if (this.stock.length === 0) {
      this.recycleDiscardIntoStock();
    }
    return draw(this.stock);
  }

  recycleDiscardIntoStock() {
    const topDiscard = this.discardPile.pop();
    this.stock = shuffle(this.discardPile, this.randomInt ?? undefined);
    this.discardPile = topDiscard ? [topDiscard] : [];
    this.pushEvent("Morto reciclado no baralho.");
  }

  swapCurrentDrawnIntoSlot(player, slotIndex) {
    const replaced = player.hand[slotIndex];
    const drawnCard = this.currentDrawn;
    const source = this.currentDrawSource;
    player.hand[slotIndex] = drawnCard;
    player.known[slotIndex] = drawnCard;
    this.discardPile.push(replaced);
    const slotName = ["esquerda", "meio", "direita"][slotIndex];
    this.noteAction("swap", "Troca", {
      playerId: player.id,
      slotIndex,
      card: drawnCard,
      replacedCard: replaced,
      source,
      fromDrawnArea: player.isHuman,
    });
    this.pushEvent(
      `${player.isHuman ? "Voce" : player.name} trocou a carta do ${slotName} e descartou ${formatCard(replaced)}.`,
    );
  }

  finishTurnOrRound() {
    if (this.stopRequestedBy) {
      this.finishRound(this.stopRequestedBy);
      return;
    }
    this.currentDrawn = null;
    this.currentDrawSource = null;
    this.currentPlayerIndex = this.findNextActiveIndex(this.currentPlayerIndex);
    this.phase = this.currentPlayer.isHuman ? PHASES.humanTurn : PHASES.botTurn;
  }

  finishRound(stopperId) {
    this.currentDrawn = null;
    this.currentDrawSource = null;
    const result = { ...evaluateStopRound(this.players, stopperId), stopperId };
    this.roundResult = result;
    this.roundEndedAt = performance.now();
    for (const player of this.players) {
      if (!player.active) continue;
      const delta = result.deltas.get(player.id) ?? 0;
      player.lastDelta = delta;
      player.lastHandValue = result.handScores.get(player.id) ?? null;
      player.score += delta;
      if (player.score >= GAME_CONFIG.eliminationScore) {
        player.active = false;
        this.pushEvent(`${player.name} saiu com ${player.score} pontos.`);
      }
    }
    this.pushRoundScoreEvent(result);

    const activePlayers = this.players.filter((player) => player.active);
    if (activePlayers.length <= 1) {
      this.winner = activePlayers[0] ?? findLowestScorePlayer(this.players);
      this.phase = PHASES.matchOver;
      this.pushEvent(`${this.winner.name} venceu a partida.`);
      return;
    }

    this.phase = PHASES.roundOver;
  }

  pushRoundScoreEvent(result) {
    this.pushEvent(result.message);
  }

  findNextActiveIndex(fromIndex) {
    for (let step = 1; step <= this.players.length; step += 1) {
      const index = (fromIndex + step + this.players.length) % this.players.length;
      if (this.players[index]?.active) return index;
    }
    return 0;
  }

  pushEvent(message) {
    this.events.push(message);
    if (this.events.length > 60) this.events.shift();
  }

  noteAction(type, label, data = {}) {
    this.lastAction = {
      type,
      label,
      at: performance.now(),
      ...data,
    };
  }
}

function createHumanPlayer(name = "Voce") {
  return {
    id: "p0",
    name,
    isHuman: true,
    active: true,
    score: 0,
    lastDelta: null,
    lastHandValue: null,
    hand: [],
    known: [null, null, null],
    profile: null,
  };
}

function createBotPlayer(index) {
  return {
    id: `p${index}`,
    name: BOT_PROFILES[index - 1]?.name ?? `Bot ${index}`,
    isHuman: false,
    active: true,
    score: 0,
    lastDelta: null,
    lastHandValue: null,
    hand: [],
    known: [null, null, null],
    profile: BOT_PROFILES[index - 1],
  };
}

function findLowestScorePlayer(players) {
  return players.reduce((best, player) => (player.score < best.score ? player : best), players[0]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function cleanPlayerName(name) {
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 14);
  return cleanName || "Voce";
}

function serializeRoundResult(result) {
  if (!result) return null;
  return {
    success: result.success,
    stopperScore: result.stopperScore,
    stopperId: result.stopperId,
    message: result.message,
    handScores: [...result.handScores.entries()],
    deltas: [...result.deltas.entries()],
  };
}

function deserializeRoundResult(result) {
  if (!result) return null;
  return {
    success: result.success,
    stopperScore: result.stopperScore,
    stopperId: result.stopperId,
    message: result.message,
    handScores: new Map(result.handScores),
    deltas: new Map(result.deltas),
  };
}

function isValidSavedState(state) {
  if (!state || typeof state !== "object" || state.version !== MATCH_STATE_VERSION) {
    return false;
  }
  if (!Object.values(PHASES).includes(state.phase) || state.phase === PHASES.idle) {
    return false;
  }
  if (
    !Array.isArray(state.players) ||
    state.players.length < GAME_CONFIG.minPlayers ||
    state.players.length > GAME_CONFIG.maxPlayersMvp ||
    state.players.filter((player) => player?.isHuman).length !== 1
  ) {
    return false;
  }
  if (
    !Number.isInteger(state.currentPlayerIndex) ||
    state.currentPlayerIndex < 0 ||
    state.currentPlayerIndex >= state.players.length
  ) {
    return false;
  }
  if (
    !Number.isInteger(state.roundNumber) ||
    state.roundNumber < 1 ||
    !Number.isInteger(state.starterOffset)
  ) {
    return false;
  }
  if (
    !Array.isArray(state.stock) ||
    !state.stock.every(isCard) ||
    !Array.isArray(state.discardPile) ||
    !state.discardPile.every(isCard)
  ) {
    return false;
  }
  if (state.currentDrawn !== null && !isCard(state.currentDrawn)) return false;
  if (![null, "stock", "discard"].includes(state.currentDrawSource)) return false;
  if (
    state.phase === PHASES.humanAction &&
    (!state.currentDrawn || !["stock", "discard"].includes(state.currentDrawSource))
  ) {
    return false;
  }
  if (
    (state.phase === PHASES.roundOver || state.phase === PHASES.matchOver) &&
    !isValidRoundResult(state.roundResult)
  ) {
    return false;
  }
  if (!Array.isArray(state.events) || !state.events.every((event) => typeof event === "string")) {
    return false;
  }
  return state.players.every(isValidSavedPlayer);
}

function isValidSavedPlayer(player) {
  if (
    !player ||
    typeof player.id !== "string" ||
    typeof player.name !== "string" ||
    typeof player.isHuman !== "boolean" ||
    typeof player.active !== "boolean" ||
    !Number.isFinite(player.score) ||
    player.score < 0 ||
    !Array.isArray(player.hand) ||
    ![0, 3].includes(player.hand.length) ||
    !player.hand.every(isCard) ||
    !Array.isArray(player.known) ||
    player.known.length !== 3
  ) {
    return false;
  }
  return player.known.every((card) => card === null || isCard(card));
}

function isValidRoundResult(result) {
  return Boolean(
    result &&
      typeof result.success === "boolean" &&
      typeof result.stopperId === "string" &&
      typeof result.message === "string" &&
      Array.isArray(result.handScores) &&
      Array.isArray(result.deltas),
  );
}

function isCard(card) {
  return Boolean(
    card &&
      typeof card.id === "string" &&
      (CARD_RANKS.includes(card.rank) || card.rank === "JOKER") &&
      CARD_SUITS.includes(card.suit),
  );
}

function copyCards(cards) {
  return cards.map(copyCard);
}

function copyCard(card) {
  return card ? { ...card } : null;
}

function isBotDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("debugBots") || window.localStorage?.getItem("memoria.debugBots") === "1";
  } catch {
    return false;
  }
}

export { MATCH_STATE_VERSION, PHASES, handValue, cardValue };
