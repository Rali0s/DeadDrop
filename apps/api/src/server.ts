import { createClient as createQuickAuthClient } from "@farcaster/quick-auth";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistDir = resolve(__dirname, "../../web/dist");
const apiBaseUrl = process.env.PUBLIC_API_BASE_URL ?? `http://localhost:${port}`;

const configuredCorsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const derivedApiOrigin = (() => {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
})();
const corsOrigins = new Set(
  [...configuredCorsOrigins, "http://localhost:5173", "http://localhost:8787", derivedApiOrigin].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
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

type WaitlistEntry = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  createdAt: string;
  source: "web" | "miniapp";
};

type DailyBrief = {
  id: string;
  date: string; // YYYY-MM-DD UTC
  title: string;
  lesson: string;
  quote?: string;
  source?: string;
  tags?: string[];
};

type NftAccountState = {
  mintedTotal: number;
  stakedNfts: number;
  cachedBoostBps: number;
  cachedEffectiveRel: number;
  cacheUpdatedAt: string;
  mintedByDay: Record<string, number>;
  tokenIds: number[];
};

type ContractQaState = {
  nft: {
    owner: string;
    devWallet: string;
    treasury: string;
    paused: boolean;
    mintPriceEth: number;
    dailyWalletMintLimit: number;
    perNftBoostBps: number;
    maxBoostBps: number;
    startTimestampUtc: number;
    maxDays: number;
    totalEthReceived: number;
    totalEthWithdrawn: number;
    ethBalance: number;
    tokenDay: Record<number, number>;
    tokenSerialInDay: Record<number, number>;
    dailyMintCount: Record<number, number>;
  };
  relToken: {
    paused: boolean;
    emissionsPoolSupply: number;
    specialReserveSupply: number;
    emissionsMinted: number;
    specialMinted: number;
  };
  feeModel: {
    baseFeeUsdc6: number;
    floorFeeUsdc6: number;
    discountStepUsdc6: number;
    relPerTier: number;
  };
  vault: {
    paused: boolean;
    maxOracleBoostBps: number;
    collectedUsdcFees: number;
    nftWeightOracle: string;
  };
  oracle: {
    baseBps: number;
    perDayTimeBps: number;
    maxTimeBps: number;
    perNftBps: number;
    maxNftBps: number;
    maxTotalBps: number;
  };
};

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
      authVerified?: boolean;
    }
  }
}

const miniAppHomeUrl = process.env.MINIAPP_HOME_URL ?? "http://localhost:5173/?miniApp=true";
const miniAppImageUrl = process.env.MINIAPP_IMAGE_URL ?? "http://localhost:5173/miniapp-image.png";
const miniAppSplashUrl = process.env.MINIAPP_SPLASH_URL ?? "http://localhost:5173/miniapp-splash.png";
const quickAuthDomain = process.env.QUICK_AUTH_DOMAIN;
const requireQuickAuth = process.env.REQUIRE_QUICK_AUTH === "true";
const adminApiKey = process.env.ADMIN_API_KEY ?? "";
const waitlistStoragePath = process.env.WAITLIST_STORAGE_PATH ?? resolve(process.cwd(), "data/waitlist.json");
const briefsStoragePath = process.env.COLDWAR_BRIEFS_PATH ?? resolve(process.cwd(), "data/coldwar-briefs.json");
const contractManifestCandidates = [
  process.env.CONTRACT_MANIFEST_PATH,
  resolve(process.cwd(), "data/contract-manifest.sepolia.json"),
  resolve(process.cwd(), "../contracts/deployments/contract-manifest.sepolia.json"),
  resolve(process.cwd(), "../../contracts/deployments/contract-manifest.sepolia.json"),
  resolve(__dirname, "../../../contracts/deployments/contract-manifest.sepolia.json"),
  resolve(__dirname, "../../../../contracts/deployments/contract-manifest.sepolia.json")
].filter(Boolean) as string[];
const nftTemplateCandidates = [
  process.env.NFT_TEMPLATE_PATH,
  resolve(process.cwd(), "Resources/NFT_STANDARD_TEMPLATE.svg"),
  resolve(process.cwd(), "../Resources/NFT_STANDARD_TEMPLATE.svg"),
  resolve(process.cwd(), "../../Resources/NFT_STANDARD_TEMPLATE.svg"),
  resolve(__dirname, "../../../Resources/NFT_STANDARD_TEMPLATE.svg"),
  resolve(__dirname, "../../../../Resources/NFT_STANDARD_TEMPLATE.svg")
].filter(Boolean) as string[];

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
let waitlistEntries: WaitlistEntry[] = [];
let dailyBriefs: DailyBrief[] = [];
let nftTokenCounter = 0;
const nftAccounts: Record<string, NftAccountState> = {};
let contractManifest: Record<string, unknown> | null = null;
const qaState: ContractQaState = {
  nft: {
    owner: "admin",
    devWallet: "dev",
    treasury: "treasury",
    paused: false,
    mintPriceEth: 0.00001,
    dailyWalletMintLimit: 3,
    perNftBoostBps: 25,
    maxBoostBps: 2000,
    startTimestampUtc: Math.floor(Date.now() / 1000) - 60,
    maxDays: 365,
    totalEthReceived: 0,
    totalEthWithdrawn: 0,
    ethBalance: 0,
    tokenDay: {},
    tokenSerialInDay: {},
    dailyMintCount: {}
  },
  relToken: {
    paused: false,
    emissionsPoolSupply: 39_375_000,
    specialReserveSupply: 16_875_000,
    emissionsMinted: 0,
    specialMinted: 0
  },
  feeModel: {
    baseFeeUsdc6: 1_000_000,
    floorFeeUsdc6: 100_000,
    discountStepUsdc6: 100_000,
    relPerTier: 100
  },
  vault: {
    paused: false,
    maxOracleBoostBps: 3000,
    collectedUsdcFees: 0,
    nftWeightOracle: "RelBoostOracle"
  },
  oracle: {
    baseBps: 0,
    perDayTimeBps: 3,
    maxTimeBps: 750,
    perNftBps: 25,
    maxNftBps: 2000,
    maxTotalBps: 3000
  }
};

