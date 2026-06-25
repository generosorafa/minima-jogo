import { cardValue, shortCard } from "../core/rules.js";
import { CardArt, CARD_ART_RATIO } from "./cardArt.js";

const CARD_RATIO = CARD_ART_RATIO;
const DRAW_TRAVEL_MS = 560;
const SWAP_TRAVEL_MS = 760;
const DISCARD_TRAVEL_MS = 560;
const ROUND_REVEAL_ACTION_BUFFER_MS = Math.max(DRAW_TRAVEL_MS, SWAP_TRAVEL_MS, DISCARD_TRAVEL_MS);
const REVEAL_FLIP_MS = 320;
const REVEAL_STAGGER_MS = 115;
const REVEAL_PLAYER_STAGGER_MS = 70;
const ROUND_REVEAL_SCORE_HOLD_MS = 3200;
const ACTION_FEEDBACK_MS = 980;

export class TableRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hitRegions = [];
    this.cardArt = new CardArt();
  }

  render(state, now = performance.now()) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(260, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.hitRegions = [];
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    this.drawBackground(ctx, rect.width, rect.height);
    if (state.phase !== "idle") {
      this.drawCenter(ctx, state, rect.width, rect.height, now);
      this.drawPlayers(ctx, state, rect.width, rect.height, now);
      this.drawTravelAnimation(ctx, state, rect.width, rect.height, now);
      this.drawActionFeedback(ctx, state, rect.width, rect.height, now);
    }
    ctx.restore();
  }

  drawBackground(ctx, width, height) {
    const playRight = playableRight(width);
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createRadialGradient(
      playRight * 0.52,
      height * 0.44,
      playRight * 0.12,
      playRight * 0.5,
      height * 0.5,
      playRight * 0.74,
    );
    bg.addColorStop(0, "#1e7a59");
    bg.addColorStop(0.58, "#0d4337");
    bg.addColorStop(1, "#061714");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const tableX = playRight * 0.055;
    const tableY = height * 0.09;
    const tableW = playRight * 0.89;
    const tableH = height * 0.78;
    const radius = Math.min(86, tableH * 0.22);

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    roundedRect(ctx, tableX, tableY, tableW, tableH, radius);
    ctx.fillStyle = "rgba(9, 28, 23, 0.42)";
    ctx.fill();
    ctx.restore();

    const rail = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY + tableH);
    rail.addColorStop(0, "#8a5429");
    rail.addColorStop(0.45, "#d09a52");
    rail.addColorStop(1, "#6e3c20");
    ctx.lineWidth = Math.max(14, Math.min(26, playRight * 0.018));
    ctx.strokeStyle = rail;
    roundedRect(ctx, tableX, tableY, tableW, tableH, radius);
    ctx.stroke();

    const feltInset = ctx.lineWidth * 0.62;
    const feltX = tableX + feltInset;
    const feltY = tableY + feltInset;
    const feltW = tableW - feltInset * 2;
    const feltH = tableH - feltInset * 2;

    ctx.save();
    roundedRect(ctx, feltX, feltY, feltW, feltH, Math.max(18, radius - feltInset));
    ctx.clip();
    const felt = ctx.createRadialGradient(
      feltX + feltW * 0.52,
      feltY + feltH * 0.48,
      feltW * 0.1,
      feltX + feltW * 0.5,
      feltY + feltH * 0.5,
      feltW * 0.72,
    );
    felt.addColorStop(0, "#207a58");
    felt.addColorStop(0.62, "#11543f");
    felt.addColorStop(1, "#0a2d27");
    ctx.fillStyle = felt;
    ctx.fillRect(feltX, feltY, feltW, feltH);

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#d8c586";
    ctx.lineWidth = 1;
    const spacing = 34;
    for (let x = -height; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#f4efe3";
    for (let dot = 0; dot < 220; dot += 1) {
      const px = feltX + ((dot * 73) % Math.max(1, feltW));
      const py = feltY + ((dot * 41) % Math.max(1, feltH));
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(3, 10, 10, 0.2)";
    ctx.fillRect(0, height * 0.84, width, height * 0.16);

    ctx.strokeStyle = "rgba(244, 239, 227, 0.12)";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, feltX + 16, feltY + 16, feltW - 32, feltH - 32, Math.max(16, radius - feltInset - 16));
    ctx.stroke();
  }

  drawCenter(ctx, state, width, height, now) {
    const { centerX, cardW, cardH, y, stockX, discardX } = centerLayout(width, height);
    const canDraw = state.phase === "humanTurn";
    if (canDraw) {
      const pulse = wave(now, 620);
      drawTargetGlow(ctx, stockX, y, cardW, cardH, pulse);
      if (state.discardTop) drawTargetGlow(ctx, discardX, y, cardW, cardH, pulse);
    }
    this.drawCardBack(ctx, stockX, y, cardW, cardH, `${state.stockCount}`, canDraw);
    this.drawCardFace(ctx, discardX, y, cardW, cardH, state.discardTop, true, canDraw);
    this.addRegion("stock", stockX, y, cardW, cardH, state.phase === "humanTurn");
    this.addRegion(
      "discard",
      discardX,
      y,
      cardW,
      cardH,
      state.phase === "humanTurn" && Boolean(state.discardTop),
    );
    drawLabel(ctx, "Baralho", stockX + cardW / 2, y + cardH + 22);
    drawLabel(ctx, `Morto ${state.discardCount}`, discardX + cardW / 2, y + cardH + 22);
    if (canDraw) {
      drawTapBadge(ctx, "Comprar", stockX + cardW / 2, y - 15);
      if (state.discardTop) drawTapBadge(ctx, "Pegar", discardX + cardW / 2, y - 15);
    }

    if (state.currentDrawn && !shouldHideCurrentDrawn(state, now)) {
      const drawn = centerLayout(width, height).drawnRect;
      drawCurrentDrawnGlow(ctx, drawn.x, drawn.y, drawn.w, drawn.h, wave(now, 720));
      this.drawCardFace(ctx, drawn.x, drawn.y, drawn.w, drawn.h, state.currentDrawn, true, true);
      drawTapBadge(ctx, "Comprada", drawn.x + drawn.w / 2, drawn.y - 12);
    }
  }

  drawPlayers(ctx, state, width, height, now) {
    const activePlayers = state.players;
    const positions = playerPositions(activePlayers.length, width, height);
    for (let index = 0; index < activePlayers.length; index += 1) {
      this.drawPlayer(ctx, activePlayers[index], positions[index], state, now, index);
    }
  }

  drawPlayer(ctx, player, pos, state, now, playerIndex) {
    const cardW = pos.cardW;
    const cardH = cardW * CARD_RATIO;
    const totalW = cardW * 3 + pos.gap * 2;
    const startX = pos.x - totalW / 2;
    const y = pos.y;
    const isCurrent = player.id === state.currentPlayerId;
    const isPreview = state.phase === "preview" && player.isHuman;
    const revealAll = state.phase === "roundOver" || state.phase === "matchOver";

    ctx.save();
    if (isCurrent && player.active) {
      const turnPulse = wave(now, 860);
      ctx.globalAlpha = 0.78 + turnPulse * 0.2;
      ctx.shadowColor = "rgba(215, 179, 90, 0.42)";
      ctx.shadowBlur = 8 + turnPulse * 10;
      ctx.strokeStyle = "#d7b35a";
      ctx.lineWidth = 3;
      roundedRect(ctx, startX - 14, y - 36, totalW + 28, cardH + 74, 14);
      ctx.stroke();
    }

    drawNamePlate(ctx, player, pos.x, y - 16, isCurrent, displayScoreForPlayer(player, state, now));

    for (let slot = 0; slot < 3; slot += 1) {
      const x = startX + slot * (cardW + pos.gap);
      const card = player.hand[slot];
      if (shouldHideSwapTarget(state, now, player.id, slot)) {
        drawSlotPlaceholder(ctx, x, y, cardW, cardH);
      } else if (revealAll) {
        const progress = revealProgressForSlot(state, now, playerIndex, slot);
        if (progress <= 0) {
          this.drawCardBack(ctx, x, y, cardW, cardH, slot === 1 ? "?" : "");
        } else if (progress < 1) {
          this.drawRevealingCard(ctx, x, y, cardW, cardH, card, progress, slot === 1 ? "?" : "", player.isHuman);
        } else {
          this.drawCardFace(ctx, x, y, cardW, cardH, card, true);
        }
      } else if (isPreview && (slot === 0 || slot === 2)) {
        this.drawCardFace(ctx, x, y, cardW, cardH, card, player.isHuman);
      } else {
        this.drawCardBack(ctx, x, y, cardW, cardH, slot === 1 ? "?" : "");
      }
      if (player.isHuman && state.phase === "humanAction") {
        const pulse = wave(now + slot * 90, 560);
        ctx.save();
        ctx.globalAlpha = 0.68 + pulse * 0.28;
        ctx.shadowColor = "rgba(215, 179, 90, 0.65)";
        ctx.shadowBlur = 14 + pulse * 9;
        ctx.strokeStyle = "rgba(255, 220, 130, 0.98)";
        ctx.lineWidth = 2;
        roundedRect(ctx, x - 7 - pulse * 2, y - 7 - pulse * 2, cardW + 14 + pulse * 4, cardH + 14 + pulse * 4, 12);
        ctx.stroke();
        ctx.restore();
        drawTapBadge(ctx, "Trocar", x + cardW / 2, y - 10);
      }
      if (player.isHuman) {
        this.addRegion("hand-slot", x, y, cardW, cardH, state.phase === "humanAction", {
          slotIndex: slot,
        });
      }
    }

    if (!player.active && !revealAll) {
      ctx.fillStyle = "rgba(8, 16, 16, 0.68)";
      roundedRect(ctx, startX - 8, y - 30, totalW + 16, cardH + 60, 12);
      ctx.fill();
      ctx.fillStyle = "#f4efe3";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Fora", pos.x, y + cardH * 0.54);
    }
    ctx.restore();
  }

  drawTravelAnimation(ctx, state, width, height, now) {
    const action = state.lastAction;
    if (!action?.card) return;
    const age = now - action.at;
    if (age < 0) return;

    if (action.type === "draw-stock" || action.type === "draw-discard") {
      if (age > DRAW_TRAVEL_MS) return;
      const center = centerLayout(width, height);
      const from = action.type === "draw-stock" ? center.stockRect : center.discardRect;
      const to = center.drawnRect;
      this.drawFlyingCard(ctx, action.card, from, to, age / DRAW_TRAVEL_MS);
      return;
    }

    if (action.type === "discard") {
      if (age > DISCARD_TRAVEL_MS) return;
      const center = centerLayout(width, height);
      const from = action.source === "drawn" ? center.drawnRect : sourceRect(action.source, center);
      this.drawFlyingCard(ctx, action.card, from, center.discardRect, age / DISCARD_TRAVEL_MS);
      return;
    }

    if (action.type === "swap") {
      if (age > SWAP_TRAVEL_MS) return;
      const center = centerLayout(width, height);
      const slot = playerSlotRect(state, action.playerId, action.slotIndex, width, height);
      if (!slot) return;
      const drawnFrom = action.fromDrawnArea ? center.drawnRect : sourceRect(action.source, center);
      const inProgress = segmentProgress(age, 0, SWAP_TRAVEL_MS * 0.72);
      this.drawFlyingCard(
        ctx,
        action.card,
        drawnFrom,
        slot,
        inProgress,
        shouldRevealFlyingCard(action, "incoming"),
      );

      if (action.replacedCard) {
        const outProgress = segmentProgress(age, SWAP_TRAVEL_MS * 0.22, SWAP_TRAVEL_MS);
        this.drawFlyingCard(
          ctx,
          action.replacedCard,
          slot,
          center.discardRect,
          outProgress,
          shouldRevealFlyingCard(action, "outgoing"),
        );
      }
    }
  }

  drawFlyingCard(ctx, card, from, to, rawProgress, faceUp = true) {
    const progress = easeOutCubic(clamp(rawProgress, 0, 1));
    const x = lerp(from.x, to.x, progress);
    const y = lerp(from.y, to.y, progress) - Math.sin(progress * Math.PI) * 28;
    const w = lerp(from.w, to.w, progress);
    const h = w * CARD_RATIO;
    const tilt = Math.sin(progress * Math.PI) * 0.08;
    const scale = 1 + Math.sin(progress * Math.PI) * 0.08;

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);
    if (faceUp) {
      this.drawCardFace(ctx, -w / 2, -h / 2, w, h, card, true, true);
    } else {
      this.drawCardBack(ctx, -w / 2, -h / 2, w, h, "", true);
    }
    ctx.restore();
  }

  drawRevealingCard(ctx, x, y, w, h, card, rawProgress, backTag, highContrast) {
    const progress = clamp(rawProgress, 0, 1);
    const faceVisible = progress >= 0.5;
    const fold = Math.max(0.08, Math.abs(Math.cos(progress * Math.PI)));
    const glow = Math.sin(progress * Math.PI);

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(fold, 1);
    ctx.shadowColor = "rgba(255, 218, 118, 0.42)";
    ctx.shadowBlur = 12 + glow * 10;
    if (faceVisible) {
      this.drawCardFace(ctx, -w / 2, -h / 2, w, h, card, highContrast, true);
    } else {
      this.drawCardBack(ctx, -w / 2, -h / 2, w, h, backTag, true);
    }
    ctx.restore();
  }

  drawActionFeedback(ctx, state, width, height, now) {
    const action = state.lastAction;
    if (!action) return;
    const age = now - action.at;
    const duration = ACTION_FEEDBACK_MS;
    if (age < 0 || age > duration) return;

    const progress = age / duration;
    const alpha = 1 - progress;
    const point = actionPoint(action, state, width, height);
    if (!point) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    drawPulseRing(ctx, point.x, point.y, point.radius, progress);
    drawFloatingLabel(ctx, action.label, point.x, point.y - point.radius - 18 - progress * 18);
    ctx.restore();
  }

  getHitRegion(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let index = this.hitRegions.length - 1; index >= 0; index -= 1) {
      const region = this.hitRegions[index];
      if (
        x >= region.x &&
        x <= region.x + region.width &&
        y >= region.y &&
        y <= region.y + region.height
      ) {
        return region;
      }
    }
    return null;
  }

  addRegion(type, x, y, width, height, enabled, data = {}) {
    this.hitRegions.push({ type, x, y, width, height, enabled, ...data });
  }

  drawCardBack(ctx, x, y, w, h, tag = "", active = false) {
    drawCardShadow(ctx, x, y, w, h, active);
    if (this.cardArt.drawBack(ctx, x, y, w, h)) {
      drawArtCardBorder(ctx, x, y, w, h);
      drawBackTag(ctx, tag || "M", x + w / 2, y + h / 2, w);
      return;
    }
    roundedRect(ctx, x, y, w, h, 8);
    const back = ctx.createLinearGradient(x, y, x + w, y + h);
    back.addColorStop(0, "#bd3444");
    back.addColorStop(0.52, "#8e2534");
    back.addColorStop(1, "#5d1724");
    ctx.fillStyle = "#efe0bd";
    ctx.fill();
    roundedRect(ctx, x + 2, y + 2, w - 4, h - 4, 7);
    ctx.fillStyle = back;
    ctx.fill();

    ctx.save();
    roundedRect(ctx, x + 5, y + 5, w - 10, h - 10, 5);
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 236, 190, 0.22)";
    ctx.lineWidth = 1;
    for (let offset = -h; offset < w + h; offset += Math.max(12, w * 0.24)) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + h);
      ctx.lineTo(x + offset + h, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset + h, y + h);
      ctx.stroke();
    }
    ctx.restore();

    roundedRect(ctx, x + 7, y + 7, w - 14, h - 14, 5);
    ctx.strokeStyle = "rgba(255, 236, 190, 0.5)";
    ctx.lineWidth = Math.max(1, w * 0.025);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * 0.26, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 236, 190, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 236, 190, 0.38)";
    ctx.stroke();

    ctx.fillStyle = "#ffe5b0";
    ctx.font = `900 ${clamp(w * 0.22, 9, 16)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag || "M", x + w / 2, y + h / 2);
  }

  drawCardFace(ctx, x, y, w, h, card, highContrast, active = false) {
    drawCardShadow(ctx, x, y, w, h, active);
    if (this.cardArt.drawFace(ctx, card, x, y, w, h)) {
      drawArtCardBorder(ctx, x, y, w, h);
      drawPointBadge(ctx, card, x, y, w, h, highContrast);
      return;
    }
    roundedRect(ctx, x, y, w, h, 8);
    const front = ctx.createLinearGradient(x, y, x + w, y + h);
    front.addColorStop(0, "#fff7e7");
    front.addColorStop(0.62, "#f4e3c3");
    front.addColorStop(1, "#e8d3ad");
    ctx.fillStyle = front;
    ctx.fill();
    ctx.strokeStyle = "#4f3b26";
    ctx.lineWidth = Math.max(1.4, w * 0.028);
    ctx.stroke();

    const red = isRedCard(card);
    const color = red ? "#ba2f39" : "#121819";
    if (w < 38) {
      ctx.fillStyle = color;
      ctx.font = `900 ${clamp(w * 0.34, 9, 13)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shortCard(card), x + w / 2, y + h * 0.43);
      ctx.font = `800 ${clamp(w * 0.18, 7, 10)}px Inter, sans-serif`;
      ctx.fillText(`${cardValue(card)}`, x + w / 2, y + h * 0.68);
      return;
    }

    drawCardCorner(ctx, card, x + w * 0.16, y + h * 0.18, w, color, false);
    drawCardCorner(ctx, card, x + w * 0.84, y + h * 0.82, w, color, true);

    ctx.save();
    ctx.globalAlpha = highContrast ? 0.16 : 0.11;
    ctx.fillStyle = color;
    ctx.font = `900 ${clamp(w * 0.56, 18, 40)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(suitSymbol(card), x + w / 2, y + h * 0.47);
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = `900 ${clamp(w * 0.28, 12, 23)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rankText(card), x + w / 2, y + h * 0.42);

    ctx.font = `900 ${clamp(w * 0.17, 8, 12)}px Inter, sans-serif`;
    const valueText = `${cardValue(card)} pts`;
    const capsuleW = Math.max(w * 0.54, ctx.measureText(valueText).width + 10);
    roundedRect(ctx, x + w / 2 - capsuleW / 2, y + h * 0.64, capsuleW, h * 0.16, 999);
    ctx.fillStyle = "rgba(78, 59, 36, 0.12)";
    ctx.fill();
    ctx.fillStyle = highContrast ? "#4b351b" : "#6a5943";
    ctx.fillText(valueText, x + w / 2, y + h * 0.72);
  }
}

