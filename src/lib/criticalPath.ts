// The first visit to an article page over a mobile connection, resource by resource. TCP slow
// start is modelled: a new connection sends 10 packets (about 14.6 KB) in its first round trip
// and doubles each round trip until it fills the link. A new origin costs DNS, TCP and TLS 1.3
// (three round trips) unless preconnected. Render-blocking CSS, an @import chain, a script in
// <head> and a web font decide when text first paints. The network figures are illustrative.

export const NET = { rtt: 100, kbps: 600, initKb: 14.6 };

/** Round trips to deliver `kb` on a fresh connection, with slow start up to the link's limit. */
export function rounds(kb: number) {
  const bdp = (NET.kbps * NET.rtt) / 1000; // KB the link carries in one round trip
  let sent = 0;
  let win = NET.initKb;
  let n = 0;
  while (sent < kb) {
    sent += Math.min(win, bdp);
    win *= 2;
    n++;
  }
  return n;
}
export const transfer = (kb: number) => rounds(kb) * NET.rtt;

export type Opts = { inlineCritical: boolean; noImport: boolean; deferScript: boolean; preconnect: boolean; fontSwap: boolean; heroPriority: boolean };
export const NAIVE: Opts = { inlineCritical: false, noImport: false, deferScript: false, preconnect: false, fontSwap: false, heroPriority: false };
export const TUNED: Opts = { inlineCritical: true, noImport: true, deferScript: true, preconnect: true, fontSwap: true, heroPriority: true };

export const SIZES = { html: 28, critical: 9, css: 46, fontCss: 2, font: 32, script: 22, hero: 140 };

export type Row = { id: string; label: string; start: number; end: number; blocking: boolean; note: string };

export function load(o: Opts) {
  const R = NET.rtt;
  const connect = 3 * R; // DNS + TCP + TLS 1.3 to a new origin
  const rows: Row[] = [];
  // HTML: a connection, the request, and slow start for its bytes.
  const htmlKb = SIZES.html + (o.inlineCritical ? SIZES.critical : 0);
  const htmlStart = connect;
  const headArrives = htmlStart + R; // the first round trip carries the <head>
  const htmlEnd = htmlStart + transfer(htmlKb);
  rows.push({ id: "html", label: `article.html (${htmlKb} KB)`, start: htmlStart, end: htmlEnd, blocking: true, note: `${rounds(htmlKb)} round trips of slow start` });

  // Stylesheet: blocks rendering unless the critical part is inlined and the rest loads async.
  const cssStart = headArrives;
  const cssEnd = cssStart + transfer(SIZES.css); // same connection; the request rides along
  const cssBlocks = !o.inlineCritical;
  rows.push({ id: "css", label: `app.css (${SIZES.css} KB)`, start: cssStart, end: cssEnd, blocking: cssBlocks, note: cssBlocks ? "render-blocking" : "loaded without blocking; critical CSS is inline" });

  // fonts.css from a third-party origin. With @import it's found only after app.css arrives.
  const fontsOrigin = o.preconnect ? 0 : connect;
  const fontCssStart = o.noImport ? headArrives : cssEnd;
  const fontCssEnd = fontCssStart + fontsOrigin + R;
  rows.push({ id: "fontcss", label: "fonts.css (fonts.example)", start: fontCssStart, end: fontCssEnd, blocking: cssBlocks, note: `${o.noImport ? "a <link> in <head>" : "an @import inside app.css: found late"}${o.preconnect ? ", origin preconnected" : ", new origin: DNS + TCP + TLS"}` });

  // The font file is requested only once the CSS says a visible element needs it.
  const fontStart = fontCssEnd;
  const fontEnd = fontStart + transfer(SIZES.font);
  rows.push({ id: "font", label: `serif.woff2 (${SIZES.font} KB)`, start: fontStart, end: fontEnd, blocking: false, note: o.fontSwap ? "font-display: swap: fallback text first" : "text is invisible until it arrives (up to 3 s)" });

  // A classic script in <head> blocks the parser (and so the first paint) until it runs.
  const scriptStart = headArrives;
  const scriptEnd = scriptStart + connect + transfer(SIZES.script) + 20; // + 20 ms to run
  rows.push({ id: "script", label: `analytics.js (${SIZES.script} KB, third party)`, start: scriptStart, end: scriptEnd, blocking: !o.deferScript, note: o.deferScript ? "defer: runs after parsing" : "parser-blocking in <head>" });

  // First paint needs the HTML up to <body>, all blocking CSS, and blocking scripts.
  const paintGates = [headArrives + 10, ...(cssBlocks ? [cssEnd, fontCssEnd] : []), ...(!o.deferScript ? [scriptEnd] : [])];
  const fcp = Math.max(...paintGates);
  const textVisible = o.fontSwap ? fcp : Math.max(fcp, Math.min(fontEnd, fcp + 3000));

  // Hero image: low priority competes with everything else unless marked high priority.
  const heroStart = o.heroPriority ? headArrives : Math.max(htmlEnd, cssBlocks ? cssEnd : headArrives);
  const heroEnd = heroStart + transfer(SIZES.hero);
  rows.push({ id: "hero", label: `hero.avif (${SIZES.hero} KB)`, start: heroStart, end: heroEnd, blocking: false, note: o.heroPriority ? 'fetchpriority="high" and a preload' : "found in the body, fetched at low priority" });

  const lcp = Math.max(fcp, heroEnd);
  // The chain of requests the first paint had to wait for, in order.
  const chain = ["article.html", ...(cssBlocks ? ["app.css"] : []), ...(cssBlocks && !o.noImport ? ["fonts.css"] : []), ...(!o.deferScript ? ["analytics.js"] : [])];
  return { rows, fcp, textVisible, lcp, chain, end: Math.max(...rows.map((r) => r.end)), htmlRounds: rounds(htmlKb) };
}
