export type RelayMetric = {
  label: string;
  value: string;
  trend: string;
};

export type RewardAccount = {
  userId: string;
  farmPoints: number;
  relBalance: number;
  stakedRel: number;
  contributionScore: number;
};

export type EpochSummary = {
  epochId: string;
  startDate: string;
  endDate: string;
  emissionRel: number;
  conversionRate: number;
};

export type GovernanceProposal = {
  id: string;
  title: string;
  status: "open" | "closed";
  yesVotes: number;
  noVotes: number;
};

export const defaultMetrics: RelayMetric[] = [
  { label: "DM Reply < 24h", value: "51%", trend: "+8.2%" },
  { label: "DeadDrop Open Rate", value: "47%", trend: "+4.5%" },
  { label: "WAP / MAU", value: "13%", trend: "+1.1%" }
];
