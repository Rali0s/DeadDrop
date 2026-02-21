import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(errors, msg) {
  errors.push(msg);
}

const repo = "/Users/proteu5/Documents/Github/DeadDrop";
const lock = loadJson(resolve(repo, "docs/simulations/season-two-lockin.json"));
const baseline = loadJson(resolve(repo, lock.sourceFiles.baselineSummary));
const stress = loadJson(resolve(repo, lock.sourceFiles.stressSummary));

const errors = [];

const b0 = baseline[0];
if (!b0) {
  fail(errors, "Baseline summary is empty.");
} else {
  const g = lock.checks.global;
  if (g.expectedGenesisSupply * g.expectedDevReservePctOfGenesis !== g.expectedDevWalletReserve) {
    fail(
      errors,
      `Dev reserve policy mismatch: expectedGenesisSupply * expectedDevReservePctOfGenesis != expectedDevWalletReserve`
    );
  }
  if (g.expectedMaxSupply - g.expectedGenesisSupply !== g.expectedRemainingPool) {
    fail(errors, `Supply mismatch: maxSupply - genesis != remainingPool`);
  }
  if (b0.remainingPool !== g.expectedRemainingPool) {
    fail(errors, `remainingPool mismatch: got ${b0.remainingPool}, expected ${g.expectedRemainingPool}`);
  }
  if (b0.reserveForSpecialEditions < g.minReserveForSpecialEditions) {
    fail(errors, `reserveForSpecialEditions too low: ${b0.reserveForSpecialEditions}`);
  }
  if (b0.cycleRemaining < g.minRemainingBudgetAfterDay250) {
    fail(errors, `cycleRemaining too low: ${b0.cycleRemaining}`);
  }
}

for (const row of baseline) {
  const b = lock.checks.baselineDay250;
  if (row.bps1 !== b.requiredBpsUser1) {
    fail(errors, `Scenario ${row.scenario}: bps1 ${row.bps1} != ${b.requiredBpsUser1}`);
  }
  if (row.bps3 !== b.requiredBpsUser3) {
    fail(errors, `Scenario ${row.scenario}: bps3 ${row.bps3} != ${b.requiredBpsUser3}`);
  }
  if (row.cumulativeEmission < b.minCumulativeEmission || row.cumulativeEmission > b.maxCumulativeEmission) {
    fail(errors, `Scenario ${row.scenario}: cumulativeEmission out of range (${row.cumulativeEmission})`);
  }
}

for (const row of stress) {
  const s = lock.checks.stressDay250;
  if (row.monteRuns < s.minRuns) {
    fail(errors, `Scenario ${row.scenario}: monteRuns ${row.monteRuns} < ${s.minRuns}`);
  }
  if (row.day250.anomalyCount_p95 > s.maxAnomalyCountP95) {
    fail(errors, `Scenario ${row.scenario}: anomalyCount_p95 ${row.day250.anomalyCount_p95} > ${s.maxAnomalyCountP95}`);
  }
  const minU1 = s.minCumRewardUser1P50ByScenario[row.scenario];
  const minU3 = s.minCumRewardUser3P50ByScenario[row.scenario];
  if (row.day250.cumRewardUser1_p50 < minU1) {
    fail(errors, `Scenario ${row.scenario}: cumRewardUser1_p50 ${row.day250.cumRewardUser1_p50} < ${minU1}`);
  }
  if (row.day250.cumRewardUser3_p50 < minU3) {
    fail(errors, `Scenario ${row.scenario}: cumRewardUser3_p50 ${row.day250.cumRewardUser3_p50} < ${minU3}`);
  }
}

if (errors.length > 0) {
  console.error("LOCKIN_CHECK_FAILED");
  for (const e of errors) {
    console.error(`- ${e}`);
  }
  process.exit(1);
}

console.log("LOCKIN_CHECK_PASSED");