function centerLayout(width, height) {
  const centerX = playableRight(width) * 0.5;
  const isNarrow = width < 560;
  const isTallMobile = isNarrow && height / width >= 1.9;
  const cardW = clamp(width * 0.062, 48, 68);
  const cardH = cardW * CARD_RATIO;
  const y = height * (isTallMobile ? 0.45 : 0.46) - cardH / 2;
  const stockX = centerX - cardW - 18;
  const discardX = centerX + 18;
  const humanCardW = isNarrow ? clamp(width * 0.14, 52, 70) : clamp(width * 0.064, 56, 78);
  const humanY =
    height - humanCardW * CARD_RATIO - (isTallMobile ? 195 : isNarrow ? 180 : 58);
  const mobileDrawnMinY = y + cardH + 22;
  const mobileDrawnMaxY = humanY - cardH - 42;
  const mobileDrawnPreferredY = humanY - cardH - 56;
  const drawnY = isNarrow
    ? mobileDrawnMaxY <= mobileDrawnMinY
      ? Math.max(8, mobileDrawnMaxY)
      : clamp(mobileDrawnPreferredY, mobileDrawnMinY, mobileDrawnMaxY)
    : y - cardH - 24;
  return {
    centerX,
    cardW,
    cardH,
    y,
    stockX,
    discardX,
    stockRect: { x: stockX, y, w: cardW, h: cardH },
    discardRect: { x: discardX, y, w: cardW, h: cardH },
    drawnRect: { x: centerX - cardW / 2, y: drawnY, w: cardW, h: cardH },
  };
}

