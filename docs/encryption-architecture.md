# Encryption Architecture

## 1. Cryptographic Stack

- Identity signatures: Ed25519
- Key agreement: X25519 (ECDH)
- KDF: HKDF-SHA256
- Symmetric encryption: ChaCha20-Poly1305 (AEAD)
- Hashing/fingerprints: SHA-256

## 2. Key Model

Per user:
- `identity_signing_key` (Ed25519)
- `encryption_key` (X25519)
- optional device subkeys for multi-device sessions

Rules:
- Private keys generated and stored client-side
- Public keys published with signed proof linked to Farcaster identity
- Server never receives plaintext private key material

## 3. Direct Mailbox E2EE

Message flow:
1. Sender performs X25519 with recipient public key
2. Shared secret expanded with HKDF into message key + nonce derivation material
3. Plaintext encrypted with ChaCha20-Poly1305
4. Ciphertext + metadata stored server-side

Long threads:
- Use lightweight Double Ratchet to provide forward secrecy
- Session state stored encrypted at rest on each client device

## 4. DeadDrop Sealed Broadcast

### Option A: Sealed-to-Recipient (MVP default)

1. Generate random content key `K`
2. Encrypt payload once with `K`
3. For each recipient, encrypt `K` to recipient public key
4. Publish `{ciphertext, recipient_envelopes[], policy, expiry}`

Pros:
- simple and robust for small-medium recipient sets

Tradeoff:
- payload size grows linearly with recipient count

### Option B: Epoch Group Key (v2)

1. DeadDrop channel gets rotating group key per epoch
2. Eligible recipients receive group key envelope
3. Messages in epoch encrypted once to group key

Pros:
- constant message payload size, better for large broadcasts

Tradeoff:
- more key lifecycle complexity

## 5. Burn-After-Read Semantics

Hard guarantee is impossible once plaintext is displayed, but practical ephemerality is achievable:
- Key server releases decrypt key one time only
- TTL and device binding enforced
- Clients avoid persistent plaintext storage (memory-only mode)
- Retrieval logs auditable for abuse/fraud signals

## 6. Abuse and Spam Controls

Because content is encrypted, moderation relies on metadata and policy layers:
- stake-to-message or proof-of-work for first-contact DMs
- trusted inbox mode (mutual-follow / token-gated)
- per-user and per-device rate limits
- reputation scoring and slashing for abuse
- user-consented reveal flow for moderator investigations

## 7. Security Acceptance Criteria

- No server endpoint can decrypt message content
- Replay protection for DeadDrop unlock tokens
- Key rotation supported without account reset
- Cryptographic primitives sourced from vetted libraries only
