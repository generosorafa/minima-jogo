import { BOT_PROFILES } from "../config/constants.js";
import { Match, PHASES } from "../game/match.js";

const DEFAULT_PLAYER_COUNTS = Object.freeze([2, 3, 4, 5, 6]);
const DEFAULT_LIMITS = Object.freeze({
  maxRoundsPerMatch: 300,
  maxTurnsPerRound: 600,
});

export function runBalanceSimulation({
  matchesPerPlayerCount = 1000,
  playerCounts = DEFAULT_PLAYER_COUNTS,
  seed = 20260625,
  limits = DEFAULT_LIMITS,
  profiles: profileDefinitions = BOT_PROFILES,
} = {}) {
  const startedAt = Date.now();
  const profiles = profileDefinitions.map((profile) => createProfileStats(profile));
  const byPlayerCount = [];
  const anomalies = [];
  let completedMatches = 0;
  let abortedMatches = 0;

  for (const playerCount of playerCounts) {
    const countStats = createCountStats(playerCount, profileDefinitions);
    for (let matchIndex = 0; matchIndex < matchesPerPlayerCount; matchIndex += 1) {
      const matchSeed = mixSeed(seed, playerCount, matchIndex);
      const result = simulateMatch({
        playerCount,
        matchIndex,
        seed: matchSeed,
        limits,
        profiles: profileDefinitions,
      });
      mergeMatchResult(countStats, profiles, result);
      if (result.aborted) {
        abortedMatches += 1;
        if (anomalies.length < 50) anomalies.push(result.anomaly);
      } else {
        completedMatches += 1;
      }
    }
    byPlayerCount.push(finalizeCountStats(countStats));
  }

  return {
    metadata: {
      seed,
      matchesPerPlayerCount,
      playerCounts: [...playerCounts],
      requestedMatches: matchesPerPlayerCount * playerCounts.length,
      completedMatches,
      abortedMatches,
      elapsedMs: Date.now() - startedAt,
      limits: { ...limits },
    },
    matchSummary: finalizeMatchSummary(byPlayerCount),
    byPlayerCount,
    profiles: profiles.map(finalizeProfileStats),
    anomalies,
  };
}

export function createSeededRandomInt(seed) {
  let state = normalizeSeed(seed);
  return (maxExclusive) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % maxExclusive;
  };
}

