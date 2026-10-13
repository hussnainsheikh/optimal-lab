// Largest Contentful Paint: when the biggest thing on screen (here, a hero image) finishes
// drawing. Each fix removes a delay from the chain. Times are illustrative.

export type Fix = "preload" | "compress" | "defer" | "cdn";

export const FIXES: { id: Fix; label: string; saves: string }[] = [
  { id: "cdn", label: "Serve from a CDN", saves: "Shorter round trips for every file." },
  { id: "defer", label: "Defer the blocking script", saves: "The page can render without waiting for app.js." },
  { id: "preload", label: "Preload the hero image", saves: "The image starts downloading with the HTML, not after CSS is parsed." },
  { id: "compress", label: "Resize + AVIF the image", saves: "1.2 MB becomes 140 KB." },
];

export function waterfall(on: Set<Fix>) {
  const rtt = on.has("cdn") ? 40 : 160;
  const rows: { name: string; from: number; to: number; blocking?: boolean }[] = [];
  const html = { name: "HTML", from: 0, to: rtt * 2 + 100 };
  rows.push(html);
  const css = { name: "styles.css", from: html.to, to: html.to + rtt + 120, blocking: true };
  rows.push(css);
  const js = on.has("defer") ? null : { name: "app.js (render-blocking)", from: html.to, to: html.to + rtt + 1200, blocking: true };
  if (js) rows.push(js);
  const imgStart = on.has("preload") ? html.from + rtt : css.to;
  const imgDur = rtt + (on.has("compress") ? 250 : 3200);
  const img = { name: "hero.jpg", from: imgStart, to: imgStart + imgDur };
  rows.push(img);
  const renderReady = Math.max(css.to, js ? js.to : 0);
  const lcp = Math.max(renderReady, img.to);
  return { rows, lcp, rating: lcp <= 2500 ? "good" : lcp <= 4000 ? "needs improvement" : "poor" };
}
