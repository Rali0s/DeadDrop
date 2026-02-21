# Season Two Float Series (Suggested)

This defines tunable float ranges for Season Two calibration based on Season One stress outputs.

## Final Numbers (Season One Day-250 Reference)
- `maxSupply`: `75,000,000`
- `genesis`: `18,750,000` (25%)
- `remainingPool`: `56,250,000`
- `cycleBudget`: `39,375,000`
- `reserveSpecialEditions`: `16,875,000`
- `cumulativeExpectedEmission@250`: `20,617,026.745736`
- `remainingBudget@250`: `18,757,973.254264`

## Season Two Float Series

| Variable | Season One | Season Two Suggested Sweep |
|---|---:|---:|
| `halfLifeDays` | `90` | `[85, 95, 110, 125]` |
| `cycleBudgetPctOfRemaining` | `0.70` | `[0.55, 0.60, 0.65]` |
| `reservePctOfRemaining` | `0.30` | `[0.35, 0.40, 0.45]` |
| `pMin` | `0.35` | `[0.25, 0.30, 0.35]` |
| `pMax` | `1.00` | `[0.90, 0.95, 1.00]` |
| `gamma` | `1.40` | `[1.10, 1.25, 1.40, 1.60]` |
| `bpsTimePerDay` | `3.0` | `[1.5, 2.0, 2.5]` |
| `bpsPerNft` | `25.0` | `[8, 12, 16, 20]` |
| `buyerFlowMeanRelPerDay` | `40,000` | `[20,000, 30,000, 40,000, 55,000]` |
| `buyerFlowVol` | `0.35` | `[0.20, 0.30, 0.40]` |
| `anomalyEventProb` | `0.06` | `[0.03, 0.05, 0.08]` |
| `anomalyEmissionShockMin` | `0.65` | `[0.70, 0.75, 0.80]` |
| `anomalyEmissionShockMax` | `1.35` | `[1.20, 1.30, 1.40]` |
| `unknownNoiseMin` | `0.90` | `[0.93, 0.95, 0.97]` |
| `unknownNoiseMax` | `1.10` | `[1.03, 1.05, 1.08]` |

## Practical Guidance
- If whale concentration rises too fast, reduce `bpsPerNft` before reducing `pMax`.
- If issuance undershoots growth targets, first lower `gamma`, then increase `pMin`.
- Keep `reservePctOfRemaining >= 0.35` for Special Edition optionality.
