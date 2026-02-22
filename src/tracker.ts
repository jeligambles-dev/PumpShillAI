import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ActionType } from "./brain";
import { logger } from "./utils/logger";

export interface CampaignMetrics {
  likes?: number;
  retweets?: number;
  impressions?: number;
  replies?: number;
  txSignature?: string;
  // Ad-specific metrics
  adCampaignId?: string;
  paidImpressions?: number;
  paidClicks?: number;
  adSpendUsd?: number;
  estimatedReach?: number;
  // Farcaster metrics
  castHash?: string;
  farcasterLikes?: number;
  farcasterRecasts?: number;
  farcasterReplies?: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: CampaignMetrics;
}

export interface Campaign {
  id: string;
  action: ActionType;
  content: string;
  cost: number;
  reasoning: string;
  timestamp: number;
  metrics?: CampaignMetrics;
  metricsHistory?: MetricsSnapshot[];
  tweetId?: string;
  contentHash?: string;
  status: "executed" | "failed" | "pending_metrics";
  lastMetricsCheck?: number;
}

const DATA_PATH = path.join(process.cwd(), "data", "campaigns.json");

export class Tracker {
  private campaigns: Campaign[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, "utf-8");
        this.campaigns = JSON.parse(raw);
        logger.info({ count: this.campaigns.length }, "Loaded campaign history");
      }
    } catch {
      logger.warn("Failed to load campaigns, starting fresh");
      this.campaigns = [];
    }
  }

  private save(): void {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(this.campaigns, null, 2));
  }

  private hashContent(content: string): string {
    return crypto
      .createHash("sha256")
      .update(content.toLowerCase().trim())
      .digest("hex");
  }

  /**
   * Check if content is too similar to recent campaigns.
   * Uses exact hash match + word overlap check.
   */
  isDuplicate(content: string, windowHours: number = 48): boolean {
    const hash = this.hashContent(content);
    const cutoff = Date.now() - windowHours * 3600000;
    const recent = this.campaigns.filter(
      (c) => c.timestamp > cutoff && c.status === "executed"
    );

    // Exact hash match
    if (recent.some((c) => c.contentHash === hash)) return true;

    // Word overlap check (>70% shared words = duplicate)
    const words = new Set(
      content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    if (words.size < 4) return false; // Too short to check

    for (const c of recent) {
      const cWords = new Set(
        c.content
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );
      if (cWords.size < 4) continue;
      let overlap = 0;
      for (const w of words) {
        if (cWords.has(w)) overlap++;
      }
      const similarity = overlap / Math.min(words.size, cWords.size);
      if (similarity > 0.7) return true;
    }

    return false;
  }

  /**
   * Get recent content snippets for the brain to avoid repetition.
   */
  getRecentContentSnippets(limit: number = 15): string[] {
    return this.campaigns
      .filter((c) => c.status === "executed")
      .slice(-limit)
      .map((c) => c.content.split("|||")[0].slice(0, 100));
  }

  logCampaign(campaign: Omit<Campaign, "id" | "timestamp" | "contentHash">): Campaign {
    const entry: Campaign = {
      ...campaign,
      id: `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      contentHash: this.hashContent(campaign.content),
    };
    this.campaigns.push(entry);
    this.save();
    logger.info({ id: entry.id, action: entry.action }, "Campaign logged");
    return entry;
  }

  updateMetrics(campaignId: string, metrics: CampaignMetrics): void {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      // Append to metrics history
      if (!campaign.metricsHistory) campaign.metricsHistory = [];
      campaign.metricsHistory.push({
        timestamp: Date.now(),
        metrics: { ...metrics },
      });
      // Keep only last 10 snapshots
      if (campaign.metricsHistory.length > 10) {
        campaign.metricsHistory = campaign.metricsHistory.slice(-10);
      }

      campaign.metrics = { ...campaign.metrics, ...metrics };
      campaign.status = "pending_metrics";
      campaign.lastMetricsCheck = Date.now();
      this.save();
    }
  }

  /**
   * Get campaigns that need metrics updates.
   * Returns campaigns from last 7 days that haven't been checked in 6+ hours.
   */
  getCampaignsNeedingMetricsUpdate(maxResults: number = 10): Campaign[] {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const sixHoursAgo = Date.now() - 6 * 3600000;

    return this.campaigns
      .filter(
        (c) =>
          c.tweetId &&
          c.status !== "failed" &&
          c.timestamp > sevenDaysAgo &&
          (!c.lastMetricsCheck || c.lastMetricsCheck < sixHoursAgo)
      )
      .slice(-maxResults);
  }

  getRecentCampaigns(limit: number = 10): Campaign[] {
    return this.campaigns.slice(-limit);
  }

  getAllCampaigns(): Campaign[] {
    return [...this.campaigns];
  }

  getStats() {
    const total = this.campaigns.length;
    const totalSpent = this.campaigns.reduce((sum, c) => sum + c.cost, 0);
    const byAction = this.campaigns.reduce(
      (acc, c) => {
        acc[c.action] = (acc[c.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return { total, totalSpent, byAction };
  }

  /**
   * Compute analytics aggregations for the analytics dashboard page.
   */
  getAnalytics() {
    const campaigns = this.campaigns.filter((c) => c.status === "executed");

    // By action type: avg engagement
    const byActionType: Record<
      string,
      { count: number; totalImpressions: number; totalLikes: number; totalRetweets: number; totalCost: number }
    > = {};
    for (const c of campaigns) {
      if (!byActionType[c.action]) {
        byActionType[c.action] = { count: 0, totalImpressions: 0, totalLikes: 0, totalRetweets: 0, totalCost: 0 };
      }
      const entry = byActionType[c.action];
      entry.count++;
      entry.totalImpressions += c.metrics?.impressions || 0;
      entry.totalLikes += c.metrics?.likes || 0;
      entry.totalRetweets += c.metrics?.retweets || 0;
      entry.totalCost += c.cost;
    }

    // By hour of day
    const byHour: Record<number, { count: number; totalImpressions: number; totalLikes: number }> = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = { count: 0, totalImpressions: 0, totalLikes: 0 };
    }
    for (const c of campaigns) {
      const hour = new Date(c.timestamp).getUTCHours();
      byHour[hour].count++;
      byHour[hour].totalImpressions += c.metrics?.impressions || 0;
      byHour[hour].totalLikes += c.metrics?.likes || 0;
    }

    // By day (last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const byDay: Record<
      string,
      { count: number; impressions: number; likes: number; retweets: number }
    > = {};
    for (const c of campaigns.filter((c) => c.timestamp > thirtyDaysAgo)) {
      const day = new Date(c.timestamp).toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { count: 0, impressions: 0, likes: 0, retweets: 0 };
      byDay[day].count++;
      byDay[day].impressions += c.metrics?.impressions || 0;
      byDay[day].likes += c.metrics?.likes || 0;
      byDay[day].retweets += c.metrics?.retweets || 0;
    }

    // Top performers
    const topPerformers = [...campaigns]
      .filter((c) => c.metrics?.impressions)
      .sort(
        (a, b) =>
          ((b.metrics?.impressions || 0) + (b.metrics?.likes || 0) * 10) -
          ((a.metrics?.impressions || 0) + (a.metrics?.likes || 0) * 10)
      )
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        action: c.action,
        content: c.content.split("|||")[0].slice(0, 120),
        impressions: c.metrics?.impressions || 0,
        likes: c.metrics?.likes || 0,
        retweets: c.metrics?.retweets || 0,
        cost: c.cost,
        timestamp: c.timestamp,
      }));

    // Summary
    const totalImpressions = campaigns.reduce((s, c) => s + (c.metrics?.impressions || 0), 0);
    const totalLikes = campaigns.reduce((s, c) => s + (c.metrics?.likes || 0), 0);
    const totalCost = campaigns.reduce((s, c) => s + c.cost, 0);
    const bestHour = Object.entries(byHour).sort(
      ([, a], [, b]) => b.totalImpressions - a.totalImpressions
    )[0];
    const bestActionType = Object.entries(byActionType).sort(
      ([, a], [, b]) =>
        (b.count > 0 ? b.totalImpressions / b.count : 0) -
        (a.count > 0 ? a.totalImpressions / a.count : 0)
    )[0];

    return {
      byActionType,
      byHour,
      byDay,
      topPerformers,
      summary: {
        totalCampaigns: campaigns.length,
        totalImpressions,
        totalLikes,
        totalCost,
        avgEngagementRate:
          totalImpressions > 0
            ? ((totalLikes / totalImpressions) * 100).toFixed(2)
            : "0",
        bestHour: bestHour ? Number(bestHour[0]) : 0,
        bestActionType: bestActionType ? bestActionType[0] : "tweet",
        costPerImpression:
          totalCost > 0 && totalImpressions > 0
            ? (totalCost / totalImpressions).toFixed(6)
            : "0",
      },
    };
  }
}
