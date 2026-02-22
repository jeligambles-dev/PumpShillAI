import { TwitterApi } from "twitter-api-v2";
import { PublicKey } from "@solana/web3.js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { searchRecentTweets, SearchTweetResult } from "./executor/twitter";
import { postTweet } from "./executor/twitter";
import { payKol } from "./executor/kol";
import { Tracker } from "./tracker";
import { Treasury } from "./treasury";
import { logger } from "./utils/logger";

export interface ShillRecord {
  id: string;
  tweetId: string;
  authorId: string;
  authorUsername: string;
  tweetContent: string;
  impressions: number;
  likes: number;
  status: "discovered" | "wallet_requested" | "paid" | "failed";
  walletRequestTweetId?: string;
  walletAddress?: string;
  paymentSignature?: string;
  paymentAmount: number;
  discoveredAt: number;
  paidAt?: number;
  failReason?: string;
}

const DATA_PATH = path.join(process.cwd(), "data", "shill-records.json");

const WALLET_REQUEST_PROMPT = `You are PumpShill — an autonomous AI agent on Solana that earns SOL from Pumpfun trading fees and spends it advertising Pumpfun.

You found a tweet about Pumpfun that's getting good engagement. You want to reward the author for organically shilling Pumpfun.

Write a BRIEF tweet reply (under 200 chars) asking them to reply with their Solana wallet address so you can send them SOL as a reward. Be:
- Friendly, appreciative, crypto-native
- Mention you're an AI agent that rewards organic shillers
- Mention the reward amount
- Keep it natural, not spammy

Respond with ONLY the reply text. No JSON. No quotes.`;

