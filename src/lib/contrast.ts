// WCAG contrast, computed exactly: relative luminance from sRGB, then (L1 + 0.05) / (L2 + 0.05).
// Colour vision deficiency is simulated with the Machado, Oliveira and Fernandes (2009)
// matrices at full severity, applied in linear RGB; how far apart two colours look is the
// CIE76 ΔE in CIELAB (about 2.3 is a just-noticeable difference).

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as RGB;
}
export const rgbToHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function luminance(c: RGB) {
  const [r, g, b] = c.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const LEVELS = [
  { id: "aa-normal", label: "AA, body text", min: 4.5 },
  { id: "aa-large", label: "AA, large text (24px, or 18.66px bold)", min: 3 },
  { id: "aaa-normal", label: "AAA, body text", min: 7 },
  { id: "non-text", label: "UI parts and icons", min: 3 },
] as const;

/** The closest text colour that reaches `target` against `bg`, darkening or lightening it. */
export function fixText(fg: RGB, bg: RGB, target = 4.5): RGB | null {
  if (contrast(fg, bg) >= target) return fg;
  const darker = luminance(bg) > 0.18;
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const c = fg.map((v) => (darker ? v * (1 - t) : v + (255 - v) * t)) as RGB;
    const r = c.map(Math.round) as RGB;
    if (contrast(r, bg) >= target) return r;
  }
  return null;
}

export type Cvd = "none" | "protanopia" | "deuteranopia" | "tritanopia";
export const CVDS: { id: Cvd; label: string; share: string }[] = [
  { id: "none", label: "Typical", share: "" },
  { id: "deuteranopia", label: "Deuteranopia", share: "about 1% of men; milder green-weakness about 5%" },
  { id: "protanopia", label: "Protanopia", share: "about 1% of men" },
  { id: "tritanopia", label: "Tritanopia", share: "rare" },
];
const M: Record<Exclude<Cvd, "none">, number[][]> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

export function simulate(c: RGB, cvd: Cvd): RGB {
  if (cvd === "none") return c;
  const lin = c.map(toLinear);
  return M[cvd].map((row) => toSrgb(Math.max(0, Math.min(1, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))) as RGB;
}

function toLab(c: RGB) {
  const [r, g, b] = c.map(toLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: RGB, b: RGB) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
