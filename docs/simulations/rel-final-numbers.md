# REL Final Numbers (Locked Reference)

## Supply and Reserves
- Max supply: `75,000,000 REL`
- Genesis issuance (25%): `18,750,000 REL`
- Dev wallet locked reserve (20% of genesis): `3,750,000 REL`
- Remaining emission pool: `56,250,000 REL`

## Season One (250-day) Budgeting
- Cycle budget (70% of remaining): `39,375,000 REL`
- Special Edition reserve (30% of remaining): `16,875,000 REL`
- Cumulative expected emission by day 250: `20,617,026.745736 REL`
- Remaining cycle budget after day 250 expected: `18,757,973.254264 REL`

## Uncapped BPS Snapshot (Day 250)
- 1 NFT/day user: `7000 bps`
- 3 NFTs/day user: `19500 bps`
- Whale profile in stress run: `13250 bps`

## Stress Summary (p50/p95, Day 250)
- Scenario A (25+25 users)
  - user1 cumulative reward: `113,235.56 / 121,349.13`
  - user3 cumulative reward: `247,780.99 / 262,455.82`
  - whale cumulative reward: `5,785,985.23 / 6,029,304.00`
- Scenario B (100+100 users)
  - user1 cumulative reward: `31,298.67 / 33,364.72`
  - user3 cumulative reward: `66,106.94 / 69,047.58`
  - whale cumulative reward: `5,429,179.91 / 5,627,496.69`
- Scenario C (250+250 users)
  - user1 cumulative reward: `14,305.64 / 15,064.73`
  - user3 cumulative reward: `29,065.60 / 30,077.57`
  - whale cumulative reward: `4,879,425.81 / 5,053,873.65`

## Curves
- `docs/simulations/rel-emissions-curves.svg`
- `docs/simulations/rel-cohort-curves.svg`
- `docs/simulations/rel-stress-curves.svg`
