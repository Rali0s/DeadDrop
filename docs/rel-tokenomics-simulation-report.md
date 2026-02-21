# REL Tokenomics Simulation Report

Generated from `apps/web/src/relWhitepaper.ts` (pre-Solidity wiring).

## Parameter Set
- `maxSupply`: 75,000,000
- `genesisPct`: 25%
- `cycleDays`: 250
- `halfLifeDays`: 90
- `cycleBudgetPctOfRemaining`: 70%
- `reservePctOfRemaining`: 30%
- `pMin/pMax/gamma`: `0.35 / 1.0 / 1.4`
- `time bps`: `+3/day` capped at `750`
- `nft bps`: `+25/NFT` capped at `2000`
- `total bps cap`: `3000`

## Supply Checks
- `genesis = 18,750,000 REL`
- `remaining = 56,250,000 REL`
- `cycleBudget = 39,375,000 REL`
- `specialEditionReserve = 16,875,000 REL`
- Check: `cycleBudget + reserve == remaining` => `true`

## 250-Day Expected Issuance
- Day 1 expected: `123,880.557957 REL`
- Day 125 expected: `81,151.411600 REL`
- Day 250 expected: `51,967.423095 REL`
- Cumulative expected by day 250: `20,617,026.745736 REL`
- Under budget check: `true`
- Remaining within cycle budget: `18,757,973.254264 REL`

## BPS / Effective Stake Checks
- `timeBps(250) = 750`
- `nftBps(80) = 2000` (cap reached)
- `totalBps(0,250,0) = 750`
- `totalBps(0,250,80) = 2750`
- `totalBps(900,250,200) = 3000` (cap reached)
- Effective stake example:
  - raw: `320 REL`
  - bps: `2750`
  - effective: `408 REL`

## Important Design Note
Current model uses a **decay baseline** plus increasing probability. That means expected issuance still trends down over time in this parameterization (day 1 > day 250).

If target behavior is “exponential rewards increase with time over 250 days”, switch to a growth-shaped baseline (or invert the current curve) before implementing in Solidity.
