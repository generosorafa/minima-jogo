import assert from "node:assert/strict";
import {
  FEEDBACK_STORAGE_KEY,
  FeedbackController,
  loadFeedbackPreference,
  saveFeedbackPreference,
} from "../public/src/ui/feedback.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

{
  const storage = new MemoryStorage();
  assert.equal(loadFeedbackPreference(storage), true);
  assert.equal(saveFeedbackPreference(false, storage), true);
  assert.equal(storage.getItem(FEEDBACK_STORAGE_KEY), "off");
  assert.equal(loadFeedbackPreference(storage), false);
}

{
  const vibrations = [];
  const storage = new MemoryStorage();
  const feedback = new FeedbackController({
    storage,
    audioContextClass: null,
    vibrate(pattern) {
      vibrations.push(pattern);
    },
  });
  assert.equal(feedback.play("draw"), true);
  assert.equal(vibrations.length, 1);
  assert.equal(feedback.setEnabled(false), false);
  assert.equal(feedback.play("swap"), false);
  assert.equal(vibrations.length, 1);
  assert.equal(feedback.setEnabled(true), true);
  assert.equal(storage.getItem(FEEDBACK_STORAGE_KEY), "on");
}

console.log("feedback.test.mjs: ok");
