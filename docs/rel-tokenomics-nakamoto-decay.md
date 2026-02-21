# REL Tokenomics: Nakamoto Decay Model (250-Day Series)

## Overview
This document defines REL tokenomics for the Cold War NFT issue cycle with:
- Fixed cap ERC-20 supply
- 25% genesis issuance
- 250-day weighted staking issuance
- Probabilistic issuance ramp with day-based weight growth
- Explicit reserve for Special Edition / Ender Edition cycles

## 1. ERC-20 Base Settings
- `name`: Relay Token
- `symbol`: REL
- `decimals`: 18
- `maxSupply`: `75,000,000 REL`

Formulas:
- `S_max = 75,000,000`
- `S_0 = 0.25 * S_max = 18,750,000` (genesis mint)
- `E = S_max - S_0 = 56,250,000` (remaining emission pool)

## 2. Supply Buckets
Let:
- `D_0` = dev wallet allocation at genesis
- `B_250` = 250-day staking emission budget
- `R_SE` = reserved supply for Special Edition/Ender Edition and future series

Constraint:
- `E = B_250 + R_SE`

Recommended baseline:
- `B_250 = 39,375,000` (70% of remaining pool)
- `R_SE = 16,875,000` (30% reserved)

At day `t`:
- `M(t) = sum_{d=1..t} m_d`
- `M(250) <= B_250`
- `E - M(250) >= R_SE`

## 3. Weighted Staking Model
For user `i` on day `t`:

- Raw stake: `s_i`
- NFT stake cache count: `n_i`
- Base staking bps (policy): `bps_base_i`

### Time weight
- `bps_time(t) = min(3 * t, 750)`  
  (max +750 bps at day 250)

### NFT weight
- `bps_nft_i = min(25 * n_i, 2000)`  
  (+25 bps per staked NFT, capped at +2000 bps)

### Total bps
- `bps_cap = 3000` (recommended)
- `bps_i(t) = min(bps_base_i + bps_time(t) + bps_nft_i, bps_cap)`

### Effective stake
- `s_eff_i(t) = s_i * (1 + bps_i(t) / 10000)`

### Distribution share
- `w_i(t) = s_eff_i(t) / sum_j s_eff_j(t)`

Daily reward:
- `r_i(t) = m_t * w_i(t)`

## 4. Nakamoto Decay + Probabilistic Issuance
Cycle length:
- `T = 250` days

Half-life parameter:
- `H = 90` days (tunable)

Normalized decay CDF:
- `F(t) = (1 - 2^(-t/H)) / (1 - 2^(-T/H))`

Target cumulative mint curve:
- `M*(t) = B_250 * F(t)`

Baseline per-day emission:
- `b_t = M*(t) - M*(t-1)`

Probabilistic ramp:
- `p(t) = p_min + (p_max - p_min) * (t / T)^gamma`
- Recommended: `p_min=0.35`, `p_max=1.0`, `gamma=1.4`

Expected per-day mint:
- `E[m_t] = b_t * p(t)`

Guarded mint:
- `m_t = min(sampleOrExpected(b_t, p(t)), B_250 - M(t-1))`

## 5. BPS and Fee Effects
If fee engine depends on effective REL:
- `effectiveRel_i(t) = s_i * (1 + bps_i(t)/10000)`

Then any fee tiering uses `effectiveRel` instead of raw stake.

Example:
- Raw staked REL: `320`
- NFT bps: `+250`
- Time bps at day 120: `+360`
- Base bps: `0`
- Total bps: `610`
- Effective REL: `320 * 1.061 = 339.52`

## 6. Invariants (must hold)
- `totalSupply <= S_max`
- `walletMintsByDay[user][day] <= 3`
- `0 <= bps_i(t) <= bps_cap`
- `effectiveRel_i(t) >= s_i`
- `M(250) <= B_250`
- `E - M(250) >= R_SE`

## 7. Operational Notes
- Keep `R_SE` inaccessible to regular staking emissions.
- Freeze issuance params before cycle launch.
- Record parameter changes in governance events.
- Recompute and cache `effectiveRel` on stake/NFT state updates.
