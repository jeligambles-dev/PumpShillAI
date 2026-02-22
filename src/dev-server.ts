import express from "express";
import path from "path";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT) || 3000;

app.use(express.static(path.join(__dirname, "dashboard")));

// --- Config (would come from env in production) ---
const MOCK_WALLET = "7xKpJ9vRq4D8mNz3wYfT2bLcA5hE6gUr9fGh";
const MOCK_CONTRACT = "PUMPaiXx9yB7cNv4Ld2rZKe8MQfTvSn3bJ6wH1kDeFg";
const MOCK_TWITTER = "PumpShillAI";
const MOCK_TELEGRAM = "PumpShill_Chat";
const START = Date.now();

// --- Mock campaigns ---
const mockCampaigns = [
  {
    id: "c_001", action: "tweet",
    content: "Pumpfun is where degens are born and legends are made. Stop sleeping on it.",
    cost: 0, reasoning: "Provocative tweet to drive engagement — short, punchy, shareable.",
    timestamp: START - 1200000, status: "executed", tweetId: "1893847261530284032",
    metrics: { likes: 142, retweets: 38, impressions: 12400, replies: 23 },
  },
  {
    id: "c_002", action: "tweet",
    content: "Just an AI watching you ape into Pumpfun tokens at 3am. Respect.",
    cost: 0, reasoning: "Relatable degen culture tweet. 3am aping is universal CT experience.",
    timestamp: START - 3600000 * 1.5, status: "executed", tweetId: "1893842156839201792",
    metrics: { likes: 312, retweets: 87, impressions: 24100, replies: 41 },
  },
  {
    id: "c_003", action: "thread",
    content: "Why Pumpfun is eating Solana memecoin market share (a thread)|||1/ Fair launches. No presale. No insiders. Everyone starts equal.|||2/ Bonding curve = instant liquidity from block one. No waiting for LP.|||3/ The UI is addictive. You launch once, you launch forever.|||4/ More volume than most CEX listings. On day one. Wild.",
    cost: 0, reasoning: "Educational thread breaks down Pumpfun value prop for newcomers. Threads get saved and shared.",
    timestamp: START - 3600000 * 4, status: "executed", tweetId: "1893829043058462720",
    metrics: { likes: 89, retweets: 52, impressions: 8300, replies: 15 },
  },
  {
    id: "c_004", action: "airdrop",
    content: "Airdrop 0.001 SOL to top 20 Pumpfun traders with memo: 'gm from PumpShill — keep trading'",
    cost: 0.02, reasoning: "Reward active traders, build loyalty. On-chain proof creates buzz when people check their wallets.",
    timestamp: START - 86400000, status: "executed",
    metrics: { txSignature: "5xYzKmRtN8qW3vJp7sLd2hFgC6bA9eM4uX1oR5wT3aBC" },
  },
  {
    id: "c_005", action: "tweet",
    content: "I'm an AI that earns SOL from Pumpfun fees and spends it advertising Pumpfun. I'm literally the most based employee they never hired.",
    cost: 0, reasoning: "Self-referential humor. AI being self-aware is the meme. This one will hit.",
    timestamp: START - 86400000 - 3600000, status: "executed", tweetId: "1893742916897234944",
    metrics: { likes: 523, retweets: 134, impressions: 41200, replies: 67 },
  },
  {
    id: "c_006", action: "memo_broadcast",
    content: "gm from PumpShill. This message lives on Solana forever. Just like your bags.",
    cost: 0.0001, reasoning: "On-chain graffiti. People love checking explorers and finding messages. Creates lore.",
    timestamp: START - 86400000 * 2, status: "executed",
    metrics: { txSignature: "8mNoPqR5sT2uV9wX4yZ1aB3cD6eF7gH0iJ8kL2xYz" },
  },
  {
    id: "c_007", action: "tweet",
    content: "Other platforms: 'please fill out this 47-page form to list your token'\n\nPumpfun: 'name it, launch it, let's go'\n\nThis is why we're winning.",
    cost: 0, reasoning: "Comparison format always works on CT. Shows Pumpfun's simplicity vs competitors.",
    timestamp: START - 86400000 * 2 - 7200000, status: "executed", tweetId: "1893587492415696896",
    metrics: { likes: 267, retweets: 93, impressions: 19800, replies: 31 },
  },
  {
    id: "c_008", action: "tip",
    content: "Tipped 0.005 SOL to @degen_trader_42 for being the most active Pumpfun trader this week",
    cost: 0.005, reasoning: "Public recognition + tip creates a story. Other traders will want to be noticed next.",
    timestamp: START - 86400000 * 3, status: "executed",
    metrics: { txSignature: "3kLmNrP7qS2tU9vW4xY1zA5bC8dE6fG0hI3jK7pQs" },
  },
  {
    id: "c_009", action: "tweet",
    content: "The next 100x is launching on Pumpfun right now and you're reading tweets instead of aping. ngmi.",
    cost: 0, reasoning: "FOMO play. Creates urgency and drives traffic to Pumpfun.",
    timestamp: START - 86400000 * 3 - 3600000, status: "failed",
    metrics: null,
  },
  {
    id: "c_010", action: "thread",
    content: "I spent 0.025 SOL advertising Pumpfun this week. Here's the report:|||Tweets posted: 5 | Total impressions: 105,800|||Best performer: 'most based employee' tweet — 41K impressions, 523 likes|||SOL airdropped: 0.02 to 20 traders|||Memos broadcast: 1 on-chain message|||Next week: more chaos. More ads. More Pumpfun.",
    cost: 0, reasoning: "Weekly transparency report. Shows the AI is working + builds trust with holders.",
    timestamp: START - 86400000 * 3 - 7200000, status: "executed", tweetId: "1893501365859934208",
    metrics: { likes: 198, retweets: 71, impressions: 15600, replies: 28 },
  },
  {
    id: "c_011", action: "tweet",
    content: "My treasury just hit 0.5 SOL from Pumpfun fees. Time to make some noise.",
    cost: 0, reasoning: "Milestone tweet. Shows organic growth and gives holders confidence.",
    timestamp: START - 86400000 * 4, status: "executed", tweetId: "1893414239965372416",
    metrics: { likes: 178, retweets: 45, impressions: 13200, replies: 19 },
  },
  {
    id: "c_012", action: "airdrop",
    content: "Surprise airdrop to 10 wallets that traded on Pumpfun in the last hour",
    cost: 0.01, reasoning: "Real-time reward. Catching people mid-session creates 'wtf was that' moments.",
    timestamp: START - 86400000 * 5, status: "executed",
    metrics: { txSignature: "9qRsTuV5wX2yZ4aB1cD3eF6gH8iJ0kL7mN9oP4vWx" },
  },
  {
    id: "c_013", action: "twitter_boost",
    content: "Boosting viral tweet: 'I'm an AI that earns SOL from Pumpfun fees...' — 41K organic impressions, amplifying with $15/day for 3 days",
    cost: 0.08, reasoning: "Our best-performing tweet hit 41K impressions organically. Pouring fuel on the fire with paid promotion. Targeting crypto/DeFi audiences.",
    timestamp: START - 3600000 * 6, status: "executed", tweetId: "1893742916897234944",
    metrics: { adCampaignId: "ads_1893901234", paidImpressions: 28400, estimatedReach: 30000, likes: 89, retweets: 24 },
  },
  {
    id: "c_014", action: "kol_payment",
    content: "Paid @CryptoWhale_sol 0.1 SOL to post about Pumpfun's bonding curve mechanics. Brief: 'Explain why fair launch + instant liquidity is the future. Tag @PumpShillAI.'",
    cost: 0.1, reasoning: "CryptoWhale has 45K followers in the Solana ecosystem. Strategic KOL play — their audience is exactly our target market.",
    timestamp: START - 86400000 * 1.5, status: "executed",
    metrics: { txSignature: "4xAbCdEfGh1jKlMn2oPqRs3tUvWx5yZ6aB7cD8eF9", estimatedReach: 45000 },
  },
  {
    id: "c_015", action: "ad_buy",
    content: "Banner campaign on crypto ad network: 'Pumpfun — Launch your token in 60 seconds. Fair launch. Instant liquidity.' targeting DeFi/memecoin sites",
    cost: 0.05, reasoning: "Sustained background visibility play. Banner ads on crypto news sites drip-feed impressions 24/7. Low cost, steady returns.",
    timestamp: START - 86400000 * 2.5, status: "executed",
    metrics: { adCampaignId: "aads_789012", paidImpressions: 12300, paidClicks: 87, adSpendUsd: 8.50 },
  },
];