function sourceRect(source, center) {
  if (source === "discard") return center.discardRect;
  if (source === "drawn") return center.drawnRect;
  return center.stockRect;
}

function playerSlotRect(state, playerId, slotIndex, width, height) {
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) return null;
  const pos = playerPositions(state.players.length, width, height)[playerIndex];
  const cardW = pos.cardW;
  const cardH = cardW * CARD_RATIO;
  const totalW = cardW * 3 + pos.gap * 2;
  return {
    x: pos.x - totalW / 2 + slotIndex * (cardW + pos.gap),
    y: pos.y,
    w: cardW,
    h: cardH,
  };
}

function shouldHideCurrentDrawn(state, now) {
  const action = state.lastAction;
  if (!action) return false;
  const age = now - action.at;
  return (action.type === "draw-stock" || action.type === "draw-discard") && age < DRAW_TRAVEL_MS;
}

function shouldHideSwapTarget(state, now, playerId, slotIndex) {
  const action = state.lastAction;
  if (!action || action.type !== "swap") return false;
  const age = now - action.at;
  return action.playerId === playerId && action.slotIndex === slotIndex && age < SWAP_TRAVEL_MS * 0.72;
}

function revealProgressForSlot(state, now, playerIndex, slotIndex) {
  const startedAt = roundRevealStartedAt(state);
  if (startedAt === null) return 1;
  const delay = playerIndex * REVEAL_PLAYER_STAGGER_MS + slotIndex * REVEAL_STAGGER_MS;
  const age = now - startedAt - delay;
  if (age <= 0) return 0;
  if (age >= REVEAL_FLIP_MS) return 1;
  return easeInOutSine(age / REVEAL_FLIP_MS);
}

