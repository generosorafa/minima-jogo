import { CARD_RANKS, CARD_SUITS } from "../config/constants.js";

let warnedMathRandom = false;

export function createDeck(deckCount = 1) {
  const deck = [];
  for (let deckIndex = 0; deckIndex < deckCount; deckIndex += 1) {
    for (const suit of CARD_SUITS) {
      for (const rank of CARD_RANKS) {
        deck.push({
          id: `${deckIndex}-${rank}-${suit}`,
          rank,
          suit,
          deckIndex,
        });
      }
    }
    deck.push({ id: `${deckIndex}-joker-red`, rank: "JOKER", suit: "H", deckIndex });
    deck.push({ id: `${deckIndex}-joker-black`, rank: "JOKER", suit: "S", deckIndex });
  }
  return deck;
}

export function shuffle(deck) {
  const cards = deck.slice();
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

export function draw(cards) {
  return cards.pop() ?? null;
}

function secureRandomInt(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const range = 0xffffffff;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      cryptoApi.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  if (!warnedMathRandom) {
    warnedMathRandom = true;
    console.warn("Crypto RNG indisponivel; usando Math.random como fallback.");
  }
  return Math.floor(Math.random() * maxExclusive);
}
