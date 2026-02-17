const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const isMiniApp = () => {
  const miniAppParam = new URLSearchParams(window.location.search).get("miniApp");
  return window.self !== window.top || miniAppParam === "true" || miniAppParam === "1";
};

export type RewardAccount = {
  userId: string;
  farmPoints: number;
  relBalance: number;
  stakedRel: number;
  contributionScore: number;
  usdcBalance: number;
  dmSentCount: number;
};

export type RewardSummaryResponse = {
  epoch: {
    epochId: string;
    startDate: string;
    endDate: string;
    emissionRel: number;
    conversionRate: number;
  };
  account: RewardAccount;
  projectedRel: number;
  dmPricing: {
    basePrice: number;
    floorPrice: number;
    currentPrice: number;
  };
};

export type StakingSummaryResponse = {
  account: RewardAccount;
  staking: {
    apr: number;
    lockDays: number;
    estimatedWeeklyYield: number;
  };
};

export type Proposal = {
  id: string;
  title: string;
  status: "open" | "closed";
  yesVotes: number;
  noVotes: number;
};

export type InboxThread = {
  threadId: string;
  counterpart: string;
  lastBody: string;
  lastTs: string;
  unreadCount: number;
  lastPrice: number;
};

export type ThreadMessage = {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  sentAt: string;
  chargedUsdc: number;
  readAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {})
  };

  let res: Response;
  if (isMiniApp()) {
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      res = await sdk.quickAuth.fetch(url, { ...init, headers });
    } catch {
      res = await fetch(url, { ...init, headers });
    }
  } else {
    res = await fetch(url, { ...init, headers });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export const api = {
  getConfig: () => request<{ appName: string; miniApp: { enabled: boolean; manifestPath: string } }>("/v1/config"),
  getRewardsSummary: () => request<RewardSummaryResponse>("/v1/rewards/summary?userId=demo"),
  addActivity: (action: string) =>
    request<{ earned: number; account: RewardSummaryResponse["account"] }>("/v1/rewards/activity", {
      method: "POST",
      body: JSON.stringify({ userId: "demo", action, weight: 1 })
    }),
  convertEpoch: () =>
    request<{ relMinted: number; account: RewardSummaryResponse["account"] }>("/v1/rewards/epoch/convert", {
      method: "POST",
      body: JSON.stringify({ userId: "demo" })
    }),
  getStaking: () => request<StakingSummaryResponse>("/v1/staking/summary?userId=demo"),
  stake: (amount: number) =>
    request<{ account: RewardSummaryResponse["account"] }>("/v1/staking/stake", {
      method: "POST",
      body: JSON.stringify({ userId: "demo", amount })
    }),
  unstake: (amount: number) =>
    request<{ account: RewardSummaryResponse["account"] }>("/v1/staking/unstake", {
      method: "POST",
      body: JSON.stringify({ userId: "demo", amount })
    }),
  getProposals: () => request<{ proposals: Proposal[] }>("/v1/governance/proposals"),
  vote: (id: string, side: "yes" | "no", weight: number) =>
    request<{ proposal: Proposal }>(`/v1/governance/proposals/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ side, weight })
    }),
  sendDm: (recipient: string, body: string) =>
    request<{
      chargedUsdc: number;
      recipient: string;
      account: RewardSummaryResponse["account"];
      pricing: { stakedRel: number; dmUnitPrice: number; nextTierAtRel: number };
    }>("/v1/dm/send", {
      method: "POST",
      body: JSON.stringify({ userId: "demo", recipient, body })
    }),
  getInbox: () => request<{ threads: InboxThread[] }>("/v1/dm/inbox?userId=demo"),
  getThread: (counterpart: string) => request<{ counterpart: string; messages: ThreadMessage[] }>(`/v1/dm/thread/${counterpart}?userId=demo`),
  markThreadRead: (counterpart: string) =>
    request<{ markedRead: number }>(`/v1/dm/thread/${counterpart}/read`, {
      method: "POST",
      body: JSON.stringify({ userId: "demo" })
    })
};
