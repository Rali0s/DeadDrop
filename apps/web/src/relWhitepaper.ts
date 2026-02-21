export type RelTokenomicsParams = {
  maxSupply: number;
  genesisPct: number;
  devWalletReservePctOfGenesis: number;
  cycleDays: number;
  halfLifeDays: number;
  cycleBudgetPctOfRemaining: number;
  reservePctOfRemaining: number;
  pMin: number;
  pMax: number;
  gamma: number;
  bpsTimePerDay: number;
  bpsPerNft: number;
};

export const REL_TOKENOMICS_PARAMS: RelTokenomicsParams = {
  maxSupply: 75_000_000,
  genesisPct: 0.25,
  devWalletReservePctOfGenesis: 0.2,
  cycleDays: 250,
  halfLifeDays: 90,
  cycleBudgetPctOfRemaining: 0.7,
  reservePctOfRemaining: 0.3,
  pMin: 0.35,
  pMax: 1,
  gamma: 1.4,
  bpsTimePerDay: 3,
  bpsPerNft: 25
};

export function remainingEmissionPool(p = REL_TOKENOMICS_PARAMS): number {
  return p.maxSupply * (1 - p.genesisPct);
}

export function genesisSupply(p = REL_TOKENOMICS_PARAMS): number {
  return p.maxSupply * p.genesisPct;
}

export function devWalletLockedReserve(p = REL_TOKENOMICS_PARAMS): number {
  return genesisSupply(p) * p.devWalletReservePctOfGenesis;
}

export function cycleBudget(p = REL_TOKENOMICS_PARAMS): number {
  return remainingEmissionPool(p) * p.cycleBudgetPctOfRemaining;
}

export function specialEditionReserve(p = REL_TOKENOMICS_PARAMS): number {
  return remainingEmissionPool(p) * p.reservePctOfRemaining;
}

export function timeBps(day: number, p = REL_TOKENOMICS_PARAMS): number {
  return Math.max(0, day) * p.bpsTimePerDay;
}

export function nftBps(stakedNfts: number, p = REL_TOKENOMICS_PARAMS): number {
  return Math.max(0, stakedNfts) * p.bpsPerNft;
}

export function totalBps(baseBps: number, day: number, stakedNfts: number, p = REL_TOKENOMICS_PARAMS): number {
  return Math.max(0, baseBps) + timeBps(day, p) + nftBps(stakedNfts, p);
}

export function effectiveStake(rawStakeRel: number, totalBpsValue: number): number {
  return rawStakeRel * (1 + totalBpsValue / 10_000);
}

function decayCdf(day: number, p = REL_TOKENOMICS_PARAMS): number {
  const t = Math.max(0, Math.min(day, p.cycleDays));
  const numerator = 1 - 2 ** (-t / p.halfLifeDays);
  const denominator = 1 - 2 ** (-p.cycleDays / p.halfLifeDays);
  return denominator === 0 ? 0 : numerator / denominator;
}

function probabilityRamp(day: number, p = REL_TOKENOMICS_PARAMS): number {
  const x = Math.max(0, Math.min(day, p.cycleDays)) / p.cycleDays;
  return p.pMin + (p.pMax - p.pMin) * x ** p.gamma;
}

export type DayEmission = {
  day: number;
  baselineDaily: number;
  probability: number;
  expectedDaily: number;
  cumulativeExpected: number;
};

export function simulateExpectedIssuance(p = REL_TOKENOMICS_PARAMS): DayEmission[] {
  const budget = cycleBudget(p);
  const rows: DayEmission[] = [];
  let cumulativeExpected = 0;
  let prevTarget = 0;

  for (let day = 1; day <= p.cycleDays; day += 1) {
    const target = budget * decayCdf(day, p);
    const baselineDaily = Math.max(0, target - prevTarget);
    prevTarget = target;

    const probability = probabilityRamp(day, p);
    const expectedDailyRaw = baselineDaily * probability;
    const expectedDaily = Math.min(expectedDailyRaw, budget - cumulativeExpected);
    cumulativeExpected += expectedDaily;

    rows.push({
      day,
      baselineDaily,
      probability,
      expectedDaily,
      cumulativeExpected
    });
  }

  return rows;
}

export const REL_WHITEPAPER_ABOUT = {
  title: "REL Tokenomics Whitepaper",
  summary:
    "REL uses a 75M capped supply, 25% genesis issuance, and a 250-day Nakamoto-decay staking cycle with probabilistic ramping and BPS-based weighted rewards.",
  highlights: [
    "Cap: 75,000,000 REL",
    "Genesis: 25% (18,750,000 REL)",
    "Remaining emission pool: 56,250,000 REL",
    "Cold War cycle: 250 days",
    "Expected cycle budget: 39,375,000 REL",
    "Special Edition reserve target: 16,875,000 REL",
    "Dev wallet locked reserve: 3,750,000 REL",
    "Time weight: +3 bps/day (uncapped)",
    "NFT weight: +25 bps/NFT (uncapped)"
  ],
  reportDay250: [
    "Cumulative expected emission: 20,617,026.745736 REL",
    "Remaining cycle budget: 18,757,973.254264 REL",
    "Special Edition reserve target: 16,875,000 REL"
  ],
  logicTheory: [
    "Baseline issuance follows a Nakamoto-style decay curve over 250 days.",
    "A probabilistic ramp controls expected daily realization of baseline issuance.",
    "Reward share uses effective stake weighted by time and NFT BPS additions.",
    "Stress tests add whale concentration, buyer flow, and anomaly/noise shocks."
  ],
  curves: [
    "/curves/rel-emissions-curves.svg",
    "/curves/rel-cohort-curves.svg",
    "/curves/rel-stress-curves.svg"
  ]
} as const;