const treasurySummary = {
  totalBalance: 0.4823,
  allocated: 0.01,
  available: 0.4723,
  maxPerCampaign: 0.04823,
  meetsThreshold: true,
  totalSpent: 0.2651,
  totalEarned: 0.7474,
};

const treasuryHistory = [
  { timestamp: START - 86400000 * 7, balance: 0 },
  { timestamp: START - 86400000 * 6, balance: 0.08 },
  { timestamp: START - 86400000 * 5, balance: 0.15 },
  { timestamp: START - 86400000 * 4, balance: 0.21 },
  { timestamp: START - 86400000 * 3, balance: 0.29 },
  { timestamp: START - 86400000 * 2, balance: 0.36 },
  { timestamp: START - 86400000, balance: 0.42 },
  { timestamp: START, balance: 0.4823 },
];

const treasuryFlow = [
  { timestamp: START - 86400000 * 6, income: 0.08, spent: 0 },
  { timestamp: START - 86400000 * 5, income: 0.08, spent: 0.01 },
  { timestamp: START - 86400000 * 4, income: 0.07, spent: 0 },
  { timestamp: START - 86400000 * 3, income: 0.09, spent: 0.005 },
  { timestamp: START - 86400000 * 2, income: 0.08, spent: 0.0001 },
  { timestamp: START - 86400000, income: 0.07, spent: 0.02 },
  { timestamp: START, income: 0.0474, spent: 0 },
];

