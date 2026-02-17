import { createClient as createQuickAuthClient } from "@farcaster/quick-auth";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

const app = express();
const port = Number(process.env.PORT ?? 8787);

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS policy"));
    }
  })
);
app.use(express.json());

type RewardAccount = {
  userId: string;
  farmPoints: number;
  relBalance: number;
  stakedRel: number;
  contributionScore: number;
  usdcBalance: number;
  dmSentCount: number;
};

type Proposal = {
  id: string;
  title: string;
  status: "open" | "closed";
  yesVotes: number;
  noVotes: number;
};

type DMMessage = {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  sentAt: string;
  chargedUsdc: number;
  readAt?: string;
};

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
      authVerified?: boolean;
    }
  }
}

const apiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? `http://localhost:${port}`;
const miniAppHomeUrl = process.env.MINIAPP_HOME_URL ?? "http://localhost:5173/?miniApp=true";
const miniAppImageUrl = process.env.MINIAPP_IMAGE_URL ?? "http://localhost:5173/miniapp-image.png";
const miniAppSplashUrl = process.env.MINIAPP_SPLASH_URL ?? "http://localhost:5173/miniapp-splash.png";
const quickAuthDomain = process.env.QUICK_AUTH_DOMAIN;
const requireQuickAuth = process.env.REQUIRE_QUICK_AUTH === "true";

const accountAssociation = {
  header: process.env.FARCASTER_HEADER ?? "",
  payload: process.env.FARCASTER_PAYLOAD ?? "",
  signature: process.env.FARCASTER_SIGNATURE ?? ""
};

const quickAuthClient = createQuickAuthClient();

const epochSummary = {
  epochId: "2026-W07",
  startDate: "2026-02-16",
  endDate: "2026-02-22",
  emissionRel: 100000,
  conversionRate: 0.25
};

const rewardAccounts: Record<string, RewardAccount> = {
  demo: {
    userId: "demo",
    farmPoints: 1240,
    relBalance: 710,
    stakedRel: 320,
    contributionScore: 188,
    usdcBalance: 125,
    dmSentCount: 0
  }
};

const dmMessages: DMMessage[] = [];
let dmMessageCounter = 0;

function makeDefaultAccount(userId: string): RewardAccount {
  return {
    userId,
    farmPoints: 0,
    relBalance: 0,
    stakedRel: 0,
    contributionScore: 0,
    usdcBalance: 10,
    dmSentCount: 0
  };
}

function getOrCreateAccount(userId: string): RewardAccount {
  if (!rewardAccounts[userId]) {
    rewardAccounts[userId] = makeDefaultAccount(userId);
  }
  return rewardAccounts[userId];
}

function dmUnitPrice(stakedRel: number): number {
  const tier = Math.floor(Math.max(0, stakedRel) / 100);
  return Math.max(0.1, Number((1 - tier * 0.1).toFixed(2)));
}

const proposals: Proposal[] = [
  {
    id: "P-11",
    title: "Increase DeadDrop Tier-2 stake from 250 REL to 300 REL",
    status: "open",
    yesVotes: 18240,
    noVotes: 4620
  },
  {
    id: "P-12",
    title: "Lower first-contact DM fee by 20%",
    status: "open",
    yesVotes: 9320,
    noVotes: 3880
  }
];

async function resolveActor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  let actorId = "";
  let authVerified = false;

  if (bearerToken && quickAuthDomain) {
    try {
      const payload = await quickAuthClient.verifyJwt({ token: bearerToken, domain: quickAuthDomain });
      actorId = `fid:${payload.sub}`;
      authVerified = true;
    } catch {
      res.status(401).json({ ok: false, error: "Invalid Quick Auth token" });
      return;
    }
  }

  if (!actorId) {
    actorId = String(req.body?.userId ?? req.query?.userId ?? "demo").trim();
  }

  if (requireQuickAuth && !authVerified) {
    res.status(401).json({ ok: false, error: "Quick Auth token required" });
    return;
  }

  if (!actorId) {
    res.status(400).json({ ok: false, error: "Actor identity missing" });
    return;
  }

  req.actorId = actorId;
  req.authVerified = authVerified;
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "deaddrop-api", ts: new Date().toISOString() });
});

