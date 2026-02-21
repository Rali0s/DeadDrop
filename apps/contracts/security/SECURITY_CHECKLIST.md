# DeadDrop Contracts Security Checklist

Security gate artifacts:
- Threat model: `<REPO_ROOT>/docs/security/daily-brief-nft-threat-model.md`
- Gate checklist: `<REPO_ROOT>/docs/security/daily-brief-nft-security-gates.md`

References used:
- ConsenSys Smart Contract Best Practices: https://consensysdiligence.github.io/smart-contract-best-practices/
- ConsenSys Reentrancy Guidance: https://consensysdiligence.github.io/smart-contract-best-practices/attacks/reentrancy/
- OpenZeppelin Contracts docs (v5): https://docs.openzeppelin.com/contracts
- OpenZeppelin AccessControl docs: https://docs.openzeppelin.com/contracts/5.x/access-control
- Provided checklist: `<LOCAL_DOWNLOADS>/Ethereum Smart Contract Audit CheckList.md`

## Control Matrix

- Compiler pinning:
  - `pragma solidity ^0.8.24`
  - Hardhat compiler explicitly pinned in `hardhat.config.js`

- Access control and admin separation:
  - `AccessControl` roles in all contracts
  - `MINTER_ROLE`, `PAUSER_ROLE`, `PARAM_ADMIN_ROLE`, `FEE_COLLECTOR_ROLE`

- Reentrancy mitigation:
  - `ReentrancyGuard` on all state-changing vault paths that transfer tokens
  - State updates happen before external transfers where possible

- Safe token interaction:
  - `SafeERC20` for all ERC20 transfers in vault
  - no unchecked low-level calls for token movement

- Emergency response:
  - `Pausable` in `RelToken` and `StakingVault`

- ERC20 standard behavior:
  - `RelToken` extends OpenZeppelin ERC20 implementation
  - standard events/return semantics inherited from OZ

- Fee model bounds:
  - validates `base > 0`, `floor > 0`, `floor <= base`, `step > 0`, `tier > 0`
  - floor clamp to prevent negative/underflow-equivalent pricing logic

- Loop/DoS awareness:
  - no unbounded user-controlled loops in core token/vault paths

- Test coverage baseline:
  - fee tier behavior test
  - stake + fee charge flow test
  - fee withdrawal role test

## Commands

Run from `<REPO_ROOT>`:

```bash
npm run build --workspace=@deaddrop/contracts
npm run lint --workspace=@deaddrop/contracts
npm run test --workspace=@deaddrop/contracts
```

## Remaining before production

- Add invariant and fuzz tests (Foundry or Echidna)
- Run static analyzers (`slither`) and symbolic tools
- Add timelock governance for admin actions
- Add audit-ready threat model and privilege table
- External independent audit before deployment
