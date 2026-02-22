import { CampaignProposal } from "../brain";
import { Campaign, CampaignMetrics, Tracker } from "../tracker";
import { Treasury } from "../treasury";
import { logger } from "../utils/logger";
import { postTweet, postThread } from "./twitter";
import { sendAirdrop, sendMemo, sendTip } from "./onchain";
import { sendTelegramNotification } from "./telegram";
import { boostTweet } from "./twitter-ads";
import { payKol } from "./kol";
import { createAdCampaign } from "./ad-network";

export interface ExecutionResult {
  success: boolean;
  tweetId?: string;
  txSignature?: string;
  adCampaignId?: string;
  estimatedReach?: number;
}

export async function executeCampaign(
  proposal: CampaignProposal,
  treasury: Treasury,
  tracker: Tracker
): Promise<Campaign> {
  logger.info(
    { action: proposal.action, budget: proposal.budget },
    "Executing campaign"
  );

  let result: ExecutionResult = { success: false };

  try {
    switch (proposal.action) {
      case "tweet": {
        const tw = await postTweet(proposal.content);
        result = { success: tw.success, tweetId: tw.tweetId };
        break;
      }

      case "thread": {
        const tweets = proposal.content.split("|||").map((t) => t.trim());
        const th = await postThread(tweets);
        result = {
          success: th.success,
          tweetId: th.tweetIds[0],
        };
        break;
      }

      case "airdrop": {
        // AI should provide recipients in metadata
        const recipients = (proposal.metadata?.recipients as string[]) || [];
        const amountEach = (proposal.metadata?.amountEach as number) || 0.001;
        if (recipients.length === 0) {
          logger.warn("Airdrop proposed but no recipients specified");
          result = { success: false };
        } else {
          if (treasury.canSpend(proposal.budget)) {
            treasury.spend(proposal.budget, "Airdrop campaign");
            const tx = await sendAirdrop(recipients, amountEach);
            result = { success: tx.success, txSignature: tx.signature };
          }
        }
        break;
      }

      case "memo_broadcast": {
        if (treasury.canSpend(proposal.budget)) {
          treasury.spend(proposal.budget, "Memo broadcast");
          const tx = await sendMemo(proposal.content);
          result = { success: tx.success, txSignature: tx.signature };
        }
        break;
      }

      case "tip": {
        const recipient = proposal.metadata?.recipient as string;
        if (!recipient) {
          logger.warn("Tip proposed but no recipient specified");
          result = { success: false };
        } else if (treasury.canSpend(proposal.budget)) {
          treasury.spend(proposal.budget, `Tip to ${recipient}`);
          const tx = await sendTip(recipient, proposal.budget);
          result = { success: tx.success, txSignature: tx.signature };
        }
        break;
      }

      case "twitter_boost": {
        const tweetId = proposal.metadata?.tweetId as string;
        const dailyBudgetUsd = (proposal.metadata?.dailyBudgetUsd as number) || 5;
        const durationDays = (proposal.metadata?.durationDays as number) || 3;
        if (!tweetId) {
          logger.warn("Twitter boost proposed but no tweetId in metadata");
          result = { success: false };
        } else if (treasury.canSpend(proposal.budget)) {
          treasury.spend(proposal.budget, `Twitter boost for tweet ${tweetId}`);
          const boost = await boostTweet({ tweetId, dailyBudgetUsd, durationDays });
          result = {
            success: boost.success,
            tweetId,
            adCampaignId: boost.adCampaignId,
            estimatedReach: boost.estimatedReach,
          };
        }
        break;
      }

      case "kol_payment": {
        const walletAddress = proposal.metadata?.walletAddress as string;
        const brief = (proposal.metadata?.brief as string) || proposal.content;
        if (!walletAddress) {
          logger.warn("KOL payment proposed but no walletAddress in metadata");
          result = { success: false };
        } else if (treasury.canSpend(proposal.budget)) {
          treasury.spend(proposal.budget, `KOL payment to ${walletAddress}`);
          const kol = await payKol({ walletAddress, amountSol: proposal.budget, brief });
          result = { success: kol.success, txSignature: kol.signature };
        }
        break;
      }

      case "ad_buy": {
        const adText = (proposal.metadata?.adText as string) || proposal.content;
        const targetUrl = (proposal.metadata?.targetUrl as string) || "https://pump.fun";
        const dailyBudgetUsd = (proposal.metadata?.dailyBudgetUsd as number) || 5;
        const durationDays = (proposal.metadata?.durationDays as number) || 7;
        if (treasury.canSpend(proposal.budget)) {
          treasury.spend(proposal.budget, "Ad network campaign");
          const ad = await createAdCampaign({
            title: proposal.content.slice(0, 60),
            adText,
            targetUrl,
            dailyBudgetUsd,
            durationDays,
          });
          result = {
            success: ad.success,
            adCampaignId: ad.campaignId,
            estimatedReach: ad.estimatedImpressions,
          };
        }
        break;
      }

      case "custom": {
        logger.info(
          { content: proposal.content, reasoning: proposal.reasoning },
          "Custom campaign proposed — logging for manual review"
        );
        result = { success: true };
        break;
      }

      default:
        logger.warn({ action: proposal.action }, "Unknown action type");
        result = { success: false };
    }
  } catch (err) {
    logger.error({ err, action: proposal.action }, "Campaign execution failed");
    result = { success: false };
  }

  const metrics: Record<string, unknown> = {};
  if (result.txSignature) metrics.txSignature = result.txSignature;
  if (result.adCampaignId) metrics.adCampaignId = result.adCampaignId;
  if (result.estimatedReach) metrics.estimatedReach = result.estimatedReach;

  const campaign = tracker.logCampaign({
    action: proposal.action,
    content: proposal.content,
    cost: proposal.budget,
    reasoning: proposal.reasoning,
    status: result.success ? "executed" : "failed",
    tweetId: result.tweetId,
    metrics: Object.keys(metrics).length > 0 ? metrics as any : undefined,
  });

  // Send Telegram notification (fire and forget)
  sendTelegramNotification(campaign).catch(() => {});

  return campaign;
}
