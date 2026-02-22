import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import { logger } from "./utils/logger";

interface Mention {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  conversationId?: string;
}

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

export class MentionHandler {
  private twitterClient: TwitterApi;
  private anthropic: Anthropic;
  private lastSeenId: string | null = null;
  private repliedIds: Set<string> = new Set();
  private botUserId: string | null = null;

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
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

  async checkAndReply(): Promise<{ checked: number; replied: number }> {
    if (!this.botUserId) {
      await this.initialize();
      if (!this.botUserId) return { checked: 0, replied: 0 };
    }

    let checked = 0;
    let replied = 0;

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
        return { checked: 0, replied: 0 };
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

        try {
          const replyText = await this.generateReply(mention);
          if (replyText) {
            await this.twitterClient.v2.tweet(replyText, {
              reply: { in_reply_to_tweet_id: mention.id },
            });
            this.repliedIds.add(mention.id);
            replied++;

            logger.info(
              {
                mentionId: mention.id,
                author: mention.authorUsername,
                reply: replyText.slice(0, 80),
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

    return { checked, replied };
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
    };
  }
}
