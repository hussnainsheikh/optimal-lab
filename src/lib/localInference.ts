// Running a model on your own machine: does it fit, and how fast does it write?
// Memory = weights (parameters × bits per weight) + KV cache (grows with context) + overhead.
// Writing one token reads every weight once, so decoding speed is bound by memory
// bandwidth: tokens/s ≈ bandwidth × efficiency ÷ bytes read per token. Layers that
// don't fit in GPU memory are offloaded to system RAM and read at RAM speed.

export type Model = { id: string; label: string; params: number; layers: number; kvHeads: number; headDim: number };

// Real configs (from each model's config.json).
export const MODELS: Model[] = [
  { id: "llama3b", label: "Llama 3.2 3B", params: 3.21e9, layers: 28, kvHeads: 8, headDim: 128 },
  { id: "llama8b", label: "Llama 3.1 8B", params: 8.03e9, layers: 32, kvHeads: 8, headDim: 128 },
  { id: "qwen32b", label: "Qwen2.5 32B", params: 32.5e9, layers: 64, kvHeads: 8, headDim: 128 },
  { id: "llama70b", label: "Llama 3.3 70B", params: 70.6e9, layers: 80, kvHeads: 8, headDim: 128 },
];

// Bits per weight, including the scales stored with each block of weights.
export const QUANTS = [
  { id: "f16", label: "16-bit", bits: 16, quality: "The original weights." },
  { id: "q8", label: "8-bit (Q8_0)", bits: 8.5, quality: "Practically the same answers as 16-bit." },
  { id: "q4", label: "4-bit (Q4_K_M)", bits: 4.85, quality: "A small quality loss; the usual choice for local use." },
  { id: "q2", label: "2-bit (Q2_K)", bits: 2.63, quality: "Noticeably worse, especially for small models." },
] as const;
export type QuantId = (typeof QUANTS)[number]["id"];

export const CONTEXTS = [4096, 32768, 131072];

export type Machine = { id: string; label: string; fast: number; fastBw: number; slow: number; slowBw: number; note: string };

// fast = memory the GPU can use; slow = system RAM left for offloaded layers (GB, GB/s).
export const MACHINES: Machine[] = [
  { id: "gpu8", label: "Gaming PC, 8 GB GPU", fast: 8, fastBw: 272, slow: 24, slowBw: 60, note: "RTX 4060-class card, 32 GB of system RAM." },
  { id: "laptop16", label: "Laptop, 16 GB unified", fast: 11, fastBw: 120, slow: 0, slowBw: 0, note: "Apple-silicon base chip. The OS and apps keep about 5 GB." },
  { id: "gpu24", label: "Workstation, 24 GB GPU", fast: 24, fastBw: 1008, slow: 56, slowBw: 80, note: "RTX 4090-class card, 64 GB of system RAM." },
  { id: "mac128", label: "Desktop, 128 GB unified", fast: 96, fastBw: 546, slow: 0, slowBw: 0, note: "Apple-silicon Max chip. About 96 GB usable by the GPU." },
];

export const OVERHEAD_GB = 1; // runtime, buffers and activations
const EFFICIENCY = 0.6; // share of peak bandwidth a decoder really gets
const GB = 1e9;

export const weightsGB = (m: Model, bits: number) => (m.params * bits) / 8 / GB;

// K and V, for every layer and KV head, 16-bit, per token of context.
export const kvBytesPerToken = (m: Model) => 2 * m.layers * m.kvHeads * m.headDim * 2;
export const kvGB = (m: Model, ctx: number) => (kvBytesPerToken(m) * ctx) / GB;

export type Plan = {
  weights: number;
  kv: number;
  total: number;
  onGpu: number; // GB in fast memory
  offloaded: number; // GB in system RAM
  fits: "fast" | "offload" | "no";
  tokensPerSec: number;
};

export function plan(m: Model, bits: number, ctx: number, machine: Machine): Plan {
  const weights = weightsGB(m, bits);
  const kv = kvGB(m, ctx);
  const total = weights + kv + OVERHEAD_GB;
  if (total <= machine.fast) {
    return { weights, kv, total, onGpu: total, offloaded: 0, fits: "fast", tokensPerSec: (machine.fastBw * EFFICIENCY) / (weights + kv) };
  }
  const offloaded = total - machine.fast;
  if (offloaded > machine.slow) return { weights, kv, total, onGpu: machine.fast, offloaded, fits: "no", tokensPerSec: 0 };
  // Each token reads the fast part at GPU speed and the offloaded part at RAM speed.
  const seconds = (machine.fast - OVERHEAD_GB) / (machine.fastBw * EFFICIENCY) + offloaded / (machine.slowBw * EFFICIENCY);
  return { weights, kv, total, onGpu: machine.fast, offloaded, fits: "offload", tokensPerSec: 1 / seconds };
}

export const gb = (x: number) => (x >= 10 ? `${Math.round(x)} GB` : `${x.toFixed(1)} GB`);
export const ctxLabel = (c: number) => `${Math.round(c / 1024)}K`;
