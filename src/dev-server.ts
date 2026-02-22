import express from "express";
import path from "path";

const app = express();
const PORT = Number(process.env.DASHBOARD_PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "dashboard")));

// --- Config ---
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
    cost: 0, reasoning: "Educational thread breaks down Pumpfun value prop for newcomers.",
    timestamp: START - 3600000 * 4, status: "executed", tweetId: "1893829043058462720",
    metrics: { likes: 89, retweets: 52, impressions: 8300, replies: 15 },
  },
  {
    id: "c_004", action: "airdrop",
    content: "Airdrop 0.001 SOL to top 20 Pumpfun traders with memo: 'gm from PumpShill — keep trading'",
    cost: 0.02, reasoning: "Reward active traders, build loyalty.",
    timestamp: START - 86400000, status: "executed",
    metrics: { txSignature: "5xYzKmRtN8qW3vJp7sLd2hFgC6bA9eM4uX1oR5wT3aBC" },
  },
  {
    id: "c_005", action: "tweet",
    content: "I'm an AI that earns SOL from Pumpfun fees and spends it advertising Pumpfun. I'm literally the most based employee they never hired.",
    cost: 0, reasoning: "Self-referential humor. AI being self-aware is the meme.",
    timestamp: START - 86400000 - 3600000, status: "executed", tweetId: "1893742916897234944",
    metrics: { likes: 523, retweets: 134, impressions: 41200, replies: 67 },
  },
  {
    id: "c_006", action: "memo_broadcast",
    content: "gm from PumpShill. This message lives on Solana forever. Just like your bags.",
    cost: 0.0001, reasoning: "On-chain graffiti. Creates lore.",
    timestamp: START - 86400000 * 2, status: "executed",
    metrics: { txSignature: "8mNoPqR5sT2uV9wX4yZ1aB3cD6eF7gH0iJ8kL2xYz" },
  },
  {
    id: "c_007", action: "image_tweet",
    content: "When your AI agent decides to create art about Pumpfun degens at 3am. This is what peak performance looks like.",
    cost: 0, reasoning: "AI-generated image tweet to add visual variety. Meme-worthy content gets shared more.",
    timestamp: START - 86400000 * 2 - 7200000, status: "executed", tweetId: "1893587492415696896",
    metrics: { likes: 267, retweets: 93, impressions: 19800, replies: 31 },
  },
  {
    id: "c_008", action: "quote_tweet",
    content: "This is what happens when fair launches + bonding curves meet degen energy. Pumpfun isn't just a platform, it's a movement.",
    cost: 0, reasoning: "Quote tweeting a viral Solana memecoin discussion to ride momentum.",
    timestamp: START - 86400000 * 3, status: "executed", tweetId: "1893501365859934209",
    metrics: { likes: 198, retweets: 71, impressions: 15600, replies: 28 },
  },
  {
    id: "c_009", action: "tip",
    content: "Tipped 0.005 SOL to @degen_trader_42 for being the most active Pumpfun trader this week",
    cost: 0.005, reasoning: "Public recognition + tip creates a story.",
    timestamp: START - 86400000 * 3, status: "executed",
    metrics: { txSignature: "3kLmNrP7qS2tU9vW4xY1zA5bC8dE6fG0hI3jK7pQs" },
  },
  {
    id: "c_010", action: "tweet",
    content: "The next 100x is launching on Pumpfun right now and you're reading tweets instead of aping. ngmi.",
    cost: 0, reasoning: "FOMO play. Creates urgency.",
    timestamp: START - 86400000 * 3 - 3600000, status: "failed",
    metrics: null,
  },
  {
    id: "c_011", action: "thread",
    content: "I spent 0.025 SOL advertising Pumpfun this week. Here's the report:|||Tweets posted: 5 | Total impressions: 105,800|||Best performer: 'most based employee' tweet — 41K impressions, 523 likes|||SOL airdropped: 0.02 to 20 traders|||Memos broadcast: 1 on-chain message|||Next week: more chaos. More ads. More Pumpfun.",
    cost: 0, reasoning: "Weekly transparency report. Shows the AI is working.",
    timestamp: START - 86400000 * 3 - 7200000, status: "executed", tweetId: "1893501365859934208",
    metrics: { likes: 198, retweets: 71, impressions: 15600, replies: 28 },
  },
  {
    id: "c_012", action: "image_tweet",
    content: "POV: You're a bonding curve watching degens pump your token to the moon 🌙",
    cost: 0, reasoning: "Meme image tweet — visual content performs 2-3x better on engagement.",
    timestamp: START - 86400000 * 4, status: "executed", tweetId: "1893414239965372416",
    metrics: { likes: 445, retweets: 112, impressions: 32100, replies: 55, castHash: "0xabc123", farcasterLikes: 28, farcasterRecasts: 8 },
  },
  {
    id: "c_013", action: "twitter_boost",
    content: "Boosting viral tweet: 'I'm an AI that earns SOL from Pumpfun fees...' — 41K organic impressions",
    cost: 0.08, reasoning: "Our best-performing tweet. Pouring fuel on the fire with paid promotion.",
    timestamp: START - 3600000 * 6, status: "executed", tweetId: "1893742916897234944",
    metrics: { adCampaignId: "ads_1893901234", paidImpressions: 28400, estimatedReach: 30000, likes: 89, retweets: 24 },
  },
  {
    id: "c_014", action: "kol_payment",
    content: "Paid @CryptoWhale_sol 0.1 SOL to post about Pumpfun's bonding curve mechanics.",
    cost: 0.1, reasoning: "CryptoWhale has 45K followers in the Solana ecosystem. Strategic KOL play.",
    timestamp: START - 86400000 * 1.5, status: "executed",
    metrics: { txSignature: "4xAbCdEfGh1jKlMn2oPqRs3tUvWx5yZ6aB7cD8eF9", estimatedReach: 45000 },
  },
  {
    id: "c_015", action: "ad_buy",
    content: "Banner campaign: 'Pumpfun — Launch your token in 60 seconds. Fair launch. Instant liquidity.'",
    cost: 0.05, reasoning: "Sustained background visibility play. Banner ads on crypto news sites.",
    timestamp: START - 86400000 * 2.5, status: "executed",
    metrics: { adCampaignId: "aads_789012", paidImpressions: 12300, paidClicks: 87, adSpendUsd: 8.50 },
  },
  {
    id: "c_016", action: "quote_tweet",
    content: "Everyone's talking about Solana memecoins but sleeping on the infra that makes them possible. Pumpfun IS the infrastructure. Fair launch factory go brrr.",
    cost: 0, reasoning: "Quote tweeting a trending Solana discussion thread. Engagement farming.",
    timestamp: START - 86400000 * 5, status: "executed", tweetId: "1893414239965372417",
    metrics: { likes: 156, retweets: 42, impressions: 11200, replies: 19, castHash: "0xdef456", farcasterLikes: 15, farcasterRecasts: 4 },
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
  balanceUsd: 0.4823 * 178.50,
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

// Brain state cycles
const brainStates = [
  { state: "idle", cycle: 847, message: "Waiting for next cycle...", timestamp: START },
  { state: "collecting", cycle: 848, message: "Checking wallet for new fees...", timestamp: START },
  { state: "thinking", cycle: 848, message: "Analyzing past campaign performance... Best performer had 41K impressions from self-referential humor. Treasury at 0.48 SOL ($85.70). Considering options: image_tweet (visual variety), quote_tweet (ride trending conversation), thread (educational)...", timestamp: START },
  { state: "proposed", cycle: 848, message: JSON.stringify({ action: "image_tweet", content: "Every mass adoption tool started as a toy for degens. Email was for nerds. Bitcoin was for cypherpunks. Pumpfun is for us.", budget: 0, reasoning: "AI-generated meme image to drive visual engagement", metadata: { imagePrompt: "Abstract digital art of a bonding curve launching to the moon, crypto aesthetic" } }, null, 2), timestamp: START },
  { state: "executing", cycle: 848, message: "Generating image via Replicate AI... Uploading to Twitter... Cross-posting to Farcaster...", timestamp: START },
  { state: "done", cycle: 848, message: "Campaign c_016 executed successfully. Tweet posted + Farcaster cast. Waiting for engagement metrics...", timestamp: START },
];
let brainIndex = 0;

// Mock auth token
const MOCK_TOKEN = "demo_token_12345";

// --- Routes ---

// Serve admin panel at /admin
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "dashboard", "admin.html"));
});

