import { logger } from "../utils/logger";
import { Campaign } from "../tracker";

const ACTION_EMOJI: Record<string, string> = {
  tweet: "📝",
  thread: "🧵",
  airdrop: "🪂",
  memo_broadcast: "📡",
  tip: "💸",
  twitter_boost: "🚀",
  kol_payment: "🤝",
  ad_buy: "📺",
  custom: "⚡",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramNotification(campaign: Campaign): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!botToken || !channelId) return false;

  const emoji = ACTION_EMOJI[campaign.action] || "⚡";
  const status = campaign.status === "executed" ? "Executed" : "Failed";
  const cost = campaign.cost > 0 ? `${campaign.cost.toFixed(4)} SOL` : "Free";
  const content =
    campaign.action === "thread"
      ? campaign.content.split("|||")[0].trim()
      : campaign.content;

  let links = "";
  if (campaign.tweetId) {
    links += `\n<a href="https://x.com/i/status/${campaign.tweetId}">View Tweet</a>`;
  }
  if (campaign.metrics?.txSignature) {
    links += `\n<a href="https://solscan.io/tx/${campaign.metrics.txSignature}">View on Solscan</a>`;
  }

  const message =
    `${emoji} <b>New Campaign: ${campaign.action.toUpperCase()}</b>\n\n` +
    `${escapeHtml(content.slice(0, 300))}\n\n` +
    `<b>Status:</b> ${status}\n` +
    `<b>Cost:</b> ${cost}\n` +
    `<b>Reasoning:</b> <i>${escapeHtml(campaign.reasoning.slice(0, 200))}</i>` +
    links;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error({ err }, "Telegram notification failed");
      return false;
    }

    logger.info({ campaignId: campaign.id }, "Telegram notification sent");
    return true;
  } catch (err) {
    logger.error({ err }, "Telegram notification error");
    return false;
  }
}
