const MATCH_STORAGE_KEY = "memoria.match.v1";
const SETUP_STORAGE_KEY = "memoria.setup.v1";

export function saveMatch(match, storage = getLocalStorage()) {
  if (!storage) return false;
  const state = match.exportState();
  if (!state) {
    removeItem(storage, MATCH_STORAGE_KEY);
    return true;
  }
  try {
    storage.setItem(MATCH_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function restoreMatch(match, storage = getLocalStorage()) {
  if (!storage) return false;
  try {
    const serialized = storage.getItem(MATCH_STORAGE_KEY);
    if (!serialized) return false;
    const restored = match.restoreState(JSON.parse(serialized));
    if (!restored) removeItem(storage, MATCH_STORAGE_KEY);
    return restored;
  } catch {
    removeItem(storage, MATCH_STORAGE_KEY);
    return false;
  }
}

export function hasSavedMatch(storage = getLocalStorage()) {
  return Boolean(readSavedMatchState(storage));
}

export function loadSavedMatchSummary(storage = getLocalStorage()) {
  const state = readSavedMatchState(storage);
  if (!state) return null;
  const human = state.players?.find((player) => player?.isHuman);
  const activeCount = state.players?.filter((player) => player?.active).length ?? 0;
  return {
    roundNumber: Number.isInteger(state.roundNumber) ? state.roundNumber : 1,
    playerCount: Array.isArray(state.players) ? state.players.length : 0,
    activeCount,
    humanName: cleanSetupName(human?.name) || "Você",
    humanScore: Number.isFinite(human?.score) ? human.score : 0,
    phase: typeof state.phase === "string" ? state.phase : "",
  };
}

export function clearSavedMatch(storage = getLocalStorage()) {
  if (!storage) return false;
  removeItem(storage, MATCH_STORAGE_KEY);
  return true;
}

export function saveSetup(setup, storage = getLocalStorage()) {
  if (!storage) return false;
  const playerName = cleanSetupName(setup?.playerName);
  const playerCount = Math.max(2, Math.min(6, Number(setup?.playerCount) || 4));
  try {
    storage.setItem(SETUP_STORAGE_KEY, JSON.stringify({ playerName, playerCount }));
    return true;
  } catch {
    return false;
  }
}

export function loadSetup(storage = getLocalStorage()) {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(SETUP_STORAGE_KEY);
    if (!serialized) return null;
    const setup = JSON.parse(serialized);
    if (
      !setup ||
      typeof setup.playerName !== "string" ||
      !Number.isInteger(setup.playerCount) ||
      setup.playerCount < 2 ||
      setup.playerCount > 6
    ) {
      removeItem(storage, SETUP_STORAGE_KEY);
      return null;
    }
    return {
      playerName: cleanSetupName(setup.playerName),
      playerCount: setup.playerCount,
    };
  } catch {
    removeItem(storage, SETUP_STORAGE_KEY);
    return null;
  }
}

function readSavedMatchState(storage) {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(MATCH_STORAGE_KEY);
    if (!serialized) return null;
    const state = JSON.parse(serialized);
    if (!state || typeof state !== "object" || !Array.isArray(state.players)) {
      removeItem(storage, MATCH_STORAGE_KEY);
      return null;
    }
    return state;
  } catch {
    removeItem(storage, MATCH_STORAGE_KEY);
    return null;
  }
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeItem(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function cleanSetupName(name) {
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 14);
  return isLegacyDefaultName(cleanName) ? "" : cleanName;
}

function isLegacyDefaultName(name) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized === "voce";
}

export { MATCH_STORAGE_KEY, SETUP_STORAGE_KEY };
