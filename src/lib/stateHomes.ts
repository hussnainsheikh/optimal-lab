// Six pieces of state in an orders dashboard, each given a home: component state, a global
// client store, a server cache (a query library), the URL, or localStorage. Each home behaves
// in a fixed way when the reader navigates, reloads, shares a link, opens a second tab, or a
// colleague changes the data on the server. Each piece has an expected behaviour; a mismatch
// is a bug, and the message says what the user would see.

export type Home = "local" | "store" | "query" | "url" | "storage";
export const HOMES: { id: Home; label: string; short: string; tool: string }[] = [
  { id: "local", label: "Component state", short: "useState", tool: "useState in the component" },
  { id: "store", label: "Global store", short: "store", tool: "a client store (context, Zustand, Redux)" },
  { id: "query", label: "Server cache", short: "query", tool: "a query cache (TanStack Query, SWR)" },
  { id: "url", label: "URL", short: "URL", tool: "search params in the URL" },
  { id: "storage", label: "localStorage", short: "storage", tool: "localStorage" },
];

export type Scenario = "navigate" | "reload" | "share" | "tab" | "edit";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "navigate", label: "Go to another page and back" },
  { id: "reload", label: "Reload" },
  { id: "share", label: "Send the link to a colleague" },
  { id: "tab", label: "Open a second tab" },
  { id: "edit", label: "A colleague edits an order" },
];

export type PieceId = "menu" | "user" | "orders" | "filters" | "draft" | "theme";
type Want = "keep" | "reset" | "carry" | "private" | "fresh" | "same";
export type Piece = { id: PieceId; label: string; server: boolean; want: Partial<Record<Scenario, Want>>; best: Home[] };

export const PIECES: Piece[] = [
  { id: "menu", label: "Is the account menu open", server: false, want: { navigate: "reset", reload: "reset", share: "private" }, best: ["local"] },
  { id: "user", label: "The signed-in user", server: true, want: { navigate: "keep", reload: "keep", share: "private", tab: "same" }, best: ["query"] },
  { id: "orders", label: "The orders list", server: true, want: { navigate: "keep", reload: "keep", edit: "fresh", tab: "same" }, best: ["query"] },
  { id: "filters", label: "Status filter and sort", server: false, want: { navigate: "keep", reload: "keep", share: "carry" }, best: ["url"] },
  { id: "draft", label: "A half-written support message", server: false, want: { navigate: "keep", reload: "keep", share: "private" }, best: ["storage"] },
  { id: "theme", label: "Dark or light theme", server: false, want: { reload: "keep", tab: "same", share: "private" }, best: ["storage"] },
];

export const DEFAULT_HOMES: Record<PieceId, Home> = { menu: "store", user: "store", orders: "store", filters: "local", draft: "local", theme: "local" };
export const GOOD_HOMES: Record<PieceId, Home> = { menu: "local", user: "query", orders: "query", filters: "url", draft: "storage", theme: "storage" };

type Got = "kept" | "lost" | "carried" | "not carried" | "fresh" | "stale" | "same" | "separate" | "fetched";

/** What a home does in a scenario. Server data copied into client state is a snapshot. */
function behaviour(home: Home, s: Scenario, server: boolean): Got {
  switch (s) {
    case "navigate":
      return home === "local" ? "lost" : "kept";
    case "reload":
      return home === "local" || home === "store" ? (server ? "fetched" : "lost") : home === "query" ? "fetched" : "kept";
    case "share":
      return home === "url" ? "carried" : "not carried";
    case "tab":
      return home === "storage" || home === "url" ? "same" : home === "query" || server ? "same" : "separate";
    case "edit":
      return home === "query" ? "fresh" : "stale";
  }
}

const MATCH: Record<Want, Got[]> = {
  keep: ["kept", "fetched", "same"],
  reset: ["lost"],
  carry: ["carried"],
  private: ["not carried"],
  fresh: ["fresh"],
  same: ["same"],
};

const BUG: Record<string, string> = {
  "menu:navigate": "the menu is open again when you come back",
  "menu:reload": "the menu reopens after a reload",
  "menu:share": "the colleague's page opens with the menu open",
  "user:share": "the colleague's link carries your user",
  "orders:edit": "the colleague's change doesn't show until the page is reloaded",
  "orders:navigate": "the orders are fetched again every time you come back",
  "user:navigate": "the user is fetched again on every page",
  "filters:navigate": "the filters reset when you come back",
  "filters:reload": "a reload loses the filters",
  "filters:share": "the colleague sees the unfiltered list",
  "draft:navigate": "the message is lost when you look at another page",
  "draft:reload": "an accidental reload wipes the message",
  "draft:share": "your draft ends up in the shared link",
  "theme:reload": "the theme resets on every reload",
  "theme:tab": "the second tab has the other theme",
  "theme:share": "your theme is forced on the colleague",
  "orders:tab": "the second tab can show different orders",
  "user:tab": "the second tab can show a different user",
};

export function evaluate(homes: Record<PieceId, Home>) {
  const cells = PIECES.flatMap((p) =>
    SCENARIOS.map((s) => {
      const want = p.want[s.id];
      const got = behaviour(homes[p.id], s.id, p.server);
      const ok = !want || MATCH[want].includes(got);
      return { piece: p.id, scenario: s.id, want, got, ok, bug: ok ? null : BUG[`${p.id}:${s.id}`] ?? `${p.label}: ${got}` };
    }),
  );
  const bugs = cells.filter((c) => !c.ok);
  // Server data held in a store needs hand-written fetching, refetching and invalidation.
  const handSynced = PIECES.filter((p) => p.server && homes[p.id] !== "query").length;
  return { cells, bugs, handSynced, right: PIECES.filter((p) => !cells.some((c) => c.piece === p.id && !c.ok)).length };
}