function roundRevealStartedAt(state) {
  if (state.phase !== "roundOver" && state.phase !== "matchOver") return null;
  if (!state.roundEndedAt) return null;
  const lastActionAt = state.lastAction?.at ?? 0;
  return Math.max(state.roundEndedAt, lastActionAt + ROUND_REVEAL_ACTION_BUFFER_MS);
}

function displayScoreForPlayer(player, state, now) {
  const revealStartedAt = roundRevealStartedAt(state);
  if (state.roundResult && revealStartedAt !== null && now - revealStartedAt < ROUND_REVEAL_SCORE_HOLD_MS) {
    return Math.max(0, player.score - (player.lastDelta ?? 0));
  }
  return player.score;
}

function actionPoint(action, state, width, height) {
  const center = centerLayout(width, height);
  if (action.type === "draw-stock") {
    return {
      x: center.stockX + center.cardW / 2,
      y: center.y + center.cardH / 2,
      radius: center.cardW * 0.64,
    };
  }
  if (action.type === "draw-discard" || action.type === "discard") {
    return {
      x: center.discardX + center.cardW / 2,
      y: center.y + center.cardH / 2,
      radius: center.cardW * 0.64,
    };
  }
  if (action.type === "swap") {
    const playerIndex = state.players.findIndex((player) => player.id === action.playerId);
    if (playerIndex < 0) return null;
    const pos = playerPositions(state.players.length, width, height)[playerIndex];
    const cardW = pos.cardW;
    const cardH = cardW * CARD_RATIO;
    const totalW = cardW * 3 + pos.gap * 2;
    const x = pos.x - totalW / 2 + action.slotIndex * (cardW + pos.gap) + cardW / 2;
    return {
      x,
      y: pos.y + cardH / 2,
      radius: cardW * 0.7,
    };
  }
  if (action.type === "stop") {
    const playerIndex = state.players.findIndex((player) => player.id === action.playerId);
    const pos = playerPositions(state.players.length, width, height)[Math.max(0, playerIndex)];
    return { x: pos.x, y: pos.y - 24, radius: pos.cardW * 0.8 };
  }
  return null;
}

