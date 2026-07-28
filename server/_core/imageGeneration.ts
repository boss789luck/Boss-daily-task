/**
 * Image generation helper using internal ImageService
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

// Default model for generated sites. "MODEL_GPT_IMAGE_2" is the forge images.v1
// enum for GPT Image 2 (id: gpt-image-2). If omitted, forge falls back to Gemini 2.5 Flash.
const DEFAULT_IMAGE_MODEL = "MODEL_GPT_IMAGE_2";
const DEFAULT_IMAGE_QUALITY = "medium";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  /** Forge image model enum, e.g. "MODEL_GPT_IMAGE_2". Defaults to GPT Image 2. */
  model?: string;
  /** Generation quality, e.g. "medium" | "high". Defaults to "medium" for GPT Image 2. */
  quality?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  try {
    let requestModel = "gpt-image-2";
    console.log("[ImageGen] Requesting gpt-image-2...");
    let response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openAiDalleKey}`,
        "Connection": "close"
      },
      body: JSON.stringify({
        model: requestModel,
        prompt: options.prompt,
        n: 1,
        size: "1024x1024",
      }),
    });
    console.log("[ImageGen] gpt-image-2 response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("[ImageGen] Parsed response JSON");
    const item = data.data?.[0];

    if (!item) {
      throw new Error("OpenAI API did not return an image");
    }

    let filename = `dalle-${Date.now()}.png`;
    let buffer: Uint8Array | ArrayBuffer;

    if (item.b64_json) {
       const binaryString = atob(item.b64_json);
       const len = binaryString.length;
       const bytes = new Uint8Array(len);
       for (let i = 0; i < len; i++) {
         bytes[i] = binaryString.charCodeAt(i);
       }
       buffer = bytes;
    } else if (item.url) {
       console.log("[ImageGen] Downloading generated image from URL:", item.url);
       const imgResponse = await fetch(item.url);
       if (!imgResponse.ok) throw new Error(`Failed to download generated image from OpenAI: ${imgResponse.statusText}`);
       buffer = await imgResponse.arrayBuffer();
       console.log("[ImageGen] Downloaded image, buffer length:", buffer.byteLength);
       const mimeType = imgResponse.headers.get("content-type") || "image/png";
       const ext = mimeType.split("/")[1] ?? "png";
       filename = `dalle-${Date.now()}.${ext}`;
    } else {
       throw new Error("OpenAI API returned an unknown format");
    }

    console.log("[ImageGen] Uploading to R2 with filename:", filename);
    const { url } = await storagePut(
       filename, 
       buffer, 
       filename.endsWith(".png") ? "image/png" : "image/jpeg"
    );
    console.log("[ImageGen] R2 upload successful:", url);

    return { url };
  } catch (err: any) {
    console.error("====== IMAGE GENERATION ERROR ======");
    console.error(err);
    console.error("====================================");
    throw new Error(`Failed to generate image: ${err.message}`);
  }
}

export type ImageModelInfo = {
  /** Forge model enum, e.g. "MODEL_GPT_IMAGE_2". Pass into generateImage({ model }). */
  model?: string;
  /** Stable model id, e.g. "gpt-image-2". */
  id?: string;
};

export type ListImageModelsResponse = {
  models: ImageModelInfo[];
};

/**
 * List the image models the internal ImageService currently supports.
 * Feed a returned `model` value into generateImage({ model }).
 */
export async function listImageModels(): Promise<ListImageModelsResponse> {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL(
    "images.v1.ImageService/ListModels",
    baseUrl
  ).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `List image models failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as { models?: ImageModelInfo[] };
  return { models: result.models ?? [] };
}
