# Relay Product Requirements Document (PRD)

## 1. Product Summary

Relay is a Farcaster-style decentralized social app focused on secure messaging and tokenized participation.

Core pillars:
- Token incentives (REL + FARM)
- Direct Mailbox (persistent E2EE messaging)
- DeadDrop (ephemeral sealed broadcasts)
- Mini App composability

## 2. Goals

- Increase 30-day retention via messaging loops and quests
- Create durable creator incentives via epoch rewards
- Build privacy-preserving communication primitives that can scale from DM to gated broadcast

## 3. Non-Goals (MVP)

- Full DAO framework
- Cross-chain bridging
- In-app perpetual trading features

## 4. Users

- Social creators using Farcaster clients
- Communities that need gated information sharing
- Power users who value private communications and token rewards

## 5. Key Features

### 5.1 Identity and Wallet
- Sign in via Farcaster identity + wallet
- Generate client-side X25519/Ed25519 keypairs
- Publish public encryption key with signed account proof

### 5.2 Direct Mailbox
- E2EE one-to-one and small-group chat
- Read receipts as optional proofs
- Thread-level reward multipliers for meaningful interactions

### 5.3 DeadDrop
- Sender creates encrypted broadcast to recipient set
- Recipient unlock requires signature + eligibility proof (stake/follow/NFT/list)
- Optional burn-after-read behavior via one-time key release

### 5.4 Incentive Engine
- FARM points from verified activity (casts, replies, unlocks, quests)
- Weekly epochs convert FARM to REL by normalized contribution score
- Anti-sybil and anti-spam penalties reduce exploitable actions

### 5.5 Profit and Growth Features
- Staking fees
- Sponsored quests
- Premium broadcast slots
- Mini App revenue share

## 6. Functional Requirements

- FR-1: User can provision keys in <10s on first login
- FR-2: User can send and receive E2EE DM messages with media metadata
- FR-3: User can create a DeadDrop with recipient gating and expiry
- FR-4: User can unlock DeadDrop once eligibility proof is validated
- FR-5: User sees FARM accrual and projected epoch conversion
- FR-6: Admin/governance can tune reward weights without redeploying all contracts

## 7. Security Requirements

- SR-1: Server stores only ciphertext and encrypted envelope keys
- SR-2: Message keys are never logged in plaintext
- SR-3: One-time key retrieval for burn-after-read mode
- SR-4: Rate limits and stake/slash policy for first-contact DM requests
- SR-5: Explicit consent flow for abuse report content disclosure

## 8. Success Metrics

- D7 retention > 35%
- DeadDrop open rate > 45%
- DM reply within 24h > 50%
- Weekly active stakers / monthly active users > 12%
- Spam report rate < 2%

## 9. Risks

- Regulatory uncertainty around token rewards
- Sybil farming exploits
- UX complexity from key management
- Moderation limits due to encryption

## 10. Open Questions

- Should DeadDrop use recipient-sealed keys or epoch group keys at launch?
- What is minimum viable governance scope for REL holders in v1?
- How much REL must be staked for different broadcast tiers?