function playerPositions(count, width, height) {
  const playRight = playableRight(width);
  const centerX = playRight * 0.5;
  const isNarrow = width < 560;
  const isTallMobile = isNarrow && height / width >= 1.9;
  const cardW = isNarrow ? clamp(width * 0.075, 30, 42) : clamp(width * 0.052, 42, 62);
  const humanCardW = isNarrow ? clamp(width * 0.14, 52, 70) : clamp(width * 0.064, 56, 78);
  const humanBottomMargin = isTallMobile ? 195 : isNarrow ? 180 : 92;
  const positions = [
    { x: centerX, y: height - humanCardW * CARD_RATIO - humanBottomMargin, cardW: humanCardW, gap: isNarrow ? 7 : 9 },
  ];
  const botCount = count - 1;
  const topSlots = Math.min(botCount, 3);
  for (let index = 0; index < topSlots; index += 1) {
    const spreadStart = isNarrow ? 0.18 : 0.25;
    const spread = isNarrow ? 0.64 : 0.5;
    const x = playRight * (spreadStart + (index * spread) / Math.max(1, topSlots - 1));
    positions.push({
      x,
      y: isTallMobile ? 104 : isNarrow ? 76 : 58,
      cardW,
      gap: isNarrow ? 4 : 7,
    });
  }
  if (botCount >= 4) {
    positions.push({ x: 94, y: height * 0.5 - cardW * CARD_RATIO / 2, cardW, gap: 8 });
  }
  if (botCount >= 5) {
    positions.push({
      x: playRight - 94,
      y: height * 0.5 - cardW * CARD_RATIO / 2,
      cardW,
      gap: 8,
    });
  }
  return positions;
}

