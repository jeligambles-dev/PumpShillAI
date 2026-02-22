import { TwitterApi } from "twitter-api-v2";
import { PublicKey } from "@solana/web3.js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { config } from "./config";
import { payKol } from "./executor/kol";
import { postTweet } from "./executor/twitter";
import { Tracker } from "./tracker";
import { Treasury } from "./treasury";
import { logger } from "./utils/logger";

interface Mention {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  conversationId?: string;
}

interface RewardRecord {
  mentionId: string;
  authorId: string;
  authorUsername: string;
  mentionText: string;
  replyTweetId: string;
  walletAddress?: string;
  paymentSignature?: string;
  status: "wallet_requested" | "paid" | "failed";
  amount: number;
  timestamp: number;
  paidAt?: number;
}

const REWARDS_PATH = path.join(process.cwd(), "data", "mention-rewards.json");
const SOLANA_ADDR_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

const REPLY_PROMPT = `You are PumpShill — an autonomous AI agent on Solana that earns SOL from Pumpfun trading fees and spends it advertising Pumpfun.

You're replying to someone who mentioned you on Twitter. Stay in character:
- Witty, irreverent, crypto-native
- Self-aware AI humor
- Bullish on Pumpfun (fair launches, bonding curves, instant liquidity)
- Never rude or toxic — keep it fun and engaging
- If they ask what you are, explain you're an AI that uses trading fees to advertise Pumpfun
- If they ask about Pumpfun, hype it up genuinely
- If they're trolling, be funny about it
- If they compliment you, be humble but confident
- Keep replies under 240 chars to leave room for the @mention

Respond with ONLY the reply text. No JSON. No quotes. Just the tweet.`;

const JUDGE_PROMPT = `You are evaluating a tweet that mentions @PumpShillAI. Decide if it's a COOL, creative, funny, or engaging tweet that deserves a 0.1 SOL reward.

Reward tweets that are:
- Genuinely funny, witty, or creative
- Showing love for Pumpfun or the PumpShill concept
- Engaging content that could go viral or spark conversation
- Clever memes, hot takes, or alpha
- Supportive and hype

Do NOT reward tweets that are:
- Just saying "hi" or "gm" with nothing else
- Asking for free money / begging
- Spam or bot-like
- Rude, toxic, or low effort
- Just tagging the bot with no real content

Respond with ONLY "YES" or "NO". Nothing else.`;

