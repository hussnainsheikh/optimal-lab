// A shop page as a component tree. Four places to keep its state: fetch in each
// component, lift everything to the top and pass props down, a global store, or a
// server-state cache with UI state in the URL. Requests on load, props passed through
// components that don't use them, re-renders when a filter changes, and stale copies
// after adding to the cart are all counted from the tree below.

export type DataKey = "user" | "products" | "cart" | "filters";
export type Strategy = "effects" | "lift" | "store" | "query";

export type Comp = { id: string; label: string; parent: string | null; uses: DataKey[]; count?: number };

export const CARDS = 6;
export const TREE: Comp[] = [
  { id: "app", label: "App", parent: null, uses: [] },
  { id: "header", label: "Header", parent: "app", uses: ["user"] },
  { id: "avatar", label: "Avatar", parent: "header", uses: ["user"] },
  { id: "page", label: "ProductsPage", parent: "app", uses: [] },
  { id: "filters", label: "Filters", parent: "page", uses: ["filters"] },
  { id: "list", label: "ProductList", parent: "page", uses: ["filters", "products"] },
  { id: "card", label: "ProductCard", parent: "list", uses: ["cart"], count: CARDS },
  { id: "sidebar", label: "Sidebar", parent: "page", uses: [] },
  { id: "cartSummary", label: "CartSummary", parent: "sidebar", uses: ["cart"] },
  { id: "footer", label: "Footer", parent: "app", uses: [] },
];

export const SERVER: DataKey[] = ["user", "products", "cart"];

export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "effects", label: "Fetch in each component", one: "Every component fetches the server data it shows in its own effect; the filter lives in the page." },
  { id: "lift", label: "Lift to the top", one: "App fetches everything once and passes it down as props, with callbacks to change it." },
  { id: "store", label: "Global store", one: "Server data is loaded into a client store at start; components subscribe to the slices they read." },
  { id: "query", label: "Server cache + URL state", one: "A query cache fetches by key and shares the result; the filter lives in the URL." },
];

const byId = (id: string) => TREE.find((c) => c.id === id)!;
const weight = (c: Comp) => c.count ?? 1;
const children = (id: string) => TREE.filter((c) => c.parent === id);
const subtree = (id: string): Comp[] => [byId(id), ...children(id).flatMap((c) => subtree(c.id))];
const ancestors = (id: string): string[] => {
  const out: string[] = [];
  let p = byId(id).parent;
  while (p) {
    out.push(p);
    p = byId(p).parent;
  }
  return out;
};
const users = (k: DataKey) => TREE.filter((c) => c.uses.includes(k));
const count = (cs: Comp[]) => cs.reduce((s, c) => s + weight(c), 0);

// Lowest common ancestor of every component using a key.
function owner(k: DataKey): string {
  const paths = users(k).map((c) => [c.id, ...ancestors(c.id)]);
  return paths[0].find((id) => paths.every((p) => p.includes(id)))!;
}

export type Result = {
  requestsOnLoad: number;
  roundTrips: number; // sequential waves of requests before the page is complete
  drilled: { comp: string; keys: DataKey[] }[]; // components passing props they don't use
  filterRerenders: number;
  filterRequests: number;
  backToFilterRequests: number; // going back to a filter already seen
  cartRerenders: number;
  cartRequests: number;
  staleAfterCart: number; // components still showing the old cart
  where: Record<DataKey, string>;
};

