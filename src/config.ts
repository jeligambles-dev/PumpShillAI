import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    feeWalletKey: required("FEE_WALLET_PRIVATE_KEY"),
    spendingWalletKey: process.env.SPENDING_WALLET_PRIVATE_KEY,
  },
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
  },
  twitter: {
    apiKey: required("TWITTER_API_KEY"),
    apiSecret: required("TWITTER_API_SECRET"),
    accessToken: required("TWITTER_ACCESS_TOKEN"),
    accessSecret: required("TWITTER_ACCESS_SECRET"),
  },
  agent: {
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 60_000,
    minTreasuryThresholdSol: Number(process.env.MIN_TREASURY_THRESHOLD_SOL) || 0.01,
    maxSpendPerCampaignPct: Number(process.env.MAX_SPEND_PER_CAMPAIGN_PCT) || 10,
  },
  imageGeneration: {
    apiToken: process.env.REPLICATE_API_TOKEN || "",
    enabled: !!process.env.REPLICATE_API_TOKEN,
  },
  farcaster: {
    enabled: process.env.ENABLE_FARCASTER === "true",
    neynarApiKey: process.env.NEYNAR_API_KEY || "",
    signerUuid: process.env.FARCASTER_SIGNER_UUID || "",
  },
  dashboard: {
    adminPassword: process.env.ADMIN_PASSWORD || "",
    port: Number(process.env.DASHBOARD_PORT) || 3000,
  },
  shillScanner: {
    enabled: process.env.ENABLE_SHILL_SCANNER !== "false",
    minImpressions: Number(process.env.SHILL_MIN_IMPRESSIONS) || 5000,
    paymentSol: Number(process.env.SHILL_PAYMENT_SOL) || 0.1,
    maxPaymentsPerDay: Number(process.env.SHILL_MAX_PAYMENTS_DAY) || 5,
  },
};