function drawNamePlate(ctx, player, x, y, isCurrent, displayScore = player.score) {
  const text = `${player.name}  ${displayScore}/50`;
  ctx.font = "900 14px Inter, sans-serif";
  const width = Math.max(92, ctx.measureText(text).width + 20);
  roundedRect(ctx, x - width / 2, y - 25, width, 24, 8);
  ctx.fillStyle = isCurrent ? "#d7b35a" : "rgba(5, 13, 13, 0.78)";
  ctx.fill();
  ctx.fillStyle = isCurrent ? "#151b1c" : "#f4efe3";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 13);
}

function drawCardCorner(ctx, card, x, y, w, color, inverted) {
  ctx.save();
  ctx.translate(x, y);
  if (inverted) ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${clamp(w * 0.18, 8, 13)}px Inter, sans-serif`;
  ctx.fillText(rankText(card), 0, -w * 0.06);
  ctx.font = `900 ${clamp(w * 0.16, 7, 12)}px Inter, sans-serif`;
  ctx.fillText(suitSymbol(card), 0, w * 0.12);
  ctx.restore();
}

function rankText(card) {
  if (!card) return "--";
  if (card.rank === "JOKER") return "JOK";
  return card.rank;
}

function suitSymbol(card) {
  if (!card) return "";
  if (card.rank === "JOKER") return "★";
  return {
    S: "♠",
    H: "♥",
    D: "♦",
    C: "♣",
  }[card.suit] ?? "";
}

function isRedCard(card) {
  return card?.suit === "H" || card?.suit === "D";
}

function drawCardShadow(ctx, x, y, w, h, active) {
  ctx.save();
  ctx.shadowColor = active ? "rgba(255, 218, 118, 0.42)" : "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = active ? 18 : 10;
  ctx.shadowOffsetY = active ? 0 : 5;
  roundedRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fill();
  ctx.restore();
}

function drawArtCardBorder(ctx, x, y, w, h) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, Math.max(5, w * 0.07));
  ctx.strokeStyle = "rgba(14, 22, 23, 0.62)";
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.stroke();
  ctx.restore();
}

function drawBackTag(ctx, text, x, y, w) {
  const radius = clamp(w * 0.2, 9, 16);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(6, 18, 22, 0.82)";
  ctx.fill();
  ctx.strokeStyle = "rgba(239, 197, 103, 0.84)";
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.stroke();
  ctx.fillStyle = "#f6dfa3";
  ctx.font = `900 ${clamp(w * 0.2, 9, 15)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPointBadge(ctx, card, x, y, w, h, highContrast) {
  const valueText = `${cardValue(card)} pts`;
  ctx.save();
  ctx.font = `900 ${clamp(w * 0.16, 7, 12)}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const badgeWidth = Math.max(w * 0.46, ctx.measureText(valueText).width + 8);
  const badgeHeight = clamp(h * 0.13, 13, 22);
  const badgeY = y + h * 0.73;
  roundedRect(
    ctx,
    x + w / 2 - badgeWidth / 2,
    badgeY,
    badgeWidth,
    badgeHeight,
    999,
  );
  ctx.fillStyle = highContrast
    ? "rgba(255, 248, 230, 0.9)"
    : "rgba(255, 248, 230, 0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(45, 35, 26, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#33271d";
  ctx.fillText(valueText, x + w / 2, badgeY + badgeHeight / 2);
  ctx.restore();
}

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = "rgba(244, 239, 227, 0.82)";
  ctx.font = "800 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawSmallValue(ctx, text, x, y) {
  ctx.fillStyle = "#0f1718";
  ctx.font = "900 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawSlotPlaceholder(ctx, x, y, w, h) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = "rgba(6, 18, 16, 0.3)";
  ctx.fill();
  ctx.strokeStyle = "rgba(215, 179, 90, 0.42)";
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTargetGlow(ctx, x, y, w, h, pulse) {
  ctx.save();
  ctx.globalAlpha = 0.2 + pulse * 0.18;
  ctx.shadowColor = "rgba(255, 216, 112, 0.7)";
  ctx.shadowBlur = 18 + pulse * 12;
  ctx.strokeStyle = "rgba(255, 218, 118, 0.9)";
  ctx.lineWidth = 2;
  roundedRect(ctx, x - 8 - pulse * 3, y - 8 - pulse * 3, w + 16 + pulse * 6, h + 16 + pulse * 6, 12);
  ctx.stroke();
  ctx.restore();
}

function drawCurrentDrawnGlow(ctx, x, y, w, h, pulse) {
  ctx.save();
  ctx.globalAlpha = 0.24 + pulse * 0.14;
  ctx.shadowColor = "rgba(255, 218, 118, 0.72)";
  ctx.shadowBlur = 24 + pulse * 10;
  ctx.fillStyle = "rgba(215, 179, 90, 0.14)";
  roundedRect(ctx, x - 12, y - 12, w + 24, h + 24, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 218, 118, 0.52)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTapBadge(ctx, text, x, y) {
  ctx.save();
  ctx.font = "900 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.max(58, ctx.measureText(text).width + 18);
  roundedRect(ctx, x - width / 2, y - 10, width, 20, 10);
  ctx.fillStyle = "rgba(215, 179, 90, 0.92)";
  ctx.fill();
  ctx.fillStyle = "#1b1208";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPulseRing(ctx, x, y, radius, progress) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 218, 118, 0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + progress * radius * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFloatingLabel(ctx, text, x, y) {
  ctx.save();
  ctx.font = "900 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.max(72, ctx.measureText(text).width + 22);
  roundedRect(ctx, x - width / 2, y - 13, width, 26, 13);
  ctx.fillStyle = "rgba(6, 18, 16, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(215, 179, 90, 0.55)";
  ctx.stroke();
  ctx.fillStyle = "#f6dfa3";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, progress) {
  return from + (to - from) * progress;
}

function segmentProgress(value, start, end) {
  if (value <= start) return 0;
  if (value >= end) return 1;
  return (value - start) / (end - start);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function wave(now, duration) {
  return 0.5 + Math.sin((now / duration) * Math.PI * 2) * 0.5;
}

function playableRight(width) {
  return width >= 1000 ? width - 340 : width;
}

export function shouldRevealFlyingCard(action, leg = "incoming") {
  if (leg === "outgoing") return true;
  if (action?.type !== "swap") return true;
  return Boolean(action.fromDrawnArea || action.source === "discard");
}
