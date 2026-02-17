# MVP Implementation Plan

## Phase 0: Foundations (Week 1)

- Define architecture decisions (DeadDrop option A for MVP)
- Finalize schema for users, keys, messages, unlock proofs, rewards
- Set up CI, lint, test framework, and threat-model checklist

Deliverables:
- ADRs for cryptography and reward engine
- baseline service scaffolding

## Phase 1: Identity + E2EE Mailbox (Weeks 2-4)

- Farcaster auth + account linking
- Client-side key generation and public key publishing
- E2EE DM send/receive path with ciphertext storage
- Basic anti-spam controls (rate limits, trusted inbox)

Exit criteria:
- Two users can exchange E2EE messages across fresh devices

## Phase 2: DeadDrop MVP (Weeks 5-7)

- Sealed-to-recipient broadcast envelopes
- Eligibility checks (stake/follow/list)
- One-time key retrieval and TTL expiry
- DeadDrop inbox and unlock UX

Exit criteria:
- Sender can broadcast to 100 recipients with unlock success > 95%

## Phase 3: Rewards + Staking (Weeks 8-10)

- FARM event collection and quality scoring
- Weekly epoch conversion to REL claims
- REL staking vault and basic fee share

Exit criteria:
- End-to-end epoch close and claim flow in staging

## Phase 4: Launch Readiness (Weeks 11-12)

- Security review and testnet hardening
- Growth instrumentation dashboard
- About/Profit pages in app + web marketing surface

Exit criteria:
- Mainnet go/no-go checklist complete

## Initial Backlog (1-2 day task slices)

1. Client crypto module wrapper (X25519/HKDF/AEAD)
2. Key registration API and signature verification
3. DM session state + ratchet persistence
4. Ciphertext message storage API
5. DeadDrop envelope generator
6. Unlock proof verifier
7. One-time key server with TTL enforcement
8. FARM event ingestion service
9. Epoch calculator + merkle claim builder
10. Staking vault UI + transaction flow
11. Abuse report consent + moderation tooling
12. Metrics pipeline for retention and open-rate KPIs

## Dependencies

- Wallet and Farcaster auth libraries
- Secure key management support on mobile/web
- Audit partner availability before launch window
