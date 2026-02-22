import { logger } from "./utils/logger";

export class PriceFeed {
  private solUsd: number = 0;
  private updatedAt: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  async start(intervalMs: number = 60000): Promise<void> {
    await this.fetchPrice();
    this.intervalId = setInterval(() => this.fetchPrice(), intervalMs);
    logger.info({ solUsd: this.solUsd }, "Price feed started");
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  getPrice(): number {
    return this.solUsd;
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }

  getSolInUsd(sol: number): number {
    return sol * this.solUsd;
  }

  getUsdInSol(usd: number): number {
    return this.solUsd > 0 ? usd / this.solUsd : 0;
  }

  private async fetchPrice(): Promise<void> {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
      const data = (await res.json()) as { solana?: { usd?: number } };
      const price = data?.solana?.usd;
      if (price && price > 0) {
        this.solUsd = price;
        this.updatedAt = Date.now();
      }
    } catch (err) {
      logger.warn({ err }, "Failed to fetch SOL price");
    }
  }
}
