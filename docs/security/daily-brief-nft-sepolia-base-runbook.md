# Daily War Brief NFT Runbook (Sepolia/Base Testnet)

## Prerequisites
- Node version from `<REPO_ROOT>/.nvmrc`
- Funded deployer wallet on target network
- RPC + explorer API keys configured

## Env Setup
In `<REPO_ROOT>/apps/contracts/.env`:

```bash
DEPLOYER_PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
BASE_SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=...
BASESCAN_API_KEY=...
BRIEF_TREASURY=0xYourTreasury
BRIEF_START_TS_UTC=1767225600
```

## 1) Build + Security Gates
From repo root:

```bash
npm run build --workspace=@deaddrop/contracts
npm run security:gates --workspace=@deaddrop/contracts
```

Optional (if installed):

```bash
npm run security:slither --workspace=@deaddrop/contracts
npm run security:mythril --workspace=@deaddrop/contracts
```

## 2) Prepare 125-item pilot brief file

```bash
npm run prepare:pilot-briefs --workspace=@deaddrop/contracts
```

Output:
- `<REPO_ROOT>/Resources/briefs.pilot125.json`

## 3) Deploy core stack (existing)
Deploy `RelToken + FeeModel + StakingVault` first (if not already deployed):

```bash
npm run deploy:sepolia --workspace=@deaddrop/contracts
```

Capture addresses from output.

## 4) Deploy DailyBriefNFT

```bash
npm run deploy:nft:sepolia --workspace=@deaddrop/contracts
```

Capture `DailyBriefNFT` address and set:

```bash
export DAILY_BRIEF_NFT_ADDRESS=0x...
```

## 5) Configure pilot briefs in batches

```bash
npm run configure:briefs:sepolia --workspace=@deaddrop/contracts
```

Optional overrides:

```bash
BRIEF_FILE=/path/to/briefs.pilot125.json BRIEF_BATCH_SIZE=10 npm run configure:briefs:sepolia --workspace=@deaddrop/contracts
```

## 6) Wire staking oracle to NFT
Call `setNftWeightOracle(RelBoostOracle)` on `StakingVault` as admin (the oracle reads NFT balance and applies BPS math).

Suggested one-off script/console call:
- Contract: `StakingVault`
- Method: `setNftWeightOracle(address)`
- Argument: `DailyBriefNFT address`

## 7) Smoke tests on testnet
- Mint 1 NFT with exact `0.00001 ETH`
- Mint up to 3/day and confirm 4th fails
- Verify `tokenURI` decodes to SVG
- Stake REL then compare `quoteDmFee` before/after owning NFTs
- Test pause/unpause and treasury withdrawal permissions

## 8) Base deployment
Repeat the same steps on Base Sepolia / Base mainnet with Base RPC + BaseScan credentials.

## 9) Go-live controls
- Freeze brief schedule for launch window
- Confirm Gate 4 checklist complete
- Require external audit signoff before mainnet activation