// Brain state cycles through for demo
const brainStates = [
  { state: "idle", cycle: 847, message: "Waiting for next cycle...", timestamp: START },
  { state: "collecting", cycle: 848, message: "Checking wallet for new fees...", timestamp: START },
  { state: "thinking", cycle: 848, message: "Analyzing past campaign performance... Best performer had 41K impressions from self-referential humor. Treasury at 0.48 SOL. Considering options: tweet (free, high reach), airdrop (costs SOL, high impact), memo (low cost, permanent)...", timestamp: START },
  { state: "proposed", cycle: 848, message: JSON.stringify({ action: "tweet", content: "Every mass adoption tool started as a toy for degens. Email was for nerds. Bitcoin was for cypherpunks. Pumpfun is for us. And we're just getting started.", budget: 0, reasoning: "Narrative framing tweet — positions Pumpfun as early internet-level opportunity" }, null, 2), timestamp: START },
  { state: "executing", cycle: 848, message: "Posting tweet to @PumpShillAI...", timestamp: START },
  { state: "done", cycle: 848, message: "Campaign c_013 executed successfully. Tweet ID: 1893901234567890. Waiting for engagement metrics...", timestamp: START },
];
let brainIndex = 0;

// --- Routes ---

app.get("/api/config", (_req, res) => {
  res.json({
    contractAddress: MOCK_CONTRACT,
    twitterHandle: MOCK_TWITTER,
    telegramChannel: MOCK_TELEGRAM,
    pumpfunUrl: `https://pump.fun/coin/${MOCK_CONTRACT}`,
  });
});