const seedBriefs: DailyBrief[] = [
  {
    id: "cw-berlin-airlift",
    date: "2026-03-10",
    title: "Berlin Airlift (1948-1949)",
    lesson: "Logistics can be strategy. Sustained airlift operations changed geopolitical leverage without direct combat.",
    quote: "We stay in Berlin. Period.",
    source: "President Harry S. Truman",
    tags: ["Berlin", "Airlift", "Containment"]
  },
  {
    id: "cw-cuban-missile-crisis",
    date: "2026-03-11",
    title: "Cuban Missile Crisis (1962)",
    lesson: "Backchannel communication and calibrated de-escalation prevented nuclear war.",
    quote: "Above all, while defending our own vital interests, nuclear powers must avert confrontations...",
    source: "John F. Kennedy, 1963",
    tags: ["Cuba", "Nuclear", "Diplomacy"]
  }
];

function persistWaitlist(): void {
  const dir = dirname(waitlistStoragePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(waitlistStoragePath, JSON.stringify(waitlistEntries, null, 2), "utf8");
}

function loadWaitlist(): WaitlistEntry[] {
  if (!existsSync(waitlistStoragePath)) {
    return [];
  }
  try {
    const raw = readFileSync(waitlistStoragePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => entry && (typeof entry.fid === "number" || typeof entry.fid === "string"))
      .map((entry) => ({
        fid: Number(entry.fid),
        username: entry.username ? String(entry.username).trim().replace(/^@/, "") : undefined,
        displayName: entry.displayName ? String(entry.displayName).trim() : undefined,
        pfpUrl: entry.pfpUrl ? String(entry.pfpUrl).trim() : undefined,
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        source: (entry.source === "miniapp" ? "miniapp" : "web") as "miniapp" | "web"
      }))
      .filter((entry) => Number.isFinite(entry.fid) && entry.fid > 0);
  } catch {
    return [];
  }
}

waitlistEntries = loadWaitlist();

function loadContractManifest(): Record<string, unknown> | null {
  const manifestPath = contractManifestCandidates.find((candidate) => existsSync(candidate));
  if (!manifestPath) {
    return null;
  }
  try {
    const raw = readFileSync(manifestPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

contractManifest = loadContractManifest();

function persistBriefs(): void {
  const dir = dirname(briefsStoragePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(briefsStoragePath, JSON.stringify(dailyBriefs, null, 2), "utf8");
}

function normalizeBrief(input: unknown): DailyBrief | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const date = String(raw.date ?? "").trim();
  const title = String(raw.title ?? "").trim();
  const lesson = String(raw.lesson ?? "").trim();
  const id = String(raw.id ?? `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`).trim();
  const quote = String(raw.quote ?? "").trim();
  const source = String(raw.source ?? "").trim();
  const tags = Array.isArray(raw.tags) ? raw.tags.map((item) => String(item)).filter(Boolean) : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || !lesson) {
    return null;
  }

  return {
    id,
    date,
    title,
    lesson,
    quote: quote || undefined,
    source: source || undefined,
    tags: tags.length > 0 ? tags : undefined
  };
}

function loadBriefs(): DailyBrief[] {
  if (!existsSync(briefsStoragePath)) {
    return seedBriefs;
  }
  try {
    const raw = readFileSync(briefsStoragePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedBriefs;
    }
    const normalized = parsed.map((item) => normalizeBrief(item)).filter((item): item is DailyBrief => Boolean(item));
    return normalized.length > 0 ? normalized : seedBriefs;
  } catch {
    return seedBriefs;
  }
}

dailyBriefs = loadBriefs();

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
  const relPerTier = Math.max(1, qaState.feeModel.relPerTier);
  const base = qaState.feeModel.baseFeeUsdc6 / 1_000_000;
  const floor = qaState.feeModel.floorFeeUsdc6 / 1_000_000;
  const step = qaState.feeModel.discountStepUsdc6 / 1_000_000;
  const tier = Math.floor(Math.max(0, stakedRel) / relPerTier);
  return Math.max(floor, Number((base - tier * step).toFixed(2)));
}

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTodayBrief(): { brief: DailyBrief | null; fallback: boolean } {
  const todayUtc = getTodayUtcDate();
  const sorted = [...dailyBriefs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const exact = sorted.find((item) => item.date === todayUtc);
  if (exact) {
    return { brief: exact, fallback: false };
  }
  return { brief: sorted.find((item) => item.date <= todayUtc) ?? sorted[0] ?? null, fallback: true };
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function redactedIfEmpty(value: string): string {
  const clean = sanitize(value);
  return clean.length > 0 ? clean : "[ REDACTED ]";
}

function wrapQuoteLines(value: string, maxChars = 75, maxLines = 3): string[] {
  const words = redactedIfEmpty(value).split(" ");
  if (words.length === 0) return ["[ REDACTED ]"];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) break;
    }
    current = word;
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
  }
  if (lines.length === maxLines) {
    const reconstructed = lines.join(" ");
    if (reconstructed.length < words.join(" ").length && lines[maxLines - 1].length > 3) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 3)}...`;
    }
  }
  return lines;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mapBriefToSvg(brief: DailyBrief | null): string {
  const templatePath = nftTemplateCandidates.find((candidate) => existsSync(candidate));
  const template = templatePath
    ? readFileSync(templatePath, "utf8")
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#ece7dc"/></svg>';

  if (!brief) {
    return template;
  }

  const date = redactedIfEmpty(brief.date);
  const title = redactedIfEmpty(brief.title).toUpperCase().slice(0, 44);
  const lesson = redactedIfEmpty(brief.lesson).toUpperCase().slice(0, 42);
  const refId = redactedIfEmpty(brief.id).toUpperCase().slice(0, 18);
  const source = redactedIfEmpty(brief.source ?? "").slice(0, 52);
  const tagLine = (brief.tags ?? []).filter(Boolean).slice(0, 3).map((tag) => sanitize(String(tag)).toUpperCase()).join(" / ") || "TRADECRAFT / ARCHIVE";
  const quoteLines = wrapQuoteLines(brief.quote || brief.lesson).map((line, idx) => `<tspan x="112" dy="${idx === 0 ? 0 : 30}">${xmlEscape(line)}</tspan>`).join("");

  let svg = template;
  svg = svg.replace("2026-02-20 // THE CUBAN MISSILE INTELLIGENCE", xmlEscape(`${date} // ${title}`));
  svg = svg.replace("REF: CW-1962-10-22-CUBA / DOSSIER-A", xmlEscape(`REF: ${refId} / DOSSIER-A`));
  svg = svg.replace("REF: CW-1962-10-22-CUBA / DOSSIER-B", xmlEscape(`REF: ${refId} / DOSSIER-B`));
  svg = svg.replace("LESSON: TIMELY INTELLIGENCE CAN AVERT CATASTRO", xmlEscape(`LESSON: ${lesson}`));
  svg = svg.replace("FIELD NOTE: TRADECRAFT / ARCHIVE", xmlEscape(`FIELD NOTE: ${tagLine.slice(0, 38)}`));
  svg = svg.replace("— CIA Cuban Missile Files", `— ${xmlEscape(source)}`);
  svg = svg.replace(
    /<text class="mono" x="112" y="764" fill="#141414" font-size="16" font-weight="700">[\s\S]*?<\/text>/,
    `<text class="mono" x="112" y="764" fill="#141414" font-size="16" font-weight="700">${quoteLines}</text>`
  );
  return svg;
}

