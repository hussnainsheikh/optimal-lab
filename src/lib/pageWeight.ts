// A product page's heavy bits, and what each optimisation saves. KB, illustrative.
export const FIXES = [
  { id: "avif", label: "Hero as AVIF instead of JPEG" },
  { id: "resize", label: "Resize images to their displayed size" },
  { id: "lazy", label: "loading=\"lazy\" for below-the-fold images" },
  { id: "subset", label: "Subset fonts, WOFF2, 2 weights not 6" },
  { id: "swap", label: "font-display: swap" },
];
export function weigh(on: Set<string>) {
  let hero = 1200;
  if (on.has("resize")) hero *= 0.45;
  if (on.has("avif")) hero *= 0.3;
  let gallery = 8 * 350;
  if (on.has("resize")) gallery *= 0.45;
  const galleryNow = on.has("lazy") ? 0 : gallery;
  const fonts = on.has("subset") ? 60 : 480;
  const total = Math.round(hero + galleryNow + fonts + 300);
  const lcp = Math.round(600 + (hero + fonts * 0.3) * 2.2);
  const textVisible = on.has("swap") ? 450 : 450 + Math.min(3000, fonts * 4);
  return { hero: Math.round(hero), gallery: Math.round(galleryNow), deferred: on.has("lazy") ? Math.round(gallery) : 0, fonts, total, lcp, textVisible };
}
