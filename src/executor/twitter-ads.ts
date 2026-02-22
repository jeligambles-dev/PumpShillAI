import { TwitterApi } from "twitter-api-v2";
import { config } from "../config";
import { logger } from "../utils/logger";

interface BoostResult {
  success: boolean;
  adCampaignId?: string;
  estimatedReach?: number;
}

function getAdsClient(): TwitterApi {
  return new TwitterApi({
    appKey: config.twitter.apiKey,
    appSecret: config.twitter.apiSecret,
    accessToken: config.twitter.accessToken,
    accessSecret: config.twitter.accessSecret,
  });
}

/**
 * Promote an existing tweet using Twitter Ads API.
 *
 * Flow:
 * 1. Create a campaign with TWEET_ENGAGEMENTS objective
 * 2. Create an ad group with budget and crypto-targeted audience
 * 3. Promote the existing tweet within that ad group
 *
 * Requires TWITTER_ADS_ACCOUNT_ID and TWITTER_ADS_FUNDING_ID in env.
 */
export async function boostTweet(opts: {
  tweetId: string;
  dailyBudgetUsd: number;
  durationDays: number;
}): Promise<BoostResult> {
  const adsAccountId = process.env.TWITTER_ADS_ACCOUNT_ID;
  const fundingId = process.env.TWITTER_ADS_FUNDING_ID;

  if (!adsAccountId || !fundingId) {
    logger.warn("Twitter Ads not configured (missing TWITTER_ADS_ACCOUNT_ID or TWITTER_ADS_FUNDING_ID)");
    return { success: false };
  }

  const client = getAdsClient();
  const baseUrl = `https://ads-api.twitter.com/12/accounts/${adsAccountId}`;

  try {
    // 1. Create Campaign
    const campaignName = `PumpShill Boost ${opts.tweetId} ${Date.now()}`;
    const campaignRes = await client.v2.post(
      `${baseUrl}/campaigns` as any,
      {
        name: campaignName,
        funding_instrument_id: fundingId,
        daily_budget_amount_local_micro: opts.dailyBudgetUsd * 1_000_000, // micro-dollars
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + opts.durationDays * 86400000).toISOString(),
        entity_status: "ACTIVE",
        objective: "TWEET_ENGAGEMENTS",
      } as any
    );

    const campaignId = (campaignRes as any)?.data?.id;
    if (!campaignId) throw new Error("Failed to create campaign");

    logger.info({ campaignId, tweetId: opts.tweetId }, "Twitter Ads campaign created");

    // 2. Create Ad Group (line item)
    const adGroupRes = await client.v2.post(
      `${baseUrl}/line_items` as any,
      {
        campaign_id: campaignId,
        name: `PumpShill AdGroup ${opts.tweetId}`,
        bid_amount_local_micro: 500_000, // $0.50 bid
        product_type: "PROMOTED_TWEETS",
        placements: ["ALL_ON_TWITTER"],
        objective: "TWEET_ENGAGEMENTS",
        entity_status: "ACTIVE",
      } as any
    );

    const adGroupId = (adGroupRes as any)?.data?.id;
    if (!adGroupId) throw new Error("Failed to create ad group");

    // 3. Promote the tweet
    await client.v2.post(
      `${baseUrl}/promoted_tweets` as any,
      {
        line_item_id: adGroupId,
        tweet_ids: [opts.tweetId],
      } as any
    );

    logger.info(
      { campaignId, adGroupId, tweetId: opts.tweetId, budget: opts.dailyBudgetUsd },
      "Tweet promoted successfully"
    );

    return {
      success: true,
      adCampaignId: campaignId,
      estimatedReach: opts.dailyBudgetUsd * 2000, // rough estimate: ~2K impressions per dollar
    };
  } catch (err) {
    logger.error({ err, tweetId: opts.tweetId }, "Twitter Ads boost failed");
    return { success: false };
  }
}

/**
 * Get performance metrics for a Twitter Ads campaign.
 */
export async function getAdMetrics(adCampaignId: string): Promise<{
  impressions: number;
  engagements: number;
  spend: number;
} | null> {
  const adsAccountId = process.env.TWITTER_ADS_ACCOUNT_ID;
  if (!adsAccountId) return null;

  try {
    const client = getAdsClient();
    const baseUrl = `https://ads-api.twitter.com/12/stats/accounts/${adsAccountId}`;

    const res = await client.v2.get(
      `${baseUrl}` as any,
      {
        entity: "CAMPAIGN",
        entity_ids: adCampaignId,
        metric_groups: "ENGAGEMENT",
        start_time: new Date(Date.now() - 86400000 * 7).toISOString(),
        end_time: new Date().toISOString(),
        granularity: "TOTAL",
      } as any
    );

    const metrics = (res as any)?.data?.[0]?.id_data?.[0]?.metrics;
    if (!metrics) return null;

    return {
      impressions: metrics.impressions?.[0] || 0,
      engagements: metrics.engagements?.[0] || 0,
      spend: metrics.billed_charge_local_micro?.[0] / 1_000_000 || 0,
    };
  } catch (err) {
    logger.error({ err, adCampaignId }, "Failed to fetch ad metrics");
    return null;
  }
}