function boostBpsFromStakedNfts(stakedNfts: number): number {
  const bps = Math.max(0, stakedNfts) * qaState.oracle.perNftBps;
  return Math.min(qaState.oracle.maxNftBps, bps);
}

function getOrCreateNftAccount(userId: string): NftAccountState {
  if (!nftAccounts[userId]) {
    nftAccounts[userId] = {
      mintedTotal: 0,
      stakedNfts: 0,
      cachedBoostBps: 0,
      cachedEffectiveRel: 0,
      cacheUpdatedAt: new Date().toISOString(),
      mintedByDay: {},
      tokenIds: []
    };
  }
  return nftAccounts[userId];
}

function refreshNftCache(userId: string, account: RewardAccount): NftAccountState {
  const nftState = getOrCreateNftAccount(userId);
  const nftBoost = boostBpsFromStakedNfts(nftState.stakedNfts);
  const day = Math.max(0, Math.floor((Date.now() / 1000 - qaState.nft.startTimestampUtc) / 86_400));
  const timeBps = Math.min(qaState.oracle.maxTimeBps, day * qaState.oracle.perDayTimeBps);
  const raw = qaState.oracle.baseBps + nftBoost + timeBps;
  const total = Math.min(qaState.oracle.maxTotalBps, raw);
  nftState.cachedBoostBps = total;
  const cappedForVault = Math.min(total, qaState.vault.maxOracleBoostBps);
  nftState.cachedEffectiveRel = Number((account.stakedRel * (1 + cappedForVault / 10_000)).toFixed(2));
  nftState.cacheUpdatedAt = new Date().toISOString();
  return nftState;
}

