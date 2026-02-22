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
