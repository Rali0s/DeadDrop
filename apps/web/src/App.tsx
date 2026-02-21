import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  api,
  type DailyBrief,
  type InboxThread,
  type NftSummary,
  type RewardSummaryResponse,
  type StakingSummaryResponse,
  type ThreadMessage,
  type WaitlistStats
} from "./api";
import { detectMiniAppMode, getMiniAppUserContext, notifyMiniAppReady } from "./miniapp";
import { REL_WHITEPAPER_ABOUT } from "./relWhitepaper";

const metrics = [
  { label: "DeadDrop Open Rate", value: "47%", delta: "+4.5%" },
  { label: "DM Reply < 24h", value: "51%", delta: "+8.2%" },
  { label: "Stakers / MAU", value: "13%", delta: "+1.1%" }
];

const loops = [
  {
    title: "Create -> Cast -> Earn",
    detail: "Quality posts and interaction proofs roll into FARM points with weekly REL conversion."
  },
  {
    title: "DeadDrop Scarcity",
    detail: "Stake REL, broadcast sealed payloads, and reward verified unlock activity."
  },
  {
    title: "Mailbox Retention",
    detail: "E2EE DMs with trust gates and incentives drive repeat conversations."
  }
];

const activityOptions = [
  { key: "cast", label: "File Cast" },
  { key: "dm_reply", label: "Intercept DM" },
  { key: "deaddrop_unlock", label: "Unlock DeadDrop" },
  { key: "quest", label: "Complete Quest" }
] as const;

type ActivityKey = (typeof activityOptions)[number]["key"];

const missionDetails = {
  dossier: "NODE-07",
  operation: "DEAD DROP",
  fileId: "Σ-404-83",
  authKey: "404-Σ",
  dropLat: "52.5200N",
  dropLon: "13.4050E",
  castRef: "CAST://RELAY-07"
};

type ContractManifestShape = {
  network?: string;
  chainId?: number;
  admin?: string;
  treasury?: string;
  devWallet?: string;
  contracts?: Record<
    string,
    {
      address?: string;
      abi?: Array<{ type?: string; name?: string; stateMutability?: string; inputs?: Array<{ type?: string; name?: string }> }>;
    }
  >;
};