function effectiveStakeForPricing(userId: string, account: RewardAccount): number {
  const nftState = getOrCreateNftAccount(userId);
  return nftState.cachedEffectiveRel > 0 ? nftState.cachedEffectiveRel : account.stakedRel;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!adminApiKey) {
    res.status(503).json({ ok: false, error: "Admin API not configured" });
    return;
  }

  const authHeader = req.header("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const candidate = (req.header("x-admin-key") ?? bearerToken).trim();

  if (!candidate || candidate !== adminApiKey) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  next();
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
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

app.get("/v1/contracts/manifest", (_req, res) => {
  if (!contractManifest) {
    res.status(404).json({ ok: false, error: "Contract manifest not found" });
    return;
  }
  res.json({ ok: true, manifest: contractManifest });
});

app.post("/v1/waitlist/signup", resolveActor, (req, res) => {
  const source = String(req.body.source ?? "web") === "miniapp" ? "miniapp" : "web";
  const actorId = req.actorId ?? "";
  const fidFromActor = actorId.startsWith("fid:") ? Number(actorId.slice(4)) : NaN;
  const fidFromBody = Number(req.body.fid ?? NaN);
  const fid = Number.isFinite(fidFromActor) && fidFromActor > 0 ? fidFromActor : fidFromBody;

  if (!Number.isFinite(fid) || fid <= 0) {
    res.status(400).json({ ok: false, error: "Valid Farcaster FID is required" });
    return;
  }

  const username = String(req.body.username ?? "").trim().replace(/^@/, "");
  const displayName = String(req.body.displayName ?? "").trim();
  const pfpUrl = String(req.body.pfpUrl ?? "").trim();

  const existing = waitlistEntries.find((entry) => entry.fid === fid);
  if (existing) {
    if (username && !existing.username) {
      existing.username = username;
    }
    if (displayName && !existing.displayName) {
      existing.displayName = displayName;
    }
    if (pfpUrl && !existing.pfpUrl) {
      existing.pfpUrl = pfpUrl;
    }
    persistWaitlist();
    res.json({
      ok: true,
      duplicate: true,
      releaseDate: "2026-03-15",
      signupCount: waitlistEntries.length
    });
    return;
  }

  waitlistEntries.push({
    fid,
    username: username || undefined,
    displayName: displayName || undefined,
    pfpUrl: pfpUrl || undefined,
    createdAt: new Date().toISOString(),
    source
  });
  persistWaitlist();

  res.json({
    ok: true,
    duplicate: false,
    releaseDate: "2026-03-15",
    signupCount: waitlistEntries.length
  });
});

app.get("/v1/waitlist/stats", (_req, res) => {
  res.json({
    signupCount: waitlistEntries.length,
    releaseDate: "2026-03-15"
  });
});

app.get("/v1/brief/today", (_req, res) => {
  const { brief, fallback } = getTodayBrief();
  res.json({ brief, fallback });
});

app.get("/v1/brief/archive", (req, res) => {
  const limit = Math.max(1, Math.min(30, Number(req.query.limit ?? 7)));
  const items = [...dailyBriefs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  res.json({ items, count: items.length });
});

app.get("/v1/admin/waitlist", requireAdmin, (_req, res) => {
  res.json({
    signupCount: waitlistEntries.length,
    releaseDate: "2026-03-15",
    entries: waitlistEntries
  });
});

app.get("/v1/admin/waitlist.csv", requireAdmin, (_req, res) => {
  const header = ["fid", "username", "displayName", "pfpUrl", "source", "createdAt"];
  const rows = waitlistEntries.map((entry) =>
    [
      escapeCsv(String(entry.fid)),
      escapeCsv(entry.username ?? ""),
      escapeCsv(entry.displayName ?? ""),
      escapeCsv(entry.pfpUrl ?? ""),
      escapeCsv(entry.source),
      escapeCsv(entry.createdAt)
    ].join(",")
  );

  const csv = `${header.join(",")}\n${rows.join("\n")}\n`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=relay-waitlist.csv");
  res.send(csv);
});

app.get("/v1/admin/briefs", requireAdmin, (_req, res) => {
  const items = [...dailyBriefs].sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ count: items.length, items });
});

