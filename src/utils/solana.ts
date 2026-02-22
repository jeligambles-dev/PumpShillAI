import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import { config } from "../config";
import { logger } from "./logger";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solana.rpcUrl, "confirmed");
    logger.info({ rpc: config.solana.rpcUrl }, "Solana connection established");
  }
  return connection;
}

export function loadKeypair(base58Key: string): Keypair {
  const decoded = bs58.decode(base58Key);
  return Keypair.fromSecretKey(decoded);
}

export function getFeeWallet(): Keypair {
  return loadKeypair(config.solana.feeWalletKey);
}

export function getSpendingWallet(): Keypair {
  const key = config.solana.spendingWalletKey || config.solana.feeWalletKey;
  return loadKeypair(key);
}

export async function getBalanceSol(pubkey: PublicKey): Promise<number> {
  const lamports = await getConnection().getBalance(pubkey);
  return lamports / LAMPORTS_PER_SOL;
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}