app.get("/.well-known/farcaster.json", (_req, res) => {
  const manifest = {
    accountAssociation,
    frame: {
      version: "1",
      name: "Relay",
      iconUrl: miniAppImageUrl,
      homeUrl: miniAppHomeUrl,
      imageUrl: miniAppImageUrl,
      buttonTitle: "Open Relay",
      splashImageUrl: miniAppSplashUrl,
      splashBackgroundColor: "#f4f0e2",
      webhookUrl: `${apiBaseUrl}/v1/webhook`
    },
    miniapp: {
      version: "1",
      name: "Relay",
      iconUrl: miniAppImageUrl,
      homeUrl: miniAppHomeUrl,
      imageUrl: miniAppImageUrl,
      buttonTitle: "Open Relay",
      splashImageUrl: miniAppSplashUrl,
      splashBackgroundColor: "#f4f0e2",
      webhookUrl: `${apiBaseUrl}/v1/webhook`
    }
  };

  res.json(manifest);
});

app.get("/.well-known/miniapp.json", (_req, res) => {
  res.json({
    name: "Relay Mini App",
    short_name: "Relay",
    description: "Encrypted SocialFi mailbox + DeadDrop incentive loops",
    version: "0.1.0",
    icons: [],
    entrypoint: miniAppHomeUrl,
    permissions: ["wallet", "user-profile"],
    chains: ["optimism"],
    apiBase: apiBaseUrl
  });
});

app.use("/v1", resolveActor);

app.get("/v1/config", (req, res) => {
  res.json({
    appName: "Relay",
    actorId: req.actorId,
    authVerified: req.authVerified,
    miniApp: {
      enabled: true,
      manifestPath: "/.well-known/farcaster.json",
      homeUrl: miniAppHomeUrl
    },
    messaging: {
      dm: "E2EE",
      deaddrop: "sealed-broadcast"
    },
    rewards: {
      epochDays: 7,
      tokens: ["REL", "FARM"]
    }
  });
});

app.get("/v1/auth/me", (req, res) => {
  const actorId = req.actorId ?? "demo";
  const account = getOrCreateAccount(actorId);

  res.json({
    actorId,
    authVerified: req.authVerified ?? false,
    account
  });
});

app.get("/v1/rewards/summary", (req, res) => {
  const account = getOrCreateAccount(req.actorId ?? "demo");
  const projectedRel = Number((account.farmPoints * epochSummary.conversionRate).toFixed(2));

  res.json({
    epoch: epochSummary,
    account,
    projectedRel,
    dmPricing: {
      basePrice: 1,
      floorPrice: 0.1,
      currentPrice: dmUnitPrice(account.stakedRel)
    }
  });
});

app.post("/v1/rewards/activity", (req, res) => {
  const action = String(req.body.action ?? "dm_reply");
  const weight = Number(req.body.weight ?? 1);

  const account = getOrCreateAccount(req.actorId ?? "demo");

  const pointMap: Record<string, number> = {
    cast: 10,
    dm_reply: 14,
    deaddrop_unlock: 20,
    quest: 12
  };

  const earned = Math.max(0, Math.floor((pointMap[action] ?? 8) * Math.max(1, weight)));
  account.farmPoints += earned;
  account.contributionScore += Math.max(1, Math.floor(earned / 5));

  res.json({ ok: true, earned, account });
});

app.post("/v1/rewards/epoch/convert", (req, res) => {
  const account = getOrCreateAccount(req.actorId ?? "demo");
  const relMinted = Number((account.farmPoints * epochSummary.conversionRate).toFixed(2));

  account.relBalance += relMinted;
  account.farmPoints = 0;

  res.json({
    ok: true,
    relMinted,
    account,
    epoch: epochSummary
  });
});

app.post("/v1/dm/send", (req, res) => {
  const sender = req.actorId ?? "demo";
  const recipient = String(req.body.recipient ?? "target").trim();
  const body = String(req.body.body ?? "").trim();
  const account = getOrCreateAccount(sender);

  if (!recipient) {
    res.status(400).json({ ok: false, error: "Recipient is required" });
    return;
  }

  if (!body) {
    res.status(400).json({ ok: false, error: "Message body is required" });
    return;
  }

  const unitPrice = dmUnitPrice(account.stakedRel);
  if (account.usdcBalance < unitPrice) {
    res.status(400).json({ ok: false, error: "Insufficient USDC balance for DM send fee" });
    return;
  }

  account.usdcBalance = Number((account.usdcBalance - unitPrice).toFixed(2));
  account.dmSentCount += 1;

  dmMessageCounter += 1;
  dmMessages.push({
    id: `dm-${dmMessageCounter}`,
    sender,
    recipient,
    body,
    sentAt: new Date().toISOString(),
    chargedUsdc: unitPrice
  });

  res.json({
    ok: true,
    recipient,
    chargedUsdc: unitPrice,
    account,
    pricing: {
      stakedRel: account.stakedRel,
      dmUnitPrice: unitPrice,
      nextTierAtRel: Math.min(900, (Math.floor(account.stakedRel / 100) + 1) * 100)
    }
  });
});

