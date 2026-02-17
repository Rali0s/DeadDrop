import { useEffect, useMemo, useState } from "react";
import {
  api,
  type InboxThread,
  type Proposal,
  type RewardSummaryResponse,
  type StakingSummaryResponse,
  type ThreadMessage
} from "./api";
import { detectMiniAppMode, notifyMiniAppReady } from "./miniapp";

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

export default function App() {
  const [rewards, setRewards] = useState<RewardSummaryResponse | null>(null);
  const [staking, setStaking] = useState<StakingSummaryResponse | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [inboxThreads, setInboxThreads] = useState<InboxThread[]>([]);
  const [activeThread, setActiveThread] = useState<string>("agent-404");
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState(50);
  const [miniEnabled, setMiniEnabled] = useState(false);
  const [miniTab, setMiniTab] = useState<"mission" | "mailbox" | "about">("mission");
  const [dmRecipient, setDmRecipient] = useState("agent-404");
  const [dmBody, setDmBody] = useState("Package secure. Awaiting extraction window.");
  const [themeMode, setThemeMode] = useState<"dossier" | "8bit">(() => {
    if (typeof window === "undefined") {
      return "dossier";
    }
    return window.localStorage.getItem("relay-theme-mode") === "8bit" ? "8bit" : "dossier";
  });

  const isMini = useMemo(() => detectMiniAppMode(), []);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const [config, rewardData, stakingData, governanceData, inboxData] = await Promise.all([
        api.getConfig(),
        api.getRewardsSummary(),
        api.getStaking(),
        api.getProposals(),
        api.getInbox()
      ]);

      setMiniEnabled(config.miniApp.enabled);
      setRewards(rewardData);
      setStaking(stakingData);
      setProposals(governanceData.proposals);
      setInboxThreads(inboxData.threads);

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
    window.localStorage.setItem("relay-theme-mode", themeMode);
  }, [themeMode]);

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

  async function vote(proposalId: string, side: "yes" | "no") {
    setTxMessage(null);
    try {
      const voteWeight = Math.max(1, Math.floor(staking?.account.stakedRel ?? 1));
      await api.vote(proposalId, side, voteWeight);
      setTxMessage(`Vote submitted on ${proposalId} (${side.toUpperCase()}) with weight ${voteWeight}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
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

  const progress = rewards ? Math.min(100, Math.floor((rewards.account.farmPoints / 1500) * 100)) : 0;
  const primaryProposal = proposals[0];

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
      label: "Stake REL and cast governance vote",
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
              <button className="mini-tab theme-switch" onClick={() => setThemeMode((prev) => (prev === "8bit" ? "dossier" : "8bit"))}>
                {themeMode === "8bit" ? "Use Dossier" : "Use 8-Bit"}
              </button>
            </div>

            {miniTab === "mission" ? (
              <>
                <p className="stamp-paper">CLASSIFIED</p>
                <p className="mono-line">DOSSIER: {missionDetails.dossier}</p>
                <p className="mono-line">OPERATION: {missionDetails.operation}</p>
                <p className="mono-line">FILE ID: {missionDetails.fileId}</p>
                <p className="mono-line">DATE: {new Date().toISOString().slice(0, 10)}</p>

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

                {primaryProposal ? (
                  <div className="proposal-paper">
                    <p className="mono-title">GOVERNANCE // {primaryProposal.id}</p>
                    <p className="mono-line proposal-title">{primaryProposal.title}</p>
                    <p className="mono-line">
                      YES {primaryProposal.yesVotes.toLocaleString()} | NO {primaryProposal.noVotes.toLocaleString()}
                    </p>
                    <div className="paper-actions">
                      <button className="paper-btn" onClick={() => void vote(primaryProposal.id, "yes")}>
                        Vote Yes
                      </button>
                      <button className="paper-btn" onClick={() => void vote(primaryProposal.id, "no")}>
                        Vote No
                      </button>
                    </div>
                  </div>
                ) : null}
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
                  Build reputation through verified social activity, optimize DM economics with stake, and participate in governance to tune
                  protocol parameters.
                </p>
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
        <div className="coldwar-row" aria-hidden="true">
          <span className="coldwar-left">☭</span>
          <span className="coldwar-right">🇺🇸</span>
        </div>
        <p className="stamp">CLASSIFIED // RELAY-07</p>
        <h1>Relay Command Surface</h1>
        <p className="subtitle">
          Mini-app mode includes mission, mailbox, and about tabs with charged DM economics tied to REL stake.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/?miniApp=true">
            Open Mini App Surface
          </a>
          <a className="btn btn-ghost" href="http://localhost:8787/.well-known/farcaster.json" target="_blank" rel="noreferrer">
            View Farcaster Manifest
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
      </main>
    </div>
  );
}
