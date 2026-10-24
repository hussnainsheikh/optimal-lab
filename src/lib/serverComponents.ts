// A product page built from React Server Components. Each component is a server or a client
// component; "use client" marks a boundary, and everything a client module imports becomes
// client code too. Server components can be async and query the database; client components
// ship JavaScript and hydrate. Props crossing from server to client must be serializable.
// The rules are React's; sizes and timings are illustrative.

export type Where = "server" | "client";
export type Comp = { id: string; name: string; kb: number; lib?: { name: string; kb: number }; needsClient?: string; data?: "product" | "reviews"; htmlKb: number; propsKb: number };

export const COMPS: Comp[] = [
  { id: "details", name: "ProductDetails", kb: 2, lib: { name: "a markdown parser", kb: 45 }, data: "product", htmlKb: 6, propsKb: 20 },
  { id: "reviews", name: "Reviews", kb: 3, lib: { name: "a date library", kb: 20 }, data: "reviews", htmlKb: 8, propsKb: 6 },
  { id: "add", name: "AddToCart", kb: 3, needsClient: "useState and onClick", htmlKb: 0.3, propsKb: 0.1 },
  { id: "carousel", name: "ImageCarousel", kb: 6, lib: { name: "a gesture library", kb: 12 }, needsClient: "swipe handlers", htmlKb: 1, propsKb: 1 },
];

export type Opts = { page: Where; where: Record<string, Where>; wholeProduct: boolean; fnProp: boolean };
export const SPA: Opts = { page: "client", where: { details: "client", reviews: "client", add: "client", carousel: "client" }, wholeProduct: false, fnProp: false };
export const RSC: Opts = { page: "server", where: { details: "server", reviews: "server", add: "client", carousel: "client" }, wholeProduct: false, fnProp: false };

export const REACT_CLIENT_KB = 50;
export const FETCH_LIB_KB = 10;
export const T = { rtt: 100, product: 40, reviews: 60, kbPerMs: 1.5, hydratePerComp: 6, render: 20 };

export function analyze(o: Opts) {
  // Everything imported from a client module is client code, whatever it says itself.
  const isClient = (id: string) => o.page === "client" || o.where[id] === "client";
  const errors: string[] = [];
  for (const c of COMPS) {
    if (c.needsClient && !isClient(c.id)) errors.push(`${c.name} uses ${c.needsClient}, which only work in a Client Component: add "use client".`);
  }
  if (o.page === "server" && isClient("add") && o.fnProp) errors.push('Functions cannot be passed directly to Client Components: onAdded={…} on <AddToCart> can\'t be serialized. Use a Server Action ("use server") or define it in the client.');

  const clientComps = COMPS.filter((c) => isClient(c.id));
  const bundle: { name: string; kb: number }[] = [];
  if (clientComps.length) bundle.push({ name: "React (client)", kb: REACT_CLIENT_KB });
  if (o.page === "client") bundle.push({ name: "ProductPage + data fetching", kb: 4 + FETCH_LIB_KB });
  for (const c of clientComps) {
    bundle.push({ name: c.name, kb: c.kb });
    if (c.lib) bundle.push({ name: `${c.lib.name} (for ${c.name})`, kb: c.lib.kb });
  }
  const bundleKb = bundle.reduce((a, b) => a + b.kb, 0);

  // What the server sends: HTML for server components, and serialized props for client ones.
  const payload: { name: string; kb: number; what: string }[] = [];
  if (o.page === "server") {
    for (const c of COMPS) {
      if (!isClient(c.id)) payload.push({ name: c.name, kb: c.htmlKb, what: "rendered output" });
      else {
        const kb = c.id === "add" && o.wholeProduct ? 22 : c.propsKb;
        payload.push({ name: c.name, kb, what: c.id === "add" ? (o.wholeProduct ? "props: the whole product, description and all" : "props: id and price") : c.data ? `props: the ${c.data} as JSON` : "props" });
      }
    }
  } else {
    payload.push({ name: "/api/product", kb: 22, what: "JSON fetched by the browser" }, { name: "/api/reviews", kb: 6, what: "JSON fetched by the browser" });
  }
  const payloadKb = payload.reduce((a, p) => a + p.kb, 0);

  // Timeline (ms). Server: queries run in parallel on the server, near the database.
  const download = (kb: number) => Math.round(kb / T.kbPerMs);
  let contentAt: number;
  let interactiveAt: number;
  let browserRequests: number;
  if (o.page === "server") {
    const ttfb = T.rtt + Math.max(T.product, T.reviews) + T.render;
    contentAt = ttfb + download(payloadKb);
    const jsDone = contentAt + T.rtt + download(bundleKb);
    interactiveAt = jsDone + clientComps.length * T.hydratePerComp;
    browserRequests = 2;
  } else {
    // Shell, then JS, then the product, then reviews (rendered only once the product arrived).
    const shell = T.rtt + T.render;
    const jsDone = shell + T.rtt + download(bundleKb);
    const product = jsDone + T.rtt + T.product + download(22);
    const reviews = product + T.rtt + T.reviews + download(6);
    contentAt = reviews;
    interactiveAt = reviews + clientComps.length * T.hydratePerComp;
    browserRequests = 4;
  }
  return { isClient, errors, bundle, bundleKb, payload, payloadKb, contentAt, interactiveAt, browserRequests, hydrated: clientComps.length, dbFromServer: o.page === "server" };
}
