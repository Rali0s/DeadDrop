# Daily Brief NFT Security Gates

## Gate 0: Threat Model
- [ ] Threat model written and reviewed
- [ ] Privilege table complete
- [ ] Invariants documented

## Gate 1: Static + Policy
- [ ] `npm run lint --workspace=@deaddrop/contracts`
- [ ] `npm run build --workspace=@deaddrop/contracts`
- [ ] `npm run security:slither --workspace=@deaddrop/contracts`
- [ ] `npm run security:mythril --workspace=@deaddrop/contracts` (or equivalent)
- [ ] Role-policy review complete

## Gate 2: Property/Invariant
- [ ] Unit tests pass
- [ ] Invariant tests cover cap/window/payment/boost/withdraw
- [ ] Fuzz tests for long strings and boundary timestamps

## Gate 3: Integration/Adversarial
- [ ] Near-midnight concurrent mint scenarios simulated
- [ ] Cap bypass attempts tested
- [ ] Oracle stale/removed scenarios tested
- [ ] Misconfigured day index scenarios tested

## Gate 4: Pre-Prod Release
- [ ] Internal walkthrough against audit checklist
  - `<LOCAL_DOWNLOADS>/Ethereum Smart Contract Audit CheckList.md`
- [ ] ConsenSys + OZ checklist pass documented
- [ ] External audit completed
- [ ] No unresolved High/Critical findings
- [ ] Medium findings mitigated or explicitly accepted

## Evidence Artifacts
- Test logs and gas report
- Slither/Mythril reports
- Threat model doc
- Role matrix and incident runbook
