import { config } from "./config";
import { FeeCollector } from "./fee-collector";
import { Treasury } from "./treasury";
import { Brain } from "./brain";
import { Tracker } from "./tracker";
import { executeCampaign } from "./executor";
import { getTweetMetrics } from "./executor/twitter";
import { startServer } from "./server";
import { logger } from "./utils/logger";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  logger.info("=== PumpShill — Autonomous Pumpfun Advertiser ===");
  logger.info("Starting up...");

  const feeCollector = new FeeCollector();
  const treasury = new Treasury();
  const brain = new Brain();
  const tracker = new Tracker();

  // Initialize fee collector with current balance
  await feeCollector.initialize();

  // Start dashboard server
  const port = Number(process.env.DASHBOARD_PORT) || 3000;
  startServer({ treasury, tracker, feeCollector }, port);

  logger.info(
    {
      wallet: feeCollector.getWalletAddress(),
      pollInterval: config.agent.pollIntervalMs,
      minThreshold: config.agent.minTreasuryThresholdSol,
      maxSpendPct: config.agent.maxSpendPerCampaignPct,
    },
    "Agent configured"
  );

  let cycleCount = 0;

  while (true) {
    cycleCount++;
    logger.info({ cycle: cycleCount }, "--- New cycle ---");

    try {
      // 1. Check for new fees
      const feeSnapshot = await feeCollector.checkForNewFees();
      treasury.updateBalance(feeSnapshot.balanceSol);

      const summary = treasury.getSummary();
      logger.info(
        {
          balance: summary.totalBalance.toFixed(4),
          available: summary.available.toFixed(4),
          meetsThreshold: summary.meetsThreshold,
        },
        "Treasury status"
      );

      // 2. Brainstorm and execute
      // Always brainstorm — tweets/threads are free even with 0 SOL
      const maxBudget = treasury.meetsThreshold ? treasury.maxSpendPerCampaign : 0;
      logger.info(
        { meetsThreshold: summary.meetsThreshold, maxBudget: maxBudget.toFixed(4) },
        treasury.meetsThreshold
          ? "Treasury funded — full action set available"
          : "Treasury low — free actions only (tweets/threads)"
      );

      const proposal = await brain.brainstorm({
        treasuryBalance: treasury.availableBalance,
        maxBudget,
        pastCampaigns: tracker.getRecentCampaigns(10),
      });

      logger.info(
        {
          action: proposal.action,
          budget: proposal.budget,
          reasoning: proposal.reasoning,
          contentPreview: proposal.content.slice(0, 100),
        },
        "AI proposed campaign"
      );

      const campaign = await executeCampaign(proposal, treasury, tracker);
      logger.info(
        { id: campaign.id, status: campaign.status },
        "Campaign result"
      );

      // 3. Update metrics for recent tweet campaigns
      const recentCampaigns = tracker.getRecentCampaigns(5);
      for (const campaign of recentCampaigns) {
        if (campaign.tweetId && campaign.status === "executed") {
          const metrics = await getTweetMetrics(campaign.tweetId);
          if (metrics) {
            tracker.updateMetrics(campaign.id, metrics);
            logger.info(
              { campaignId: campaign.id, metrics },
              "Updated campaign metrics"
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in main loop cycle");
    }

    // 4. Sleep until next cycle
    logger.info(
      { nextCycleMs: config.agent.pollIntervalMs },
      "Sleeping until next cycle..."
    );
    await sleep(config.agent.pollIntervalMs);
  }
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error");
  process.exit(1);
});
