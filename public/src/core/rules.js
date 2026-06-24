import { SUIT_SYMBOLS } from "../config/constants.js";

export function cardValue(card) {
  if (!card) return 0;
  if (card.rank === "JOKER" || card.rank === "J") return 0;
  if (card.rank === "A") return 1;
  if (card.rank === "Q" || card.rank === "K") return 10;
  return Number(card.rank);
}

export function formatCard(card) {
  if (!card) return "--";
  if (card.rank === "JOKER") return "Coringa";
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function shortCard(card) {
  if (!card) return "--";
  if (card.rank === "JOKER") return "JOK";
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function handValue(hand) {
  return hand.reduce((sum, card) => sum + cardValue(card), 0);
}

export function evaluateStopRound(players, stopperId) {
  const activePlayers = players.filter((player) => player.active);
  const handScores = new Map(
    activePlayers.map((player) => [player.id, handValue(player.hand)]),
  );
  const stopperScore = handScores.get(stopperId);
  const stopperFailed = activePlayers.some(
    (player) => player.id !== stopperId && handScores.get(player.id) <= stopperScore,
  );
  const deltas = new Map();

  if (stopperFailed) {
    const penalty = activePlayers.reduce(
      (sum, player) => sum + handScores.get(player.id),
      0,
    );
    activePlayers.forEach((player) => deltas.set(player.id, 0));
    deltas.set(stopperId, penalty);
    return {
      success: false,
      stopperScore,
      handScores,
      deltas,
      message: "Pedido falhou: alguem empatou ou fez menos pontos.",
    };
  }

  activePlayers.forEach((player) => {
    deltas.set(player.id, player.id === stopperId ? 0 : handScores.get(player.id));
  });

  return {
    success: true,
    stopperScore,
    handScores,
    deltas,
    message: "Pedido venceu: quem pediu fez a menor mao sozinho.",
  };
}
