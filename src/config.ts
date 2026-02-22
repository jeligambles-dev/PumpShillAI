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
};
