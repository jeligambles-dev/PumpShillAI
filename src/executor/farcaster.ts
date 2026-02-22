import { logger } from "../utils/logger";

interface CastResult {
  success: boolean;
  castHash?: string;
}

interface CastMetrics {
  likes: number;
  recasts: number;
  replies: number;
}

export async function postCast(
  text: string,
  imageUrl?: string
): Promise<CastResult> {
  const apiKey = process.env.NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  if (!apiKey || !signerUuid) {
    logger.debug("Farcaster not configured (missing NEYNAR_API_KEY or FARCASTER_SIGNER_UUID)");
    return { success: false };
  }

  try {
    const body: Record<string, unknown> = {
      signer_uuid: signerUuid,
      text: text.slice(0, 1024), // Farcaster 1024 char limit
    };

    if (imageUrl) {
      body.embeds = [{ url: imageUrl }];
    }

    const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Neynar API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { cast?: { hash?: string } };
    const castHash = data?.cast?.hash;

    if (!castHash) throw new Error("No cast hash returned");

    logger.info({ castHash }, "Farcaster cast posted");
    return { success: true, castHash };
  } catch (err) {
    logger.error({ err }, "Failed to post Farcaster cast");
    return { success: false };
  }
}

export async function getCastMetrics(castHash: string): Promise<CastMetrics | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`,
      { headers: { api_key: apiKey } }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      cast?: { reactions?: { likes_count?: number; recasts_count?: number }; replies?: { count?: number } };
    };

    return {
      likes: data?.cast?.reactions?.likes_count || 0,
      recasts: data?.cast?.reactions?.recasts_count || 0,
      replies: data?.cast?.replies?.count || 0,
    };
  } catch (err) {
    logger.error({ err, castHash }, "Failed to fetch Farcaster cast metrics");
    return null;
  }
}
