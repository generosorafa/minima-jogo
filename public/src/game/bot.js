import { cardValue } from "../core/rules.js";

export function chooseBotMove(match, player) {
  const discardTop = match.peekDiscard();
  const profile = player.profile;
  const context = createDecisionContext(match, player, profile);
  const discardTarget = discardTop
    ? chooseTargetSlot(player, cardValue(discardTop), profile, context)
    : null;
  const shouldTakeDiscard = Boolean(discardTop && discardTarget);
  const source = shouldTakeDiscard ? "discard" : "stock";
  const drawnCard = source === "discard" ? match.takeDiscardForBot() : match.drawStockForBot();
  const drawnValue = cardValue(drawnCard);
  const targetSlot =
    source === "discard"
      ? discardTarget
      : chooseTargetSlot(player, drawnValue, profile, context);
  const action =
    targetSlot === null
      ? { type: "discard" }
      : { type: "swap", slotIndex: targetSlot.index };

  const expected = estimateHandAfterAction(player, drawnCard, action, profile);
  const stopDecision = decideStop(player, profile, context, expected, action);

  return {
    source,
    drawnCard,
    action,
    shouldStop: stopDecision.shouldStop,
    expected,
    debug: {
      player: player.name,
      profileStyle: profile.style,
      score: player.score,
      knownCount: context.knownCount,
      unknownCount: context.unknownCount,
      activeCount: context.activeCount,
      nearElimination: context.nearElimination,
      source,
      actionType: action.type,
      targetSlot: action.type === "swap" ? action.slotIndex : null,
      shouldStop: stopDecision.shouldStop,
      sourceReason: shouldTakeDiscard
        ? discardTarget.reason
        : "baralho fechado: morto nao melhora a mao",
      actionReason: targetSlot?.reason ?? "descartou: carta comprada nao melhora a mao",
      expected,
      riskAdjustedExpected: stopDecision.riskAdjustedExpected,
      stopLimit: stopDecision.stopLimit,
      stopReason: stopDecision.reason,
    },
  };
}

function createDecisionContext(match, player, profile) {
  const activeCount = Array.isArray(match.players)
    ? match.players.filter((candidate) => candidate.active).length
    : 1;
  const knownCount = player.known.filter(Boolean).length;
  const unknownCount = player.known.length - knownCount;
  return {
    activeCount,
    knownCount,
    unknownCount,
    nearElimination: player.score >= 40,
    desperate: player.score >= 45,
    effectiveLotteryAt: clamp(
      profile.lotteryAt +
        (player.score >= 40 ? profile.survivalLotteryBonus : 0),
      0,
      6,
    ),
  };
}

function chooseTargetSlot(player, drawnValue, profile, context) {
  const slots = player.known.map((knownCard, index) => ({
    index,
    value: knownCard ? cardValue(knownCard) : null,
    known: Boolean(knownCard),
  }));
  const highestKnown = slots
    .filter((slot) => slot.known)
    .reduce((best, slot) => (!best || slot.value > best.value ? slot : best), null);

  if (highestKnown && drawnValue < highestKnown.value) {
    return {
      index: highestKnown.index,
      reason: `troca carta conhecida ${highestKnown.value} por ${drawnValue}`,
    };
  }
  if (!player.known[1] && drawnValue <= context.effectiveLotteryAt) {
    return {
      index: 1,
      reason: `aposta no meio com ${drawnValue} (limite ${context.effectiveLotteryAt})`,
    };
  }
  return null;
}

function estimateHandAfterAction(player, drawnCard, action, profile) {
  const estimated = player.known.map((knownCard) =>
    knownCard ? cardValue(knownCard) : profile.unknownValue,
  );
  if (action.type === "swap") {
    estimated[action.slotIndex] = cardValue(drawnCard);
  }
  return estimated.reduce((sum, value) => sum + value, 0);
}

function decideStop(player, profile, context, expected, action) {
  const knownCountAfter =
    action.type === "swap" && !player.known[action.slotIndex]
      ? context.knownCount + 1
      : context.knownCount;
  const unknownCountAfter = player.known.length - knownCountAfter;
  const stopLimit =
    profile.stopAt +
    (context.activeCount <= 2 ? profile.duelStopBonus : 0) +
    (context.nearElimination ? Math.max(0, profile.survivalStopAt - profile.stopAt) : 0);
  const riskAdjustedExpected =
    expected + unknownCountAfter * profile.unknownRiskPenalty;
  const hasEnoughInformation =
    knownCountAfter >= profile.minKnownToStop || context.desperate || expected <= 2;

  if (!hasEnoughInformation) {
    return {
      shouldStop: false,
      riskAdjustedExpected,
      stopLimit,
      reason: `nao parou: so conhece ${knownCountAfter} carta(s)`,
    };
  }

  if (riskAdjustedExpected <= stopLimit) {
    return {
      shouldStop: true,
      riskAdjustedExpected,
      stopLimit,
      reason: context.nearElimination
        ? "parou por sobrevivencia perto de 50"
        : "parou com mao estimada baixa",
    };
  }

  return {
    shouldStop: false,
    riskAdjustedExpected,
    stopLimit,
    reason: `nao parou: risco ${riskAdjustedExpected.toFixed(1)} acima do limite ${stopLimit}`,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
