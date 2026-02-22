import express from "express";
import path from "path";
import { Treasury } from "./treasury";
import { Tracker } from "./tracker";
import { FeeCollector } from "./fee-collector";
import { AlertSystem } from "./alerts";
import { logger } from "./utils/logger";

export function createServer(deps: {
  treasury: Treasury;
  tracker: Tracker;
  feeCollector: FeeCollector;
  alertSystem: AlertSystem;
}) {
  const app = express();
  const { treasury, tracker, feeCollector, alertSystem } = deps;

  app.use(express.json());

  // Serve static dashboard
  app.use(express.static(path.join(__dirname, "dashboard")));

  // --- API Routes ---

  app.get("/api/config", (_req, res) => {
    const contractAddress = process.env.CONTRACT_ADDRESS || "";
    const twitterHandle = process.env.TWITTER_HANDLE || "";
    const telegramChannel = process.env.TELEGRAM_CHANNEL || "";
    res.json({
      contractAddress,
      twitterHandle,
      telegramChannel,
      pumpfunUrl: contractAddress ? `https://pump.fun/coin/${contractAddress}` : "",
    });
  });

  app.get("/api/leaderboard", (_req, res) => {
    const campaigns = tracker.getAllCampaigns();
    const ranked = [...campaigns]
      .filter((c) => c.metrics && ((c.metrics as any).impressions || (c.metrics as any).likes))
      .sort((a, b) => {
        const scoreA = ((a.metrics as any)?.impressions || 0) + ((a.metrics as any)?.likes || 0) * 10;
        const scoreB = ((b.metrics as any)?.impressions || 0) + ((b.metrics as any)?.likes || 0) * 10;
        return scoreB - scoreA;
      })
      .slice(0, 5);
    res.json({ top: ranked });
  });

  app.get("/api/stats", (_req, res) => {
    const treasurySummary = treasury.getSummary();
    const campaignStats = tracker.getStats();

    res.json({
      treasury: treasurySummary,
      campaigns: campaignStats,
      wallet: feeCollector.getWalletAddress(),
      uptime: process.uptime(),
    });
  });

  app.get("/api/treasury", (_req, res) => {
    res.json({
      summary: treasury.getSummary(),
      ledger: treasury.getLedger().slice(-50),
    });
  });

  app.get("/api/campaigns", (_req, res) => {
    const limit = Number(_req.query.limit) || 50;
    const campaigns = tracker.getAllCampaigns();
    res.json({
      total: campaigns.length,
      campaigns: campaigns.slice(-limit).reverse(),
    });
  });

  app.get("/api/campaigns/:id", (_req, res) => {
    const all = tracker.getAllCampaigns();
    const campaign = all.find((c) => c.id === _req.params.id);
    if (!campaign) return res.status(404).json({ error: "Not found" });
    res.json(campaign);
  });

  app.get("/api/spending", (_req, res) => {
    const campaigns = tracker.getAllCampaigns();

    // Spending by action type
    const byAction: Record<string, { count: number; totalSol: number }> = {};
    for (const c of campaigns) {
      if (!byAction[c.action]) byAction[c.action] = { count: 0, totalSol: 0 };
      byAction[c.action].count++;
      byAction[c.action].totalSol += c.cost;
    }

    // Spending over time (grouped by day)
    const byDay: Record<string, { count: number; totalSol: number }> = {};
    for (const c of campaigns) {
      const day = new Date(c.timestamp).toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { count: 0, totalSol: 0 };
      byDay[day].count++;
      byDay[day].totalSol += c.cost;
    }

    // Success rate
    const executed = campaigns.filter((c) => c.status === "executed").length;
    const failed = campaigns.filter((c) => c.status === "failed").length;

    res.json({
      byAction,
      byDay,
      successRate: campaigns.length > 0 ? executed / campaigns.length : 0,
      executed,
      failed,
      total: campaigns.length,
    });
  });

  // --- Admin / Alert Routes ---

  app.get("/api/alerts", (_req, res) => {
    const active = alertSystem.getActiveAlerts();
    const stats = alertSystem.getStats();
    res.json({ alerts: active, stats });
  });

  app.get("/api/alerts/all", (_req, res) => {
    const all = alertSystem.getAllAlerts();
    const stats = alertSystem.getStats();
    res.json({ alerts: all, stats });
  });

  app.post("/api/alerts/:id/dismiss", (_req, res) => {
    const ok = alertSystem.dismissAlert(_req.params.id);
    if (!ok) return res.status(404).json({ error: "Alert not found" });
    res.json({ success: true });
  });

  return app;
}

export function startServer(
  deps: {
    treasury: Treasury;
    tracker: Tracker;
    feeCollector: FeeCollector;
    alertSystem: AlertSystem;
  },
  port: number = 3000
) {
  const app = createServer(deps);
  app.listen(port, () => {
    logger.info({ port }, "Dashboard server running at http://localhost:" + port);
  });
  return app;
}
