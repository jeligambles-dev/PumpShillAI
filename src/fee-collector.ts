import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";
import { getConnection, getFeeWallet, getBalanceSol, lamportsToSol } from "./utils/solana";
import { logger } from "./utils/logger";

export interface FeeSnapshot {
  balanceSol: number;
  newFeesSol: number;
  claimedSol: number;
  timestamp: number;
}

export class FeeCollector {
  private lastKnownBalance: number = 0;
  private wallet = getFeeWallet();
  private connection = getConnection();
  private sdk: OnlinePumpSdk;

  constructor() {
    this.sdk = new OnlinePumpSdk(this.connection);
    logger.info(
      { wallet: this.wallet.publicKey.toBase58() },
      "Fee collector initialized"
    );
  }

  async initialize(): Promise<void> {
    this.lastKnownBalance = await getBalanceSol(this.wallet.publicKey);
    logger.info(
      { balance: this.lastKnownBalance },
      "Initial fee wallet balance"
    );
  }

  /**
   * Claim accumulated creator fees from Pumpfun.
   *
   * Uses the official pump-sdk to:
   * 1. Check vault balance across both Pump (bonding curve) and PumpSwap (graduated)
   * 2. Build + send the collect transaction
   *
   * The instruction is permissionless — fees always go to the creator wallet.
   */
  async claimFees(): Promise<{ claimed: boolean; amountSol: number; signature?: string }> {
    try {
      // Check vault balance across both programs
      const vaultBalance = await this.sdk.getCreatorVaultBalanceBothPrograms(
        this.wallet.publicKey
      );

      const vaultSol = lamportsToSol(Number(vaultBalance));

      if (vaultSol < 0.000001) {
        logger.debug("No fees to claim from Pumpfun vaults");
        return { claimed: false, amountSol: 0 };
      }

      logger.info({ vaultSol }, "Unclaimed Pumpfun fees detected, claiming...");

      // Build collect instructions
      const instructions = await this.sdk.collectCoinCreatorFeeInstructions(
        this.wallet.publicKey
      );

      if (!instructions || instructions.length === 0) {
        logger.debug("No collect instructions returned");
        return { claimed: false, amountSol: 0 };
      }

      const tx = new Transaction().add(...instructions);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );

      logger.info(
        { signature, amountSol: vaultSol },
        "Pumpfun creator fees claimed"
      );

      return { claimed: true, amountSol: vaultSol, signature };
    } catch (err) {
      logger.error({ err }, "Failed to claim Pumpfun fees");
      return { claimed: false, amountSol: 0 };
    }
  }

  async checkForNewFees(): Promise<FeeSnapshot> {
    // First, try to claim any accumulated fees
    const claim = await this.claimFees();

    // Then check wallet balance
    const currentBalance = await getBalanceSol(this.wallet.publicKey);
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
      claimedSol: claim.amountSol,
      timestamp: Date.now(),
    };
  }

  getWalletAddress(): string {
    return this.wallet.publicKey.toBase58();
  }

  async getRecentTransactions(limit: number = 10) {
    const signatures = await this.connection.getSignaturesForAddress(
      this.wallet.publicKey,
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
