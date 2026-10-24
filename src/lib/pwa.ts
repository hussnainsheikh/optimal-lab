// A small shop as a progressive web app. The manifest is checked against Chrome's install
// criteria. A service worker answers three kinds of request with a caching strategy each,
// under four conditions; outcomes follow from what each strategy does. Network times are
// illustrative; the strategies are the standard ones (as in Workbox).

export type Manifest = { name: boolean; icon192: boolean; icon512: boolean; startUrl: boolean; display: "browser" | "standalone" | "minimal-ui"; https: boolean };
export const BARE: Manifest = { name: true, icon192: false, icon512: false, startUrl: false, display: "browser", https: true };
export const FULL: Manifest = { name: true, icon192: true, icon512: true, startUrl: true, display: "standalone", https: true };

export function installChecks(m: Manifest) {
  const checks = [
    { label: "Served over HTTPS", ok: m.https },
    { label: "name or short_name", ok: m.name },
    { label: "A 192×192 icon", ok: m.icon192 },
    { label: "A 512×512 icon", ok: m.icon512 },
    { label: "start_url", ok: m.startUrl },
    { label: 'display: standalone, fullscreen or minimal-ui (not "browser")', ok: m.display !== "browser" },
  ];
  return { checks, installable: checks.every((c) => c.ok) };
}

export function manifestJson(m: Manifest) {
  const o: Record<string, unknown> = {};
  if (m.name) o.name = "Trail Shop";
  if (m.startUrl) o.start_url = "/?source=pwa";
  o.display = m.display;
  const icons = [m.icon192 && { src: "/icon-192.png", sizes: "192x192", type: "image/png" }, m.icon512 && { src: "/icon-512.png", sizes: "512x512", type: "image/png" }].filter(Boolean);
  if (icons.length) o.icons = icons;
  return JSON.stringify(o, null, 2);
}

export type Strategy = "network-only" | "cache-first" | "network-first" | "stale-while-revalidate";
export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "network-only", label: "Network only" },
  { id: "cache-first", label: "Cache first" },
  { id: "network-first", label: "Network first" },
  { id: "stale-while-revalidate", label: "Stale while revalidate" },
];
export type Kind = "shell" | "api" | "images";
export const KINDS: { id: Kind; label: string; what: string }[] = [
  { id: "shell", label: "App shell", what: "HTML, JS and CSS" },
  { id: "api", label: "Orders API", what: "/api/orders, changes often" },
  { id: "images", label: "Product images", what: "rarely change" },
];
export type Condition = "online" | "lie-fi" | "offline" | "deploy";
export const CONDITIONS: { id: Condition; label: string; what: string }[] = [
  { id: "online", label: "Good connection", what: "Every request comes back in about 80 ms." },
  { id: "lie-fi", label: "Lie-fi", what: "The phone says it's connected, but requests hang for 10 s before failing." },
  { id: "offline", label: "Offline", what: "No connection at all; requests fail at once." },
  { id: "deploy", label: "After a deploy", what: "A new version of the shell and API went live since the last visit." },
];

export const NET = { online: 80, hang: 10000, cache: 5, timeout: 3000 };
export type Outcome = { ms: number; result: "fresh" | "cached" | "failed" | "old version"; note: string };

export function respond(s: Strategy, c: Condition, kind: Kind, sw: boolean): Outcome {
  const strategy = sw ? s : "network-only";
  const net: Outcome = c === "offline" ? { ms: 0, result: "failed", note: "no network, nothing cached" } : c === "lie-fi" ? { ms: NET.hang, result: "failed", note: "hangs, then fails" } : { ms: NET.online, result: "fresh", note: "from the network" };
  const cachedResult = c === "deploy" && kind !== "images" ? "old version" : "cached";
  switch (strategy) {
    case "network-only":
      return { ...net, note: sw ? net.note : `${net.note} (no service worker)` };
    case "cache-first":
      return { ms: NET.cache, result: cachedResult, note: c === "deploy" && kind !== "images" ? "serves what it cached last time, until the cache is updated" : "from the cache, without touching the network" };
    case "network-first":
      if (c === "online" || c === "deploy") return { ms: NET.online, result: "fresh", note: "from the network" };
      if (c === "offline") return { ms: NET.cache, result: "cached", note: "network failed at once; served from the cache" };
      return { ms: NET.timeout, result: "cached", note: `gave up on the network after ${NET.timeout / 1000} s; served from the cache` };
    case "stale-while-revalidate":
      return { ms: NET.cache, result: cachedResult, note: c === "online" || c === "deploy" ? "from the cache now, refreshed in the background for next time" : "from the cache; the background refresh fails quietly" };
  }
}

export const NAIVE: Record<Kind, Strategy> = { shell: "network-only", api: "network-only", images: "network-only" };
export const GOOD: Record<Kind, Strategy> = { shell: "stale-while-revalidate", api: "network-first", images: "cache-first" };

export type Prompt = "load" | "action";
export const PROMPTS: { id: Prompt; label: string; what: string }[] = [
  { id: "load", label: "On page load", what: "The permission prompt appears before the person has done anything." },
  { id: "action", label: "After they ask", what: 'The prompt appears when the person presses "Notify me when it\'s back in stock".' },
];

export function pushOutcome(p: Prompt, installedOnIos: boolean) {
  return [
    { where: "Chrome", ok: p === "action", note: p === "action" ? "shows the prompt" : "may show only a quiet icon in the address bar for sites people often refuse" },
    { where: "Firefox", ok: p === "action", note: p === "action" ? "shows the prompt" : "ignores requests that don't come from a click or key press" },
    { where: "Safari on Mac", ok: p === "action", note: p === "action" ? "shows the prompt" : "requires a user gesture" },
    { where: "Safari on iPhone", ok: p === "action" && installedOnIos, note: !installedOnIos ? "web push only works for web apps added to the home screen" : p === "action" ? "shows the prompt" : "requires a user gesture" },
  ];
}
