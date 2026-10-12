// Which React components re-render, and why. A component re-renders when its own state
// changes, when its parent re-renders (unless it is wrapped in memo and its props are the
// same), or when a context it reads changes, wherever it sits in the tree.

export type Comp = {
  id: string;
  name: string;
  parent: string | null;
  owns?: StateKey[]; // state this component holds
  props?: StateKey[]; // state it receives through props
  readsTheme?: boolean; // useContext(ThemeContext)
};

export type StateKey = "count" | "theme" | "query";

export const TREE: Comp[] = [
  { id: "app", name: "App", parent: null, owns: ["count", "theme"] },
  { id: "header", name: "Header", parent: "app", readsTheme: true },
  { id: "counter", name: "Counter", parent: "app", props: ["count"] },
  { id: "sidebar", name: "Sidebar", parent: "app", owns: ["query"] },
  { id: "search", name: "SearchBox", parent: "sidebar", props: ["query"] },
  { id: "list", name: "ProjectList", parent: "sidebar" },
  { id: "footer", name: "Footer", parent: "app" },
  { id: "theme-label", name: "ThemeLabel", parent: "footer", readsTheme: true },
];

export const ACTIONS: { id: StateKey; label: string; owner: string; note: string }[] = [
  { id: "count", label: "Click +1", owner: "app", note: "setCount in App" },
  { id: "theme", label: "Switch theme", owner: "app", note: "setTheme in App, passed down through ThemeContext" },
  { id: "query", label: "Type in search", owner: "sidebar", note: "setQuery in Sidebar" },
];

export type Reason = "own state" | "parent re-rendered" | "props changed" | "context changed" | "skipped by memo" | "not affected";

export type Result = { comp: Comp; rendered: boolean; reason: Reason; depth: number };

export function simulate(action: StateKey, memo: boolean): Result[] {
  const owner = ACTIONS.find((a) => a.id === action)!.owner;
  const contextChanged = action === "theme";
  const out: Result[] = [];
  const walk = (id: string, parentRendered: boolean, depth: number) => {
    const comp = TREE.find((c) => c.id === id)!;
    let rendered = false;
    let reason: Reason = "not affected";
    if (id === owner) {
      rendered = true;
      reason = "own state";
    } else if (parentRendered) {
      const propsChanged = (comp.props ?? []).includes(action);
      if (!memo) {
        rendered = true;
        reason = propsChanged ? "props changed" : "parent re-rendered";
      } else if (propsChanged) {
        rendered = true;
        reason = "props changed";
      } else {
        reason = "skipped by memo";
      }
    }
    if (!rendered && contextChanged && comp.readsTheme) {
      rendered = true;
      reason = "context changed";
    }
    out.push({ comp, rendered, reason, depth });
    for (const child of TREE.filter((c) => c.parent === id)) walk(child.id, rendered, depth + 1);
  };
  walk("app", false, 0);
  return out;
}
