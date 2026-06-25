import assert from "node:assert/strict";
import {
  createSeededRandomInt,
  runBalanceSimulation,
} from "../public/src/simulation/balanceSimulator.js";
import { Match } from "../public/src/game/match.js";

{
  const first = createSeededRandomInt(42);
  const second = createSeededRandomInt(42);
  assert.deepEqual(
    Array.from({ length: 20 }, () => first(54)),
    Array.from({ length: 20 }, () => second(54)),
  );
}

{
  const first = new Match({ randomInt: createSeededRandomInt(99) });
  const second = new Match({ randomInt: createSeededRandomInt(99) });
  first.startMatch(4, "A");
  second.startMatch(4, "B");
  assert.deepEqual(first.stock, second.stock);
  assert.deepEqual(
    first.players.map((player) => player.hand),
    second.players.map((player) => player.hand),
  );
}

{
  const report = runBalanceSimulation({
    matchesPerPlayerCount: 1000,
    seed: 20260625,
  });
  assert.equal(report.metadata.requestedMatches, 5000);
  assert.equal(report.metadata.completedMatches, 5000);
  assert.equal(report.metadata.abortedMatches, 0);
  assert.equal(report.profiles.length, 5);
  assert.ok(report.profiles.every((profile) => profile.appearances > 0));
  assert.ok(
    report.profiles.every(
      (profile) => profile.winIndex >= 0.82 && profile.winIndex <= 1.18,
    ),
    `Perfis fora da faixa: ${report.profiles
      .map((profile) => `${profile.name}=${profile.winIndex.toFixed(2)}`)
      .join(", ")}`,
  );
  assert.ok(report.matchSummary.averageRounds > 0);
  assert.ok(report.matchSummary.averageTurns > 0);
}

console.log("simulation.test.mjs: ok");
