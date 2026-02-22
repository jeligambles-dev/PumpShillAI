import { Campaign } from "./tracker";
import { logger } from "./utils/logger";

export interface BoostAlert {
  id: string;
  campaignId: string;
  tweetId: string;
  content: string;
  impressions: number;
  likes: number;
  retweets: number;
  score: number;
  reason: string;
  tweetUrl: string;
  timestamp: number;
  dismissed: boolean;
}

// Thresholds for boost recommendations
const THRESHOLDS = {
  minImpressions: 500,
  minLikes: 20,
  minScore: 1000, // impressions + likes*10 + retweets*20
};

export class AlertSystem {
  private alerts: BoostAlert[] = [];
  private dismissedIds: Set<string> = new Set();

  /**
   * Scan campaigns for tweets worth boosting.
   * Call this after metrics are updated each cycle.
   */
  evaluateCampaigns(campaigns: Campaign[], twitterHandle: string): void {
    for (const c of campaigns) {
      // Only look at executed tweets/threads with metrics
      if (!c.tweetId || c.status !== "executed") continue;
      if (!c.metrics?.impressions && !c.metrics?.likes) continue;

      const impressions = c.metrics.impressions || 0;
      const likes = c.metrics.likes || 0;
      const retweets = c.metrics.retweets || 0;
      const score = impressions + likes * 10 + retweets * 20;

      // Skip if below thresholds
      if (score < THRESHOLDS.minScore) continue;

      // Skip if we already have an alert for this campaign
      const alertId = `boost_${c.id}`;
      if (this.alerts.some((a) => a.id === alertId)) {
        // Update metrics on existing alert
        const existing = this.alerts.find((a) => a.id === alertId)!;
        existing.impressions = impressions;
        existing.likes = likes;
        existing.retweets = retweets;
        existing.score = score;
        continue;
      }

      let reason = "";
      if (impressions >= 10000) reason = "Viral potential — over 10K impressions organically";
      else if (impressions >= 5000) reason = "Strong performer — 5K+ impressions, worth amplifying";
      else if (likes >= 100) reason = "High engagement rate — 100+ likes, audience loves this";
      else if (score >= 5000) reason = "Top performer by combined score";
      else reason = "Above-average engagement — consider boosting";

      const alert: BoostAlert = {
        id: alertId,
        campaignId: c.id,
        tweetId: c.tweetId,
        content: c.action === "thread" ? c.content.split("|||")[0] : c.content,
        impressions,
        likes,
        retweets,
        score,
        reason,
        tweetUrl: `https://x.com/${twitterHandle}/status/${c.tweetId}`,
        timestamp: Date.now(),
        dismissed: false,
      };

      this.alerts.push(alert);
      logger.info(
        { alertId, tweetId: c.tweetId, score, reason },
        "New boost alert created"
      );
    }
  }

  getActiveAlerts(): BoostAlert[] {
    return this.alerts
      .filter((a) => !a.dismissed && !this.dismissedIds.has(a.id))
      .sort((a, b) => b.score - a.score);
  }

  getAllAlerts(): BoostAlert[] {
    return [...this.alerts].sort((a, b) => b.score - a.score);
  }

  dismissAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      this.dismissedIds.add(alertId);
      logger.info({ alertId }, "Alert dismissed");
      return true;
    }
    return false;
  }

  getStats() {
    const active = this.alerts.filter((a) => !a.dismissed).length;
    const dismissed = this.alerts.filter((a) => a.dismissed).length;
    const topScore = this.alerts.length > 0
      ? Math.max(...this.alerts.map((a) => a.score))
      : 0;
    return { total: this.alerts.length, active, dismissed, topScore };
  }
}
