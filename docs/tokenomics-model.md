# Tokenomics Model (REL + FARM)

## 1. Token Roles

- `REL`: governance, staking, utility for premium actions
- `FARM`: non-transferable points used for weekly emission allocation

## 2. Emission Model

Weekly epoch (7 days):
- Fixed base emission `E_week`
- Optional growth modifier tied to protocol treasury targets

User share:
- `share_u = score_u / sum(score_all)`
- `REL_u = E_week * share_u`

Where `score_u` is weighted, quality-adjusted activity.

## 3. Activity Scoring

Base actions (illustrative weights):
- Meaningful post engagement: `w_post = 1.0`
- DM reply quality event: `w_dm = 1.4`
- DeadDrop unlock/validation: `w_drop = 2.0`
- Quest completion: `w_quest = 1.2`
- Streak continuity multiplier: up to `1.25x`

Anti-gaming adjustments:
- Diminishing returns for repeated low-entropy actions
- Sybil suspicion penalty
- Negative score for confirmed abuse/spam

## 4. Staking Mechanics

Staking REL enables:
- DeadDrop audience tier upgrades
- First-contact message bandwidth
- governance voting weight

Yield sources:
- protocol fee share
- optional partner campaign allocations

## 5. Revenue Streams

- DeadDrop premium slot fees
- sponsor quest placements
- tip routing fee
- mini-app revenue share
- optional NFT utility fees

## 6. Guardrails

- Per-epoch max emission cap
- Team/investor vesting with linear unlock
- Treasury circuit breaker for adverse market conditions
- Governance delay for economic parameter changes

## 7. Launch Phasing

Phase 1:
- FARM live, REL soft-launch emissions, no transfer incentives

Phase 2:
- REL staking and limited governance scope

Phase 3:
- broader utility, partner token pools, advanced governance
