import { writeFileSync } from 'node:fs';
import {
  REL_TOKENOMICS_PARAMS,
  simulateExpectedIssuance,
  totalBps,
  effectiveStake,
  cycleBudget,
  specialEditionReserve,
  remainingEmissionPool
} from '../../apps/web/src/relWhitepaper.ts';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

const emissions = simulateExpectedIssuance();
const days = REL_TOKENOMICS_PARAMS.cycleDays;

const scenarios = [
  { id: 'A', usersPerCohort: 25 },
  { id: 'B', usersPerCohort: 100 },
  { id: 'C', usersPerCohort: 250 }
];

const initialStake = 320;

const defaultStress = {
  whaleUsers: 2,
  whaleStake: 200_000,
  whaleNftPerDay: 2,
  buyerFlowMeanRelPerDay: 40_000,
  buyerFlowVol: 0.35,
  anomalyEventProb: 0.06,
  anomalyEmissionShockMin: 0.65,
  anomalyEmissionShockMax: 1.35,
  unknownNoiseMin: 0.9,
  unknownNoiseMax: 1.1
};

function runStressScenario(usersPerCohort, runSeed, stress = defaultStress) {
  const rng = mulberry32(runSeed);

  let rawStake1 = initialStake;
  let rawStake3 = initialStake;
  let whaleRawStake = stress.whaleStake;

  let cumPerUser1 = 0;
  let cumPerUser3 = 0;
  let cumPerWhale = 0;

  let anomalyCount = 0;

  const dayRows = [];

  for (let day = 1; day <= days; day++) {
    const baseEmission = emissions[day - 1].expectedDaily;

    // Unknown variable: environmental noise over system behavior
    const noise = randRange(rng, stress.unknownNoiseMin, stress.unknownNoiseMax);

    // Random anomaly event (macro market, traffic, outages, etc.)
    let anomalyShock = 1;
    if (rng() < stress.anomalyEventProb) {
      anomalyShock = randRange(rng, stress.anomalyEmissionShockMin, stress.anomalyEmissionShockMax);
      anomalyCount += 1;
    }

    // Buyer flow: net REL buys adding staked position pressure over time
    const buyerFlow = Math.max(
      0,
      stress.buyerFlowMeanRelPerDay * (1 + randRange(rng, -stress.buyerFlowVol, stress.buyerFlowVol))
    );

    // Split buyer inflow across cohorts by random weights
    const w1 = randRange(rng, 0.15, 0.45);
    const w3 = randRange(rng, 0.25, 0.55);
    const ww = Math.max(0, 1 - w1 - w3);
    rawStake1 += (buyerFlow * w1) / usersPerCohort;
    rawStake3 += (buyerFlow * w3) / usersPerCohort;
    whaleRawStake += stress.whaleUsers > 0 ? (buyerFlow * ww) / stress.whaleUsers : 0;

    const nftCount1 = day;
    const nftCount3 = day * 3;
    const nftCountWhale = day * stress.whaleNftPerDay;

    const bps1 = totalBps(0, day, nftCount1, REL_TOKENOMICS_PARAMS);
    const bps3 = totalBps(0, day, nftCount3, REL_TOKENOMICS_PARAMS);
    const bpsW = totalBps(0, day, nftCountWhale, REL_TOKENOMICS_PARAMS);

    const eff1 = effectiveStake(rawStake1, bps1) * noise;
    const eff3 = effectiveStake(rawStake3, bps3) * noise;
    const effW = effectiveStake(whaleRawStake, bpsW) * noise;

    const totalEff = usersPerCohort * eff1 + usersPerCohort * eff3 + stress.whaleUsers * effW;

    const share1 = totalEff > 0 ? (usersPerCohort * eff1) / totalEff : 0;
    const share3 = totalEff > 0 ? (usersPerCohort * eff3) / totalEff : 0;
    const shareW = totalEff > 0 ? (stress.whaleUsers * effW) / totalEff : 0;

    const dailyEmission = baseEmission * anomalyShock;

    const rewardTotal1 = dailyEmission * share1;
    const rewardTotal3 = dailyEmission * share3;
    const rewardTotalW = dailyEmission * shareW;

    const rewardPerUser1 = rewardTotal1 / usersPerCohort;
    const rewardPerUser3 = rewardTotal3 / usersPerCohort;
    const rewardPerWhale = stress.whaleUsers > 0 ? rewardTotalW / stress.whaleUsers : 0;

    // compounding
    rawStake1 += rewardPerUser1;
    rawStake3 += rewardPerUser3;
    whaleRawStake += rewardPerWhale;

    cumPerUser1 += rewardPerUser1;
    cumPerUser3 += rewardPerUser3;
    cumPerWhale += rewardPerWhale;

    dayRows.push({
      day,
      dailyEmission,
      baseEmission,
      anomalyShock,
      buyerFlow,
      bps1,
      bps3,
      bpsW,
      share1,
      share3,
      shareW,
      cumPerUser1,
      cumPerUser3,
      cumPerWhale,
      rawStake1,
      rawStake3,
      whaleRawStake
    });
  }

  const end = dayRows[dayRows.length - 1];
  return {
    end,
    dayRows,
    anomalyCount
  };
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const w = idx - lo;
  return sortedArr[lo] * (1 - w) + sortedArr[hi] * w;
}

const monteRuns = 200;
const summary = [];
const curveRows = [];