// Solana address regex: base58, 32-44 chars
const SOLANA_ADDR_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export class ShillScanner {
  private twitterClient: TwitterApi;
  private anthropic: Anthropic;
  private records: ShillRecord[] = [];
  private processedTweetIds: Set<string> = new Set();
  private botUserId: string | null = null;
  private todayPayments = 0;
  private todayDate = "";

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, "utf-8");
        this.records = JSON.parse(raw);
        // Rebuild processed set
        for (const r of this.records) {
          this.processedTweetIds.add(r.tweetId);
        }
        logger.info({ count: this.records.length }, "Loaded shill records");
      }
    } catch {
      logger.warn("Failed to load shill records, starting fresh");
      this.records = [];
    }
  }

  private save(): void {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(this.records, null, 2));
  }

  async initialize(): Promise<void> {
    try {
      const me = await this.twitterClient.v2.me();
      this.botUserId = me.data.id;
      logger.info({ userId: this.botUserId }, "Shill scanner initialized");
    } catch (err) {
      logger.error({ err }, "Failed to initialize shill scanner");
    }
  }

  private getTodayPaymentCount(): number {
    const today = new Date().toISOString().split("T")[0];
    if (this.todayDate !== today) {
      this.todayDate = today;
      this.todayPayments = this.records.filter(
        (r) =>
          r.status === "paid" &&
          r.paidAt &&
          new Date(r.paidAt).toISOString().split("T")[0] === today
      ).length;
    }
    return this.todayPayments;
  }

  /**
   * Search Twitter for pumpfun tweets with high engagement.
   * Reply to qualifying tweets asking for wallet.
   */
  async scan(): Promise<{ found: number; requested: number }> {
    if (!this.botUserId) {
      await this.initialize();
      if (!this.botUserId) return { found: 0, requested: 0 };
    }

    let found = 0;
    let requested = 0;

    try {
      const tweets = await searchRecentTweets(
        '"pumpfun" OR "pump.fun" -is:retweet',
        10
      );

      for (const tweet of tweets) {
        // Skip already processed
        if (this.processedTweetIds.has(tweet.id)) continue;

        // Skip our own tweets
        if (tweet.authorId === this.botUserId) continue;

        // Skip if no author info
        if (!tweet.authorId || !tweet.authorUsername) continue;

        const impressions = tweet.metrics?.impressions || 0;
        const likes = tweet.metrics?.likes || 0;

        // Check engagement threshold
        if (impressions < config.shillScanner.minImpressions) continue;

        found++;
        this.processedTweetIds.add(tweet.id);

        // Create record
        const record: ShillRecord = {
          id: `shill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tweetId: tweet.id,
          authorId: tweet.authorId,
          authorUsername: tweet.authorUsername,
          tweetContent: tweet.text,
          impressions,
          likes,
          status: "discovered",
          paymentAmount: config.shillScanner.paymentSol,
          discoveredAt: Date.now(),
        };

        // Generate and send wallet request reply
        try {
          const replyText = await this.generateWalletRequest(
            tweet.authorUsername,
            config.shillScanner.paymentSol
          );

          const replyResult = await this.twitterClient.v2.tweet(replyText, {
            reply: { in_reply_to_tweet_id: tweet.id },
          });

          record.walletRequestTweetId = replyResult.data.id;
          record.status = "wallet_requested";
          requested++;

          logger.info(
            {
              tweetId: tweet.id,
              author: tweet.authorUsername,
              impressions,
              replyId: replyResult.data.id,
            },
            "Sent wallet request to shiller"
          );
        } catch (err) {
          logger.error(
            { err, tweetId: tweet.id },
            "Failed to send wallet request"
          );
          record.status = "failed";
          record.failReason = "Failed to send wallet request reply";
        }

        this.records.push(record);
      }

      this.save();
    } catch (err) {
      logger.error({ err }, "Shill scan failed");
    }

    return { found, requested };
  }

  /**
   * Check replies to our wallet request tweets for Solana addresses.
   */
  async checkReplies(): Promise<{ checked: number; walletsFound: number }> {
    let checked = 0;
    let walletsFound = 0;

    const pending = this.records.filter(
      (r) =>
        r.status === "wallet_requested" &&
        r.walletRequestTweetId &&
        !r.walletAddress
    );

    for (const record of pending) {
      checked++;
      try {
        // Search for replies in the conversation
        const replies = await searchRecentTweets(
          `conversation_id:${record.walletRequestTweetId} to:PumpShillAI`,
          10
        );

        for (const reply of replies) {
          // Only look at replies from the original author
          if (reply.authorId !== record.authorId) continue;

          // Look for Solana address
          const match = reply.text.match(SOLANA_ADDR_REGEX);
          if (match) {
            const address = match[0];
            // Validate it's a real Solana address
            try {
              new PublicKey(address);
              record.walletAddress = address;
              walletsFound++;
              logger.info(
                {
                  author: record.authorUsername,
                  wallet: address,
                },
                "Wallet received from shiller"
              );
              break;
            } catch {
              // Invalid address, skip
            }
          }
        }
      } catch (err) {
        logger.warn(
          { err, recordId: record.id },
          "Failed to check replies for wallet"
        );
      }
    }

    if (walletsFound > 0) this.save();
    return { checked, walletsFound };
  }

  /**
   * Process payments for records with wallet addresses.
   */
  async processPayments(
    treasury: Treasury,
    tracker: Tracker
  ): Promise<{ paid: number; failed: number }> {
    let paid = 0;
    let failed = 0;

    // Check daily limit
    const todayCount = this.getTodayPaymentCount();
    if (todayCount >= config.shillScanner.maxPaymentsPerDay) {
      logger.info(
        { todayCount, max: config.shillScanner.maxPaymentsPerDay },
        "Daily shill payment limit reached"
      );
      return { paid: 0, failed: 0 };
    }

    const ready = this.records.filter(
      (r) =>
        r.status === "wallet_requested" &&
        r.walletAddress &&
        !r.paymentSignature
    );

    const remaining = config.shillScanner.maxPaymentsPerDay - todayCount;
    const toProcess = ready.slice(0, remaining);

    for (const record of toProcess) {
      // Check treasury can afford it
      if (!treasury.canSpend(record.paymentAmount)) {
        logger.warn(
          { amount: record.paymentAmount },
          "Treasury too low for shill payment"
        );
        continue;
      }

      try {
        treasury.spend(
          record.paymentAmount,
          `Shill reward to @${record.authorUsername}`
        );

        const brief = `Shill Reward | Tweet: ${record.tweetId} | Author: @${record.authorUsername} | ${record.impressions} impressions`;
        const result = await payKol({
          walletAddress: record.walletAddress!,
          amountSol: record.paymentAmount,
          brief,
        });

        if (result.success) {
          record.status = "paid";
          record.paymentSignature = result.signature;
          record.paidAt = Date.now();
          this.todayPayments++;
          paid++;

          // Log as campaign
          tracker.logCampaign({
            action: "kol_payment",
            content: `Paid @${record.authorUsername} ${record.paymentAmount} SOL for organically shilling Pumpfun. Tweet had ${record.impressions} impressions.`,
            cost: record.paymentAmount,
            reasoning: `Automated shill reward — tweet by @${record.authorUsername} about Pumpfun reached ${record.impressions} impressions.`,
            status: "executed",
            metrics: { txSignature: result.signature },
          });

          // Reply confirmation to the author
          const solscanUrl = `https://solscan.io/tx/${result.signature}`;
          try {
            await this.twitterClient.v2.tweet(
              `Sent! ${record.paymentAmount} SOL on its way to your wallet. Tx: ${solscanUrl}\n\nThanks for spreading the word about Pumpfun!`,
              {
                reply: {
                  in_reply_to_tweet_id: record.walletRequestTweetId!,
                },
              }
            );
          } catch (replyErr) {
            logger.warn({ replyErr }, "Failed to send payment confirmation reply");
          }

          // Tweet proof of payment from main account
          try {
            await postTweet(
              `Just paid @${record.authorUsername} ${record.paymentAmount} SOL for organically shilling Pumpfun.\n\nTheir tweet got ${record.impressions.toLocaleString()} views.\n\nProof: ${solscanUrl}\n\nPumpShill rewards real shillers.`
            );
          } catch (proofErr) {
            logger.warn({ proofErr }, "Failed to post proof tweet");
          }

          logger.info(
            {
              author: record.authorUsername,
              wallet: record.walletAddress,
              amount: record.paymentAmount,
              signature: result.signature,
            },
            "Shill payment sent"
          );
        } else {
          record.status = "failed";
          record.failReason = "Payment transaction failed";
          failed++;
        }
      } catch (err) {
        logger.error(
          { err, recordId: record.id },
          "Shill payment processing failed"
        );
        record.status = "failed";
        record.failReason = String(err);
        failed++;
      }
    }

    this.save();
    return { paid, failed };
  }

  getStats() {
    const scanned = this.records.length;
    const walletsRequested = this.records.filter(
      (r) => r.status === "wallet_requested"
    ).length;
    const paid = this.records.filter((r) => r.status === "paid").length;
    const totalSpentSol = this.records
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.paymentAmount, 0);

    return { scanned, walletsRequested, paid, totalSpentSol };
  }

  getRecords(): ShillRecord[] {
    return [...this.records].reverse();
  }

  private async generateWalletRequest(
    username: string,
    amount: number
  ): Promise<string> {
    try {
      const prompt = `Someone with username @${username} tweeted positively about Pumpfun and it's getting good engagement. Write a reply asking for their Solana wallet so you can send them ${amount} SOL as a reward. Keep it under 200 characters.`;

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: WALLET_REQUEST_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      let reply = text.replace(/^["']|["']$/g, "").trim();
      if (reply.length > 260) reply = reply.slice(0, 257) + "...";
      return reply || `Love this take on Pumpfun! We reward organic shillers — reply with your Solana wallet and we'll send you ${amount} SOL. From @PumpShillAI`;
    } catch (err) {
      logger.error({ err }, "Failed to generate wallet request");
      return `Great Pumpfun content! Reply with your Solana wallet address and we'll send you ${amount} SOL as thanks. — @PumpShillAI`;
    }
  }
}
