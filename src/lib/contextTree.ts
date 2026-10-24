// A shop's component tree and React's rules for when a component renders: it owns state that
// changed; its parent rendered and handed it a new element (unless memo sees equal props);
// or a context it reads now has a different value (compared with Object.is). Elements passed
// in as children from a component that didn't render are the same objects, so React skips
// them. The same tree is wired three ways: props passed down by hand, one context, or one
// context per kind of data, and with the state kept in App or in provider components.

export type Key = "user" | "cart" | "theme" | "menu";
export type Approach = "props" | "one" | "split";
export type Opts = { approach: Approach; owner: "app" | "provider"; memoValue: boolean; memoMiddle: boolean };
export const DRILLED: Opts = { approach: "props", owner: "app", memoValue: false, memoMiddle: false };
export const TUNED: Opts = { approach: "split", owner: "provider", memoValue: true, memoMiddle: false };

export type Comp = { id: string; name: string; parent: string | null; reads: Key[]; middle?: boolean };

export const TREE: Comp[] = [
  { id: "app", name: "App", parent: null, reads: [] },
  { id: "header", name: "Header", parent: "app", reads: [], middle: true },
  { id: "usermenu", name: "UserMenu", parent: "header", reads: ["menu"] },
  { id: "avatar", name: "Avatar", parent: "usermenu", reads: ["user"] },
  { id: "badge", name: "CartBadge", parent: "header", reads: ["cart"] },
  { id: "main", name: "Main", parent: "app", reads: [], middle: true },
  { id: "grid", name: "ProductGrid", parent: "main", reads: [], middle: true },
  ...[1, 2, 3, 4].flatMap((n) => [
    { id: `card${n}`, name: `ProductCard #${n}`, parent: "grid", reads: [] as Key[], middle: true },
    { id: `add${n}`, name: `AddToCart #${n}`, parent: `card${n}`, reads: ["cart"] as Key[] },
  ]),
  { id: "footer", name: "Footer", parent: "app", reads: [], middle: true },
  { id: "toggle", name: "ThemeToggle", parent: "footer", reads: ["theme"] },
];

export const ACTIONS: { id: Key; label: string; what: string }[] = [
  { id: "cart", label: "Add to cart", what: "the cart changes" },
  { id: "theme", label: "Toggle the theme", what: "the theme changes" },
  { id: "menu", label: "Open the user menu", what: "menu state changes" },
  { id: "user", label: "Rename the user", what: "the user changes" },
];

const byId = new Map(TREE.map((c) => [c.id, c]));
const children = (id: string) => TREE.filter((c) => c.parent === id);
const descendants = (id: string): Comp[] => children(id).flatMap((c) => [c, ...descendants(c.id)]);

/** With props, each component receives every key that it or anything below it reads. */
export function propsOf(id: string): Key[] {
  const keys = new Set<Key>();
  for (const c of [byId.get(id)!, ...descendants(id)]) c.reads.forEach((k) => keys.add(k));
  return [...keys].sort();
}

/** Which context a key lives in for an approach. */
const contextOf = (o: Opts, k: Key) => (o.approach === "split" ? k : "app");

export type Result = { comp: Comp; rendered: boolean; reason: string; depth: number; passesOnly: Key[] };

export function simulate(o: Opts, changed: Key): Result[] {
  const owner = o.approach === "props" ? "app" : o.owner;
  // The state lives in App, or in a provider component that renders the tree as children.
  const appRendered = owner === "app";
  // A context's value is a new object when its provider renders, unless it's memoised, in
  // which case it changes only if a key inside it changed.
  const contextChanged = (ctx: string) => {
    if (o.approach === "props") return false;
    const keysInCtx: Key[] = o.approach === "split" ? [ctx as Key] : ["user", "cart", "theme", "menu"];
    const providerRenders = owner === "app" ? appRendered : keysInCtx.includes(changed);
    if (!providerRenders) return false;
    return o.memoValue ? keysInCtx.includes(changed) : true;
  };
  const rendered = new Map<string, { yes: boolean; reason: string }>();
  const depthOf = (c: Comp): number => (c.parent ? depthOf(byId.get(c.parent)!) + 1 : 0);
  for (const c of TREE) {
    const parent = c.parent ? rendered.get(c.parent)! : null;
    let yes = false;
    let reason = "";
    if (c.id === "app") {
      yes = appRendered;
      reason = appRendered ? `owns the state: ${changed}` : "state lives in a provider";
    } else {
      const ctxHit = o.approach !== "props" && c.reads.some((k) => contextChanged(contextOf(o, k)));
      const props = o.approach === "props" ? propsOf(c.id) : [];
      const propsChanged = props.includes(changed);
      if (parent?.yes) {
        // The parent made a fresh element for this child.
        if (o.memoMiddle && c.middle && !propsChanged) {
          yes = false;
          reason = "skipped: memo, same props";
        } else {
          yes = true;
          reason = propsChanged ? `props changed (${changed})` : "its parent rendered";
        }
      } else if (parent && !parent.yes && c.parent === "app" && !appRendered) {
        yes = false;
        reason = "skipped: same element (passed as children)";
      } else {
        yes = false;
        reason = "not affected";
      }
      if (!yes && ctxHit) {
        yes = true;
        const name = o.approach === "split" ? `${c.reads[0]} context` : "app context";
        reason = o.memoValue ? `reads the ${name}, which changed` : `reads the ${name}: its value is a new object`;
      }
    }
    rendered.set(c.id, { yes, reason });
  }
  return TREE.map((c) => {
    const r = rendered.get(c.id)!;
    const passesOnly = o.approach === "props" ? propsOf(c.id).filter((k) => !c.reads.includes(k)) : [];
    return { comp: c, rendered: r.yes, reason: r.reason, depth: depthOf(c), passesOnly };
  });
}

/** Components that receive props only to hand them on. */
export function drilling(o: Opts) {
  if (o.approach !== "props") return { components: 0, props: 0 };
  const rows = TREE.filter((c) => c.id !== "app").map((c) => propsOf(c.id).filter((k) => !c.reads.includes(k)));
  return { components: rows.filter((r) => r.length).length, props: rows.reduce((a, r) => a + r.length, 0) };
}

/** What adding a field (say, the user's currency for prices) costs: files touched. */
export function addField(o: Opts) {
  // ProductCard needs the user's currency. With props, every component between App and it changes.
  if (o.approach === "props") return ["App", "Main", "ProductGrid", "ProductCard"];
  return ["ProductCard"];
}