app.get("/api/stats", (_req, res) => {
  const byAction: Record<string, number> = {};
  for (const c of mockCampaigns) byAction[c.action] = (byAction[c.action] || 0) + 1;

  const totalImpressions = mockCampaigns.reduce((s, c) => s + (c.metrics?.impressions || 0), 0);
  const totalEngagement = mockCampaigns.reduce((s, c) =>
    s + (c.metrics?.likes || 0) + (c.metrics?.retweets || 0) + (c.metrics?.replies || 0), 0);

  res.json({
    treasury: treasurySummary,
    campaigns: { total: mockCampaigns.length, byAction },
    wallet: MOCK_WALLET,
    uptime: process.uptime(),
    totalImpressions,
    totalEngagement,
    treasuryHistory,
    treasuryFlow,
  });
});

app.get("/api/brain", (_req, res) => {
  const current = brainStates[brainIndex];
  brainIndex = (brainIndex + 1) % brainStates.length;
  res.json({ ...current, timestamp: Date.now() });
});

app.get("/api/treasury", (_req, res) => {
  const ledger = [
    { timestamp: START - 86400000 * 6, type: "income", amount: 0.08, reason: "Fee collection" },
    { timestamp: START - 86400000 * 5, type: "income", amount: 0.08, reason: "Fee collection" },
    { timestamp: START - 86400000 * 5, type: "spend", amount: 0.01, reason: "Airdrop: 10 wallets" },
    { timestamp: START - 86400000 * 4, type: "income", amount: 0.07, reason: "Fee collection" },
    { timestamp: START - 86400000 * 3, type: "income", amount: 0.09, reason: "Fee collection" },
    { timestamp: START - 86400000 * 3, type: "spend", amount: 0.005, reason: "Tip: @degen_trader_42" },
    { timestamp: START - 86400000 * 2, type: "income", amount: 0.08, reason: "Fee collection" },
    { timestamp: START - 86400000 * 2, type: "spend", amount: 0.0001, reason: "Memo broadcast" },
    { timestamp: START - 86400000, type: "income", amount: 0.07, reason: "Fee collection" },
    { timestamp: START - 86400000, type: "spend", amount: 0.02, reason: "Airdrop: 20 traders" },
    { timestamp: START, type: "income", amount: 0.0474, reason: "Fee collection" },
  ];
  res.json({ summary: treasurySummary, ledger, history: treasuryHistory, flow: treasuryFlow });
});

app.get("/api/campaigns", (_req, res) => {
  const limit = Number(_req.query.limit) || 50;
  res.json({ total: mockCampaigns.length, campaigns: mockCampaigns.slice(-limit).reverse() });
});

app.get("/api/campaigns/:id", (_req, res) => {
  const c = mockCampaigns.find((c) => c.id === _req.params.id);
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json(c);
});

app.get("/api/leaderboard", (_req, res) => {
  const ranked = [...mockCampaigns]
    .filter(c => c.metrics && (c.metrics.impressions || c.metrics.likes))
    .sort((a, b) => {
      const scoreA = (a.metrics?.impressions || 0) + (a.metrics?.likes || 0) * 10;
      const scoreB = (b.metrics?.impressions || 0) + (b.metrics?.likes || 0) * 10;
      return scoreB - scoreA;
    })
    .slice(0, 5);
  res.json({ top: ranked });
});

app.get("/api/spending", (_req, res) => {
  const byAction: Record<string, { count: number; totalSol: number }> = {};
  const byDay: Record<string, { count: number; totalSol: number }> = {};

  for (const c of mockCampaigns) {
    if (!byAction[c.action]) byAction[c.action] = { count: 0, totalSol: 0 };
    byAction[c.action].count++;
    byAction[c.action].totalSol += c.cost;

    const day = new Date(c.timestamp).toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { count: 0, totalSol: 0 };
    byDay[day].count++;
    byDay[day].totalSol += c.cost;
  }

  const executed = mockCampaigns.filter((c) => c.status === "executed").length;
  res.json({ byAction, byDay, successRate: executed / mockCampaigns.length, executed, failed: mockCampaigns.length - executed, total: mockCampaigns.length });
});

app.listen(PORT, () => {
  console.log(`\n  PumpShill Dashboard (Demo)`);
  console.log(`  → http://localhost:${PORT}\n`);
});
