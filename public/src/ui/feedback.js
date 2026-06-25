export const FEEDBACK_STORAGE_KEY = "minima.feedback.v1";

const SOUND_PATTERNS = Object.freeze({
  start: Object.freeze([
    Object.freeze({ frequency: 330, duration: 0.055, delay: 0 }),
    Object.freeze({ frequency: 495, duration: 0.07, delay: 0.045 }),
  ]),
  draw: Object.freeze([
    Object.freeze({ frequency: 280, duration: 0.045, delay: 0 }),
    Object.freeze({ frequency: 380, duration: 0.055, delay: 0.035 }),
  ]),
  swap: Object.freeze([
    Object.freeze({ frequency: 520, duration: 0.045, delay: 0 }),
    Object.freeze({ frequency: 700, duration: 0.05, delay: 0.035 }),
  ]),
  discard: Object.freeze([
    Object.freeze({ frequency: 270, duration: 0.07, delay: 0 }),
  ]),
  stop: Object.freeze([
    Object.freeze({ frequency: 220, duration: 0.07, delay: 0 }),
    Object.freeze({ frequency: 165, duration: 0.09, delay: 0.065 }),
  ]),
  good: Object.freeze([
    Object.freeze({ frequency: 440, duration: 0.08, delay: 0 }),
    Object.freeze({ frequency: 590, duration: 0.08, delay: 0.075 }),
    Object.freeze({ frequency: 740, duration: 0.12, delay: 0.15 }),
  ]),
  bad: Object.freeze([
    Object.freeze({ frequency: 330, duration: 0.09, delay: 0 }),
    Object.freeze({ frequency: 245, duration: 0.14, delay: 0.08 }),
  ]),
  win: Object.freeze([
    Object.freeze({ frequency: 440, duration: 0.09, delay: 0 }),
    Object.freeze({ frequency: 554, duration: 0.09, delay: 0.08 }),
    Object.freeze({ frequency: 660, duration: 0.09, delay: 0.16 }),
    Object.freeze({ frequency: 880, duration: 0.18, delay: 0.24 }),
  ]),
});

const VIBRATION_PATTERNS = Object.freeze({
  start: 12,
  draw: 10,
  swap: Object.freeze([12, 18, 18]),
  discard: 16,
  stop: Object.freeze([24, 28, 24]),
  good: Object.freeze([18, 22, 42]),
  bad: Object.freeze([45, 30, 55]),
  win: Object.freeze([18, 18, 28, 18, 55]),
});

export class FeedbackController {
  constructor({
    storage = globalThis.localStorage,
    audioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
    vibrate = globalThis.navigator?.vibrate?.bind(globalThis.navigator),
  } = {}) {
    this.storage = storage;
    this.audioContextClass = audioContextClass;
    this.vibrate = vibrate;
    this.audioContext = null;
    this.enabled = loadFeedbackPreference(storage);
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    saveFeedbackPreference(this.enabled, this.storage);
    if (this.enabled) this.play("start", { vibrate: false });
    return this.enabled;
  }

  play(kind, { vibrate = true } = {}) {
    if (!this.enabled) return false;
    if (vibrate) this.playVibration(kind);
    this.playSound(kind);
    return true;
  }

  playVibration(kind) {
    if (typeof this.vibrate !== "function") return;
    const pattern = VIBRATION_PATTERNS[kind];
    if (pattern === undefined) return;
    try {
      this.vibrate(pattern);
    } catch {
      // Vibration support varies by browser and device.
    }
  }

  playSound(kind) {
    const pattern = SOUND_PATTERNS[kind];
    if (!pattern || typeof this.audioContextClass !== "function") return;
    try {
      this.audioContext ??= new this.audioContextClass();
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume();
      }
      const startAt = this.audioContext.currentTime + 0.005;
      pattern.forEach((tone) => this.scheduleTone(tone, startAt));
    } catch {
      // Audio feedback is optional and must never block the game.
    }
  }

  scheduleTone(tone, startAt) {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const toneStart = startAt + tone.delay;
    const toneEnd = toneStart + tone.duration;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.045, toneStart + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.01);
  }
}

export function loadFeedbackPreference(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(FEEDBACK_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveFeedbackPreference(enabled, storage = globalThis.localStorage) {
  try {
    storage?.setItem(FEEDBACK_STORAGE_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}
