// How an image becomes tokens. Following Anthropic's vision docs: the image is first
// shrunk (keeping its shape) until its long edge and its token count are within the
// model's limits, then cut into 28 × 28 pixel patches. Each patch is one visual token:
// tokens = ⌈width / 28⌉ × ⌈height / 28⌉.
// Detail that ends up much smaller than a patch is hard for the model to read. The
// 10 px readability line below is a teaching rule of thumb, not a published limit.

export const PATCH = 28;
export const READABLE_PX = 10;

export type TierId = "standard" | "high";
export const TIERS: { id: TierId; label: string; maxEdge: number; maxTokens: number }[] = [
  { id: "standard", label: "Standard", maxEdge: 1568, maxTokens: 1568 },
  { id: "high", label: "High-resolution", maxEdge: 2576, maxTokens: 4784 },
];

export const tokensFor = (w: number, h: number) => Math.ceil(w / PATCH) * Math.ceil(h / PATCH);

// The largest size, same shape, that fits both limits.
export function resize(w: number, h: number, tierId: TierId): { w: number; h: number; scale: number } {
  const t = TIERS.find((x) => x.id === tierId)!;
  if (Math.max(w, h) <= t.maxEdge && tokensFor(w, h) <= t.maxTokens) return { w, h, scale: 1 };
  const landscape = w >= h;
  const long = landscape ? w : h;
  const ratio = landscape ? h / w : w / h;
  for (let l = Math.min(long, t.maxEdge); l > 0; l--) {
    const s = Math.round(l * ratio);
    const [rw, rh] = landscape ? [l, s] : [s, l];
    if (tokensFor(rw, rh) <= t.maxTokens) return { w: rw, h: rh, scale: rw / w };
  }
  return { w: PATCH, h: PATCH, scale: PATCH / w };
}

export type Detail = { label: string; px: number; question: string };

export type Picture = {
  id: string;
  label: string;
  w: number;
  h: number;
  details: Detail[];
  crop?: { label: string; x: number; y: number; w: number; h: number; keeps: string[] };
};

export const PICTURES: Picture[] = [
  {
    id: "receipt",
    label: "Phone photo of a receipt",
    w: 3024,
    h: 4032,
    details: [
      { label: "Item names", px: 48, question: "What did I buy?" },
      { label: "Total", px: 64, question: "How much was it?" },
      { label: "VAT number in the fine print", px: 24, question: "What's the shop's VAT number?" },
    ],
    crop: { label: "Crop to the bottom third", x: 0, y: 2688, w: 3024, h: 1344, keeps: ["Total", "VAT number in the fine print"] },
  },
  {
    id: "dashboard",
    label: "Screenshot of a dashboard",
    w: 1920,
    h: 1080,
    details: [
      { label: "Chart titles", px: 28, question: "Which charts are on this page?" },
      { label: "Line going up or down", px: 200, question: "Is traffic rising?" },
      { label: "Axis numbers", px: 12, question: "What was the peak value?" },
    ],
    crop: { label: "Crop to one chart", x: 40, y: 560, w: 640, h: 400, keeps: ["Line going up or down", "Axis numbers"] },
  },
  {
    id: "product",
    label: "Product photo",
    w: 1000,
    h: 1000,
    details: [
      { label: "What the object is", px: 600, question: "What is this?" },
      { label: "A small scratch", px: 14, question: "Is it damaged?" },
    ],
  },
];

export type Result = { w: number; h: number; scale: number; cols: number; rows: number; tokens: number; details: (Detail & { after: number; readable: boolean; kept: boolean })[] };

export function encodeImage(p: Picture, tierId: TierId, cropped: boolean): Result {
  const src = cropped && p.crop ? p.crop : p;
  const r = resize(src.w, src.h, tierId);
  return {
    ...r,
    cols: Math.ceil(r.w / PATCH),
    rows: Math.ceil(r.h / PATCH),
    tokens: tokensFor(r.w, r.h),
    details: p.details.map((d) => {
      const kept = !(cropped && p.crop) || p.crop.keeps.includes(d.label);
      const after = d.px * r.scale;
      return { ...d, after, kept, readable: kept && after >= READABLE_PX };
    }),
  };
}

// The same tokens spent on text: roughly 0.75 English words per token.
export const wordsFor = (tokens: number) => Math.round(tokens * 0.75);