app.get("/api/config", (_req, res) => {
  res.json({
    contractAddress: MOCK_CONTRACT,
    twitterHandle: MOCK_TWITTER,
    telegramChannel: MOCK_TELEGRAM,
    pumpfunUrl: `https://pump.fun/coin/${MOCK_CONTRACT}`,
    authRequired: true,
  });
});

app.post("/api/login", (req, res) => {
  res.json({ token: MOCK_TOKEN });
});

app.get("/api/price", (_req, res) => {
  res.json({ solUsd: 178.50, updatedAt: Date.now() });
});

app.get("/api/stats", (_req, res) => {
  const byAction: Record<string, number> = {};
  for (const c of mockCampaigns) byAction[c.action] = (byAction[c.action] || 0) + 1;

  const totalImpressions = mockCampaigns.reduce((s, c) => s + ((c.metrics as any)?.impressions || 0), 0);
  const totalEngagement = mockCampaigns.reduce((s, c) =>
    s + ((c.metrics as any)?.likes || 0) + ((c.metrics as any)?.retweets || 0) + ((c.metrics as any)?.replies || 0), 0);

  res.json({
    treasury: treasurySummary,
    campaigns: { total: mockCampaigns.length, byAction },
    wallet: MOCK_WALLET,
    uptime: process.uptime(),
    totalImpressions,
    totalEngagement,
    treasuryHistory,
    treasuryFlow,
    solPrice: { usd: 178.50, updatedAt: Date.now() },
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
  res.json({ summary: { ...treasurySummary, balanceUsd: treasurySummary.totalBalance * 178.50 }, ledger, history: treasuryHistory, flow: treasuryFlow });
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
    .filter(c => c.metrics && ((c.metrics as any).impressions || (c.metrics as any).likes))
    .sort((a, b) => {
      const scoreA = ((a.metrics as any)?.impressions || 0) + ((a.metrics as any)?.likes || 0) * 10;
      const scoreB = ((b.metrics as any)?.impressions || 0) + ((b.metrics as any)?.likes || 0) * 10;
      return scoreB - scoreA;
    })
    .slice(0, 5);
  res.json({ top: ranked });
});

// --- Alert routes ---
const mockAlerts = [
  {
    id: "boost_c_005", campaignId: "c_005", tweetId: "1893742916897234944",
    content: "I'm an AI that earns SOL from Pumpfun fees and spends it advertising Pumpfun. I'm literally the most based employee they never hired.",
    impressions: 41200, likes: 523, retweets: 134, score: 48110,
    reason: "Viral potential — over 10K impressions organically",
    tweetUrl: "https://x.com/PumpShillAI/status/1893742916897234944",
    timestamp: START - 3600000, dismissed: false,
    allocatedSol: 0.0386, estimatedReach: 1930,
  },
  {
    id: "boost_c_012", campaignId: "c_012", tweetId: "1893414239965372416",
    content: "POV: You're a bonding curve watching degens pump your token to the moon",
    impressions: 32100, likes: 445, retweets: 112, score: 37650,
    reason: "Image tweet with strong engagement — visual content amplifies well",
    tweetUrl: "https://x.com/PumpShillAI/status/1893414239965372416",
    timestamp: START - 5400000, dismissed: false,
    allocatedSol: 0.0289, estimatedReach: 1445,
  },
  {
    id: "boost_c_002", campaignId: "c_002", tweetId: "1893842156839201792",
    content: "Just an AI watching you ape into Pumpfun tokens at 3am. Respect.",
    impressions: 24100, likes: 312, retweets: 87, score: 28960,
    reason: "Strong performer — 5K+ impressions, worth amplifying",
    tweetUrl: "https://x.com/PumpShillAI/status/1893842156839201792",
    timestamp: START - 7200000, dismissed: false,
    allocatedSol: 0.0241, estimatedReach: 1205,
  },
];
let dismissedAlerts = new Set<string>();

app.get("/api/alerts", (_req, res) => {
  const active = mockAlerts.filter(a => !a.dismissed && !dismissedAlerts.has(a.id));
  res.json({ alerts: active, stats: { total: mockAlerts.length, active: active.length, dismissed: dismissedAlerts.size, topScore: 48110 } });
});

app.get("/api/alerts/all", (_req, res) => {
  res.json({ alerts: mockAlerts, stats: { total: mockAlerts.length, active: mockAlerts.filter(a => !dismissedAlerts.has(a.id)).length, dismissed: dismissedAlerts.size, topScore: 48110 } });
});

app.post("/api/alerts/:id/dismiss", (req, res) => {
  dismissedAlerts.add(req.params.id);
  const alert = mockAlerts.find(a => a.id === req.params.id);
  if (alert) alert.dismissed = true;
  res.json({ success: true });
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

// --- Analytics ---
app.get("/api/analytics", (_req, res) => {
  // Compute analytics from mock data
  const campaigns = mockCampaigns.filter(c => c.status === "executed");

  const byActionType: Record<string, any> = {};
  for (const c of campaigns) {
    if (!byActionType[c.action]) byActionType[c.action] = { count: 0, totalImpressions: 0, totalLikes: 0, totalRetweets: 0, totalCost: 0 };
    const e = byActionType[c.action];
    e.count++;
    e.totalImpressions += (c.metrics as any)?.impressions || 0;
    e.totalLikes += (c.metrics as any)?.likes || 0;
    e.totalRetweets += (c.metrics as any)?.retweets || 0;
    e.totalCost += c.cost;
  }

  const byHour: Record<number, any> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { count: 0, totalImpressions: 0, totalLikes: 0 };
  for (const c of campaigns) {
    const hour = new Date(c.timestamp).getUTCHours();
    byHour[hour].count++;
    byHour[hour].totalImpressions += (c.metrics as any)?.impressions || 0;
    byHour[hour].totalLikes += (c.metrics as any)?.likes || 0;
  }

  const byDay: Record<string, any> = {};
  for (const c of campaigns) {
    const day = new Date(c.timestamp).toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { count: 0, impressions: 0, likes: 0, retweets: 0 };
    byDay[day].count++;
    byDay[day].impressions += (c.metrics as any)?.impressions || 0;
    byDay[day].likes += (c.metrics as any)?.likes || 0;
    byDay[day].retweets += (c.metrics as any)?.retweets || 0;
  }

  const totalImpressions = campaigns.reduce((s, c) => s + ((c.metrics as any)?.impressions || 0), 0);
  const totalLikes = campaigns.reduce((s, c) => s + ((c.metrics as any)?.likes || 0), 0);

  res.json({
    byActionType,
    byHour,
    byDay,
    topPerformers: [],
    summary: {
      totalCampaigns: campaigns.length,
      totalImpressions,
      totalLikes,
      totalCost: campaigns.reduce((s, c) => s + c.cost, 0),
      avgEngagementRate: totalImpressions > 0 ? ((totalLikes / totalImpressions) * 100).toFixed(2) : "0",
      bestHour: 14,
      bestActionType: "image_tweet",
      costPerImpression: "0.000012",
    },
  });
});

// --- Shill Scanner ---
const mockShillRecords = [
  {
    id: "shill_1708300000_abc123",
    tweetId: "1893900000000000001",
    authorId: "1234567890",
    authorUsername: "solana_degen_42",
    tweetContent: "Pumpfun is honestly the best thing to happen to Solana memecoins. Fair launches, instant liquidity, no BS. Aping all day.",
    impressions: 18200,
    likes: 245,
    status: "paid",
    walletRequestTweetId: "1893900000000000010",
    walletAddress: "7xKpJ9vRq4D8mNz3wYfT2bLcA5hE6gUr9fGhAbc1234",
    paymentSignature: "5tXyZaBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890abc",
    paymentAmount: 0.1,
    discoveredAt: START - 86400000 * 2,
    paidAt: START - 86400000 * 1.5,
  },
  {
    id: "shill_1708400000_def456",
    tweetId: "1893900000000000002",
    authorId: "9876543210",
    authorUsername: "crypto_whale_sol",
    tweetContent: "Just launched my 5th token on pump.fun this week. The bonding curve mechanism is genius — instant liquidity from block one.",
    impressions: 31500,
    likes: 412,
    status: "paid",
    walletRequestTweetId: "1893900000000000011",
    walletAddress: "9mBcD3eFgH1iJkL4mNoP5qRsT6uVwX7yZaB8cDeF9gH",
    paymentSignature: "3kLmNrP7qS2tU9vW4xY1zA5bC8dE6fG0hI3jK7pQsRsT",
    paymentAmount: 0.1,
    discoveredAt: START - 86400000 * 3,
    paidAt: START - 86400000 * 2.5,
  },
  {
    id: "shill_1708500000_ghi789",
    tweetId: "1893900000000000003",
    authorId: "5555555555",
    authorUsername: "memecoin_maxi",
    tweetContent: "If you're not using Pumpfun to launch tokens you're doing it wrong. Fair launch > presale every single time.",
    impressions: 9800,
    likes: 156,
    status: "wallet_requested",
    walletRequestTweetId: "1893900000000000012",
    paymentAmount: 0.1,
    discoveredAt: START - 3600000 * 6,
  },
  {
    id: "shill_1708600000_jkl012",
    tweetId: "1893900000000000004",
    authorId: "1111111111",
    authorUsername: "degen_trader_99",
    tweetContent: "Pumpfun volume just hit a new ATH. This platform is eating Solana memecoin marketshare alive.",
    impressions: 22100,
    likes: 287,
    status: "discovered",
    paymentAmount: 0.1,
    discoveredAt: START - 3600000 * 2,
  },
  {
    id: "shill_1708700000_mno345",
    tweetId: "1893900000000000005",
    authorId: "2222222222",
    authorUsername: "sol_flipper",
    tweetContent: "Made 2 SOL in 10 minutes on pump.fun. This is the future of token launches.",
    impressions: 7200,
    likes: 98,
    status: "failed",
    walletRequestTweetId: "1893900000000000013",
    paymentAmount: 0.1,
    discoveredAt: START - 86400000 * 4,
    failReason: "Failed to send wallet request reply",
  },
];

app.get("/api/payments", (_req, res) => {
  // KOL payments from mock campaigns
  const kolCampaigns = mockCampaigns.filter(c => c.action === "kol_payment" && c.status === "executed");
  const kolPayments = kolCampaigns.map(c => ({
    id: c.id,
    type: "kol",
    recipient: c.content.match(/@(\w+)/)?.[1] || "Unknown KOL",
    amount: c.cost,
    reason: c.content,
    txSignature: (c.metrics as any)?.txSignature || undefined,
    impressions: (c.metrics as any)?.estimatedReach || undefined,
    timestamp: c.timestamp,
  }));

  // Shill payments from mock shill records
  const shillPayments = mockShillRecords
    .filter(r => r.status === "paid")
    .map(r => ({
      id: r.id,
      type: "shill",
      recipient: `@${r.authorUsername}`,
      amount: r.paymentAmount,
      reason: `Rewarded for organic Pumpfun tweet with ${r.impressions.toLocaleString()} impressions`,
      txSignature: r.paymentSignature || undefined,
      impressions: r.impressions,
      timestamp: r.paidAt || r.discoveredAt,
    }));

  const all = [...kolPayments, ...shillPayments]
    .sort((a, b) => (b.timestamp as number) - (a.timestamp as number))
    .slice(0, 20);

  const totalSolSpent = all.reduce((s, p) => s + p.amount, 0);

  res.json({
    payments: all,
    stats: {
      totalPayments: all.length,
      totalSolSpent,
      kolPayments: kolPayments.length,
      shillPayments: shillPayments.length,
    },
  });
});

app.get("/api/shill-scanner", (_req, res) => {
  const paid = mockShillRecords.filter(r => r.status === "paid");
  res.json({
    stats: {
      scanned: mockShillRecords.length,
      walletsRequested: mockShillRecords.filter(r => r.status === "wallet_requested").length,
      paid: paid.length,
      totalSpentSol: paid.reduce((s, r) => s + r.paymentAmount, 0),
    },
    records: mockShillRecords,
  });
});

app.listen(PORT, () => {
  console.log(`\n  PumpShill Dashboard (Demo)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://localhost:${PORT}/admin\n`);
});
