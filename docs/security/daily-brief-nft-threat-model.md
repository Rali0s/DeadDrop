# Daily War Brief NFT Threat Model

## Scope
Contracts:
- `DailyBriefNFT`
- `DailyBriefSVG`
- `StakingVault` (NFT oracle integration)

Assumptions:
- Base chain deployment
- UTC day-index schedule
- Open-edition daily minting

## Assets
- Mint revenue (ETH in `DailyBriefNFT`)
- Staking fee economics (USDC fee path in `StakingVault`)
- REL staking fairness (boost effect)
- Metadata integrity (day-index brief content)
- Role authority integrity

## Trust Boundaries
- External users minting NFTs
- Admin/content operator configuring briefs
- Treasury withdrawing ETH
- Oracle consumer (`StakingVault`) trusting `INftWeightOracle`

## Privileged Roles
- `DEFAULT_ADMIN_ROLE`: admin controls
- `CONTENT_ROLE`: brief schedule/content writes
- `TREASURY_ROLE`: withdrawals
- `PARAM_ADMIN_ROLE`: mint limits and boost params
- `PAUSER_ROLE`: pause control

## Abuse Cases

### Economic attacks
- Mint spam by bots:
  - Mitigation: exact payment + per-wallet/day cap + day-window gate
- Boost farming:
  - Mitigation: capped boost (`maxBoostBps`), configurable via admin

### Timing attacks
- Midnight edge attempts to exceed cap:
  - Mitigation: day-indexed wallet mint mapping keyed by UTC day
- Late-day and post-window mint attempts:
  - Mitigation: strict `isMintOpenForDay` + 365-day bounds

### Metadata/content abuse
- Oversized text causing render bleed:
  - Mitigation: deterministic SVG clamps, line caps, ellipsis
- Malformed brief entries:
  - Mitigation: required fields and date-length checks in config

### Oracle misuse
- Stale or malicious oracle boosting too high:
  - Mitigation: optional oracle, capped boost enforced by oracle contract; admin-settable oracle address
- Oracle removed/unset:
  - Mitigation: fallback to raw stake when oracle is zero-address

### Funds safety
- Reentrancy on mint/withdraw:
  - Mitigation: `ReentrancyGuard`, checks-effects-interactions
- Unauthorized withdrawal:
  - Mitigation: role-restricted withdraw path

## Invariants
1. Wallet/day mint cap:
   - `walletMintsByDay[user][day] <= dailyWalletMintLimit`
2. Mint window correctness:
   - mints only when `day == currentDayIndex()` and day in `[0,364]`
3. Fee exactness:
   - `msg.value == quantity * MINT_PRICE_WEI`
4. Boost cap:
   - `boostBps(user) <= maxBoostBps`
5. Withdraw conservation:
   - `totalEthReceived - totalEthWithdrawn <= address(this).balance`
   - equality can be broken only by forced ETH edge cases

## Residual Risks
- Forced ETH transfers can alter balance accounting surface
- Centralized content/admin roles until governance/timelock is added
- External oracle trust if replaced with third-party implementation

## Mandatory Controls Before Mainnet
- Slither static scan and reviewed findings
- Symbolic analysis (Mythril or equivalent) on mint/withdraw paths
- Invariant + fuzz test suite passing
- External audit and signed risk acceptance for unresolved Medium issues
