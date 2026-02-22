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

export async function sendAirdrop(
  recipients: string[],
  amountPerWalletSol: number
): Promise<{ signature: string; success: boolean }> {
  try {
    const connection = getConnection();
    const wallet = getSpendingWallet();
    const lamportsEach = solToLamports(amountPerWalletSol);

    const tx = new Transaction();

    for (const addr of recipients) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(addr),
          lamports: lamportsEach,
        })
      );
    }

    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
    logger.info(
      { signature, recipients: recipients.length, amountEach: amountPerWalletSol },
      "Airdrop sent"
    );
    return { signature, success: true };
  } catch (err) {
    logger.error({ err }, "Airdrop failed");
    return { signature: "", success: false };
  }
}

export async function sendMemo(
  message: string
): Promise<{ signature: string; success: boolean }> {
  try {
    const connection = getConnection();
    const wallet = getSpendingWallet();

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(message, "utf-8"),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
    logger.info({ signature, message: message.slice(0, 50) }, "Memo broadcast sent");
    return { signature, success: true };
  } catch (err) {
    logger.error({ err }, "Memo broadcast failed");
    return { signature: "", success: false };
  }
}

export async function sendTip(
  recipient: string,
  amountSol: number
): Promise<{ signature: string; success: boolean }> {
  try {
    const connection = getConnection();
    const wallet = getSpendingWallet();

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: solToLamports(amountSol),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
    logger.info({ signature, recipient, amount: amountSol }, "Tip sent");
    return { signature, success: true };
  } catch (err) {
    logger.error({ err }, "Tip failed");
    return { signature: "", success: false };
  }
}
