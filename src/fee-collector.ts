import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection, getFeeWallet, getBalanceSol } from "./utils/solana";
import { logger } from "./utils/logger";

export interface FeeSnapshot {
  balanceSol: number;
  newFeesSol: number;
  timestamp: number;
}

export class FeeCollector {
  private lastKnownBalance: number = 0;
  private walletPubkey: PublicKey;

  constructor() {
    this.walletPubkey = getFeeWallet().publicKey;
    logger.info(
      { wallet: this.walletPubkey.toBase58() },
      "Fee collector initialized"
    );
  }

  async initialize(): Promise<void> {
    this.lastKnownBalance = await getBalanceSol(this.walletPubkey);
    logger.info(
      { balance: this.lastKnownBalance },
      "Initial fee wallet balance"
    );
  }

  async checkForNewFees(): Promise<FeeSnapshot> {
    const currentBalance = await getBalanceSol(this.walletPubkey);
    const newFees = Math.max(0, currentBalance - this.lastKnownBalance);

    if (newFees > 0) {
      logger.info(
        { newFees, currentBalance, previousBalance: this.lastKnownBalance },
        "New fees detected"
      );
    }

    this.lastKnownBalance = currentBalance;

    return {
      balanceSol: currentBalance,
      newFeesSol: newFees,
      timestamp: Date.now(),
    };
  }

  getWalletAddress(): string {
    return this.walletPubkey.toBase58();
  }

  async getRecentTransactions(limit: number = 10) {
    const connection = getConnection();
    const signatures = await connection.getSignaturesForAddress(
      this.walletPubkey,
      { limit }
    );
    return signatures.map((sig) => ({
      signature: sig.signature,
      slot: sig.slot,
      err: sig.err,
      memo: sig.memo,
      blockTime: sig.blockTime,
    }));
  }
}
