import { logger } from "../utils/logger";

interface AdNetworkResult {
  success: boolean;
  campaignId?: string;
  estimatedImpressions?: number;
}

/**
 * Buy display/banner ads on A-Ads (Anonymous Ads), a crypto-native ad network.
 *
 * A-Ads accepts Bitcoin/crypto payments and has a REST API for creating
 * banner campaigns targeting crypto audiences.
 *
 * Flow:
 * 1. Create an ad unit with your creative text / banner URL
 * 2. Fund it (A-Ads generates a BTC/crypto deposit address)
 * 3. Track impressions/clicks via their API
 *
 * Requires A_ADS_API_TOKEN in env.
 */
export async function createAdCampaign(opts: {
  title: string;
  adText: string;
  targetUrl: string;
  dailyBudgetUsd: number;
  durationDays: number;
}): Promise<AdNetworkResult> {
  const apiToken = process.env.A_ADS_API_TOKEN;

  if (!apiToken) {
    logger.warn("A-Ads not configured (missing A_ADS_API_TOKEN)");
    return { success: false };
  }

  try {
    // Create campaign via A-Ads API
    const res = await fetch("https://a-ads.com/api/v2/campaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        name: `PumpShill: ${opts.title}`,
        ad_type: "text",
        ad_text: opts.adText.slice(0, 140),
        target_url: opts.targetUrl,
        daily_budget: opts.dailyBudgetUsd,
        status: "active",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`A-Ads API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as any;
    const campaignId = data?.id?.toString();

    if (!campaignId) throw new Error("No campaign ID returned from A-Ads");

    logger.info(
      { campaignId, title: opts.title, budget: opts.dailyBudgetUsd },
      "A-Ads campaign created"
    );

    return {
      success: true,
      campaignId,
      estimatedImpressions: opts.dailyBudgetUsd * opts.durationDays * 1000, // rough: ~1K per dollar
    };
  } catch (err) {
    logger.error({ err, title: opts.title }, "A-Ads campaign creation failed");
    return { success: false };
  }
}

/**
 * Get performance metrics for an A-Ads campaign.
 */
export async function getAdNetworkMetrics(campaignId: string): Promise<{
  impressions: number;
  clicks: number;
  spent: number;
} | null> {
  const apiToken = process.env.A_ADS_API_TOKEN;
  if (!apiToken) return null;

  try {
    const res = await fetch(
      `https://a-ads.com/api/v2/campaigns/${campaignId}/stats`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as any;

    return {
      impressions: data?.impressions || 0,
      clicks: data?.clicks || 0,
      spent: data?.spent_usd || 0,
    };
  } catch (err) {
    logger.error({ err, campaignId }, "Failed to fetch A-Ads metrics");
    return null;
  }
}