export default function App() {
  const [rewards, setRewards] = useState<RewardSummaryResponse | null>(null);
  const [staking, setStaking] = useState<StakingSummaryResponse | null>(null);
  const [inboxThreads, setInboxThreads] = useState<InboxThread[]>([]);
  const [activeThread, setActiveThread] = useState<string>("agent-404");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStats | null>(null);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [nftSummary, setNftSummary] = useState<NftSummary | null>(null);
  const [nftPreviewUri, setNftPreviewUri] = useState<string>("");
  const [nftLoading, setNftLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(50);
  const [miniEnabled, setMiniEnabled] = useState(false);
  const [miniTab, setMiniTab] = useState<"mission" | "mailbox" | "about" | "timeline">("mission");
  const [dmRecipient, setDmRecipient] = useState("agent-404");
  const [dmBody, setDmBody] = useState("Package secure. Awaiting extraction window.");
  const [themeMode, setThemeMode] = useState<"dossier" | "8bit">(() => {
    if (typeof window === "undefined") {
      return "dossier";
    }
    try {
      return window.localStorage.getItem("relay-theme-mode") === "8bit" ? "8bit" : "dossier";
    } catch {
      return "dossier";
    }
  });
  const [qaAllowed] = useState(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return p.get("qa") === "1" || window.localStorage.getItem("relay-qa-enabled") === "1";
  });
  const [qaVisible, setQaVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search);
    return p.get("qa") === "1" || window.localStorage.getItem("relay-qa-mode") === "1";
  });
  const [qaAdminKey, setQaAdminKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("relay-qa-admin-key") ?? "";
  });
  const [qaActorId, setQaActorId] = useState("demo");
  const [qaAmount, setQaAmount] = useState(1);
  const [qaAction, setQaAction] = useState<ActivityKey>("quest");
  const [qaRecipient, setQaRecipient] = useState("agent-404");
  const [qaBody, setQaBody] = useState("QA payload");
  const [qaThread, setQaThread] = useState("agent-404");
  const [qaMintQty, setQaMintQty] = useState(1);
  const [qaStakeAction, setQaStakeAction] = useState<"stake" | "unstake">("stake");
  const [qaRawPath, setQaRawPath] = useState("/v1/health");
  const [qaRawMethod, setQaRawMethod] = useState("GET");
  const [qaRawBody, setQaRawBody] = useState("{}");
  const [qaOutput, setQaOutput] = useState("");
  const [qaOwner, setQaOwner] = useState("admin");
  const [qaDevWallet, setQaDevWallet] = useState("dev");
  const [qaTreasury, setQaTreasury] = useState("treasury");
  const [qaWithdrawCaller, setQaWithdrawCaller] = useState("admin");
  const [qaWithdrawTo, setQaWithdrawTo] = useState("treasury");
  const [qaWithdrawAmount, setQaWithdrawAmount] = useState(0.00001);
  const [qaMintedDate, setQaMintedDate] = useState(new Date().toISOString().slice(0, 10));
  const [qaMintedCount, setQaMintedCount] = useState(0);
  const [qaDailyLimit, setQaDailyLimit] = useState(3);
  const [qaPerNftBoost, setQaPerNftBoost] = useState(25);
  const [qaMaxBoost, setQaMaxBoost] = useState(2000);
  const [qaVaultMaxOracleBps, setQaVaultMaxOracleBps] = useState(3000);
  const [qaBaseFeeUsdc6, setQaBaseFeeUsdc6] = useState(1000000);
  const [qaFloorFeeUsdc6, setQaFloorFeeUsdc6] = useState(100000);
  const [qaDiscountStepUsdc6, setQaDiscountStepUsdc6] = useState(100000);
  const [qaRelPerTier, setQaRelPerTier] = useState(100);
  const [qaOracleBaseBps, setQaOracleBaseBps] = useState(0);
  const [qaOraclePerDayBps, setQaOraclePerDayBps] = useState(3);
  const [qaOracleMaxTimeBps, setQaOracleMaxTimeBps] = useState(750);
  const [qaOraclePerNftBps, setQaOraclePerNftBps] = useState(25);
  const [qaOracleMaxNftBps, setQaOracleMaxNftBps] = useState(2000);
  const [qaOracleMaxTotalBps, setQaOracleMaxTotalBps] = useState(3000);
  const [qaRelMintAmount, setQaRelMintAmount] = useState(1000);
  const [qaVaultFeeWithdrawAmount, setQaVaultFeeWithdrawAmount] = useState(1);
  const [qaManifest, setQaManifest] = useState<ContractManifestShape | null>(null);
  const [qaSelectedContract, setQaSelectedContract] = useState<string>("");
  const [qaWeb3Account, setQaWeb3Account] = useState("");
  const [qaWeb3ChainId, setQaWeb3ChainId] = useState<number | null>(null);
  const [qaWeb3Method, setQaWeb3Method] = useState("");
  const [qaWeb3Args, setQaWeb3Args] = useState("[]");
  const [qaWeb3ValueEth, setQaWeb3ValueEth] = useState("0");
  const [qaWeb3Status, setQaWeb3Status] = useState("Disconnected");
  const [qaBriefDraft, setQaBriefDraft] = useState(
    JSON.stringify(
      [
        {
          id: "qa-brief-1",
          date: new Date().toISOString().slice(0, 10),
          title: "QA Brief",
          lesson: "Control surface test payload.",
          quote: "Inspect every edge.",
          source: "QA",
          tags: ["QA", "ADMIN"]
        }
      ],
      null,
      2
    )
  );

  const isMini = useMemo(() => detectMiniAppMode(), []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const waitlistData = await api.getWaitlistStats();
      setWaitlistStats(waitlistData);

      try {
        const nftBriefData = await api.getNftBriefToday();
        setDailyBrief(nftBriefData.brief);
        const previewUri =
          nftBriefData.svgDataUri ||
          (nftBriefData.svg ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(nftBriefData.svg)))}` : "");
        setNftPreviewUri(previewUri);
        setNftSummary(nftBriefData.nft);
      } catch {
        try {
          const briefData = await api.getDailyBrief();
          setDailyBrief(briefData.brief);
        } catch {
          setDailyBrief(null);
        }
        setNftPreviewUri("");
      }

      const [config, rewardData, stakingData, inboxData] = await Promise.all([
        api.getConfig(),
        api.getRewardsSummary(),
        api.getStaking(),
        api.getInbox()
      ]);

      setMiniEnabled(config.miniApp.enabled);
      setRewards(rewardData);
      setStaking(stakingData);
      setInboxThreads(inboxData.threads);
      if (!nftSummary) {
        try {
          setNftSummary(await api.getNftSummary());
        } catch {
          // ignore nft summary failures for non-nft flows
        }
      }

      const nextThread = inboxData.threads[0]?.counterpart ?? "agent-404";
      setActiveThread((current) => current || nextThread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshThread(counterpart: string) {
    try {
      const [threadData] = await Promise.all([api.getThread(counterpart), api.markThreadRead(counterpart)]);
      setThreadMessages(threadData.messages);
      setActiveThread(counterpart);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mailbox thread");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    void notifyMiniAppReady();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("miniApp") === "true" || params.get("miniApp") === "1") {
      return;
    }

    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isFarcasterClient = /Farcaster|Warpcast|warpcast/i.test(ua) || params.get("fc") === "1";
    if (isMobile || isFarcasterClient) {
      window.location.replace("/?miniApp=true");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("relay-theme-mode", themeMode);
    } catch {
      // ignore storage failures in restrictive webviews
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (qaAllowed) {
      window.localStorage.setItem("relay-qa-enabled", "1");
    }
  }, [qaAllowed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("relay-qa-mode", qaVisible ? "1" : "0");
  }, [qaVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (qaAdminKey) {
      window.localStorage.setItem("relay-qa-admin-key", qaAdminKey);
    }
  }, [qaAdminKey]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }
    void refreshThread(activeThread);
  }, [activeThread]);

  async function runActivity(action: ActivityKey) {
    setTxMessage(null);
    try {
      const res = await api.addActivity(action);
      setTxMessage(`Activity recorded: +${res.earned} FARM`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record activity");
    }
  }

  async function convertEpoch() {
    setTxMessage(null);
    try {
      const res = await api.convertEpoch();
      setTxMessage(`Epoch converted: +${res.relMinted} REL minted`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert epoch");
    }
  }

  async function stake(action: "stake" | "unstake") {
    setTxMessage(null);
    try {
      if (action === "stake") {
        await api.stake(stakeAmount);
        setTxMessage(`Staked ${stakeAmount} REL`);
      } else {
        await api.unstake(stakeAmount);
        setTxMessage(`Unstaked ${stakeAmount} REL`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staking transaction failed");
    }
  }

  async function sendChargedDm() {
    setTxMessage(null);
    try {
      const res = await api.sendDm(dmRecipient, dmBody);
      setTxMessage(
        `DM sent to ${res.recipient}. Charged ${res.chargedUsdc.toFixed(2)} USDC at ${res.pricing.dmUnitPrice.toFixed(2)} USDC/DM`
      );
      setDmBody("");
      await refreshThread(res.recipient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DM send failed");
    }
  }

  async function submitWaitlist(source: "web" | "miniapp") {
    setWaitlistLoading(true);
    setWaitlistMessage(null);
    setError(null);

    try {
      const profile = await getMiniAppUserContext();
      if (!profile) {
        setError("Open this in Farcaster Mini App to join with your FID/username.");
        return;
      }

      const res = await api.signupWaitlist({
        source,
        fid: profile.fid,
        username: profile.username,
        displayName: profile.displayName,
        pfpUrl: profile.pfpUrl
      });
      setWaitlistMessage(
        res.duplicate
          ? `You are already on the list. Release target is ${res.releaseDate}.`
          : `You're in. Release target is ${res.releaseDate}. Signups: ${res.signupCount}.`
      );
      setWaitlistStats({ signupCount: res.signupCount, releaseDate: res.releaseDate });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waitlist signup failed");
    } finally {
      setWaitlistLoading(false);
    }
  }

  async function mintTodayNft(quantity: number) {
    setNftLoading(true);
    setTxMessage(null);
    setError(null);
    try {
      const res = await api.mintNftToday(quantity);
      setNftPreviewUri(res.svgDataUri);
      setTxMessage(`Minted ${res.quantity} NFT${res.quantity > 1 ? "s" : ""}. Total minted: ${res.mintedTotal}.`);
      try {
        setNftSummary(await api.getNftSummary());
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFT mint failed");
    } finally {
      setNftLoading(false);
    }
  }

  async function updateNftStakeCache(action: "stake" | "unstake", amount: number) {
    setNftLoading(true);
    setTxMessage(null);
    setError(null);
    try {
      const res = await api.updateNftStakeCache(action, amount);
      setNftSummary(res.nft);
      setTxMessage(
        `${action === "stake" ? "Staked" : "Unstaked"} ${amount} NFT${amount > 1 ? "s" : ""}. Boost: +${(
          res.nft.cachedBoostBps / 100
        ).toFixed(2)}%`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "NFT stake cache update failed");
    } finally {
      setNftLoading(false);
    }
  }

  async function runQa(label: string, exec: () => Promise<unknown>) {
    setError(null);
    try {
      const data = await exec();
      setQaOutput(`${label}\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "QA call failed";
      setQaOutput(`${label}\nERROR: ${message}`);
      setError(message);
    }
  }

  async function loadAndSyncManifest() {
    await runQa("contracts/manifest sync", async () => {
      const result = await api.qa.getContractManifest();
      const manifest = result.manifest as ContractManifestShape;
      setQaManifest(manifest);

      if (manifest.admin) setQaOwner(manifest.admin);
      if (manifest.devWallet) setQaDevWallet(manifest.devWallet);
      if (manifest.treasury) {
        setQaTreasury(manifest.treasury);
        setQaWithdrawTo(manifest.treasury);
      }

      const contractKeys = Object.keys(manifest.contracts ?? {});
      if (contractKeys.length > 0) {
        setQaSelectedContract((prev) => (prev && contractKeys.includes(prev) ? prev : contractKeys[0]));
      }

      return result;
    });
  }

  const selectedContractMeta = useMemo(() => {
    return qaManifest?.contracts?.[qaSelectedContract];
  }, [qaManifest, qaSelectedContract]);

  const selectedContractFunctions = useMemo(() => {
    const abi = selectedContractMeta?.abi ?? [];
    return abi
      .filter((entry) => entry.type === "function" && entry.name)
      .map((entry) => {
        const inputs = (entry.inputs ?? []).map((input) => input.type || "unknown").join(",");
        return {
          key: `${entry.name}(${inputs})`,
          name: entry.name || "",
          stateMutability: entry.stateMutability || "nonpayable"
        };
      });
  }, [selectedContractMeta]);

  useEffect(() => {
    if (!qaWeb3Method && selectedContractFunctions.length > 0) {
      setQaWeb3Method(selectedContractFunctions[0].key);
      return;
    }
    if (qaWeb3Method && selectedContractFunctions.length > 0) {
      const exists = selectedContractFunctions.some((fn) => fn.key === qaWeb3Method);
      if (!exists) {
        setQaWeb3Method(selectedContractFunctions[0].key);
      }
    }
  }, [selectedContractFunctions, qaWeb3Method]);

  function stringifyWithBigInt(value: unknown): string {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === "bigint") return val.toString();
        return val;
      },
      2
    );
  }

  async function connectWeb3Qa() {
    try {
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) {
        throw new Error("No wallet detected. Install MetaMask/Rabby.");
      }

      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] }).catch(async () => {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"]
            }
          ]
        });
      });

      const provider = new ethers.BrowserProvider(eth as unknown as ethers.Eip1193Provider);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const account = String(accounts?.[0] ?? "");

      setQaWeb3Account(account);
      setQaWeb3ChainId(Number(network.chainId));
      setQaWeb3Status(account ? "Connected" : "Disconnected");
      setQaOutput(`web3 connected\naccount=${account}\nchainId=${network.chainId.toString()}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "web3 connect failed";
      setQaWeb3Status(`Error: ${message}`);
      setQaOutput(`web3 connect error\n${message}`);
      setError(message);
    }
  }

  async function runWeb3SelectedFunction() {
    try {
      const eth = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (!eth) throw new Error("No wallet detected");
      const address = selectedContractMeta?.address;
      const abi = selectedContractMeta?.abi;
      if (!address || !abi) throw new Error("Select a contract from manifest first");

      const fnMeta = selectedContractFunctions.find((fn) => fn.key === qaWeb3Method);
      if (!fnMeta) throw new Error("Select a function");

      const parsedArgs = JSON.parse(qaWeb3Args || "[]");
      if (!Array.isArray(parsedArgs)) throw new Error("Arguments must be a JSON array");

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(address, abi, signer);
      const isRead = fnMeta.stateMutability === "view" || fnMeta.stateMutability === "pure";
      const isPayable = fnMeta.stateMutability === "payable";

      if (isRead) {
        const result = await contract[fnMeta.name](...parsedArgs);
        setQaOutput(`web3 read ${fnMeta.key}\n${stringifyWithBigInt(result)}`);
        return;
      }

      const overrides = isPayable ? { value: ethers.parseEther(qaWeb3ValueEth || "0") } : undefined;
      const tx = overrides ? await contract[fnMeta.name](...parsedArgs, overrides) : await contract[fnMeta.name](...parsedArgs);
      const receipt = await tx.wait();
      setQaOutput(
        `web3 write ${fnMeta.key}\n${stringifyWithBigInt({
          hash: tx.hash,
          status: receipt?.status,
          blockNumber: receipt?.blockNumber,
          contract: address
        })}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "web3 contract call failed";
      setQaOutput(`web3 call error\n${message}`);
      setError(message);
    }
  }

  const progress = rewards ? Math.min(100, Math.floor((rewards.account.farmPoints / 1500) * 100)) : 0;

  const missionChecklist = [
    {
      label: "Authenticate Relay identity key",
      complete: Boolean(rewards),
      actionLabel: "Verify",
      action: () => void runActivity("quest")
    },
    {
      label: "Send encrypted mailbox action",
      complete: (rewards?.account.contributionScore ?? 0) >= 5,
      actionLabel: "Dispatch",
      action: () => void runActivity("dm_reply")
    },
    {
      label: "Unlock one DeadDrop payload",
      complete: (rewards?.account.farmPoints ?? 0) >= 40,
      actionLabel: "Unlock",
      action: () => void runActivity("deaddrop_unlock")
    },
    {
      label: "Convert epoch FARM to REL",
      complete: (rewards?.account.farmPoints ?? 0) === 0 && (rewards?.account.relBalance ?? 0) > 0,
      actionLabel: "Convert",
      action: () => void convertEpoch()
    },
    {
      label: "Stake REL and lower DM fees",
      complete: (staking?.account.stakedRel ?? 0) > 0,
      actionLabel: "Stake",
      action: () => void stake("stake")
    }
  ];

  if (isMini) {
    return (
      <div className={`app-shell mini-mode ${themeMode === "8bit" ? "theme-8bit" : ""}`}>
        <div className="bg-watermark" aria-hidden="true">
          <span className="bg-watermark-left">☭</span>
          <span className="bg-watermark-right">🇺🇸</span>
        </div>
        <main>
          <section className="dossier-sheet">
            <div className="coldwar-row" aria-hidden="true">
              <span className="coldwar-left">☭</span>
              <span className="coldwar-right">🇺🇸</span>
            </div>
            <div className="mini-tab-row">
              <button className={`mini-tab ${miniTab === "mission" ? "active" : ""}`} onClick={() => setMiniTab("mission")}>
                Mission
              </button>
              <button className={`mini-tab ${miniTab === "mailbox" ? "active" : ""}`} onClick={() => setMiniTab("mailbox")}>
                Mailbox
              </button>
              <button className={`mini-tab ${miniTab === "about" ? "active" : ""}`} onClick={() => setMiniTab("about")}>
                About
              </button>
              <button className={`mini-tab ${miniTab === "timeline" ? "active" : ""}`} onClick={() => setMiniTab("timeline")}>
                Timeline
              </button>
              <button className="mini-tab theme-switch" onClick={() => setThemeMode((prev) => (prev === "8bit" ? "dossier" : "8bit"))}>
                {themeMode === "8bit" ? "Use Dossier" : "Use 8-Bit"}
              </button>
            </div>

            {miniTab === "mission" ? (
              <>
                <div className="ops-scene mini-ops-scene" role="img" aria-label="Cold-war operations table scene" />
                <div className="mission-headline">
                  <p className="stamp-paper">CLASSIFIED</p>
                  <div className="mission-headline-right">
                    <p className="mono-line mission-dossier-inline">DOSSIER: {missionDetails.dossier}</p>
                    <span className="smiley-inline" aria-label="Relay smiley" title="Relay morale">
                      😎
                    </span>
                  </div>
                </div>
                <p className="mono-line">OPERATION: {missionDetails.operation}</p>
                <p className="mono-line">FILE ID: {missionDetails.fileId}</p>
                <p className="mono-line">DATE: {new Date().toISOString().slice(0, 10)}</p>

                <div className="brief-mini-card">
                  <p className="mono-title">DAILY WAR BRIEF</p>
                  <p className="about-line">
                    <strong>{dailyBrief?.date ?? new Date().toISOString().slice(0, 10)}</strong> //{" "}
                    {dailyBrief?.title ?? "Awaiting ingest"}
                  </p>
                  <p className="about-line">
                    {dailyBrief?.lesson ??
                      "Brief scaffold live. Connect scraper ingest to /v1/admin/briefs and the daily lesson will render here."}
                  </p>
                  <p className="about-line tiny">
                    {dailyBrief?.quote
                      ? `"${dailyBrief.quote}" ${dailyBrief.source ? `- ${dailyBrief.source}` : ""}`
                      : "QUOTE: Pending source feed"}
                  </p>
                  {nftPreviewUri ? <img className="nft-preview-img" src={nftPreviewUri} alt="Today's brief NFT preview" /> : null}
                  <div className="paper-actions">
                    <button className="paper-btn primary-paper" disabled={nftLoading} onClick={() => void mintTodayNft(1)}>
                      {nftLoading ? "Minting..." : "Mint Today's NFT"}
                    </button>
                    <button className="paper-btn" disabled={nftLoading} onClick={() => void mintTodayNft(3)}>
                      Mint 3 (Daily Max)
                    </button>
                  </div>
                  <p className="mono-line tiny">
                    Minted today: {nftSummary?.mintedToday ?? 0} / {nftSummary?.walletDailyLimit ?? 3} | Total: {nftSummary?.mintedTotal ?? 0}
                  </p>
                  <div className="paper-actions">
                    <button className="paper-btn" disabled={nftLoading} onClick={() => void updateNftStakeCache("stake", 1)}>
                      Stake 1 NFT (Cache)
                    </button>
                    <button className="paper-btn" disabled={nftLoading} onClick={() => void updateNftStakeCache("unstake", 1)}>
                      Unstake 1 NFT
                    </button>
                  </div>
                  <p className="mono-line tiny">
                    NFT boost: +{((nftSummary?.cachedBoostBps ?? 0) / 100).toFixed(2)}% | Effective REL:{" "}
                    {(nftSummary?.cachedEffectiveRel ?? 0).toFixed(2)}
                  </p>
                </div>

                <div className="paper-divider" />
                <p className="mono-title">INTERCEPTED TRANSMISSION</p>
                <p className="mono-line">AUTH KEY: {missionDetails.authKey}</p>
                <p className="mono-line">STATUS: {miniEnabled ? "VERIFIED" : "PENDING"}</p>
                <p className="mono-line">DROP LOCATION: LAT {missionDetails.dropLat}</p>
                <p className="mono-line">LON {missionDetails.dropLon}</p>

                <div className="paper-divider" />
                <p className="mono-title">RETRIEVAL PROGRESS</p>
                <div className="paper-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p className="mono-line">FARM: {rewards?.account.farmPoints ?? 0} | REL: {rewards?.account.relBalance.toFixed(2) ?? "0.00"}</p>
                <p className="mono-line">STAKED: {staking?.account.stakedRel.toFixed(2) ?? "0.00"} | EPOCH: {rewards?.epoch.epochId ?? "--"}</p>

                <ul className="mission-list">
                  {missionChecklist.map((mission) => (
                    <li key={mission.label}>
                      <span className={mission.complete ? "mission-done" : "mission-open"}>
                        {mission.complete ? "[VERIFIED]" : "[OPEN]"}
                      </span>
                      <span>{mission.label}</span>
                      <button className="paper-btn" onClick={mission.action}>
                        {mission.actionLabel}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="paper-divider" />
                <p className="mono-title">DM FEE ENGINE</p>
                <p className="mono-line">BASE FEE: 1.00 USDC / DM</p>
                <p className="mono-line">CURRENT FEE: {rewards?.dmPricing.currentPrice.toFixed(2) ?? "1.00"} USDC / DM</p>
                <p className="mono-line">USDC BALANCE: {rewards?.account.usdcBalance.toFixed(2) ?? "0.00"}</p>
                <p className="mono-line">DM SENT: {rewards?.account.dmSentCount ?? 0}</p>

                <div className="paper-actions">
                  {activityOptions.map((option) => (
                    <button key={option.key} className="paper-btn" onClick={() => void runActivity(option.key)}>
                      {option.label}
                    </button>
                  ))}
                  <button className="paper-btn primary-paper" onClick={() => void convertEpoch()}>
                    Epoch Convert
                  </button>
                </div>

                <div className="paper-stake-row">
                  <label htmlFor="miniStake" className="mono-line">
                    STAKE AMOUNT (REL)
                  </label>
                  <input
                    id="miniStake"
                    className="paper-input"
                    type="number"
                    min={1}
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(Number(e.target.value))}
                  />
                  <button className="paper-btn" onClick={() => void stake("stake")}>
                    Stake
                  </button>
                  <button className="paper-btn" onClick={() => void stake("unstake")}>
                    Unstake
                  </button>
                </div>

              </>
            ) : null}

            {miniTab === "mailbox" ? (
              <>
                <p className="stamp-paper">MAILBOX</p>
                <p className="mono-title">READ DMS + SEND CHARGED MESSAGE</p>
                <p className="mono-line">CURRENT FEE: {rewards?.dmPricing.currentPrice.toFixed(2) ?? "1.00"} USDC / DM</p>
                <p className="mono-line">USDC BALANCE: {rewards?.account.usdcBalance.toFixed(2) ?? "0.00"}</p>

                <div className="paper-stake-row">
                  <label htmlFor="dmRecipient" className="mono-line">
                    RECIPIENT
                  </label>
                  <input id="dmRecipient" className="paper-input" value={dmRecipient} onChange={(e) => setDmRecipient(e.target.value)} />
                  <label htmlFor="dmBody" className="mono-line">
                    MESSAGE
                  </label>
                  <textarea id="dmBody" className="paper-input paper-textarea" value={dmBody} onChange={(e) => setDmBody(e.target.value)} />
                  <button className="paper-btn primary-paper" onClick={() => void sendChargedDm()}>
                    Send Charged DM
                  </button>
                </div>

                <div className="paper-divider" />
                <p className="mono-title">INBOX THREADS</p>
                <div className="thread-list">
                  {inboxThreads.length === 0 ? <p className="about-line">No DMs yet. Send one to create a thread.</p> : null}
                  {inboxThreads.map((thread) => (
                    <button key={thread.counterpart} className="thread-item" onClick={() => void refreshThread(thread.counterpart)}>
                      <span>{thread.counterpart}</span>
                      <span>{thread.unreadCount > 0 ? `${thread.unreadCount} unread` : "read"}</span>
                    </button>
                  ))}
                </div>

                <div className="paper-divider" />
                <p className="mono-title">THREAD // {activeThread}</p>
                <div className="thread-messages">
                  {threadMessages.length === 0 ? <p className="about-line">No messages in this thread.</p> : null}
                  {threadMessages.map((msg) => (
                    <article key={msg.id} className="thread-message-card">
                      <p className="about-line">
                        <strong>{msg.sender === "demo" ? "You" : msg.sender}:</strong> {msg.body}
                      </p>
                      <p className="about-line tiny">
                        {new Date(msg.sentAt).toLocaleString()} | Fee {msg.chargedUsdc.toFixed(2)} USDC | {msg.readAt ? "Read" : "Unread"}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            {miniTab === "about" ? (
              <>
                <p className="stamp-paper">ABOUT</p>
                <p className="mono-title">RELAY MINI-APP GAME LOOP</p>
                <p className="about-line">
                  Relay turns encrypted social actions into a mission system inside Farcaster. Actions award FARM, epochs convert FARM to REL,
                  and staked REL lowers DM send fees.
                </p>

                <div className="paper-divider" />
                <p className="mono-title">ACTION DEFINITIONS</p>
                <ul className="about-list">
                  <li>
                    <strong>File Cast:</strong> logs a cast/mission broadcast event and awards FARM points.
                  </li>
                  <li>
                    <strong>Intercept DM:</strong> logs a verified DM interaction event and awards FARM points.
                  </li>
                  <li>
                    <strong>Epoch Convert:</strong> converts current FARM into REL using this epoch conversion rate.
                  </li>
                </ul>

                <div className="paper-divider" />
                <p className="mono-title">DM PRICING RULES</p>
                <p className="about-line">Base is 1.00 USDC per DM. Every 100 REL staked lowers fee by 0.10 USDC.</p>
                <p className="about-line">Examples: 100 REL = 0.90, 200 REL = 0.80 ... floor at 0.10 USDC per DM.</p>
                <p className="about-line">Current fee: {rewards?.dmPricing.currentPrice.toFixed(2) ?? "1.00"} USDC per DM.</p>

                <div className="paper-divider" />
                <p className="mono-title">MISSION OBJECTIVE</p>
                <p className="about-line">
                  Build reputation through verified social activity and optimize DM economics with stake-driven fee tiers.
                </p>

                <div className="paper-divider" />
                <p className="mono-title">{REL_WHITEPAPER_ABOUT.title}</p>
                <p className="about-line">{REL_WHITEPAPER_ABOUT.summary}</p>
                <ul className="about-list">
                  {REL_WHITEPAPER_ABOUT.highlights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                <div className="paper-divider" />
                <p className="mono-title">DAY-250 REPORT SNAPSHOT</p>
                <ul className="about-list">
                  {REL_WHITEPAPER_ABOUT.reportDay250.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                <div className="paper-divider" />
                <p className="mono-title">EMISSION LOGIC + THEORY</p>
                <ul className="about-list">
                  {REL_WHITEPAPER_ABOUT.logicTheory.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                <div className="paper-divider" />
                <p className="mono-title">RELEASE + WAITLIST</p>
                <p className="about-line">Release target: March 15, 2026.</p>
                <p className="about-line">Current signups: {waitlistStats?.signupCount ?? 0}</p>
                <div className="paper-stake-row">
                  <button className="paper-btn primary-paper" disabled={waitlistLoading} onClick={() => void submitWaitlist("miniapp")}>
                    {waitlistLoading ? "Submitting..." : "Join Waitlist"}
                  </button>
                </div>
              </>
            ) : null}

            {miniTab === "timeline" ? (
              <>
                <p className="stamp-paper">TIMELINE</p>
                <p className="mono-title">COLD WAR ISSUE ROLLOUT TRACK</p>
                <ul className="about-list">
                  <li>
                    <strong>A.</strong> Cold War Issue NFT series runs for 250 days.
                  </li>
                  <li>
                    <strong>B.</strong> REL release and direct staking.
                  </li>
                  <li>
                    <strong>C.</strong> NFT weighted staking to REL pool.
                  </li>
                  <li>
                    <strong>D.</strong> Day 251: next series and Special Edition(s) begin.
                  </li>
                  <li>
                    <strong>E.</strong> Threshold to enter Ender Edition: Project Grill Flame, PSYOps, Kubark Files, FOIA, TBA.
                  </li>
                  <li>
                    <strong>F.</strong> Second series timeline completes after the next 250-day cycle.
                  </li>
                  <li>
                    <strong>G.</strong> Year three and beyond expansion.
                  </li>
                </ul>
              </>
            ) : null}

            {loading ? <p className="mini-status">SYNCING DOSSIER...</p> : null}
            {error ? <p className="mini-error">{error}</p> : null}
            {txMessage ? <p className="mini-success">{txMessage}</p> : null}

            <div className="paper-footer">
              <p className="mono-line">ARCHIVED</p>
              <p className="mono-line">{missionDetails.castRef}</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell ${themeMode === "8bit" ? "theme-8bit" : ""}`}>
      <div className="noise" aria-hidden="true" />
      <div className="bg-watermark" aria-hidden="true">
        <span className="bg-watermark-left">☭</span>
        <span className="bg-watermark-right">🇺🇸</span>
      </div>

      <header className="hero panel">
        <div className="ops-scene" role="img" aria-label="Cold-war operations table scene" />
        <div className="coldwar-row" aria-hidden="true">
          <span className="coldwar-left">☭</span>
          <span className="coldwar-right">🇺🇸</span>
        </div>
        <p className="stamp">CLASSIFIED // RELAY-07</p>
        <h1>Relay Command Surface</h1>
        <p className="subtitle">
          Mini-app mode includes mission, mailbox, and about tabs with charged DM economics tied to REL stake. Public release target:
          March 15, 2026.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/?miniApp=true">
            Open Mini App Surface
          </a>
          <button className="btn btn-ghost" onClick={() => setThemeMode((prev) => (prev === "8bit" ? "dossier" : "8bit"))}>
            {themeMode === "8bit" ? "Switch to Dossier" : "Switch to 8-Bit"}
          </button>
        </div>
      </header>

      <main>
        {loading ? <section className="panel section">Loading dashboard...</section> : null}
        {error ? <section className="panel section error">{error}</section> : null}
        {txMessage ? <section className="panel section success">{txMessage}</section> : null}
        {waitlistMessage ? <section className="panel section success">{waitlistMessage}</section> : null}

        <section className="panel section">
          <h2>Launch Waitlist</h2>
          <p className="subtitle">
            Non-contract release cycle while deployment capital is finalized. Target launch date: <strong>March 15, 2026</strong>.
            Signups collected: <strong>{waitlistStats?.signupCount ?? 0}</strong>. Join is Farcaster identity based (FID/username), no manual
            form.
          </p>
          <div className="waitlist-grid">
            <button className="btn btn-primary" disabled={waitlistLoading} onClick={() => void submitWaitlist("web")}>
              {waitlistLoading ? "Submitting..." : "Join Waitlist"}
            </button>
          </div>
        </section>

        <section className="panel section">
          <h2>Daily Cold War Brief</h2>
          {dailyBrief ? (
            <>
              <p className="subtitle">
                <strong>{dailyBrief.date}</strong> // {dailyBrief.title}
              </p>
              <p className="subtitle">{dailyBrief.lesson}</p>
              {dailyBrief.quote ? (
                <p className="subtitle">
                  "{dailyBrief.quote}" {dailyBrief.source ? `- ${dailyBrief.source}` : ""}
                </p>
              ) : null}
              {nftPreviewUri ? <img className="nft-preview-img nft-preview-web" src={nftPreviewUri} alt="Today's brief NFT preview" /> : null}
              <div className="hero-actions">
                <button className="btn btn-primary" disabled={nftLoading} onClick={() => void mintTodayNft(1)}>
                  {nftLoading ? "Minting..." : "Mint Today's NFT"}
                </button>
                <button className="btn btn-ghost" disabled={nftLoading} onClick={() => void updateNftStakeCache("stake", 1)}>
                  Stake 1 NFT (Cache)
                </button>
              </div>
              <p className="subtitle">
                Minted today: <strong>{nftSummary?.mintedToday ?? 0}</strong>/{nftSummary?.walletDailyLimit ?? 3} | Boost:{" "}
                <strong>+{((nftSummary?.cachedBoostBps ?? 0) / 100).toFixed(2)}%</strong>
              </p>
            </>
          ) : (
            <p className="subtitle">No brief loaded yet.</p>
          )}
        </section>

        <section className="panel section">
          <h2>Live Growth Signals</h2>
          <div className="grid metrics-grid">
            {metrics.map((item) => (
              <article className="card" key={item.label}>
                <p className="metric-label">{item.label}</p>
                <p className="metric-value">{item.value}</p>
                <p className="metric-delta">{item.delta}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel section">
          <h2>Token and Messaging Loops</h2>
          <div className="grid loops-grid">
            {loops.map((loop) => (
              <article className="card" key={loop.title}>
                <h3>{loop.title}</h3>
                <p>{loop.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {qaAllowed && qaVisible ? (
          <section className="panel section qa-panel">
            <h2>QA Control Deck (Hidden)</h2>
            <p className="subtitle">Temporary admin/testing surface for contract-flow QA. Remove before public release.</p>

            <div className="qa-grid">
              <label>
                Actor ID
                <input className="paper-input" value={qaActorId} onChange={(e) => setQaActorId(e.target.value)} />
              </label>
              <label>
                Admin API Key
                <input className="paper-input" value={qaAdminKey} onChange={(e) => setQaAdminKey(e.target.value)} />
              </label>
              <label>
                Amount
                <input className="paper-input" type="number" min={1} value={qaAmount} onChange={(e) => setQaAmount(Number(e.target.value || 1))} />
              </label>
              <label>
                Activity
                <select className="paper-input" value={qaAction} onChange={(e) => setQaAction(e.target.value as ActivityKey)}>
                  {activityOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="qa-actions">
              <button className="btn btn-ghost" onClick={() => void runQa("getConfig", () => api.qa.getConfig())}>Config</button>
              <button className="btn btn-ghost" onClick={() => void runQa("auth/me", () => api.qa.getAuthMe(qaActorId))}>Auth Me</button>
              <button className="btn btn-ghost" onClick={() => void runQa("rewards/summary", () => api.qa.getRewardsSummary(qaActorId))}>
                Rewards Summary
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("rewards/activity", () => api.qa.addActivity(qaActorId, qaAction, qaAmount))}>
                Add Activity
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("rewards/epoch/convert", () => api.qa.convertEpoch(qaActorId))}>
                Convert Epoch
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("staking/summary", () => api.qa.getStakingSummary(qaActorId))}>
                Staking Summary
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("staking/stake", () => api.qa.stake(qaActorId, qaAmount))}>Stake</button>
              <button className="btn btn-ghost" onClick={() => void runQa("staking/unstake", () => api.qa.unstake(qaActorId, qaAmount))}>
                Unstake
              </button>
            </div>

            <div className="qa-grid">
              <label>
                DM Recipient
                <input className="paper-input" value={qaRecipient} onChange={(e) => setQaRecipient(e.target.value)} />
              </label>
              <label>
                Thread Counterpart
                <input className="paper-input" value={qaThread} onChange={(e) => setQaThread(e.target.value)} />
              </label>
              <label>
                DM Body
                <input className="paper-input" value={qaBody} onChange={(e) => setQaBody(e.target.value)} />
              </label>
              <label>
                NFT Mint Qty (1-3)
                <input
                  className="paper-input"
                  type="number"
                  min={1}
                  max={3}
                  value={qaMintQty}
                  onChange={(e) => setQaMintQty(Math.max(1, Math.min(3, Number(e.target.value || 1))))}
                />
              </label>
            </div>

            <div className="qa-actions">
              <button className="btn btn-ghost" onClick={() => void runQa("dm/send", () => api.qa.sendDm(qaActorId, qaRecipient, qaBody))}>
                Send DM
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("dm/inbox", () => api.qa.getInbox(qaActorId))}>Inbox</button>
              <button className="btn btn-ghost" onClick={() => void runQa("dm/thread", () => api.qa.getThread(qaActorId, qaThread))}>Thread</button>
              <button className="btn btn-ghost" onClick={() => void runQa("dm/read", () => api.qa.markThreadRead(qaActorId, qaThread))}>Mark Read</button>
              <button className="btn btn-ghost" onClick={() => void runQa("nft/brief/today", () => api.qa.getNftBriefToday(qaActorId))}>
                NFT Brief Today
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("nft/summary", () => api.qa.getNftSummary(qaActorId))}>NFT Summary</button>
              <button className="btn btn-ghost" onClick={() => void runQa("nft/mint/today", () => api.qa.mintNftToday(qaActorId, qaMintQty))}>
                Mint NFT
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void runQa("nft/stake-cache", () => api.qa.updateNftStakeCache(qaActorId, qaStakeAction, qaAmount))}
              >
                {qaStakeAction === "stake" ? "Stake NFT Cache" : "Unstake NFT Cache"}
              </button>
              <button className="btn btn-ghost" onClick={() => setQaStakeAction((prev) => (prev === "stake" ? "unstake" : "stake"))}>
                Toggle Cache Action
              </button>
            </div>

            <div className="qa-actions">
              <button className="btn btn-primary" onClick={() => void loadAndSyncManifest()}>
                Contract Manifest
              </button>
              <button className="btn btn-primary" onClick={() => void runQa("admin/contracts/state", () => api.qa.adminContractState(qaAdminKey))}>
                Contract State
              </button>
              <button className="btn btn-primary" onClick={() => void runQa("admin/waitlist", () => api.qa.adminWaitlist(qaAdminKey))}>
                Admin Waitlist
              </button>
              <button className="btn btn-primary" onClick={() => void runQa("admin/waitlist.csv", () => api.qa.adminWaitlistCsv(qaAdminKey))}>
                Admin Waitlist CSV
              </button>
              <button className="btn btn-primary" onClick={() => void runQa("admin/briefs", () => api.qa.adminBriefs(qaAdminKey))}>
                Admin Briefs
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  void runQa("admin/briefs upsert", async () => {
                    const parsed = JSON.parse(qaBriefDraft) as DailyBrief[];
                    return api.qa.adminUpsertBriefs(qaAdminKey, parsed);
                  })
                }
              >
                Upsert Briefs
              </button>
            </div>

            <div className="paper-divider" />
            <p className="mono-title">Contract Controls (Admin)</p>
            <div className="qa-grid">
              <label>
                Manifest Network
                <input className="paper-input" value={qaManifest?.network ?? ""} readOnly />
              </label>
              <label>
                Manifest Chain ID
                <input className="paper-input" value={qaManifest?.chainId ?? ""} readOnly />
              </label>
              <label>
                Select Contract
                <select
                  className="paper-input"
                  value={qaSelectedContract}
                  onChange={(e) => setQaSelectedContract(e.target.value)}
                >
                  {(Object.keys(qaManifest?.contracts ?? {}) || []).map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Selected Address
                <input
                  className="paper-input"
                  value={qaManifest?.contracts?.[qaSelectedContract]?.address ?? ""}
                  readOnly
                />
              </label>
            </div>
            <p className="about-line tiny">
              ABI functions:{" "}
              {(
                qaManifest?.contracts?.[qaSelectedContract]?.abi?.filter((entry) => entry.type === "function").length ?? 0
              ).toString()}
            </p>
            <div className="qa-actions">
              <button className="btn btn-ghost" onClick={() => void loadAndSyncManifest()}>
                Sync QA From Manifest
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  setQaOutput(
                    JSON.stringify(
                      {
                        selectedContract: qaSelectedContract,
                        address: qaManifest?.contracts?.[qaSelectedContract]?.address ?? "",
                        abi: qaManifest?.contracts?.[qaSelectedContract]?.abi ?? []
                      },
                      null,
                      2
                    )
                  )
                }
              >
                Dump Selected ABI
              </button>
            </div>

            <div className="paper-divider" />
            <p className="mono-title">Web3 Contract Runner (QA)</p>
            <p className="about-line tiny">
              Wallet: {qaWeb3Account || "not connected"} | Chain: {qaWeb3ChainId ?? "--"} | Status: {qaWeb3Status}
            </p>
            <div className="qa-actions">
              <button className="btn btn-primary" onClick={() => void connectWeb3Qa()}>
                Connect Wallet (Sepolia)
              </button>
            </div>
            <div className="qa-grid">
              <label>
                Function
                <select className="paper-input" value={qaWeb3Method} onChange={(e) => setQaWeb3Method(e.target.value)}>
                  {selectedContractFunctions.map((fn) => (
                    <option key={fn.key} value={fn.key}>
                      {fn.key}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Value (ETH, payable only)
                <input className="paper-input" value={qaWeb3ValueEth} onChange={(e) => setQaWeb3ValueEth(e.target.value)} />
              </label>
            </div>
            <label>
              Args (JSON array)
              <textarea className="paper-input paper-textarea qa-json" value={qaWeb3Args} onChange={(e) => setQaWeb3Args(e.target.value)} />
            </label>
            <div className="qa-actions">
              <button className="btn btn-ghost" onClick={() => void runWeb3SelectedFunction()}>
                Run Selected Web3 Function
              </button>
            </div>

            <div className="qa-grid">
              <label>
                Owner
                <input className="paper-input" value={qaOwner} onChange={(e) => setQaOwner(e.target.value)} />
              </label>
              <label>
                Dev Wallet
                <input className="paper-input" value={qaDevWallet} onChange={(e) => setQaDevWallet(e.target.value)} />
              </label>
              <label>
                Treasury
                <input className="paper-input" value={qaTreasury} onChange={(e) => setQaTreasury(e.target.value)} />
              </label>
              <label>
                Daily Mint Limit
                <input className="paper-input" type="number" min={1} value={qaDailyLimit} onChange={(e) => setQaDailyLimit(Number(e.target.value || 1))} />
              </label>
            </div>

            <div className="qa-actions">
              <button className="btn btn-ghost" onClick={() => void runQa("transferOwnership", () => api.qa.adminSetOwner(qaAdminKey, qaOwner))}>
                Change Owner
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("setDevWallet", () => api.qa.adminSetDevWallet(qaAdminKey, qaDevWallet))}>
                Set Dev Wallet
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("setTreasury", () => api.qa.adminSetTreasury(qaAdminKey, qaTreasury))}>
                Set Treasury
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("setDailyWalletMintLimit", () => api.qa.adminSetNftDailyLimit(qaAdminKey, qaDailyLimit))}>
                Set Daily Mint Limit
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("setPause(true)", () => api.qa.adminSetNftPause(qaAdminKey, true))}>
                Pause NFT
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("setPause(false)", () => api.qa.adminSetNftPause(qaAdminKey, false))}>
                Unpause NFT
              </button>
            </div>

            <div className="qa-grid">
              <label>
                Withdraw Caller
                <input className="paper-input" value={qaWithdrawCaller} onChange={(e) => setQaWithdrawCaller(e.target.value)} />
              </label>
              <label>
                Withdraw To
                <input className="paper-input" value={qaWithdrawTo} onChange={(e) => setQaWithdrawTo(e.target.value)} />
              </label>
              <label>
                Withdraw Amount (ETH)
                <input
                  className="paper-input"
                  type="number"
                  step="0.00001"
                  min={0}
                  value={qaWithdrawAmount}
                  onChange={(e) => setQaWithdrawAmount(Number(e.target.value || 0))}
                />
              </label>
              <label>
                Minted Count Override
                <input className="paper-input" type="number" min={0} value={qaMintedCount} onChange={(e) => setQaMintedCount(Number(e.target.value || 0))} />
              </label>
              <label>
                Minted Date
                <input className="paper-input" value={qaMintedDate} onChange={(e) => setQaMintedDate(e.target.value)} />
              </label>
            </div>

            <div className="qa-actions">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void runQa("withdraw", () => api.qa.adminNftWithdraw(qaAdminKey, qaWithdrawCaller, qaWithdrawTo, qaWithdrawAmount))
                }
              >
                Withdraw (Owner/Dev Only)
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void runQa("adjust minted today", () => api.qa.adminAdjustMintedToday(qaAdminKey, qaActorId, qaMintedDate, qaMintedCount))
                }
              >
                Adjust Daily Mint Count
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("vault pause true", () => api.qa.adminSetVaultPause(qaAdminKey, true))}>
                Pause Vault
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("vault pause false", () => api.qa.adminSetVaultPause(qaAdminKey, false))}>
                Unpause Vault
              </button>
            </div>

            <div className="qa-grid">
              <label>
                Per NFT Boost BPS
                <input className="paper-input" type="number" min={1} value={qaPerNftBoost} onChange={(e) => setQaPerNftBoost(Number(e.target.value || 1))} />
              </label>
              <label>
                Max NFT Boost BPS
                <input className="paper-input" type="number" min={1} value={qaMaxBoost} onChange={(e) => setQaMaxBoost(Number(e.target.value || 1))} />
              </label>
              <label>
                Vault Max Oracle BPS
                <input
                  className="paper-input"
                  type="number"
                  min={0}
                  max={10000}
                  value={qaVaultMaxOracleBps}
                  onChange={(e) => setQaVaultMaxOracleBps(Number(e.target.value || 0))}
                />
              </label>
              <label>
                REL Mint Amount
                <input className="paper-input" type="number" min={0} value={qaRelMintAmount} onChange={(e) => setQaRelMintAmount(Number(e.target.value || 0))} />
              </label>
              <label>
                Vault Fee Withdraw (USDC)
                <input
                  className="paper-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={qaVaultFeeWithdrawAmount}
                  onChange={(e) => setQaVaultFeeWithdrawAmount(Number(e.target.value || 0))}
                />
              </label>
            </div>

            <div className="qa-actions">
              <button
                className="btn btn-ghost"
                onClick={() => void runQa("setBoostParams", () => api.qa.adminSetNftBoostParams(qaAdminKey, qaPerNftBoost, qaMaxBoost))}
              >
                Set NFT Boost Params
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void runQa("setMaxOracleBoostBps", () => api.qa.adminSetVaultMaxOracleBps(qaAdminKey, qaVaultMaxOracleBps))}
              >
                Set Vault Max Oracle BPS
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void runQa("vault withdraw fees", () => api.qa.adminVaultWithdrawFees(qaAdminKey, qaVaultFeeWithdrawAmount))}
              >
                Vault Withdraw Fees
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("mintEmission", () => api.qa.adminRelMintEmission(qaAdminKey, qaRelMintAmount))}>
                REL Mint Emission
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("mintSpecial", () => api.qa.adminRelMintSpecial(qaAdminKey, qaRelMintAmount))}>
                REL Mint Special
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("rel pause true", () => api.qa.adminRelPause(qaAdminKey, true))}>
                Pause REL
              </button>
              <button className="btn btn-ghost" onClick={() => void runQa("rel pause false", () => api.qa.adminRelPause(qaAdminKey, false))}>
                Unpause REL
              </button>
            </div>

            <div className="qa-grid">
              <label>
                Fee Base (USDC6)
                <input className="paper-input" type="number" min={1} value={qaBaseFeeUsdc6} onChange={(e) => setQaBaseFeeUsdc6(Number(e.target.value || 1))} />
              </label>
              <label>
                Fee Floor (USDC6)
                <input className="paper-input" type="number" min={1} value={qaFloorFeeUsdc6} onChange={(e) => setQaFloorFeeUsdc6(Number(e.target.value || 1))} />
              </label>
              <label>
                Discount Step (USDC6)
                <input
                  className="paper-input"
                  type="number"
                  min={1}
                  value={qaDiscountStepUsdc6}
                  onChange={(e) => setQaDiscountStepUsdc6(Number(e.target.value || 1))}
                />
              </label>
              <label>
                REL / Tier
                <input className="paper-input" type="number" min={1} value={qaRelPerTier} onChange={(e) => setQaRelPerTier(Number(e.target.value || 1))} />
              </label>
            </div>
            <div className="qa-actions">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void runQa("fee model params", () =>
                    api.qa.adminSetFeeModelParams(qaAdminKey, {
                      baseFeeUsdc6: qaBaseFeeUsdc6,
                      floorFeeUsdc6: qaFloorFeeUsdc6,
                      discountStepUsdc6: qaDiscountStepUsdc6,
                      relPerTier: qaRelPerTier
                    })
                  )
                }
              >
                Set Fee Model Params
              </button>
            </div>

            <div className="qa-grid">
              <label>
                Oracle Base BPS
                <input className="paper-input" type="number" min={0} value={qaOracleBaseBps} onChange={(e) => setQaOracleBaseBps(Number(e.target.value || 0))} />
              </label>
              <label>
                Oracle Per-Day BPS
                <input className="paper-input" type="number" min={0} value={qaOraclePerDayBps} onChange={(e) => setQaOraclePerDayBps(Number(e.target.value || 0))} />
              </label>
              <label>
                Oracle Max Time BPS
                <input className="paper-input" type="number" min={0} value={qaOracleMaxTimeBps} onChange={(e) => setQaOracleMaxTimeBps(Number(e.target.value || 0))} />
              </label>
              <label>
                Oracle Per-NFT BPS
                <input className="paper-input" type="number" min={0} value={qaOraclePerNftBps} onChange={(e) => setQaOraclePerNftBps(Number(e.target.value || 0))} />
              </label>
              <label>
                Oracle Max NFT BPS
                <input className="paper-input" type="number" min={0} value={qaOracleMaxNftBps} onChange={(e) => setQaOracleMaxNftBps(Number(e.target.value || 0))} />
              </label>
              <label>
                Oracle Max Total BPS
                <input className="paper-input" type="number" min={0} value={qaOracleMaxTotalBps} onChange={(e) => setQaOracleMaxTotalBps(Number(e.target.value || 0))} />
              </label>
            </div>
            <div className="qa-actions">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void runQa("oracle params", () =>
                    api.qa.adminSetOracleParams(qaAdminKey, {
                      baseBps: qaOracleBaseBps,
                      perDayTimeBps: qaOraclePerDayBps,
                      maxTimeBps: qaOracleMaxTimeBps,
                      perNftBps: qaOraclePerNftBps,
                      maxNftBps: qaOracleMaxNftBps,
                      maxTotalBps: qaOracleMaxTotalBps
                    })
                  )
                }
              >
                Set Oracle Params
              </button>
            </div>

            <label>
              Admin Brief Upsert JSON Array
              <textarea className="paper-input paper-textarea qa-json" value={qaBriefDraft} onChange={(e) => setQaBriefDraft(e.target.value)} />
            </label>

            <div className="qa-grid">
              <label>
                Raw Path
                <input className="paper-input" value={qaRawPath} onChange={(e) => setQaRawPath(e.target.value)} />
              </label>
              <label>
                Method
                <select className="paper-input" value={qaRawMethod} onChange={(e) => setQaRawMethod(e.target.value)}>
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
              </label>
            </div>

            <label>
              Raw Body
              <textarea className="paper-input paper-textarea qa-json" value={qaRawBody} onChange={(e) => setQaRawBody(e.target.value)} />
            </label>

            <div className="qa-actions">
              <button
                className="btn btn-ghost"
                onClick={() =>
                  void runQa("raw request", () =>
                    api.qa.raw({
                      path: qaRawPath,
                      method: qaRawMethod,
                      body: qaRawBody,
                      adminKey: qaAdminKey,
                      parseMode: qaRawPath.endsWith(".csv") ? "text" : "json"
                    })
                  )
                }
              >
                Run Raw Request
              </button>
              <button className="btn btn-ghost" onClick={() => setQaVisible(false)}>
                Hide QA Panel
              </button>
            </div>

            <pre className="qa-output">{qaOutput || "No QA output yet."}</pre>
          </section>
        ) : qaAllowed ? (
          <section className="panel section qa-toggle">
            <button className="btn btn-ghost" onClick={() => setQaVisible(true)}>
              Open Hidden QA Deck
            </button>
            <p className="subtitle tiny">Hidden control panel for admin/QA stress testing.</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}
