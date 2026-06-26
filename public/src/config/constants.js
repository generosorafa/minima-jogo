export const APP_VERSION = "0.9.2-beta.1";

export const GAME_CONFIG = Object.freeze({
  eliminationScore: 50,
  previewSeconds: 2,
  maxPlayersOneDeck: 6,
  minPlayers: 2,
  maxPlayersMvp: 6,
});

export const CARD_RANKS = Object.freeze([
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
]);

export const CARD_SUITS = Object.freeze(["S", "H", "D", "C"]);

export const SUIT_SYMBOLS = Object.freeze({
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
});

export const BOT_PROFILES = Object.freeze([
  {
    name: "Ana",
    style: "conservadora",
    stopAt: 4,
    survivalStopAt: 8,
    lotteryAt: 2,
    survivalLotteryBonus: 1,
    duelStopBonus: 1,
    unknownValue: 6,
    unknownRiskPenalty: 1.6,
    minKnownToStop: 3,
    aggression: 0.32,
  },
  {
    name: "Beto",
    style: "agressivo",
    stopAt: 7,
    survivalStopAt: 10,
    lotteryAt: 4,
    survivalLotteryBonus: 1,
    duelStopBonus: 2,
    unknownValue: 6,
    unknownRiskPenalty: 0.6,
    minKnownToStop: 2,
    aggression: 0.7,
  },
  {
    name: "Clara",
    style: "calculista",
    stopAt: 5,
    survivalStopAt: 9,
    lotteryAt: 2,
    survivalLotteryBonus: 2,
    duelStopBonus: 1,
    unknownValue: 6,
    unknownRiskPenalty: 1.1,
    minKnownToStop: 2,
    aggression: 0.42,
  },
  {
    name: "Davi",
    style: "arriscado",
    stopAt: 6,
    survivalStopAt: 9,
    lotteryAt: 5,
    survivalLotteryBonus: 1,
    duelStopBonus: 2,
    unknownValue: 6,
    unknownRiskPenalty: 0.6,
    minKnownToStop: 2,
    aggression: 0.82,
  },
  {
    name: "Eva",
    style: "sobrevivente",
    stopAt: 5,
    survivalStopAt: 10,
    lotteryAt: 2,
    survivalLotteryBonus: 2,
    duelStopBonus: 1,
    unknownValue: 6,
    unknownRiskPenalty: 1.2,
    minKnownToStop: 2,
    aggression: 0.56,
  },
]);