export function run(s: Strategy): Result {
  const where = {} as Record<DataKey, string>;
  for (const k of ["user", "products", "cart", "filters"] as DataKey[]) {
    where[k] =
      s === "lift"
        ? "App (props)"
        : s === "store"
          ? k === "filters"
            ? "store (UI slice)"
            : "store (copied from server)"
          : s === "query"
            ? k === "filters"
              ? "URL ?category="
              : `query cache ["${k}"]`
            : k === "filters"
              ? `${byId(owner(k)).label} state`
              : "each component's own state";
  }

  // Requests on load
  let requestsOnLoad: number;
  let roundTrips: number;
  if (s === "effects") {
    requestsOnLoad = SERVER.reduce((sum, k) => sum + count(users(k)), 0); // every user fetches its own copy
    roundTrips = 2; // cards only mount after the product list arrives, then fetch the cart
  } else {
    requestsOnLoad = SERVER.length;
    roundTrips = 1;
  }

  // Prop drilling: with lifting, every component between App and a user receives the prop.
  const drilled: Result["drilled"] = [];
  if (s === "lift") {
    const map = new Map<string, Set<DataKey>>();
    for (const k of ["user", "products", "cart", "filters"] as DataKey[])
      for (const u of users(k))
        for (const a of ancestors(u.id)) {
          if (a === "app") continue;
          const c = byId(a);
          if (c.uses.includes(k)) continue;
          if (!map.has(a)) map.set(a, new Set());
          map.get(a)!.add(k);
        }
    for (const [comp, keys] of map) drilled.push({ comp: byId(comp).label, keys: [...keys] });
  } else if (s === "effects") {
    // the filter is lifted to the page, which passes it to the list: the page uses it to hold state, so nothing is drilled
  }

  // Changing a filter re-renders the owner of the filter state and everything under it,
  // unless components subscribe to exactly what they read.
  let filterRerenders: number;
  let filterRequests: number;
  let backToFilterRequests: number;
  if (s === "lift") {
    filterRerenders = count(subtree("app"));
    filterRequests = 1;
    backToFilterRequests = 1;
  } else if (s === "effects") {
    filterRerenders = count(subtree(owner("filters")));
    filterRequests = 1 + CARDS; // new cards mount and each fetches the cart again
    backToFilterRequests = 1 + CARDS;
  } else {
    // store or query: only subscribers of filters/products, plus the cards the list renders
    filterRerenders = count(users("filters")) + CARDS;
    filterRequests = 1;
    backToFilterRequests = s === "query" ? 0 : 1;
  }

  // Adding to the cart from one card.
  let cartRerenders: number;
  let cartRequests: number;
  let staleAfterCart: number;
  if (s === "effects") {
    cartRerenders = 1;
    cartRequests = 1;
    staleAfterCart = count(users("cart")) - 1; // the summary and the other cards keep their own old copies
  } else if (s === "lift") {
    cartRerenders = count(subtree("app"));
    cartRequests = 1;
    staleAfterCart = 0;
  } else if (s === "store") {
    cartRerenders = count(users("cart"));
    cartRequests = 1;
    staleAfterCart = 0; // until another tab or device changes the cart: the store never hears
  } else {
    cartRerenders = count(users("cart"));
    cartRequests = 2; // the POST, then one refetch of ["cart"] shared by all subscribers
    staleAfterCart = 0;
  }

  return { requestsOnLoad, roundTrips, drilled, filterRerenders, filterRequests, backToFilterRequests, cartRerenders, cartRequests, staleAfterCart, where };
}

// Which components re-render (or go stale) for the highlighted event, for the tree picture.
export type Event = "load" | "filter" | "cart";
export function marks(s: Strategy, e: Event): Record<string, "fetch" | "render" | "stale" | "none"> {
  const out: Record<string, "fetch" | "render" | "stale" | "none"> = {};
  for (const c of TREE) out[c.id] = "none";
  if (e === "load") {
    if (s === "effects") for (const k of SERVER) for (const u of users(k)) out[u.id] = "fetch";
    else out[s === "lift" ? "app" : "app"] = "fetch";
    return out;
  }
  if (e === "filter") {
    const ids = s === "lift" ? subtree("app").map((c) => c.id) : s === "effects" ? subtree(owner("filters")).map((c) => c.id) : ["filters", "list", "card"];
    for (const id of ids) out[id] = "render";
    return out;
  }
  if (s === "effects") {
    out.card = "render";
    out.cartSummary = "stale";
  } else if (s === "lift") for (const c of subtree("app")) out[c.id] = "render";
  else for (const u of users("cart")) out[u.id] = "render";
  return out;
}

export function depth(id: string): number {
  return ancestors(id).length;
}
