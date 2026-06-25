import assert from "node:assert/strict";
import {
  CARD_ART_HEIGHT,
  CARD_ART_RATIO,
  CARD_ART_WIDTH,
  cardAtlasIndex,
} from "../public/src/rendering/cardArt.js";

assert.equal(CARD_ART_WIDTH, 176);
assert.equal(CARD_ART_HEIGHT, 256);
assert.equal(CARD_ART_RATIO, 256 / 176);

assert.equal(cardAtlasIndex({ rank: "A", suit: "C" }), 0);
assert.equal(cardAtlasIndex({ rank: "K", suit: "C" }), 12);
assert.equal(cardAtlasIndex({ rank: "A", suit: "D" }), 13);
assert.equal(cardAtlasIndex({ rank: "Q", suit: "H" }), 37);
assert.equal(cardAtlasIndex({ rank: "K", suit: "S" }), 51);
assert.equal(cardAtlasIndex({ rank: "JOKER", suit: "H" }), 52);
assert.equal(cardAtlasIndex({ rank: "JOKER", suit: "S" }), 53);
assert.equal(cardAtlasIndex(null), -1);
assert.equal(cardAtlasIndex({ rank: "X", suit: "S" }), -1);

console.log("cardArt.test.mjs: ok");