app.post("/v1/admin/briefs", requireAdmin, (req, res) => {
  const input: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
  if (input.length === 0) {
    res.status(400).json({ ok: false, error: "Provide items[] with brief records" });
    return;
  }

  const upserts = input.map((item) => normalizeBrief(item)).filter((item): item is DailyBrief => Boolean(item));
  if (upserts.length === 0) {
    res.status(400).json({ ok: false, error: "No valid brief records in payload" });
    return;
  }

  const byId = new Map(dailyBriefs.map((entry) => [entry.id, entry]));
  for (const entry of upserts) {
    byId.set(entry.id, entry);
  }

  dailyBriefs = Array.from(byId.values());
  persistBriefs();

  res.json({
    ok: true,
    upserted: upserts.length,
    count: dailyBriefs.length
  });
});

app.get("/v1/admin/contracts/state", requireAdmin, (_req, res) => {
  res.json({ ok: true, state: qaState });
});

app.post("/v1/admin/contracts/owner", requireAdmin, (req, res) => {
  const owner = String(req.body.owner ?? "").trim();
  if (!owner) {
    res.status(400).json({ ok: false, error: "owner required" });
    return;
  }
  qaState.nft.owner = owner;
  res.json({ ok: true, owner });
});

app.post("/v1/admin/contracts/dev-wallet", requireAdmin, (req, res) => {
  const devWallet = String(req.body.devWallet ?? "").trim();
  if (!devWallet) {
    res.status(400).json({ ok: false, error: "devWallet required" });
    return;
  }
  qaState.nft.devWallet = devWallet;
  res.json({ ok: true, devWallet });
});

app.post("/v1/admin/contracts/treasury", requireAdmin, (req, res) => {
  const treasury = String(req.body.treasury ?? "").trim();
  if (!treasury) {
    res.status(400).json({ ok: false, error: "treasury required" });
    return;
  }
  qaState.nft.treasury = treasury;
  res.json({ ok: true, treasury });
});

app.post("/v1/admin/contracts/nft/pause", requireAdmin, (req, res) => {
  qaState.nft.paused = Boolean(req.body.paused);
  res.json({ ok: true, paused: qaState.nft.paused });
});

app.post("/v1/admin/contracts/nft/daily-limit", requireAdmin, (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.body.limit ?? 3)));
  qaState.nft.dailyWalletMintLimit = limit;
  res.json({ ok: true, dailyWalletMintLimit: limit });
});

