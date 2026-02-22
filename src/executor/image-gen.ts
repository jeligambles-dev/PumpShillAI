import { logger } from "../utils/logger";

export async function generateImage(prompt: string): Promise<Buffer | null> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    logger.warn("Image generation not configured (missing REPLICATE_API_TOKEN)");
    return null;
  }

  try {
    // Use Replicate's SDXL model for fast, high-quality images
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input: {
          prompt: `${prompt}. Crypto art style, vibrant, digital, modern, high quality`,
          negative_prompt: "text, watermark, logo, blurry, low quality",
          width: 1024,
          height: 1024,
          num_outputs: 1,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Replicate API error ${res.status}: ${errText}`);
    }

    const prediction = (await res.json()) as { id: string; urls: { get: string } };

    // Poll for completion
    let result: any;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      result = await pollRes.json();

      if (result.status === "succeeded") break;
      if (result.status === "failed") throw new Error(`Generation failed: ${result.error}`);
    }

    if (!result?.output?.[0]) throw new Error("No image output returned");

    // Download the image
    const imageUrl = result.output[0];
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.status}`);

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info({ prompt: prompt.slice(0, 60), size: buffer.length }, "Image generated");
    return buffer;
  } catch (err) {
    logger.error({ err, prompt: prompt.slice(0, 60) }, "Image generation failed");
    return null;
  }
}