for (const sc of scenarios) {
  const runEnds = [];
  const anomalyCounts = [];

  for (let run = 0; run < monteRuns; run++) {
    const seed = 1000 + run * 31 + sc.usersPerCohort;
    const out = runStressScenario(sc.usersPerCohort, seed);
    runEnds.push(out.end);
    anomalyCounts.push(out.anomalyCount);

    // persist one representative run (median-ish run index)
    if (run === Math.floor(monteRuns / 2)) {
      for (const d of out.dayRows) {
        curveRows.push({ scenario: sc.id, usersPerCohort: sc.usersPerCohort, ...d });
      }
    }
  }

  const sortBy = (k) => runEnds.map((r) => r[k]).sort((a, b) => a - b);
  const cum1 = sortBy('cumPerUser1');
  const cum3 = sortBy('cumPerUser3');
  const cumW = sortBy('cumPerWhale');
  const stake1 = sortBy('rawStake1');
  const stake3 = sortBy('rawStake3');
  const stakeW = sortBy('whaleRawStake');
  const em250 = sortBy('dailyEmission');
  const aCounts = anomalyCounts.slice().sort((a, b) => a - b);

  summary.push({
    scenario: sc.id,
    usersPerCohort: sc.usersPerCohort,
    monteRuns,
    day250: {
      dailyEmission_p50: percentile(em250, 0.5),
      dailyEmission_p95: percentile(em250, 0.95),
      cumRewardUser1_p50: percentile(cum1, 0.5),
      cumRewardUser1_p95: percentile(cum1, 0.95),
      cumRewardUser3_p50: percentile(cum3, 0.5),
      cumRewardUser3_p95: percentile(cum3, 0.95),
      cumRewardWhale_p50: percentile(cumW, 0.5),
      cumRewardWhale_p95: percentile(cumW, 0.95),
      rawStakeUser1_p50: percentile(stake1, 0.5),
      rawStakeUser1_p95: percentile(stake1, 0.95),
      rawStakeUser3_p50: percentile(stake3, 0.5),
      rawStakeUser3_p95: percentile(stake3, 0.95),
      rawStakeWhale_p50: percentile(stakeW, 0.5),
      rawStakeWhale_p95: percentile(stakeW, 0.95),
      anomalyCount_p50: percentile(aCounts, 0.5),
      anomalyCount_p95: percentile(aCounts, 0.95),
      bpsUser1_day250: totalBps(0, 250, 250, REL_TOKENOMICS_PARAMS),
      bpsUser3_day250: totalBps(0, 250, 750, REL_TOKENOMICS_PARAMS),
      bpsWhale_day250: totalBps(0, 250, 500, REL_TOKENOMICS_PARAMS)
    },
    constants: {
      cycleBudget: cycleBudget(REL_TOKENOMICS_PARAMS),
      reserveSpecialEditions: specialEditionReserve(REL_TOKENOMICS_PARAMS),
      remainingEmissionPool: remainingEmissionPool(REL_TOKENOMICS_PARAMS)
    }
  });
}

const outDir = './docs/simulations';
let curveCsv = 'scenario,users_per_cohort,day,daily_emission,base_emission,anomaly_shock,buyer_flow,bps_1,bps_3,bps_whale,share_1,share_3,share_whale,cum_user1,cum_user3,cum_whale,raw_stake1,raw_stake3,raw_stake_whale\n';
for (const r of curveRows) {
  curveCsv += [
    r.scenario,
    r.usersPerCohort,
    r.day,
    r.dailyEmission,
    r.baseEmission,
    r.anomalyShock,
    r.buyerFlow,
    r.bps1,
    r.bps3,
    r.bpsW,
    r.share1,
    r.share3,
    r.shareW,
    r.cumPerUser1,
    r.cumPerUser3,
    r.cumPerWhale,
    r.rawStake1,
    r.rawStake3,
    r.whaleRawStake
  ].join(',') + '\n';
}

let md = '# REL Stress Simulation: Anomalies, Whales, Buyer Flows\n\n';
md += 'Unknown variables included:\n';
md += '- Random anomaly event shocks on daily emission\n';
md += '- REL buyer inflow process (stochastic daily flow)\n';
md += '- Whale cohort with high stake concentration\n';
md += '- Environmental noise factor on effective stake\n\n';
md += `Monte Carlo runs per scenario: **${monteRuns}**\n\n`;
md += '| Scenario | Users/Cohort | Day250 BPS 1/day | Day250 BPS 3/day | Day250 BPS Whale | CumReward/User1 p50 | CumReward/User1 p95 | CumReward/User3 p50 | CumReward/User3 p95 | Whale Cum p50 | Whale Cum p95 | Daily Emission p50 | Daily Emission p95 | Anomaly Count p50 | Anomaly Count p95 |\n';
md += '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for (const s of summary) {
  const d = s.day250;
  md += `| ${s.scenario} | ${s.usersPerCohort} | ${d.bpsUser1_day250} | ${d.bpsUser3_day250} | ${d.bpsWhale_day250} | ${d.cumRewardUser1_p50.toFixed(2)} | ${d.cumRewardUser1_p95.toFixed(2)} | ${d.cumRewardUser3_p50.toFixed(2)} | ${d.cumRewardUser3_p95.toFixed(2)} | ${d.cumRewardWhale_p50.toFixed(2)} | ${d.cumRewardWhale_p95.toFixed(2)} | ${d.dailyEmission_p50.toFixed(2)} | ${d.dailyEmission_p95.toFixed(2)} | ${d.anomalyCount_p50.toFixed(0)} | ${d.anomalyCount_p95.toFixed(0)} |\n`;
}

writeFileSync(`${outDir}/rel-stress-summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${outDir}/rel-stress-curves.csv`, curveCsv);
writeFileSync(`${outDir}/rel-stress-report.md`, md);
console.log('wrote rel-stress-summary.json, rel-stress-curves.csv, rel-stress-report.md');
