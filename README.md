# DeadDrop / Relay

Farcaster-inspired SocialFi product combining token incentives, encrypted mailbox messaging, and DeadDrop sealed broadcasts.

## Repository Layout

- `/Users/proteu5/Documents/Github/DeadDrop/apps/web` - React + Vite front end
- `/Users/proteu5/Documents/Github/DeadDrop/apps/api` - Express API scaffold
- `/Users/proteu5/Documents/Github/DeadDrop/apps/contracts` - Hardhat smart contracts (OZ-based)
- `/Users/proteu5/Documents/Github/DeadDrop/packages/shared` - shared types/constants
- `/Users/proteu5/Documents/Github/DeadDrop/docs` - product, architecture, tokenomics, and roadmap docs
  - `/Users/proteu5/Documents/Github/DeadDrop/docs/miniapp-preprod-prod-checklist.md` - Farcaster pre-prod/prod release checklist
  - `/Users/proteu5/Documents/Github/DeadDrop/docs/railway-host-upload.md` - Railway deployment instructions

## Quick Start

```bash
cd /Users/proteu5/Documents/Github/DeadDrop
npm install
npm run dev:api
npm run dev:web
```

Web app:
- default: [http://localhost:5173](http://localhost:5173)
- mini-app surface: [http://localhost:5173/?miniApp=true](http://localhost:5173/?miniApp=true)

Farcaster manifest endpoints:
- [http://localhost:8787/.well-known/farcaster.json](http://localhost:8787/.well-known/farcaster.json)
- [http://localhost:8787/.well-known/miniapp.json](http://localhost:8787/.well-known/miniapp.json)

## Commands

- `npm run dev:web` - starts web app
- `npm run dev:api` - starts API app
- `npm run build` - builds all workspaces
- `npm run build --workspace=@deaddrop/contracts` - compile contracts
- `npm run lint --workspace=@deaddrop/contracts` - solhint checks
- `npm run test --workspace=@deaddrop/contracts` - contract tests
- `npm run deploy:sepolia --workspace=@deaddrop/contracts` - deploy contracts to Sepolia
- `npm run start:api` - production-style API start
- `npm run start:web` - production-style web start (uses `$PORT`)

## Farcaster Mini App Readiness

Aligned to [Farcaster Mini Apps getting started](https://miniapps.farcaster.xyz/docs/getting-started):

- Embed tags in `/Users/proteu5/Documents/Github/DeadDrop/apps/web/index.html`:
  - `fc:miniapp`
  - `fc:frame`
- Runtime SDK readiness call in mini-app mode:
  - `/Users/proteu5/Documents/Github/DeadDrop/apps/web/src/miniapp.ts`
- Manifest serving:
  - `/.well-known/farcaster.json`
- Quick Auth aware API actor resolution:
  - `/Users/proteu5/Documents/Github/DeadDrop/apps/api/src/server.ts`

Pre-prod/prod env templates:
- `/Users/proteu5/Documents/Github/DeadDrop/apps/web/.env.example`
- `/Users/proteu5/Documents/Github/DeadDrop/apps/api/.env.example`
- `/Users/proteu5/Documents/Github/DeadDrop/apps/contracts/.env.example`
- Node runtime pin: `/Users/proteu5/Documents/Github/DeadDrop/.nvmrc`

## Implemented Now

- 4) FARM -> REL epoch conversion API + front-end controls
- 5) REL staking + governance voting API + front-end controls
- Mini-app support with manifest endpoint and mini-app rendering mode
- Mailbox support with inbox/thread read APIs and mini-app mailbox tab
- DM pricing by stake tier: base 1.00 USDC, -0.10 per 100 REL staked, floor 0.10
- Smart contract scaffold: `RelToken`, `StakingVault`, `FeeModel`
