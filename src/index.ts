import { config } from "./config";
import { FeeCollector } from "./fee-collector";
import { Treasury } from "./treasury";
import { Brain } from "./brain";
import { Tracker } from "./tracker";
import { executeCampaign } from "./executor";
import { getTweetMetrics, postTweet, searchRecentTweets } from "./executor/twitter";
import { getCastMetrics } from "./executor/farcaster";
import { startServer, updateBrainState } from "./server";
import { AlertSystem } from "./alerts";
import { MentionHandler } from "./mentions";
import { ShillScanner } from "./shill-scanner";
import { PriceFeed } from "./price-feed";
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
  const alertSystem = new AlertSystem();
  const mentionHandler = new MentionHandler();
  const shillScanner = new ShillScanner();
  const priceFeed = new PriceFeed();

  // Initialize
  await feeCollector.initialize();
  await mentionHandler.initialize();
  await shillScanner.initialize();
  await priceFeed.start(60000); // Poll SOL price every 60s

  // Start dashboard server
  const port = Number(process.env.DASHBOARD_PORT) || 3000;
  startServer({ treasury, tracker, feeCollector, alertSystem, priceFeed, shillScanner }, port);

  logger.info(
    {
      wallet: feeCollector.getWalletAddress(),
      pollInterval: config.agent.pollIntervalMs,
      minThreshold: config.agent.minTreasuryThresholdSol,
      maxSpendPct: config.agent.maxSpendPerCampaignPct,
      imageGenEnabled: config.imageGeneration.enabled,
      farcasterEnabled: config.farcaster.enabled,
      solPrice: priceFeed.getPrice(),
    },
    "Agent configured"
  );

  let cycleCount = 0;

  while (true) {
    cycleCount++;
    logger.info({ cycle: cycleCount }, "--- New cycle ---");
    updateBrainState("collecting", cycleCount, "Checking wallet for new fees...");

    try {
      // 1. Check for new fees
      const feeSnapshot = await feeCollector.checkForNewFees();
      treasury.updateBalance(feeSnapshot.balanceSol);

      // Tweet about claimed fees
      if (feeSnapshot.claimedSol > 0) {
        try {
          await postTweet(
            `Just claimed ${feeSnapshot.claimedSol.toFixed(4)} SOL in Pumpfun creator fees.\n\nTotal treasury: ${feeSnapshot.balanceSol.toFixed(4)} SOL\n\nBack to work — more ads incoming.`
          );
          logger.info({ claimed: feeSnapshot.claimedSol }, "Fee claim tweeted");
        } catch (tweetErr) {
          logger.warn({ tweetErr }, "Failed to tweet fee claim (non-blocking)");
        }
      }

      const summary = treasury.getSummary();
      const solPrice = priceFeed.getPrice();
      logger.info(
        {
          balance: summary.totalBalance.toFixed(4),
          available: summary.available.toFixed(4),
          meetsThreshold: summary.meetsThreshold,
          solPriceUsd: solPrice > 0 ? solPrice.toFixed(2) : "unavailable",
        },
        "Treasury status"
      );

      // 2. Fetch trending crypto tweets for quote-tweet context
      let trendingTweets: Array<{ id: string; text: string; metrics?: { impressions?: number; likes?: number } }> = [];
      try {
        trendingTweets = await searchRecentTweets("pumpfun OR pump.fun OR solana memecoin", 5);
      } catch (err) {
        logger.warn({ err }, "Failed to fetch trending tweets");
      }

      // 3. Brainstorm and execute
      const maxBudget = treasury.meetsThreshold ? treasury.maxSpendPerCampaign : 0;
      logger.info(
        { meetsThreshold: summary.meetsThreshold, maxBudget: maxBudget.toFixed(4) },
        treasury.meetsThreshold
          ? "Treasury funded — full action set available"
          : "Treasury low — free actions only (tweets/threads)"
      );

      updateBrainState("thinking", cycleCount, `Treasury: ${summary.available.toFixed(4)} SOL. Analyzing past campaigns and brainstorming next move...`);

      const proposal = await brain.brainstorm({
        treasuryBalance: treasury.availableBalance,
        maxBudget,
        pastCampaigns: tracker.getRecentCampaigns(10),
        recentContentSnippets: tracker.getRecentContentSnippets(15),
        trendingTweets,
        solPriceUsd: solPrice > 0 ? solPrice : undefined,
      });

      updateBrainState("proposed", cycleCount, JSON.stringify({ action: proposal.action, content: proposal.content.slice(0, 120), budget: proposal.budget, reasoning: proposal.reasoning }, null, 2));

      logger.info(
        {
          action: proposal.action,
          budget: proposal.budget,
          reasoning: proposal.reasoning,
          contentPreview: proposal.content.slice(0, 100),
        },
        "AI proposed campaign"
      );

      updateBrainState("executing", cycleCount, `Executing ${proposal.action}...`);

      const campaign = await executeCampaign(proposal, treasury, tracker);

      updateBrainState("done", cycleCount, `Campaign ${campaign.id} ${campaign.status}. ${campaign.status === 'executed' ? 'Waiting for engagement metrics...' : 'Failed — will retry next cycle.'}`);

      logger.info(
        { id: campaign.id, status: campaign.status },
        "Campaign result"
      );

      // 4. Update metrics for campaigns needing checks (longer engagement tracking)
      const campaignsToCheck = tracker.getCampaignsNeedingMetricsUpdate(10);
      for (const c of campaignsToCheck) {
        if (c.tweetId) {
          const metrics = await getTweetMetrics(c.tweetId);
          if (metrics) {
            // Also fetch Farcaster metrics if cast exists
            if (c.metrics?.castHash && config.farcaster.enabled) {
              const farcasterMetrics = await getCastMetrics(c.metrics.castHash);
              if (farcasterMetrics) {
                metrics.farcasterLikes = farcasterMetrics.likes;
                metrics.farcasterRecasts = farcasterMetrics.recasts;
                metrics.farcasterReplies = farcasterMetrics.replies;
              }
            }
            tracker.updateMetrics(c.id, metrics);
            logger.info(
              { campaignId: c.id, impressions: metrics.impressions },
              "Updated campaign metrics"
            );
          }
        }
      }

      // 5. Check and reply to mentions + reward cool replies
      const mentionResult = await mentionHandler.checkAndReply();
      if (mentionResult.replied > 0) {
        logger.info(
          { checked: mentionResult.checked, replied: mentionResult.replied, rewarded: mentionResult.rewarded },
          "Replied to mentions"
        );
      }
      // Process pending mention reward payments
      const rewardResult = await mentionHandler.processRewardPayments(treasury, tracker);
      if (rewardResult.paid > 0) {
        logger.info(
          { paid: rewardResult.paid, failed: rewardResult.failed },
          "Mention rewards processed"
        );
      }

      // 6. Shill scanner — find organic shillers, reward them
      if (config.shillScanner.enabled) {
        try {
          const scanResult = await shillScanner.scan();
          if (scanResult.found > 0) {
            logger.info(
              { found: scanResult.found, requested: scanResult.requested },
              "Shill scan results"
            );
          }
          const replyResult = await shillScanner.checkReplies();
          if (replyResult.walletsFound > 0) {
            logger.info(
              { walletsFound: replyResult.walletsFound },
              "Wallets received from shillers"
            );
          }
          const payResult = await shillScanner.processPayments(treasury, tracker);
          if (payResult.paid > 0) {
            logger.info(
              { paid: payResult.paid, failed: payResult.failed },
              "Shill payments processed"
            );
          }
        } catch (err) {
          logger.error({ err }, "Shill scanner error");
        }
      }

      // 7. Evaluate campaigns for boost alerts
      const twitterHandle = process.env.TWITTER_HANDLE || "PumpShillAI";
      alertSystem.evaluateCampaigns(tracker.getAllCampaigns(), twitterHandle, treasury.availableBalance);
      const alertStats = alertSystem.getStats();
      if (alertStats.active > 0) {
        logger.info(
          { activeAlerts: alertStats.active, topScore: alertStats.topScore },
          "Boost alerts active — check admin panel"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error in main loop cycle");
    }

    // Sleep until next cycle
    updateBrainState("idle", cycleCount, "Waiting for next cycle...");
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
