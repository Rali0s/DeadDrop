# Smart Contract Design (Draft)

Network target: Optimism-compatible EVM.

## 1. Contracts

1. `RelToken`
- ERC-20 with role-based mint controls
- vesting-aware transfer hooks optional

2. `FarmPoints`
- non-transferable accounting token or points ledger contract
- mint/burn restricted to `RewardsController`

3. `RewardsController`
- receives activity attestations
- computes epoch snapshots and REL allocations
- supports governance-tunable weights

4. `StakingVault`
- REL staking and reward distribution
- unlock periods + early-unstake penalty

5. `DeadDropPolicy`
- on-chain policy registry for gating rules
- stake thresholds, eligibility predicates, and fee schedule

6. `GovernanceTimelock`
- parameter change delay and execution controls

## 2. Off-Chain + On-Chain Boundary

Keep message payloads off-chain (DB/IPFS). On-chain stores:
- economic commitments
- reward checkpoints
- policy and governance state

## 3. Minimal Interfaces

```solidity
interface IRewardsController {
  function recordActivity(address user, bytes32 actionType, uint256 weight) external;
  function finalizeEpoch(uint256 epochId) external;
  function claimRewards(uint256 epochId, address user) external;
}

interface IStakingVault {
  function stake(uint256 amount) external;
  function unstake(uint256 amount) external;
  function claimYield() external;
}

interface IDeadDropPolicy {
  function canBroadcast(address user, uint256 recipientCount) external view returns (bool);
  function requiredStake(uint256 recipientCount) external view returns (uint256);
}
```

## 4. Security Controls

- Access control via OpenZeppelin `AccessControl`
- Pausable critical paths
- Reentrancy protection
- Separate hot-path operational roles from governance roles
- Mandatory audits before mainnet deployment

## 5. Upgrade Strategy

- UUPS or transparent proxy only where change likelihood is high
- Freeze immutable modules (token core) where possible
- Governance + timelock required for upgrades