export function formatBalanceReport(report) {
  const lines = [
    "# Relatorio de balanceamento",
    "",
    `- Semente: \`${report.metadata.seed}\``,
    `- Partidas concluidas: ${report.metadata.completedMatches}/${report.metadata.requestedMatches}`,
    `- Partidas abortadas: ${report.metadata.abortedMatches}`,
    `- Rodadas medias: ${report.matchSummary.averageRounds.toFixed(2)}`,
    `- Turnos medios: ${report.matchSummary.averageTurns.toFixed(2)}`,
    `- Maior partida: ${report.matchSummary.maxRounds} rodadas, ${report.matchSummary.maxTurns} turnos`,
    "",
    "## Perfis",
    "",
    "| Perfil | Aparicoes | Vitorias | Indice de vitoria | Paradas | Acerto da parada | Mao media ao parar | Morto | Trocas |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.profiles.map((profile) =>
      [
        profile.name,
        profile.appearances,
        profile.wins,
        profile.winIndex.toFixed(2),
        profile.stops,
        formatPercent(profile.stopSuccessRate),
        profile.averageStopHand.toFixed(2),
        formatPercent(profile.discardDrawRate),
        formatPercent(profile.swapRate),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    ),
    "",
    "## Quantidade de jogadores",
    "",
    "| Jogadores | Partidas | Rodadas medias | Turnos medios | Max. rodadas | Abortadas |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.byPlayerCount.map((entry) =>
      `| ${entry.playerCount} | ${entry.completedMatches} | ${entry.averageRounds.toFixed(2)} | ${entry.averageTurns.toFixed(2)} | ${entry.maxRounds} | ${entry.abortedMatches} |`,
    ),
    "",
    "## Indice de vitoria por mesa",
    "",
    `| Perfil | ${report.byPlayerCount.map((entry) => `${entry.playerCount} jogadores`).join(" | ")} |`,
    `| --- | ${report.byPlayerCount.map(() => "---:").join(" | ")} |`,
    ...report.profiles.map((profile, profileIndex) =>
      `| ${profile.name} | ${report.byPlayerCount
        .map((entry) => entry.profiles[profileIndex].winIndex.toFixed(2))
        .join(" | ")} |`,
    ),
  ];

  if (report.anomalies.length > 0) {
    lines.push("", "## Anomalias", "");
    for (const anomaly of report.anomalies) {
      lines.push(
        `- ${anomaly.playerCount} jogadores, partida ${anomaly.matchIndex}, semente ${anomaly.seed}: ${anomaly.reason}`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function simulateMatch({ playerCount, matchIndex, seed, limits, profiles }) {
  const randomInt = createSeededRandomInt(seed);
  const match = new Match({ randomInt });
  match.startMatch(playerCount, "Simulador");
  const profileOrder = createProfileOrder(
    playerCount,
    matchIndex,
    seed,
    profiles.length,
  );
  const playerMetrics = new Map();

  match.players.forEach((player, seatIndex) => {
    const profileIndex = profileOrder[seatIndex];
    const profile = profiles[profileIndex];
    player.isHuman = false;
    player.profile = profile;
    player.name = profile.name;
    playerMetrics.set(player.id, createPlayerMatchStats(profileIndex, playerCount));
  });
  match.completePreview();

  let turns = 0;
  let rounds = 0;
  let turnsThisRound = 0;
  let maxTurnsInRound = 0;
  let recycledStocks = 0;

  while (match.phase !== PHASES.matchOver) {
    if (match.phase === PHASES.roundOver) {
      rounds += 1;
      collectRoundResult(match, playerMetrics);
      maxTurnsInRound = Math.max(maxTurnsInRound, turnsThisRound);
      if (rounds >= limits.maxRoundsPerMatch) {
        return createAbortedResult(
          "limite de rodadas excedido",
          playerCount,
          matchIndex,
          seed,
          rounds,
          turns,
          maxTurnsInRound,
          recycledStocks,
          playerMetrics,
        );
      }
      match.startRound(0);
      match.completePreview();
      turnsThisRound = 0;
      continue;
    }

    if (match.phase !== PHASES.botTurn) {
      return createAbortedResult(
        `fase inesperada: ${match.phase}`,
        playerCount,
        matchIndex,
        seed,
        rounds,
        turns,
        maxTurnsInRound,
        recycledStocks,
        playerMetrics,
      );
    }

    const actingPlayer = match.currentPlayer;
    const stockWasEmpty = match.stock.length === 0;
    match.runBotTurn();
    turns += 1;
    turnsThisRound += 1;
    collectTurn(match, actingPlayer, playerMetrics.get(actingPlayer.id));
    if (stockWasEmpty && match.lastBotDecision?.source === "stock") {
      recycledStocks += 1;
    }

    if (turnsThisRound >= limits.maxTurnsPerRound) {
      return createAbortedResult(
        "limite de turnos da rodada excedido",
        playerCount,
        matchIndex,
        seed,
        rounds,
        turns,
        Math.max(maxTurnsInRound, turnsThisRound),
        recycledStocks,
        playerMetrics,
      );
    }
  }

  rounds += 1;
  collectRoundResult(match, playerMetrics);
  maxTurnsInRound = Math.max(maxTurnsInRound, turnsThisRound);
  const winnerStats = playerMetrics.get(match.winner.id);
  winnerStats.wins += 1;

  for (const player of match.players) {
    const stats = playerMetrics.get(player.id);
    stats.finalScore += player.score;
    if (!player.active) stats.eliminations += 1;
  }

  return {
    aborted: false,
    playerCount,
    rounds,
    turns,
    maxTurnsInRound,
    recycledStocks,
    playerMetrics: [...playerMetrics.values()],
  };
}

function collectTurn(match, player, stats) {
  const decision = match.lastBotDecision;
  if (!decision) return;
  stats.turns += 1;
  if (decision.source === "discard") stats.discardDraws += 1;
  else stats.stockDraws += 1;
  if (decision.actionType === "swap") stats.swaps += 1;
  else stats.drawnDiscards += 1;
  if (decision.targetSlot === 1) stats.middleSwaps += 1;
  if (decision.shouldStop) stats.stops += 1;
}

function collectRoundResult(match, playerMetrics) {
  const result = match.roundResult;
  if (!result) return;
  const stopper = playerMetrics.get(result.stopperId);
  stopper.stopHandTotal += result.stopperScore;
  stopper.stopSuccesses += result.success ? 1 : 0;
  for (const player of match.players) {
    if (!result.handScores.has(player.id)) continue;
    const stats = playerMetrics.get(player.id);
    stats.rounds += 1;
    stats.handTotal += result.handScores.get(player.id);
    stats.pointsAdded += result.deltas.get(player.id) ?? 0;
  }
}

function createProfileOrder(playerCount, matchIndex, seed, profileCount) {
  const randomInt = createSeededRandomInt(mixSeed(seed, playerCount, matchIndex + 7919));
  const order = Array.from({ length: profileCount }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  while (order.length < playerCount) {
    order.push((matchIndex + order.length) % profileCount);
  }
  return order.slice(0, playerCount);
}

function createProfileStats(profile) {
  return {
    name: profile.name,
    style: profile.style,
    appearances: 0,
    expectedWins: 0,
    wins: 0,
    turns: 0,
    rounds: 0,
    stops: 0,
    stopSuccesses: 0,
    stopHandTotal: 0,
    stockDraws: 0,
    discardDraws: 0,
    swaps: 0,
    drawnDiscards: 0,
    middleSwaps: 0,
    handTotal: 0,
    pointsAdded: 0,
    finalScore: 0,
    eliminations: 0,
  };
}

function createPlayerMatchStats(profileIndex, playerCount) {
  return {
    profileIndex,
    appearances: 1,
    expectedWins: 1 / playerCount,
    wins: 0,
    turns: 0,
    rounds: 0,
    stops: 0,
    stopSuccesses: 0,
    stopHandTotal: 0,
    stockDraws: 0,
    discardDraws: 0,
    swaps: 0,
    drawnDiscards: 0,
    middleSwaps: 0,
    handTotal: 0,
    pointsAdded: 0,
    finalScore: 0,
    eliminations: 0,
  };
}

function createCountStats(playerCount, profiles) {
  return {
    playerCount,
    completedMatches: 0,
    abortedMatches: 0,
    totalRounds: 0,
    totalTurns: 0,
    maxRounds: 0,
    maxTurns: 0,
    maxTurnsInRound: 0,
    recycledStocks: 0,
    profiles: profiles.map((profile) => createProfileStats(profile)),
  };
}

function mergeMatchResult(countStats, profiles, result) {
  if (result.aborted) countStats.abortedMatches += 1;
  else countStats.completedMatches += 1;
  countStats.totalRounds += result.rounds;
  countStats.totalTurns += result.turns;
  countStats.maxRounds = Math.max(countStats.maxRounds, result.rounds);
  countStats.maxTurns = Math.max(countStats.maxTurns, result.turns);
  countStats.maxTurnsInRound = Math.max(
    countStats.maxTurnsInRound,
    result.maxTurnsInRound,
  );
  countStats.recycledStocks += result.recycledStocks;
  for (const playerStats of result.playerMetrics) {
    const profile = profiles[playerStats.profileIndex];
    const countProfile = countStats.profiles[playerStats.profileIndex];
    for (const key of Object.keys(playerStats)) {
      if (key === "profileIndex") continue;
      profile[key] += playerStats[key];
      countProfile[key] += playerStats[key];
    }
  }
}

function finalizeProfileStats(stats) {
  return {
    ...stats,
    winRate: divide(stats.wins, stats.appearances),
    winIndex: divide(stats.wins, stats.expectedWins),
    stopSuccessRate: divide(stats.stopSuccesses, stats.stops),
    averageStopHand: divide(stats.stopHandTotal, stats.stops),
    averageHand: divide(stats.handTotal, stats.rounds),
    averagePointsAdded: divide(stats.pointsAdded, stats.rounds),
    averageFinalScore: divide(stats.finalScore, stats.appearances),
    discardDrawRate: divide(stats.discardDraws, stats.turns),
    swapRate: divide(stats.swaps, stats.turns),
    middleSwapRate: divide(stats.middleSwaps, stats.swaps),
  };
}

function finalizeCountStats(stats) {
  return {
    ...stats,
    profiles: stats.profiles.map(finalizeProfileStats),
    averageRounds: divide(stats.totalRounds, stats.completedMatches),
    averageTurns: divide(stats.totalTurns, stats.completedMatches),
  };
}

function finalizeMatchSummary(byPlayerCount) {
  const completedMatches = byPlayerCount.reduce(
    (sum, entry) => sum + entry.completedMatches,
    0,
  );
  const totalRounds = byPlayerCount.reduce((sum, entry) => sum + entry.totalRounds, 0);
  const totalTurns = byPlayerCount.reduce((sum, entry) => sum + entry.totalTurns, 0);
  return {
    averageRounds: divide(totalRounds, completedMatches),
    averageTurns: divide(totalTurns, completedMatches),
    maxRounds: Math.max(...byPlayerCount.map((entry) => entry.maxRounds)),
    maxTurns: Math.max(...byPlayerCount.map((entry) => entry.maxTurns)),
    maxTurnsInRound: Math.max(
      ...byPlayerCount.map((entry) => entry.maxTurnsInRound),
    ),
    recycledStocks: byPlayerCount.reduce(
      (sum, entry) => sum + entry.recycledStocks,
      0,
    ),
  };
}

function createAbortedResult(
  reason,
  playerCount,
  matchIndex,
  seed,
  rounds,
  turns,
  maxTurnsInRound,
  recycledStocks,
  playerMetrics,
) {
  return {
    aborted: true,
    anomaly: { reason, playerCount, matchIndex, seed },
    playerCount,
    rounds,
    turns,
    maxTurnsInRound,
    recycledStocks,
    playerMetrics: [...playerMetrics.values()],
  };
}

function mixSeed(seed, playerCount, matchIndex) {
  let value = normalizeSeed(seed);
  value ^= Math.imul(playerCount + 1, 0x9e3779b1);
  value ^= Math.imul(matchIndex + 1, 0x85ebca6b);
  value ^= value >>> 16;
  return value >>> 0;
}

function normalizeSeed(seed) {
  const numeric = Number(seed);
  return (Number.isFinite(numeric) ? numeric : 1) >>> 0 || 1;
}

function divide(value, divisor) {
  return divisor > 0 ? value / divisor : 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
