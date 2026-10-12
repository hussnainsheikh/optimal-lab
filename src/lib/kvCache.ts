// The KV cache. To pick each new token, attention needs a key (K) and a value (V) for every
// earlier token. Without a cache the model recomputes them all on every step; with a cache it
// computes K and V once per token and keeps them, so each step only works on the newest token.

export const PROMPT = ["The", " capital", " of", " France", " is"];
export const OUTPUT = [" Paris", ",", " a", " city", " on", " the", " Seine", "."];

// Per-token cache size for a 7B-class model: 32 layers × 32 heads × 128 dims × K and V × 2 bytes (fp16).
export const MODEL = { layers: 32, heads: 32, headDim: 128, bytesPerValue: 2 };
export const BYTES_PER_TOKEN = MODEL.layers * MODEL.heads * MODEL.headDim * 2 * MODEL.bytesPerValue; // 524,288 B = 0.5 MB

export type KvFrame = {
  phase: "prefill" | "decode";
  step: number; // 0 = prefill, then one per generated token
  tokens: string[]; // everything the model has seen after this step
  newToken: string | null; // token produced by this step
  computedNoCache: number; // K/V rows computed in this step without a cache
  computedWithCache: number; // K/V rows computed in this step with a cache
  totalNoCache: number; // running total
  totalWithCache: number;
  cachedRows: number; // rows held in the cache after this step
};

export function kvTrace(prompt = PROMPT, output = OUTPUT): KvFrame[] {
  const n0 = prompt.length;
  // Prefill: one pass over the whole prompt, in parallel. It computes K and V for every prompt
  // token, stores them, and produces the first output token. Same work with or without a cache.
  const frames: KvFrame[] = [
    {
      phase: "prefill",
      step: 0,
      tokens: [...prompt, output[0]],
      newToken: output[0],
      computedNoCache: n0,
      computedWithCache: n0,
      totalNoCache: n0,
      totalWithCache: n0,
      cachedRows: n0,
    },
  ];
  let totalNo = n0;
  let totalWith = n0;
  // Decode: each step feeds in the token produced last time and produces the next one.
  // Without a cache it recomputes K/V for every token so far; with a cache only for the new one.
  for (let i = 1; i < output.length; i++) {
    const seen = n0 + i;
    totalNo += seen;
    totalWith += 1;
    frames.push({
      phase: "decode",
      step: i,
      tokens: [...prompt, ...output.slice(0, i + 1)],
      newToken: output[i],
      computedNoCache: seen,
      computedWithCache: 1,
      totalNoCache: totalNo,
      totalWithCache: totalWith,
      cachedRows: seen,
    });
  }
  return frames;
}

// Total K/V rows computed to generate `out` tokens after a `prompt`-token prompt.
export function workFor(prompt: number, out: number) {
  let noCache = prompt;
  for (let i = 1; i < out; i++) noCache += prompt + i;
  return { noCache, withCache: prompt + Math.max(0, out - 1) };
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
