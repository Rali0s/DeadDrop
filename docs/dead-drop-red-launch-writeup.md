# DeadDrop Launch Write-Up (for `<YOUR_APP_DOMAIN>`)

## Suggested Title

DeadDrop Is Live on <YOUR_APP_DOMAIN>: A Farcaster-Native Social Mission Layer

## Suggested URL Slug

`deaddrop-live-on-dead-drop-red`

## Suggested SEO Description

DeadDrop launches on <YOUR_APP_DOMAIN> with encrypted mailbox messaging, mission-based social loops, and stake-weighted DM economics for Farcaster-native communities.

---

DeadDrop is now live at **<YOUR_APP_DOMAIN>**.

This is our mission-grade social layer for Farcaster: a system designed around encrypted communication, meaningful participation, and transparent incentive logic.

The core design is simple:

- private communication should be default, not premium
- quality participation should be rewarded, not farmed blindly
- users should understand exactly how economics and access work

## Why We Built DeadDrop

Most social feeds optimize for maximum noise. DeadDrop is built for high-signal coordination.

We are combining three primitives:

1. **Encrypted Mailbox**: a direct thread-based communication layer
2. **DeadDrop Missions**: gamified participation with clear objective loops
3. **Stake-Aware Economics**: DM pricing that becomes cheaper with higher REL stake

The current DM model:

- base cost: **1.00 USDC per DM**
- discount: **0.10 USDC** per **100 REL** staked
- floor: **0.10 USDC per DM**

This aligns network value with user commitment while remaining predictable and visible.

## Product Surface on Day One

At launch, DeadDrop includes:

- Farcaster-compatible mini app manifest + launch metadata
- mission dashboard with progression and activity actions
- mailbox tab with inbox threads, read-state, and charged DM send flow
- about tab with economics and action definitions
- dual visual themes (dossier + 8-bit) with instant toggle

## Smart Contract Foundation

Our contracts are scaffolded with OpenZeppelin patterns and tested locally:

- **RelToken** (ERC20 + role controls)
- **StakingVault** (staking, fee charging, fee withdrawal)
- **FeeModel** (tiered DM pricing)

Security controls currently integrated include role-based access, pausable paths, safe token transfers, and reentrancy guard on vault operations.

## Security and Production Plan

Before mainnet-grade rollout, we are enforcing:

- production domain + Farcaster account association manifests
- Quick Auth validation in non-local environments
- stricter pre-production verification for manifest and webhook integrity
- independent external smart contract audit prior to production token flows

## What’s Next

Near-term roadmap:

- complete production Farcaster domain association for <YOUR_APP_DOMAIN>
- move from mock state services to persistent production storage
- finalize Base deployment strategy for token/staking modules
- ship governance parameter controls for fee model updates

## Closing

DeadDrop is not trying to be another feed.

It is a coordination layer for communities that need privacy, incentive clarity, and operational structure.

If that is your stack, start here:

**https://<YOUR_APP_DOMAIN>**

---

## Optional Social Post (Short Version)

DeadDrop is live on **<YOUR_APP_DOMAIN>**.

Farcaster-native mission loops + encrypted mailbox + stake-aware DM economics.

Base fee is 1.00 USDC/DM, discounted by REL stake down to 0.10.

This is mission-grade social coordination, not noise.

👉 https://<YOUR_APP_DOMAIN>