app.post("/v1/admin/contracts/nft/boost-params", requireAdmin, (req, res) => {
  const perNftBoostBps = Math.max(1, Number(req.body.perNftBoostBps ?? qaState.nft.perNftBoostBps));
  const maxBoostBps = Math.max(1, Number(req.body.maxBoostBps ?? qaState.nft.maxBoostBps));
  qaState.nft.perNftBoostBps = perNftBoostBps;
  qaState.nft.maxBoostBps = maxBoostBps;
  // Keep oracle in sync for QA simulation.
  qaState.oracle.perNftBps = perNftBoostBps;
  qaState.oracle.maxNftBps = maxBoostBps;
  res.json({ ok: true, perNftBoostBps, maxBoostBps });
});

app.post("/v1/admin/contracts/nft/minted-today", requireAdmin, (req, res) => {
  const userId = String(req.body.userId ?? "demo");
  const date = String(req.body.date ?? getTodayUtcDate());
  const count = Math.max(0, Number(req.body.count ?? 0));
  const nftState = getOrCreateNftAccount(userId);
  nftState.mintedByDay[date] = count;
  res.json({ ok: true, userId, date, count });
});

app.post("/v1/admin/contracts/nft/withdraw", requireAdmin, (req, res) => {
  const caller = String(req.body.caller ?? "").trim();
  const to = String(req.body.to ?? "").trim();
  const amount = Number(req.body.amount ?? 0);

  if (!caller || !to || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: "caller, to, amount required" });
    return;
  }
  if (caller !== qaState.nft.owner && caller !== qaState.nft.devWallet) {
    res.status(403).json({ ok: false, error: "onlyOwnerOrDevWallet" });
    return;
  }
  if (amount > qaState.nft.ethBalance) {
    res.status(400).json({ ok: false, error: "insufficient balance" });
    return;
  }
  qaState.nft.ethBalance = Number((qaState.nft.ethBalance - amount).toFixed(8));
  qaState.nft.totalEthWithdrawn = Number((qaState.nft.totalEthWithdrawn + amount).toFixed(8));
  res.json({
    ok: true,
    to,
    amount,
    totalEthWithdrawn: qaState.nft.totalEthWithdrawn,
    balance: qaState.nft.ethBalance
  });
});

app.post("/v1/admin/contracts/vault/pause", requireAdmin, (req, res) => {
  qaState.vault.paused = Boolean(req.body.paused);
  res.json({ ok: true, paused: qaState.vault.paused });
});

app.post("/v1/admin/contracts/vault/max-oracle-bps", requireAdmin, (req, res) => {
  const value = Math.max(0, Math.min(10_000, Number(req.body.value ?? qaState.vault.maxOracleBoostBps)));
  qaState.vault.maxOracleBoostBps = value;
  res.json({ ok: true, value });
});

app.post("/v1/admin/contracts/vault/withdraw-fees", requireAdmin, (req, res) => {
  const amount = Number(req.body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ ok: false, error: "amount required" });
    return;
  }
  if (amount > qaState.vault.collectedUsdcFees) {
    res.status(400).json({ ok: false, error: "insufficient fees" });
    return;
  }
  qaState.vault.collectedUsdcFees = Number((qaState.vault.collectedUsdcFees - amount).toFixed(2));
  res.json({ ok: true, withdrawn: amount, collectedUsdcFees: qaState.vault.collectedUsdcFees });
});

app.post("/v1/admin/contracts/fee-model/params", requireAdmin, (req, res) => {
  const baseFeeUsdc6 = Math.max(1, Number(req.body.baseFeeUsdc6 ?? qaState.feeModel.baseFeeUsdc6));
  const floorFeeUsdc6 = Math.max(1, Number(req.body.floorFeeUsdc6 ?? qaState.feeModel.floorFeeUsdc6));
  const discountStepUsdc6 = Math.max(1, Number(req.body.discountStepUsdc6 ?? qaState.feeModel.discountStepUsdc6));
  const relPerTier = Math.max(1, Number(req.body.relPerTier ?? qaState.feeModel.relPerTier));
  qaState.feeModel = { baseFeeUsdc6, floorFeeUsdc6, discountStepUsdc6, relPerTier };
  res.json({ ok: true, feeModel: qaState.feeModel });
});

