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
}

export interface Campaign {
  id: string;
  action: ActionType;
  content: string;
  cost: number;
  reasoning: string;
  timestamp: number;
  metrics?: CampaignMetrics;
  tweetId?: string;
  status: "executed" | "failed" | "pending_metrics";
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

  logCampaign(campaign: Omit<Campaign, "id" | "timestamp">): Campaign {
    const entry: Campaign = {
      ...campaign,
      id: `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.campaigns.push(entry);
    this.save();
    logger.info({ id: entry.id, action: entry.action }, "Campaign logged");
    return entry;
  }

  updateMetrics(campaignId: string, metrics: CampaignMetrics): void {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      campaign.metrics = { ...campaign.metrics, ...metrics };
      campaign.status = "pending_metrics";
      this.save();
    }
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
}