app.get("/v1/dm/inbox", (req, res) => {
  const userId = req.actorId ?? "demo";

  const threadMap = new Map<
    string,
    { threadId: string; counterpart: string; lastBody: string; lastTs: string; unreadCount: number; lastPrice: number }
  >();

  for (const message of dmMessages) {
    if (message.sender !== userId && message.recipient !== userId) {
      continue;
    }

    const counterpart = message.sender === userId ? message.recipient : message.sender;
    const existing = threadMap.get(counterpart);
    const unread = message.recipient === userId && !message.readAt ? 1 : 0;

    if (!existing || message.sentAt > existing.lastTs) {
      threadMap.set(counterpart, {
        threadId: counterpart,
        counterpart,
        lastBody: message.body,
        lastTs: message.sentAt,
        unreadCount: (existing?.unreadCount ?? 0) + unread,
        lastPrice: message.chargedUsdc
      });
    } else {
      existing.unreadCount += unread;
      threadMap.set(counterpart, existing);
    }
  }

  const threads = Array.from(threadMap.values()).sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
  res.json({ threads });
});

app.get("/v1/dm/thread/:counterpart", (req, res) => {
  const userId = req.actorId ?? "demo";
  const counterpart = String(req.params.counterpart);

  const messages = dmMessages
    .filter(
      (message) =>
        (message.sender === userId && message.recipient === counterpart) ||
        (message.sender === counterpart && message.recipient === userId)
    )
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1));

  res.json({ counterpart, messages });
});

app.post("/v1/dm/thread/:counterpart/read", (req, res) => {
  const userId = req.actorId ?? "demo";
  const counterpart = String(req.params.counterpart);
  const now = new Date().toISOString();

  let marked = 0;
  for (const message of dmMessages) {
    if (message.sender === counterpart && message.recipient === userId && !message.readAt) {
      message.readAt = now;
      marked += 1;
    }
  }

  res.json({ ok: true, markedRead: marked, counterpart });
});

app.get("/v1/staking/summary", (req, res) => {
  const account = getOrCreateAccount(req.actorId ?? "demo");

  const apr = 14.8;
  const estimatedWeeklyYield = Number(((account.stakedRel * apr) / 5200).toFixed(2));

  res.json({
    account,
    staking: {
      apr,
      lockDays: 7,
      estimatedWeeklyYield
    }
  });
});

app.post("/v1/staking/stake", (req, res) => {
  const amount = Number(req.body.amount ?? 0);
  const account = getOrCreateAccount(req.actorId ?? "demo");

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: "Stake amount must be greater than 0" });
    return;
  }

  if (account.relBalance < amount) {
    res.status(400).json({ ok: false, error: "Insufficient REL balance" });
    return;
  }

  account.relBalance -= amount;
  account.stakedRel += amount;

  res.json({ ok: true, account });
});

app.post("/v1/staking/unstake", (req, res) => {
  const amount = Number(req.body.amount ?? 0);
  const account = getOrCreateAccount(req.actorId ?? "demo");

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: "Unstake amount must be greater than 0" });
    return;
  }

  if (account.stakedRel < amount) {
    res.status(400).json({ ok: false, error: "Insufficient staked REL" });
    return;
  }

  account.stakedRel -= amount;
  account.relBalance += amount;

  res.json({ ok: true, account });
});

app.get("/v1/governance/proposals", (_req, res) => {
  res.json({ proposals });
});

app.post("/v1/governance/proposals/:id/vote", (req, res) => {
  const proposal = proposals.find((item) => item.id === req.params.id);
  if (!proposal || proposal.status !== "open") {
    res.status(404).json({ ok: false, error: "Open proposal not found" });
    return;
  }

  const side = String(req.body.side ?? "yes");
  const weight = Number(req.body.weight ?? 1);
  if (!Number.isFinite(weight) || weight <= 0) {
    res.status(400).json({ ok: false, error: "Vote weight must be greater than 0" });
    return;
  }

  if (side === "yes") {
    proposal.yesVotes += weight;
  } else {
    proposal.noVotes += weight;
  }

  res.json({ ok: true, proposal });
});

app.post("/v1/webhook", (_req, res) => {
  res.status(202).json({ ok: true });
});

app.listen(port, () => {
  console.log(`deaddrop api listening on http://localhost:${port}`);
});