app.post("/v1/admin/contracts/oracle/params", requireAdmin, (req, res) => {
  qaState.oracle.baseBps = Math.max(0, Number(req.body.baseBps ?? qaState.oracle.baseBps));
  qaState.oracle.perDayTimeBps = Math.max(0, Number(req.body.perDayTimeBps ?? qaState.oracle.perDayTimeBps));
  qaState.oracle.maxTimeBps = Math.max(0, Number(req.body.maxTimeBps ?? qaState.oracle.maxTimeBps));
  qaState.oracle.perNftBps = Math.max(0, Number(req.body.perNftBps ?? qaState.oracle.perNftBps));
  qaState.oracle.maxNftBps = Math.max(0, Number(req.body.maxNftBps ?? qaState.oracle.maxNftBps));
  qaState.oracle.maxTotalBps = Math.max(0, Number(req.body.maxTotalBps ?? qaState.oracle.maxTotalBps));
  res.json({ ok: true, oracle: qaState.oracle });
});

app.post("/v1/admin/contracts/rel/mint-emission", requireAdmin, (req, res) => {
  const amount = Math.max(0, Number(req.body.amount ?? 0));
  if (qaState.relToken.emissionsMinted + amount > qaState.relToken.emissionsPoolSupply) {
    res.status(400).json({ ok: false, error: "emission cap" });
    return;
  }
  qaState.relToken.emissionsMinted += amount;
  res.json({ ok: true, emissionsMinted: qaState.relToken.emissionsMinted });
});

app.post("/v1/admin/contracts/rel/mint-special", requireAdmin, (req, res) => {
  const amount = Math.max(0, Number(req.body.amount ?? 0));
  if (qaState.relToken.specialMinted + amount > qaState.relToken.specialReserveSupply) {
    res.status(400).json({ ok: false, error: "special cap" });
    return;
  }
  qaState.relToken.specialMinted += amount;
  res.json({ ok: true, specialMinted: qaState.relToken.specialMinted });
});

