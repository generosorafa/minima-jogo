export const CARD_ART_WIDTH = 176;
export const CARD_ART_HEIGHT = 256;
export const CARD_ART_RATIO = CARD_ART_HEIGHT / CARD_ART_WIDTH;

const ATLAS_COLUMNS = 9;
const SUIT_INDEX = Object.freeze({ C: 0, D: 1, H: 2, S: 3 });
const RANK_INDEX = Object.freeze({
  A: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
});

export class CardArt {
  constructor(ImageClass = globalThis.Image) {
    this.faces = createImage(
      ImageClass,
      new URL("../../assets/cards/faces.webp", import.meta.url).href,
    );
    this.back = createImage(
      ImageClass,
      new URL("../../assets/cards/back.webp", import.meta.url).href,
    );
  }

  drawFace(ctx, card, x, y, width, height) {
    if (!isReady(this.faces)) return false;
    const index = cardAtlasIndex(card);
    if (index < 0) return false;
    const sourceX = (index % ATLAS_COLUMNS) * CARD_ART_WIDTH;
    const sourceY = Math.floor(index / ATLAS_COLUMNS) * CARD_ART_HEIGHT;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      this.faces,
      sourceX,
      sourceY,
      CARD_ART_WIDTH,
      CARD_ART_HEIGHT,
      x,
      y,
      width,
      height,
    );
    ctx.restore();
    return true;
  }

  drawBack(ctx, x, y, width, height) {
    if (!isReady(this.back)) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.back, x, y, width, height);
    ctx.restore();
    return true;
  }
}

export function cardAtlasIndex(card) {
  if (!card) return -1;
  if (card.rank === "JOKER") return card.suit === "H" ? 52 : 53;
  const suitIndex = SUIT_INDEX[card.suit];
  const rankIndex = RANK_INDEX[card.rank];
  if (!Number.isInteger(suitIndex) || !Number.isInteger(rankIndex)) return -1;
  return suitIndex * 13 + rankIndex;
}

function createImage(ImageClass, source) {
  if (typeof ImageClass !== "function") return null;
  const image = new ImageClass();
  image.decoding = "async";
  image.src = source;
  return image;
}

function isReady(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}
