import { CampaignProposal } from "../brain";
import { Campaign, CampaignMetrics, Tracker } from "../tracker";
import { Treasury } from "../treasury";
import { logger } from "../utils/logger";
import { postTweet, postThread, postTweetWithImage, postQuoteTweet } from "./twitter";
import { sendAirdrop, sendMemo, sendTip } from "./onchain";
import { sendTelegramNotification } from "./telegram";
import { boostTweet } from "./twitter-ads";
import { payKol } from "./kol";
import { createAdCampaign } from "./ad-network";
import { generateImage } from "./image-gen";
import { postCast } from "./farcaster";
import { config } from "../config";

export interface ExecutionResult {
  success: boolean;
  tweetId?: string;
  txSignature?: string;
  adCampaignId?: string;
  estimatedReach?: number;
  castHash?: string;
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

  // Content dedup check
  if (tracker.isDuplicate(proposal.content, 48)) {
    logger.warn(
      { action: proposal.action, content: proposal.content.slice(0, 60) },
      "Duplicate content detected — skipping"
    );
    const campaign = tracker.logCampaign({
      action: proposal.action,
      content: proposal.content,
      cost: 0,
      reasoning: proposal.reasoning,
      status: "failed",
    });
    return campaign;
  }

  let result: ExecutionResult = { success: false };

  try {
    switch (proposal.action) {
      case "tweet": {
        const tw = await postTweet(proposal.content);
        result = { success: tw.success, tweetId: tw.tweetId };
        break;
      }

      case "image_tweet": {
        const imagePrompt = (proposal.metadata?.imagePrompt as string) || proposal.content;
        const imageBuffer = await generateImage(imagePrompt);
        if (imageBuffer) {
          const tw = await postTweetWithImage(proposal.content, imageBuffer);
          result = { success: tw.success, tweetId: tw.tweetId };
        } else {
          // Fallback to text tweet if image gen fails
          logger.warn("Image generation failed, falling back to text tweet");
          const tw = await postTweet(proposal.content);
          result = { success: tw.success, tweetId: tw.tweetId };
        }
        break;
      }

      case "quote_tweet": {
        const quoteTweetId = proposal.metadata?.quoteTweetId as string;
        if (!quoteTweetId) {
          logger.warn("Quote tweet proposed but no quoteTweetId in metadata");
          // Fallback to regular tweet
          const tw = await postTweet(proposal.content);
          result = { success: tw.success, tweetId: tw.tweetId };
        } else {
          const tw = await postQuoteTweet(proposal.content, quoteTweetId);
          result = { success: tw.success, tweetId: tw.tweetId };
        }
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

  // Cross-post to Farcaster if enabled and campaign was a tweet-based action
  if (
    config.farcaster.enabled &&
    result.success &&
    ["tweet", "image_tweet", "quote_tweet"].includes(proposal.action)
  ) {
    try {
      const castResult = await postCast(proposal.content);
      if (castResult.success) {
        result.castHash = castResult.castHash;
        logger.info({ castHash: castResult.castHash }, "Cross-posted to Farcaster");
      }
    } catch (err) {
      logger.warn({ err }, "Farcaster cross-post failed (non-blocking)");
    }
  }

  const metrics: Record<string, unknown> = {};
  if (result.txSignature) metrics.txSignature = result.txSignature;
  if (result.adCampaignId) metrics.adCampaignId = result.adCampaignId;
  if (result.estimatedReach) metrics.estimatedReach = result.estimatedReach;
  if (result.castHash) metrics.castHash = result.castHash;

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

  // Tweet proof of payment for paid actions (non-blocking)
  if (result.success && proposal.budget > 0) {
    tweetSpendProof(proposal, result).catch(() => {});
  }

  return campaign;
}

/**
 * Tweet public proof when PumpShill spends SOL on any paid action.
 */
async function tweetSpendProof(
  proposal: CampaignProposal,
  result: ExecutionResult
): Promise<void> {
  const sig = result.txSignature;
  const solscan = sig ? `https://solscan.io/tx/${sig}` : "";
  let proofText = "";

  switch (proposal.action) {
    case "kol_payment":
      proofText = `Just paid ${proposal.budget} SOL to a KOL for promoting Pumpfun.\n\nOn-chain proof: ${solscan}\n\nPumpShill puts fees to work.`;
      break;
    case "ad_buy":
      proofText = `Spent ${proposal.budget} SOL on crypto display ads for Pumpfun. Campaign is live.\n\nAutonomous ad buying — powered by creator fees.`;
      break;
    case "airdrop": {
      const recipients = (proposal.metadata?.recipients as string[]) || [];
      proofText = `Airdropped SOL to ${recipients.length} Pumpfun traders.\n\nProof: ${solscan}\n\nRewards for the community.`;
      break;
    }
    case "tip":
      proofText = `Tipped ${proposal.budget} SOL to a Pumpfun community member.\n\nProof: ${solscan}\n\nGood vibes only.`;
      break;
    case "twitter_boost":
      proofText = `Boosting a viral Pumpfun tweet with ${proposal.budget} SOL worth of ads.\n\nFueling organic reach with paid amplification.`;
      break;
    case "memo_broadcast":
      proofText = `Broadcast an on-chain memo for ${proposal.budget} SOL.\n\nProof: ${solscan}\n\nPermanent Pumpfun lore on Solana.`;
      break;
    default:
      return; // Don't tweet proof for unknown paid actions
  }

  if (proofText) {
    try {
      await postTweet(proofText);
      logger.info({ action: proposal.action }, "Spend proof tweeted");
    } catch (err) {
      logger.warn({ err }, "Failed to tweet spend proof (non-blocking)");
    }
  }
}