app.post("/v1/admin/contracts/rel/pause", requireAdmin, (req, res) => {
  qaState.relToken.paused = Boolean(req.body.paused);
  res.json({ ok: true, paused: qaState.relToken.paused });
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
  const userId = req.actorId ?? "demo";
  const account = getOrCreateAccount(userId);
  const nftState = refreshNftCache(userId, account);
  const effectiveRel = effectiveStakeForPricing(userId, account);
  const projectedRel = Number((account.farmPoints * epochSummary.conversionRate).toFixed(2));

  res.json({
    epoch: epochSummary,
    account,
    projectedRel,
    dmPricing: {
      basePrice: 1,
      floorPrice: 0.1,
      currentPrice: dmUnitPrice(effectiveRel)
    },
    nftStakingCache: nftState
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
  if (qaState.vault.paused) {
    res.status(400).json({ ok: false, error: "vault paused" });
    return;
  }
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

  refreshNftCache(sender, account);
  const effectiveRel = effectiveStakeForPricing(sender, account);
  const unitPrice = dmUnitPrice(effectiveRel);
  if (account.usdcBalance < unitPrice) {
    res.status(400).json({ ok: false, error: "Insufficient USDC balance for DM send fee" });
    return;
  }

  account.usdcBalance = Number((account.usdcBalance - unitPrice).toFixed(2));
  account.dmSentCount += 1;
  qaState.vault.collectedUsdcFees = Number((qaState.vault.collectedUsdcFees + unitPrice).toFixed(2));

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
      stakedRel: effectiveRel,
      dmUnitPrice: unitPrice,
      nextTierAtRel: Math.min(900, (Math.floor(effectiveRel / 100) + 1) * 100)
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
  if (qaState.vault.paused || qaState.relToken.paused) {
    res.status(400).json({ ok: false, error: "staking paused" });
    return;
  }
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
  refreshNftCache(req.actorId ?? "demo", account);

  res.json({ ok: true, account });
});

app.post("/v1/staking/unstake", (req, res) => {
  if (qaState.vault.paused || qaState.relToken.paused) {
    res.status(400).json({ ok: false, error: "staking paused" });
    return;
  }
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
  refreshNftCache(req.actorId ?? "demo", account);

  res.json({ ok: true, account });
});

app.get("/v1/governance/proposals", (_req, res) => {
  res.json({ proposals });
});

app.get("/v1/nft/brief/today", (req, res) => {
  const userId = req.actorId ?? "demo";
  const { brief, fallback } = getTodayBrief();
  const svg = mapBriefToSvg(brief);
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  const account = getOrCreateAccount(userId);
  const nftState = refreshNftCache(userId, account);
  res.json({ brief, fallback, svg, svgDataUri, nft: nftState });
});

app.get("/v1/nft/summary", (req, res) => {
  const userId = req.actorId ?? "demo";
  const account = getOrCreateAccount(userId);
  const nftState = refreshNftCache(userId, account);
  const today = getTodayUtcDate();
  res.json({
    mintPriceEth: qaState.nft.mintPriceEth,
    walletDailyLimit: qaState.nft.dailyWalletMintLimit,
    mintedToday: nftState.mintedByDay[today] ?? 0,
    ...nftState
  });
});

app.post("/v1/nft/mint/today", (req, res) => {
  const userId = req.actorId ?? "demo";
  const quantity = Math.max(1, Math.min(qaState.nft.dailyWalletMintLimit, Number(req.body.quantity ?? 1)));
  const today = getTodayUtcDate();
  const { brief, fallback } = getTodayBrief();
  if (!brief) {
    res.status(400).json({ ok: false, error: "No brief available to mint" });
    return;
  }

  if (qaState.nft.paused) {
    res.status(400).json({ ok: false, error: "mint paused" });
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const dayIndex = Math.max(0, Math.floor((now - qaState.nft.startTimestampUtc) / 86_400));
  if (dayIndex >= qaState.nft.maxDays || now < qaState.nft.startTimestampUtc) {
    res.status(400).json({ ok: false, error: "mint window closed" });
    return;
  }

  const nftState = getOrCreateNftAccount(userId);
  const mintedToday = nftState.mintedByDay[today] ?? 0;
  if (mintedToday + quantity > qaState.nft.dailyWalletMintLimit) {
    res.status(400).json({ ok: false, error: `Daily mint limit reached (${qaState.nft.dailyWalletMintLimit})` });
    return;
  }

  nftState.mintedByDay[today] = mintedToday + quantity;
  nftState.mintedTotal += quantity;
  for (let i = 0; i < quantity; i++) {
    nftTokenCounter += 1;
    nftState.tokenIds.push(nftTokenCounter);
    qaState.nft.tokenDay[nftTokenCounter] = dayIndex;
    const nextSerial = (qaState.nft.dailyMintCount[dayIndex] ?? 0) + 1;
    qaState.nft.dailyMintCount[dayIndex] = nextSerial;
    qaState.nft.tokenSerialInDay[nftTokenCounter] = nextSerial;
  }
  const mintPaid = Number((qaState.nft.mintPriceEth * quantity).toFixed(8));
  qaState.nft.totalEthReceived = Number((qaState.nft.totalEthReceived + mintPaid).toFixed(8));
  qaState.nft.ethBalance = Number((qaState.nft.ethBalance + mintPaid).toFixed(8));

  const svg = mapBriefToSvg(brief);
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  const account = getOrCreateAccount(userId);
  refreshNftCache(userId, account);

  res.json({
    ok: true,
    quantity,
    fallback,
    mintedToday: nftState.mintedByDay[today],
    mintedTotal: nftState.mintedTotal,
    lastTokenId: nftTokenCounter,
    brief,
    svgDataUri
  });
});

app.post("/v1/nft/stake-cache", (req, res) => {
  const userId = req.actorId ?? "demo";
  const action = String(req.body.action ?? "stake") === "unstake" ? "unstake" : "stake";
  const amount = Math.max(1, Number(req.body.amount ?? 1));
  const nftState = getOrCreateNftAccount(userId);

  if (action === "stake") {
    const available = nftState.mintedTotal - nftState.stakedNfts;
    if (available < amount) {
      res.status(400).json({ ok: false, error: "Not enough minted NFTs available to stake" });
      return;
    }
    nftState.stakedNfts += amount;
  } else {
    if (nftState.stakedNfts < amount) {
      res.status(400).json({ ok: false, error: "Not enough staked NFTs to unstake" });
      return;
    }
    nftState.stakedNfts -= amount;
  }

  const account = getOrCreateAccount(userId);
  const updated = refreshNftCache(userId, account);
  res.json({ ok: true, action, amount, nft: updated });
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

// Single-domain mode: serve web app from API host when web dist is present.
if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/v1") || req.path.startsWith("/.well-known") || req.path === "/health") {
      next();
      return;
    }

    res.sendFile(resolve(webDistDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`deaddrop api listening on http://localhost:${port}`);
});
