// Client rendering vs server rendering vs islands. When does the user see content, and when
// can they click it? Times in ms on a mid-range phone, simplified.

export type Strategy = "csr" | "ssr" | "islands";

export const STRATEGIES: { id: Strategy; label: string; note: string }[] = [
  { id: "csr", label: "Client-side rendering", note: "The server sends an empty page and a JavaScript bundle; the browser builds everything." },
  { id: "ssr", label: "Server rendering + hydration", note: "The server sends finished HTML; then the same JavaScript loads and attaches event handlers to it." },
  { id: "islands", label: "Islands", note: "Server HTML, and only the interactive parts (a cart button, a search box) ship JavaScript." },
];

export function timeline(s: Strategy, jsKb: number) {
  const html = 300; // HTML arrives
  const download = (kb: number) => kb * 4; // ms per KB on a slow connection, simplified
  const exec = (kb: number) => kb * 2.5; // parse + run
  if (s === "csr") {
    const ready = html + download(jsKb) + exec(jsKb);
    return { firstPaint: ready, interactive: ready, deadClicks: 0, phases: [{ name: "blank page", from: 0, to: ready }] };
  }
  const kb = s === "islands" ? Math.round(jsKb * 0.15) : jsKb;
  const interactive = Math.round(html + download(kb) + exec(kb));
  return {
    firstPaint: html,
    interactive,
    deadClicks: interactive - html,
    phases: [
      { name: "waiting for HTML", from: 0, to: html },
      { name: "visible, not clickable", from: html, to: interactive },
    ],
  };
}

export const BUNDLES = [100, 300, 600];
