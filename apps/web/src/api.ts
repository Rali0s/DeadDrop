const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8787";
const API_BASE = import.meta.env.VITE_API_URL ?? runtimeOrigin;
const isMiniApp = () => {
  const miniAppParam = new URLSearchParams(window.location.search).get("miniApp") ?? "";
  return window.self !== window.top || miniAppParam === "1" || miniAppParam.startsWith("true");
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

export type WaitlistStats = {
  signupCount: number;
  releaseDate: string;
};

export type DailyBrief = {
  id: string;
  date: string;
  title: string;
  lesson: string;
  quote?: string;
  source?: string;
  tags?: string[];
};

export type NftSummary = {
  mintPriceEth: number;
  walletDailyLimit: number;
  mintedToday: number;
  mintedTotal: number;
  stakedNfts: number;
  cachedBoostBps: number;
  cachedEffectiveRel: number;
  cacheUpdatedAt: string;
};

type ParseMode = "json" | "text";

async function requestWithMode<T>(path: string, init?: RequestInit, parseMode: ParseMode = "json"): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    ...((init?.headers ?? {}) as Record<string, string>)
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

  if (parseMode === "text") {
    return (await res.text()) as T;
  }

  return (await res.json()) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestWithMode<T>(path, init, "json");
}

export const api = {
  getContractManifest: () => request<{ ok: boolean; manifest: Record<string, unknown> }>("/v1/contracts/manifest"),
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
    }),
  signupWaitlist: (input: {
    source: "web" | "miniapp";
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  }) =>
    request<{ ok: boolean; duplicate: boolean; releaseDate: string; signupCount: number }>("/v1/waitlist/signup", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getWaitlistStats: () => request<WaitlistStats>("/v1/waitlist/stats"),
  getDailyBrief: () => request<{ brief: DailyBrief | null; fallback: boolean }>("/v1/brief/today"),
  getNftBriefToday: () =>
    request<{ brief: DailyBrief | null; fallback: boolean; svg: string; svgDataUri: string; nft: NftSummary }>("/v1/nft/brief/today"),
  getNftSummary: () => request<NftSummary>("/v1/nft/summary"),
  mintNftToday: (quantity = 1) =>
    request<{
      ok: boolean;
      quantity: number;
      fallback: boolean;
      mintedToday: number;
      mintedTotal: number;
      lastTokenId: number;
      brief: DailyBrief;
      svgDataUri: string;
    }>("/v1/nft/mint/today", {
      method: "POST",
      body: JSON.stringify({ quantity })
    }),
  updateNftStakeCache: (action: "stake" | "unstake", amount = 1) =>
    request<{ ok: boolean; action: "stake" | "unstake"; amount: number; nft: NftSummary }>("/v1/nft/stake-cache", {
      method: "POST",
      body: JSON.stringify({ action, amount })
    }),
  qa: {
    getConfig: () => request<{ appName: string; actorId: string; authVerified: boolean }>("/v1/config"),
    getContractManifest: () => request<{ ok: boolean; manifest: Record<string, unknown> }>("/v1/contracts/manifest"),
    getAuthMe: (userId: string) => request<{ actorId: string; authVerified: boolean; account: RewardAccount }>(`/v1/auth/me?userId=${encodeURIComponent(userId)}`),
    getRewardsSummary: (userId: string) => request<RewardSummaryResponse>(`/v1/rewards/summary?userId=${encodeURIComponent(userId)}`),
    addActivity: (userId: string, action: string, weight = 1) =>
      request<{ ok: boolean; earned: number; account: RewardAccount }>("/v1/rewards/activity", {
        method: "POST",
        body: JSON.stringify({ userId, action, weight })
      }),
    convertEpoch: (userId: string) =>
      request<{ ok: boolean; relMinted: number; account: RewardAccount }>("/v1/rewards/epoch/convert", {
        method: "POST",
        body: JSON.stringify({ userId })
      }),
    getStakingSummary: (userId: string) => request<StakingSummaryResponse>(`/v1/staking/summary?userId=${encodeURIComponent(userId)}`),
    stake: (userId: string, amount: number) =>
      request<{ ok: boolean; account: RewardAccount }>("/v1/staking/stake", {
        method: "POST",
        body: JSON.stringify({ userId, amount })
      }),
    unstake: (userId: string, amount: number) =>
      request<{ ok: boolean; account: RewardAccount }>("/v1/staking/unstake", {
        method: "POST",
        body: JSON.stringify({ userId, amount })
      }),
    sendDm: (userId: string, recipient: string, body: string) =>
      request<{ ok: boolean; recipient: string; chargedUsdc: number; account: RewardAccount }>("/v1/dm/send", {
        method: "POST",
        body: JSON.stringify({ userId, recipient, body })
      }),
    getInbox: (userId: string) => request<{ threads: InboxThread[] }>(`/v1/dm/inbox?userId=${encodeURIComponent(userId)}`),
    getThread: (userId: string, counterpart: string) =>
      request<{ counterpart: string; messages: ThreadMessage[] }>(
        `/v1/dm/thread/${encodeURIComponent(counterpart)}?userId=${encodeURIComponent(userId)}`
      ),
    markThreadRead: (userId: string, counterpart: string) =>
      request<{ ok: boolean; markedRead: number }>(`/v1/dm/thread/${encodeURIComponent(counterpart)}/read`, {
        method: "POST",
        body: JSON.stringify({ userId })
      }),
    getNftBriefToday: (userId: string) =>
      request<{ brief: DailyBrief | null; fallback: boolean; svgDataUri: string; nft: NftSummary }>(
        `/v1/nft/brief/today?userId=${encodeURIComponent(userId)}`
      ),
    getNftSummary: (userId: string) => request<NftSummary>(`/v1/nft/summary?userId=${encodeURIComponent(userId)}`),
    mintNftToday: (userId: string, quantity = 1) =>
      request<{ ok: boolean; quantity: number; mintedToday: number; mintedTotal: number; lastTokenId: number }>("/v1/nft/mint/today", {
        method: "POST",
        body: JSON.stringify({ userId, quantity })
      }),
    updateNftStakeCache: (userId: string, action: "stake" | "unstake", amount = 1) =>
      request<{ ok: boolean; action: "stake" | "unstake"; amount: number; nft: NftSummary }>("/v1/nft/stake-cache", {
        method: "POST",
        body: JSON.stringify({ userId, action, amount })
      }),
    adminWaitlist: (adminKey: string) =>
      request<{ signupCount: number; releaseDate: string; entries: Array<Record<string, unknown>> }>("/v1/admin/waitlist", {
        headers: { "x-admin-key": adminKey }
      }),
    adminWaitlistCsv: (adminKey: string) =>
      requestWithMode<string>("/v1/admin/waitlist.csv", { headers: { "x-admin-key": adminKey } }, "text"),
    adminBriefs: (adminKey: string) => request<{ count: number; items: DailyBrief[] }>("/v1/admin/briefs", { headers: { "x-admin-key": adminKey } }),
    adminUpsertBriefs: (adminKey: string, items: DailyBrief[]) =>
      request<{ ok: boolean; upserted: number; count: number }>("/v1/admin/briefs", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ items })
      }),
    adminContractState: (adminKey: string) =>
      request<{ ok: boolean; state: Record<string, unknown> }>("/v1/admin/contracts/state", {
        headers: { "x-admin-key": adminKey }
      }),
    adminSetOwner: (adminKey: string, owner: string) =>
      request<{ ok: boolean; owner: string }>("/v1/admin/contracts/owner", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ owner })
      }),
    adminSetDevWallet: (adminKey: string, devWallet: string) =>
      request<{ ok: boolean; devWallet: string }>("/v1/admin/contracts/dev-wallet", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ devWallet })
      }),
    adminSetTreasury: (adminKey: string, treasury: string) =>
      request<{ ok: boolean; treasury: string }>("/v1/admin/contracts/treasury", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ treasury })
      }),
    adminSetNftPause: (adminKey: string, paused: boolean) =>
      request<{ ok: boolean; paused: boolean }>("/v1/admin/contracts/nft/pause", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ paused })
      }),
    adminSetNftDailyLimit: (adminKey: string, limit: number) =>
      request<{ ok: boolean; dailyWalletMintLimit: number }>("/v1/admin/contracts/nft/daily-limit", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ limit })
      }),
    adminSetNftBoostParams: (adminKey: string, perNftBoostBps: number, maxBoostBps: number) =>
      request<{ ok: boolean; perNftBoostBps: number; maxBoostBps: number }>("/v1/admin/contracts/nft/boost-params", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ perNftBoostBps, maxBoostBps })
      }),
    adminAdjustMintedToday: (adminKey: string, userId: string, date: string, count: number) =>
      request<{ ok: boolean; userId: string; date: string; count: number }>("/v1/admin/contracts/nft/minted-today", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ userId, date, count })
      }),
    adminNftWithdraw: (adminKey: string, caller: string, to: string, amount: number) =>
      request<{ ok: boolean; to: string; amount: number; totalEthWithdrawn: number; balance: number }>("/v1/admin/contracts/nft/withdraw", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ caller, to, amount })
      }),
    adminSetVaultPause: (adminKey: string, paused: boolean) =>
      request<{ ok: boolean; paused: boolean }>("/v1/admin/contracts/vault/pause", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ paused })
      }),
    adminSetVaultMaxOracleBps: (adminKey: string, value: number) =>
      request<{ ok: boolean; value: number }>("/v1/admin/contracts/vault/max-oracle-bps", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ value })
      }),
    adminVaultWithdrawFees: (adminKey: string, amount: number) =>
      request<{ ok: boolean; withdrawn: number; collectedUsdcFees: number }>("/v1/admin/contracts/vault/withdraw-fees", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ amount })
      }),
    adminSetFeeModelParams: (
      adminKey: string,
      input: { baseFeeUsdc6: number; floorFeeUsdc6: number; discountStepUsdc6: number; relPerTier: number }
    ) =>
      request<{ ok: boolean; feeModel: Record<string, number> }>("/v1/admin/contracts/fee-model/params", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify(input)
      }),
    adminSetOracleParams: (
      adminKey: string,
      input: {
        baseBps: number;
        perDayTimeBps: number;
        maxTimeBps: number;
        perNftBps: number;
        maxNftBps: number;
        maxTotalBps: number;
      }
    ) =>
      request<{ ok: boolean; oracle: Record<string, number> }>("/v1/admin/contracts/oracle/params", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify(input)
      }),
    adminRelMintEmission: (adminKey: string, amount: number) =>
      request<{ ok: boolean; emissionsMinted: number }>("/v1/admin/contracts/rel/mint-emission", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ amount })
      }),
    adminRelMintSpecial: (adminKey: string, amount: number) =>
      request<{ ok: boolean; specialMinted: number }>("/v1/admin/contracts/rel/mint-special", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ amount })
      }),
    adminRelPause: (adminKey: string, paused: boolean) =>
      request<{ ok: boolean; paused: boolean }>("/v1/admin/contracts/rel/pause", {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: JSON.stringify({ paused })
      }),
    raw: (input: { path: string; method: string; body?: string; adminKey?: string; parseMode?: ParseMode }) => {
      const method = input.method.toUpperCase();
      return requestWithMode<unknown>(
        input.path.startsWith("/") ? input.path : `/${input.path}`,
        {
          method,
          headers: input.adminKey ? { "x-admin-key": input.adminKey } : undefined,
          body: method === "GET" || method === "HEAD" ? undefined : input.body ?? ""
        },
        input.parseMode ?? "json"
      );
    }
  }
};
