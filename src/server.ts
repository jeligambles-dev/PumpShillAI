import express from "express";
import path from "path";
import { Treasury } from "./treasury";
import { Tracker } from "./tracker";
import { FeeCollector } from "./fee-collector";
import { AlertSystem } from "./alerts";
import { PriceFeed } from "./price-feed";
import { ShillScanner } from "./shill-scanner";
import { loginHandler, authMiddleware } from "./middleware/auth";
import { logger } from "./utils/logger";

export function createServer(deps: {
  treasury: Treasury;
  tracker: Tracker;
  feeCollector: FeeCollector;
  alertSystem: AlertSystem;
  priceFeed?: PriceFeed;
  shillScanner?: ShillScanner;
}) {
  const app = express();
  const { treasury, tracker, feeCollector, alertSystem, priceFeed, shillScanner } = deps;
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const auth = authMiddleware(adminPassword);

  app.use(express.json());

  // Serve static dashboard
  app.use(express.static(path.join(__dirname, "dashboard")));

  // Serve admin panel at /admin
  app.get("/admin", (_req, res) => {
    res.sendFile(path.join(__dirname, "dashboard", "admin.html"));
  });

  // --- Public Routes (no auth) ---

  app.get("/api/config", (_req, res) => {
    const contractAddress = process.env.CONTRACT_ADDRESS || "";
    const twitterHandle = process.env.TWITTER_HANDLE || "";
    const telegramChannel = process.env.TELEGRAM_CHANNEL || "";
    res.json({
      contractAddress,
      twitterHandle,
      telegramChannel,
      pumpfunUrl: contractAddress ? `https://pump.fun/coin/${contractAddress}` : "",
      authRequired: !!adminPassword,
    });
  });

  app.get("/api/stats", (_req, res) => {
    const treasurySummary = treasury.getSummary();
    const campaignStats = tracker.getStats();
    const solUsd = priceFeed?.getPrice() || 0;

    res.json({
      treasury: {
        ...treasurySummary,
        balanceUsd: solUsd > 0 ? treasurySummary.totalBalance * solUsd : null,
      },
      campaigns: campaignStats,
      wallet: feeCollector.getWalletAddress(),
      uptime: process.uptime(),
      solPrice: solUsd > 0 ? { usd: solUsd, updatedAt: priceFeed?.getUpdatedAt() } : null,
    });
  });

  app.get("/api/price", (_req, res) => {
    const solUsd = priceFeed?.getPrice() || 0;
    res.json({
      solUsd,
      updatedAt: priceFeed?.getUpdatedAt() || 0,
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

  app.get("/api/feed", (_req, res) => {
    const limit = Math.min(Number(_req.query.limit) || 20, 50);
    const campaigns = tracker.getAllCampaigns();
    res.json({
      total: campaigns.length,
      campaigns: campaigns.slice(-limit).reverse(),
    });
  });

  app.get("/api/payments", (_req, res) => {
    // KOL payments from campaign tracker
    const kolCampaigns = tracker.getAllCampaigns()
      .filter((c) => c.action === "kol_payment" && c.status === "executed");
    const kolPayments = kolCampaigns.map((c) => ({
      id: c.id,
      type: "kol" as const,
      recipient: c.content.match(/@(\w+)/)?.[1] || "Unknown KOL",
      amount: c.cost,
      reason: c.content,
      txSignature: (c.metrics as any)?.txSignature || undefined,
      impressions: (c.metrics as any)?.estimatedReach || undefined,
      timestamp: c.timestamp,
    }));

    // Shill payments from scanner
    const shillPayments = (shillScanner?.getRecords() || [])
      .filter((r) => r.status === "paid")
      .map((r) => ({
        id: r.id,
        type: "shill" as const,
        recipient: `@${r.authorUsername}`,
        amount: r.paymentAmount,
        reason: `Rewarded for organic Pumpfun tweet with ${r.impressions.toLocaleString()} impressions`,
        txSignature: r.paymentSignature || undefined,
        impressions: r.impressions,
        timestamp: r.paidAt || r.discoveredAt,
      }));

    const all = [...kolPayments, ...shillPayments]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    const totalSolSpent = all.reduce((s, p) => s + p.amount, 0);

    res.json({
      payments: all,
      stats: {
        totalPayments: all.length,
        totalSolSpent,
        kolPayments: kolPayments.length,
        shillPayments: shillPayments.length,
      },
    });
  });

  // Login route
  app.post("/api/login", loginHandler(adminPassword));

  // --- Protected Routes (auth required) ---

  app.get("/api/treasury", auth, (_req, res) => {
    const solUsd = priceFeed?.getPrice() || 0;
    const summary = treasury.getSummary();
    res.json({
      summary: {
        ...summary,
        balanceUsd: solUsd > 0 ? summary.totalBalance * solUsd : null,
      },
      ledger: treasury.getLedger().slice(-50),
    });
  });

  app.get("/api/campaigns", auth, (_req, res) => {
    const limit = Number(_req.query.limit) || 50;
    const campaigns = tracker.getAllCampaigns();
    res.json({
      total: campaigns.length,
      campaigns: campaigns.slice(-limit).reverse(),
    });
  });

  app.get("/api/campaigns/:id", auth, (_req, res) => {
    const all = tracker.getAllCampaigns();
    const campaign = all.find((c) => c.id === _req.params.id as string);
    if (!campaign) return res.status(404).json({ error: "Not found" });
    res.json(campaign);
  });

  app.get("/api/spending", auth, (_req, res) => {
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

  app.get("/api/alerts", auth, (_req, res) => {
    const active = alertSystem.getActiveAlerts();
    const stats = alertSystem.getStats();
    res.json({ alerts: active, stats });
  });

  app.get("/api/alerts/all", auth, (_req, res) => {
    const all = alertSystem.getAllAlerts();
    const stats = alertSystem.getStats();
    res.json({ alerts: all, stats });
  });

  app.post("/api/alerts/:id/dismiss", auth, (_req, res) => {
    const id = _req.params.id as string;
    const ok = alertSystem.dismissAlert(id);
    if (!ok) return res.status(404).json({ error: "Alert not found" });
    res.json({ success: true });
  });

  // --- Analytics ---

  app.get("/api/analytics", auth, (_req, res) => {
    const analytics = tracker.getAnalytics();
    res.json(analytics);
  });

  // --- Shill Scanner ---

  app.get("/api/shill-scanner", auth, (_req, res) => {
    if (!shillScanner) {
      return res.json({ stats: { scanned: 0, walletsRequested: 0, paid: 0, totalSpentSol: 0 }, records: [] });
    }
    res.json({
      stats: shillScanner.getStats(),
      records: shillScanner.getRecords().slice(0, 50),
    });
  });

  return app;
}

export function startServer(
  deps: {
    treasury: Treasury;
    tracker: Tracker;
    feeCollector: FeeCollector;
    alertSystem: AlertSystem;
    priceFeed?: PriceFeed;
    shillScanner?: ShillScanner;
  },
  port: number = 3000
) {
  const app = createServer(deps);
  app.listen(port, () => {
    logger.info({ port }, "Dashboard server running at http://localhost:" + port);
  });
  return app;
}