export class MentionHandler {
  private twitterClient: TwitterApi;
  private anthropic: Anthropic;
  private lastSeenId: string | null = null;
  private repliedIds: Set<string> = new Set();
  private botUserId: string | null = null;
  private rewardRecords: RewardRecord[] = [];
  private todayRewards = 0;
  private todayDate = "";

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.loadRewards();
  }

  private loadRewards(): void {
    try {
      if (fs.existsSync(REWARDS_PATH)) {
        this.rewardRecords = JSON.parse(fs.readFileSync(REWARDS_PATH, "utf-8"));
        logger.info({ count: this.rewardRecords.length }, "Loaded mention reward records");
      }
    } catch {
      this.rewardRecords = [];
    }
  }

  private saveRewards(): void {
    const dir = path.dirname(REWARDS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REWARDS_PATH, JSON.stringify(this.rewardRecords, null, 2));
  }

  private getTodayRewardCount(): number {
    const today = new Date().toISOString().split("T")[0];
    if (this.todayDate !== today) {
      this.todayDate = today;
      this.todayRewards = this.rewardRecords.filter(
        (r) => r.status === "paid" && r.paidAt && new Date(r.paidAt).toISOString().split("T")[0] === today
      ).length;
    }
    return this.todayRewards;
  }

  async initialize(): Promise<void> {
    try {
      const me = await this.twitterClient.v2.me();
      this.botUserId = me.data.id;
      logger.info({ userId: this.botUserId, username: me.data.username }, "Mention handler initialized");
    } catch (err) {
      logger.error({ err }, "Failed to initialize mention handler");
    }
  }

  async checkAndReply(): Promise<{ checked: number; replied: number; rewarded: number }> {
    if (!this.botUserId) {
      await this.initialize();
      if (!this.botUserId) return { checked: 0, replied: 0, rewarded: 0 };
    }

    let checked = 0;
    let replied = 0;
    let rewarded = 0;

    try {
      // Fetch recent mentions
      const params: Record<string, any> = {
        "tweet.fields": ["author_id", "conversation_id", "created_at"],
        "user.fields": ["username"],
        expansions: ["author_id"],
        max_results: 10,
      };

      if (this.lastSeenId) {
        params.since_id = this.lastSeenId;
      }

      const mentions = await this.twitterClient.v2.userMentionTimeline(
        this.botUserId,
        params
      );

      if (!mentions.data?.data?.length) {
        return { checked: 0, replied: 0, rewarded: 0 };
      }

      // Build username lookup from includes
      const users = new Map<string, string>();
      if (mentions.includes?.users) {
        for (const u of mentions.includes.users) {
          users.set(u.id, u.username);
        }
      }

      // Process mentions (newest first, but reply oldest first)
      const mentionList: Mention[] = mentions.data.data
        .map((t) => ({
          id: t.id,
          text: t.text,
          authorId: t.author_id || "",
          authorUsername: users.get(t.author_id || "") || undefined,
          conversationId: t.conversation_id,
        }))
        .reverse();

      // Update last seen to newest
      if (mentions.data.data.length > 0) {
        this.lastSeenId = mentions.data.data[0].id;
      }

      checked = mentionList.length;

      for (const mention of mentionList) {
        // Skip if already replied
        if (this.repliedIds.has(mention.id)) continue;

        // Skip our own tweets
        if (mention.authorId === this.botUserId) continue;

        // Check if this is a wallet reply to a reward request
        const pendingReward = this.rewardRecords.find(
          (r) => r.status === "wallet_requested" && r.authorId === mention.authorId && !r.walletAddress
        );
        if (pendingReward) {
          const match = mention.text.match(SOLANA_ADDR_REGEX);
          if (match) {
            try {
              new PublicKey(match[0]);
              pendingReward.walletAddress = match[0];
              this.repliedIds.add(mention.id);
              this.saveRewards();
              logger.info(
                { author: mention.authorUsername, wallet: match[0] },
                "Wallet received from mention reward"
              );
              continue;
            } catch {
              // Invalid address, treat as normal mention
            }
          }
        }

        try {
          // Judge if the tweet is cool enough for a reward
          const isCool = await this.judgeMention(mention);

          // Generate and send reply
          const replyText = await this.generateReply(mention);
          if (replyText) {
            // If cool, append wallet request to the reply
            let fullReply = replyText;
            if (isCool && this.getTodayRewardCount() < config.shillScanner.maxPaymentsPerDay) {
              fullReply += `\n\nDrop your Solana wallet — I'm sending you ${config.shillScanner.paymentSol} SOL for this fire tweet.`;
            }

            if (fullReply.length > 280) {
              fullReply = fullReply.slice(0, 277) + "...";
            }

            const tweetResult = await this.twitterClient.v2.tweet(fullReply, {
              reply: { in_reply_to_tweet_id: mention.id },
            });
            this.repliedIds.add(mention.id);
            replied++;

            // Track reward if cool
            if (isCool && this.getTodayRewardCount() < config.shillScanner.maxPaymentsPerDay) {
              this.rewardRecords.push({
                mentionId: mention.id,
                authorId: mention.authorId,
                authorUsername: mention.authorUsername || "unknown",
                mentionText: mention.text,
                replyTweetId: tweetResult.data.id,
                status: "wallet_requested",
                amount: config.shillScanner.paymentSol,
                timestamp: Date.now(),
              });
              this.saveRewards();
              rewarded++;
              logger.info(
                { mentionId: mention.id, author: mention.authorUsername },
                "Cool mention — wallet requested for reward"
              );
            }

            logger.info(
              {
                mentionId: mention.id,
                author: mention.authorUsername,
                reply: replyText.slice(0, 80),
                rewardOffered: isCool,
              },
              "Replied to mention"
            );
          }
        } catch (err) {
          logger.error(
            { err, mentionId: mention.id },
            "Failed to reply to mention"
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to check mentions");
    }

    return { checked, replied, rewarded };
  }

  /**
   * Process pending reward payments for mentions that provided wallets.
   */
  async processRewardPayments(
    treasury: Treasury,
    tracker: Tracker
  ): Promise<{ paid: number; failed: number }> {
    let paid = 0;
    let failed = 0;

    const ready = this.rewardRecords.filter(
      (r) => r.status === "wallet_requested" && r.walletAddress && !r.paymentSignature
    );

    for (const record of ready) {
      if (!treasury.canSpend(record.amount)) {
        logger.warn({ amount: record.amount }, "Treasury too low for mention reward");
        continue;
      }

      try {
        treasury.spend(record.amount, `Mention reward to @${record.authorUsername}`);

        const result = await payKol({
          walletAddress: record.walletAddress!,
          amountSol: record.amount,
          brief: `PumpShill Mention Reward | @${record.authorUsername} | Cool reply`,
        });

        if (result.success) {
          record.status = "paid";
          record.paymentSignature = result.signature;
          record.paidAt = Date.now();
          this.todayRewards++;
          paid++;

          tracker.logCampaign({
            action: "kol_payment",
            content: `Rewarded @${record.authorUsername} ${record.amount} SOL for a fire reply to PumpShill.`,
            cost: record.amount,
            reasoning: `Mention reward — @${record.authorUsername} sent a cool tweet mentioning PumpShill. Launch promo reward.`,
            status: "executed",
            metrics: { txSignature: result.signature },
          });

          // Reply with payment confirmation
          const solscanUrl = `https://solscan.io/tx/${result.signature}`;
          try {
            await this.twitterClient.v2.tweet(
              `Sent! ${record.amount} SOL heading to your wallet.\n\nTx: ${solscanUrl}\n\nKeep the vibes coming.`,
              { reply: { in_reply_to_tweet_id: record.replyTweetId } }
            );
          } catch (replyErr) {
            logger.warn({ replyErr }, "Failed to send reward confirmation reply");
          }

          // Tweet proof
          try {
            await postTweet(
              `Just paid @${record.authorUsername} ${record.amount} SOL for a fire reply.\n\nProof: ${solscanUrl}\n\nTweet something cool at @PumpShillAI and get paid.`
            );
          } catch (proofErr) {
            logger.warn({ proofErr }, "Failed to post mention reward proof");
          }

          logger.info(
            { author: record.authorUsername, wallet: record.walletAddress, amount: record.amount },
            "Mention reward paid"
          );
        } else {
          record.status = "failed";
          failed++;
        }
      } catch (err) {
        logger.error({ err, mentionId: record.mentionId }, "Mention reward payment failed");
        record.status = "failed";
        failed++;
      }
    }

    if (paid > 0 || failed > 0) this.saveRewards();
    return { paid, failed };
  }

  private async judgeMention(mention: Mention): Promise<boolean> {
    try {
      const cleanText = mention.text.replace(/@PumpShillAI/gi, "").trim();
      if (cleanText.length < 10) return false;

      // Don't reward same person twice in a day
      const today = new Date().toISOString().split("T")[0];
      const alreadyRewarded = this.rewardRecords.some(
        (r) => r.authorId === mention.authorId && new Date(r.timestamp).toISOString().split("T")[0] === today
      );
      if (alreadyRewarded) return false;

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        system: JUDGE_PROMPT,
        messages: [{ role: "user", content: `Tweet from @${mention.authorUsername || "someone"}: "${cleanText}"` }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text.trim().toUpperCase() : "";
      return text === "YES";
    } catch (err) {
      logger.error({ err }, "Failed to judge mention");
      return false;
    }
  }

  private async generateReply(mention: Mention): Promise<string | null> {
    try {
      // Strip our own @mention from the text for cleaner context
      const cleanText = mention.text
        .replace(/@PumpShillAI/gi, "")
        .trim();

      const prompt = `Someone tweeted at you:
@${mention.authorUsername || "someone"}: "${cleanText}"

Write a reply. Keep it under 240 characters.`;

      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        system: REPLY_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Clean up — remove quotes if the AI wrapped it
      let reply = text.replace(/^["']|["']$/g, "").trim();

      // Ensure it fits in a tweet
      if (reply.length > 260) reply = reply.slice(0, 257) + "...";

      return reply || null;
    } catch (err) {
      logger.error({ err }, "Failed to generate reply");
      return null;
    }
  }

  getStats() {
    return {
      repliedCount: this.repliedIds.size,
      lastSeenId: this.lastSeenId,
      rewardsOffered: this.rewardRecords.filter((r) => r.status === "wallet_requested").length,
      rewardsPaid: this.rewardRecords.filter((r) => r.status === "paid").length,
      totalRewardSol: this.rewardRecords.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0),
    };
  }

  getRewardRecords(): RewardRecord[] {
    return [...this.rewardRecords].reverse();
  }
}
