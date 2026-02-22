import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getConnection, getSpendingWallet, solToLamports } from "../utils/solana";
import { logger } from "../utils/logger";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

/**
 * Pay a KOL/influencer in SOL with an on-chain memo brief.
 *
 * The memo serves as a public, verifiable record of the payment + brief.
 * Anyone can see on Solscan that PumpShill paid X SOL to wallet Y with the message.
 */
export async function payKol(opts: {
  walletAddress: string;
  amountSol: number;
  brief: string;
}): Promise<{ signature: string; success: boolean }> {
  try {
    const connection = getConnection();
    const wallet = getSpendingWallet();
    const recipient = new PublicKey(opts.walletAddress);

    // Construct memo: include brief + attribution
    const memo = `PumpShill KOL Campaign | ${opts.brief} | Payment: ${opts.amountSol} SOL`;

    const tx = new Transaction();

    // SOL transfer
    tx.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipient,
        lamports: solToLamports(opts.amountSol),
      })
    );

    // Memo with the brief (on-chain proof)
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo.slice(0, 566), "utf-8"), // memo max ~566 bytes
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);

    logger.info(
      {
        signature,
        recipient: opts.walletAddress,
        amount: opts.amountSol,
        brief: opts.brief.slice(0, 80),
      },
      "KOL payment sent"
    );

    return { signature, success: true };
  } catch (err) {
    logger.error({ err, wallet: opts.walletAddress }, "KOL payment failed");
    return { signature: "", success: false };
  }
}
