# Sepolia Admin Deploy Prep

This project now includes an admin-wallet preflight and one-shot Sepolia bundle deploy.

## 1) Set env

Create `<REPO_ROOT>/apps/contracts/.env` from `.env.example` and set:

- `SEPOLIA_RPC_URL`
- `DEPLOYER_PRIVATE_KEY` (admin wallet key)
- `ETHERSCAN_API_KEY` (optional for verify)
- `ADMIN_ADDRESS`
- `TREASURY_ADDRESS`
- `DEV_WALLET_ADDRESS`
- `STRICT_ADMIN_DEPLOYER=true`
- `USDC_TOKEN_ADDRESS` (set for live USDC)
- `REQUIRE_LIVE_USDC=true` (recommended in pre-prod/prod)
- optional fee + brief vars

## 2) Preflight (no deploy)

```bash
cd <REPO_ROOT>
npm run preflight:sepolia:admin --workspace=@deaddrop/contracts
```

Checks:
- env completeness
- deployer address
- deployer ETH balance
- deployer/admin match when strict mode is on

## 3) Deploy admin bundle (when ready)

```bash
cd <REPO_ROOT>
npm run deploy:sepolia:admin-bundle --workspace=@deaddrop/contracts
```

Deploys and wires:
- `RelToken`
- `USDC` (live if `USDC_TOKEN_ADDRESS` set, otherwise mock)
- `FeeModel`
- `StakingVault`
- `DailyBriefNFT`
- `RelBoostOracle`
- wires `StakingVault.setNftWeightOracle(RelBoostOracle)`

All core contracts are deployed as OpenZeppelin UUPS proxies.

Artifacts are written to:
- `<REPO_ROOT>/apps/contracts/deployments/sepolia-<timestamp>.json`
- `<REPO_ROOT>/apps/contracts/deployments/sepolia.latest.json`

## 4) Configure briefs (optional)

```bash
export DAILY_BRIEF_NFT_ADDRESS=<deployed_nft_address>
npm run configure:briefs:sepolia --workspace=@deaddrop/contracts
```
