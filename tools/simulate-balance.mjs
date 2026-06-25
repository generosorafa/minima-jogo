import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  formatBalanceReport,
  runBalanceSimulation,
} from "../public/src/simulation/balanceSimulator.js";

const options = parseArguments(process.argv.slice(2));
const report = runBalanceSimulation(options);
const outputDirectory = resolve(options.outputDirectory);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "balance-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(outputDirectory, "balance-report.md"),
  formatBalanceReport(report),
  "utf8",
);

console.log(formatBalanceReport(report));

function parseArguments(args) {
  const values = Object.fromEntries(
    args
      .filter((argument) => argument.startsWith("--") && argument.includes("="))
      .map((argument) => {
        const [key, ...valueParts] = argument.slice(2).split("=");
        return [key, valueParts.join("=")];
      }),
  );
  return {
    matchesPerPlayerCount: positiveInteger(values.matches, 1000),
    seed: positiveInteger(values.seed, 20260625),
    outputDirectory: values.output ?? "work/balance",
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
