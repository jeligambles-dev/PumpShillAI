import { TwitterApi } from "twitter-api-v2";
import { config } from "../config";
import { logger } from "../utils/logger";
import { CampaignMetrics } from "../tracker";

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (!client) {
    client = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret,
    });
  }
  return client;
}

export async function postTweet(
  content: string
): Promise<{ tweetId: string; success: boolean }> {
  try {
    const tw = getClient();
    const result = await tw.v2.tweet(content);
    logger.info({ tweetId: result.data.id }, "Tweet posted");
    return { tweetId: result.data.id, success: true };
  } catch (err) {
    logger.error({ err }, "Failed to post tweet");
    return { tweetId: "", success: false };
  }
}

export async function postTweetWithImage(
  content: string,
  imageBuffer: Buffer
): Promise<{ tweetId: string; success: boolean }> {
  try {
    const tw = getClient();

    // Upload media via v1 API (required for media upload)
    const mediaId = await tw.v1.uploadMedia(imageBuffer, {
      mimeType: "image/png",
    });

    const result = await tw.v2.tweet(content, {
      media: { media_ids: [mediaId] },
    });

    logger.info({ tweetId: result.data.id }, "Image tweet posted");
    return { tweetId: result.data.id, success: true };
  } catch (err) {
    logger.error({ err }, "Failed to post image tweet");
    return { tweetId: "", success: false };
  }
}

export async function postQuoteTweet(
  content: string,
  quotedTweetId: string
): Promise<{ tweetId: string; success: boolean }> {
  try {
    const tw = getClient();
    const result = await tw.v2.tweet(content, {
      quote_tweet_id: quotedTweetId,
    });
    logger.info({ tweetId: result.data.id, quotedTweetId }, "Quote tweet posted");
    return { tweetId: result.data.id, success: true };
  } catch (err) {
    logger.error({ err, quotedTweetId }, "Failed to post quote tweet");
    return { tweetId: "", success: false };
  }
}

export interface SearchTweetResult {
  id: string;
  text: string;
  authorId?: string;
  authorUsername?: string;
  conversationId?: string;
  metrics?: { impressions?: number; likes?: number };
}

export async function searchRecentTweets(
  query: string,
  maxResults: number = 5
): Promise<SearchTweetResult[]> {
  try {
    const tw = getClient();
    const result = await tw.v2.search(query, {
      max_results: Math.min(maxResults, 10) as 10,
      "tweet.fields": ["public_metrics", "author_id", "conversation_id"],
      "user.fields": ["username"],
      expansions: ["author_id"],
      sort_order: "relevancy",
    });

    if (!result.data?.data) return [];

    // Build username lookup from includes
    const users = new Map<string, string>();
    if (result.includes?.users) {
      for (const u of result.includes.users) {
        users.set(u.id, u.username);
      }
    }

    return result.data.data.map((t) => ({
      id: t.id,
      text: t.text,
      authorId: t.author_id,
      authorUsername: users.get(t.author_id || "") || undefined,
      conversationId: t.conversation_id,
      metrics: t.public_metrics
        ? {
            impressions: t.public_metrics.impression_count,
            likes: t.public_metrics.like_count,
          }
        : undefined,
    }));
  } catch (err) {
    logger.warn({ err, query }, "Failed to search tweets");
    return [];
  }
}

export async function postThread(
  tweets: string[]
): Promise<{ tweetIds: string[]; success: boolean }> {
  try {
    const tw = getClient();
    const tweetIds: string[] = [];
    let lastTweetId: string | undefined;

    for (const text of tweets) {
      const options = lastTweetId
        ? { reply: { in_reply_to_tweet_id: lastTweetId } }
        : {};
      const result = await tw.v2.tweet(text, options);
      tweetIds.push(result.data.id);
      lastTweetId = result.data.id;
    }

    logger.info({ count: tweetIds.length }, "Thread posted");
    return { tweetIds, success: true };
  } catch (err) {
    logger.error({ err }, "Failed to post thread");
    return { tweetIds: [], success: false };
  }
}

export async function getTweetMetrics(
  tweetId: string
): Promise<CampaignMetrics | null> {
  try {
    const tw = getClient();
    const tweet = await tw.v2.singleTweet(tweetId, {
      "tweet.fields": ["public_metrics"],
    });

    const metrics = tweet.data.public_metrics;
    if (!metrics) return null;

    return {
      likes: metrics.like_count,
      retweets: metrics.retweet_count,
      impressions: metrics.impression_count,
      replies: metrics.reply_count,
    };
  } catch (err) {
    logger.error({ err, tweetId }, "Failed to fetch tweet metrics");
    return null;
  }
}
