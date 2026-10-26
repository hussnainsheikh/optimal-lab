// An infinite feed: paging through a list that changes while you read it, fetching the next
// page early enough, rendering only what's on screen, and coming back to the same place.
// Paging really slices a list that gains posts at the top; the prefetch timing is arithmetic
// on scroll speed and latency. The demo also renders a real virtualized list and counts its
// DOM nodes. Latencies and heights are illustrative.

export const PAGE = 10;
export type Paging = "offset" | "cursor";

/** Load page 1, let `arrivals` new posts land on top, then load page 2. */
export function pageTwo(paging: Paging, arrivals: number) {
  const before = Array.from({ length: 60 }, (_, i) => 1000 - i); // newest first: ids 1000, 999…
  const page1 = before.slice(0, PAGE);
  const after = [...Array.from({ length: arrivals }, (_, i) => 1000 + arrivals - i), ...before];
  const page2 = paging === "offset" ? after.slice(PAGE, PAGE * 2) : after.filter((id) => id < page1[page1.length - 1]).slice(0, PAGE);
  const dupes = page2.filter((id) => page1.includes(id));
  return { page1, page2, dupes, request: paging === "offset" ? `GET /feed?offset=${PAGE}&limit=${PAGE}` : `GET /feed?after=${page1[page1.length - 1]}&limit=${PAGE}` };
}

export const ROW_PX = 180;
export const VIEWPORT_PX = 800;
export const LATENCY_MS = 700;

/** Does a reader scrolling at `speed` px/s reach the end before the next page arrives? */
export function prefetch(screensAhead: number, speed: number) {
  const distance = screensAhead * VIEWPORT_PX;
  const timeToEnd = (distance / speed) * 1000;
  const wait = Math.max(0, Math.round(LATENCY_MS - timeToEnd));
  return { distance, timeToEnd: Math.round(timeToEnd), wait };
}

/** DOM size for a long session: everything kept vs a window around the viewport. */
export function domCost(loaded: number, virtual: boolean, overscan = 3) {
  const visible = Math.ceil(VIEWPORT_PX / ROW_PX) + 1;
  const rows = virtual ? Math.min(loaded, visible + overscan * 2) : loaded;
  const nodesPerRow = 24; // avatar, name, text, image, buttons…
  return { rows, nodes: rows * nodesPerRow };
}

export type Restore = "none" | "browser" | "cached";
export const RESTORES: { id: Restore; label: string; what: string }[] = [
  { id: "none", label: "Refetch from the top", what: "The feed is fetched again from page 1 and the reader is back at the top." },
  { id: "browser", label: "Browser scroll restoration only", what: "The browser restores the scroll position, but the feed is fetched again and only page 1 exists yet, so it lands near the bottom of page 1." },
  { id: "cached", label: "Cached pages + saved position", what: "The loaded pages come from the cache and the saved offset is applied after they render." },
];

export function backButton(r: Restore, pagesLoaded: number, readingRow: number) {
  if (r === "cached") return { lands: readingRow, refetched: 0, ok: true };
  if (r === "browser") return { lands: Math.min(readingRow, PAGE - 1), refetched: 1, ok: false };
  return { lands: 0, refetched: 1, ok: false, pagesLoaded };
}
