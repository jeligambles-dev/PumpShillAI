import { config } from "./config";
import { logger } from "./utils/logger";

export interface LedgerEntry {
  timestamp: number;
  type: "income" | "spend";
  amount: number;
  reason: string;
  campaignId?: string;
}

export class Treasury {
  private balance: number = 0;
  private allocated: number = 0;
  private ledger: LedgerEntry[] = [];

  get availableBalance(): number {
    return this.balance - this.allocated;
  }

  get totalBalance(): number {
    return this.balance;
  }

  get maxSpendPerCampaign(): number {
    return this.balance * (config.agent.maxSpendPerCampaignPct / 100);
  }

  get meetsThreshold(): boolean {
    return this.availableBalance >= config.agent.minTreasuryThresholdSol;
  }

  recordIncome(amount: number, reason: string): void {
    this.balance += amount;
    this.ledger.push({
      timestamp: Date.now(),
      type: "income",
      amount,
      reason,
    });
    logger.info({ amount, balance: this.balance }, "Income recorded");
  }

  updateBalance(newBalance: number): void {
    const diff = newBalance - this.balance;
    if (diff > 0) {
      this.recordIncome(diff, "Fee collection");
    }
    this.balance = newBalance;
  }

  canSpend(amount: number): boolean {
    if (amount <= 0) return false;
    if (amount > this.availableBalance) return false;
    if (amount > this.maxSpendPerCampaign) return false;
    return true;
  }

  allocate(amount: number, reason: string): boolean {
    if (!this.canSpend(amount)) {
      logger.warn({ amount, available: this.availableBalance }, "Cannot allocate");
      return false;
    }
    this.allocated += amount;
    logger.info({ amount, allocated: this.allocated }, "Funds allocated");
    return true;
  }

  spend(amount: number, reason: string, campaignId?: string): boolean {
    this.balance -= amount;
    this.allocated = Math.max(0, this.allocated - amount);
    this.ledger.push({
      timestamp: Date.now(),
      type: "spend",
      amount,
      reason,
      campaignId,
    });
    logger.info(
      { amount, reason, campaignId, remaining: this.balance },
      "Funds spent"
    );
    return true;
  }

  releaseAllocation(amount: number): void {
    this.allocated = Math.max(0, this.allocated - amount);
  }

  getLedger(): LedgerEntry[] {
    return [...this.ledger];
  }

  getSummary() {
    return {
      totalBalance: this.balance,
      allocated: this.allocated,
      available: this.availableBalance,
      maxPerCampaign: this.maxSpendPerCampaign,
      meetsThreshold: this.meetsThreshold,
      totalSpent: this.ledger
        .filter((e) => e.type === "spend")
        .reduce((sum, e) => sum + e.amount, 0),
      totalEarned: this.ledger
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + e.amount, 0),
    };
  }
}
