import { AsyncLocalStorage } from "node:async_hooks";

export const bucketStorage = new AsyncLocalStorage<any>(); // R2Bucket type

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const bucket = bucketStorage.getStore();
  if (!bucket) throw new Error("No R2 bucket binding found");

  const key = appendHashSuffix(normalizeKey(relKey));
  
  await bucket.put(key, data, {
    httpMetadata: { contentType }
  });

  return { key, url: `/uploads/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/uploads/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  // Not strictly needed if we serve public uploads via a worker route, 
  // but keeping signature for compatibility if needed.
  return `/uploads/${normalizeKey(relKey)}`;
}
