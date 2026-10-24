// Five widgets, each written several ways, judged for four kinds of user: mouse, keyboard,
// screen reader and voice control. Outcomes follow from the markup's properties: the role
// (ARIA role, else the element's own), whether it's focusable and responds to Enter and Space,
// its accessible name (aria-label wins over the visible text), whether state is exposed,
// aria-hidden, and live regions. The rule ids are axe-core's, where axe has a rule; some
// failures (a div with role=button that can't be focused) no automated rule can see.

export type User = "mouse" | "keyboard" | "screenReader" | "voice";
export const USERS: { id: User; label: string }[] = [
  { id: "mouse", label: "Mouse" },
  { id: "keyboard", label: "Keyboard" },
  { id: "screenReader", label: "Screen reader" },
  { id: "voice", label: "Voice control" },
];

export type Variant = {
  id: string;
  label: string;
  code: string;
  tag: "button" | "div" | "a" | "table" | "nav";
  role?: string;
  tabindex?: number;
  keys?: boolean;
  visibleText: string;
  ariaLabel?: string;
  exposesState?: boolean;
  needsState?: boolean;
  hiddenButFocusable?: boolean;
  inert?: boolean;
  live?: "none" | "polite" | "assertive";
  presentationTable?: boolean;
};

export type Widget = { id: string; label: string; what: string; variants: Variant[] };

export const WIDGETS: Widget[] = [
  {
    id: "disclosure",
    label: "A Show details toggle",
    what: "Opens and closes a panel of product details.",
    variants: [
      { id: "div", label: 'div role="button"', code: '<div role="button" onclick="toggle()">Show details</div>', tag: "div", role: "button", visibleText: "Show details", needsState: true },
      { id: "div-full", label: "div with all the ARIA and JS", code: '<div role="button" tabindex="0" aria-expanded="false"\n     onclick="toggle()" onkeydown="enterOrSpace(event)">Show details</div>', tag: "div", role: "button", tabindex: 0, keys: true, exposesState: true, visibleText: "Show details", needsState: true },
      { id: "button-nostate", label: "button, no aria-expanded", code: '<button onclick="toggle()">Show details</button>', tag: "button", visibleText: "Show details", needsState: true },
      { id: "button", label: "button + aria-expanded", code: '<button aria-expanded="false" onclick="toggle()">Show details</button>', tag: "button", exposesState: true, visibleText: "Show details", needsState: true },
    ],
  },
  {
    id: "search",
    label: "A search button",
    what: 'A button that shows the word "Search".',
    variants: [
      { id: "mismatch", label: "aria-label that differs", code: '<button aria-label="Find products">Search</button>', tag: "button", ariaLabel: "Find products", visibleText: "Search" },
      { id: "visible", label: "the visible text as its name", code: "<button>Search</button>", tag: "button", visibleText: "Search" },
      { id: "extended", label: "aria-label starting with the text", code: '<button aria-label="Search products">Search</button>', tag: "button", ariaLabel: "Search products", visibleText: "Search" },
    ],
  },
  {
    id: "drawer",
    label: "A closed side menu",
    what: "An off-screen menu of links, hidden until opened.",
    variants: [
      { id: "aria-hidden", label: 'aria-hidden="true"', code: '<nav class="offscreen" aria-hidden="true">\n  <a href="/sale">Sale</a> …\n</nav>', tag: "nav", visibleText: "", hiddenButFocusable: true },
      { id: "inert", label: "inert", code: '<nav class="offscreen" inert>\n  <a href="/sale">Sale</a> …\n</nav>', tag: "nav", visibleText: "", inert: true },
    ],
  },
  {
    id: "status",
    label: "An Added to cart message",
    what: "Text that appears after pressing Add to cart.",
    variants: [
      { id: "plain", label: "plain text", code: '<p id="msg"></p>  <!-- filled in by JS -->', tag: "div", visibleText: "Added to cart", live: "none" },
      { id: "alert", label: 'role="alert"', code: '<p id="msg" role="alert"></p>', tag: "div", visibleText: "Added to cart", live: "assertive" },
      { id: "status", label: 'role="status"', code: '<p id="msg" role="status"></p>', tag: "div", visibleText: "Added to cart", live: "polite" },
    ],
  },
  {
    id: "table",
    label: "A size chart",
    what: "A real data table: sizes against foot lengths.",
    variants: [
      { id: "presentation", label: 'role="presentation"', code: '<table role="presentation">\n  <tr><th>EU</th><th>cm</th></tr> …', tag: "table", visibleText: "", presentationTable: true },
      { id: "native", label: "a plain <table>", code: "<table>\n  <caption>Sizes</caption>\n  <tr><th>EU</th><th>cm</th></tr> …", tag: "table", visibleText: "" },
    ],
  },
];

export type Result = { user: User; ok: "ok" | "bad" | "warn"; why: string };

export function judge(v: Variant): { results: Result[]; axe: string[] } {
  const role = v.role ?? (v.tag === "button" ? "button" : v.tag === "a" ? "link" : v.tag === "table" ? "table" : v.tag === "nav" ? "navigation" : "generic");
  const focusable = v.tag === "button" || v.tag === "a" || (v.tabindex ?? -1) >= 0;
  const operable = focusable && (v.tag === "button" || !!v.keys);
  const name = v.ariaLabel ?? v.visibleText;
  const results: Result[] = [];
  const axe: string[] = [];
  const add = (user: User, ok: Result["ok"], why: string) => results.push({ user, ok, why });

  if (v.live !== undefined) {
    add("mouse", "ok", "sees the message appear");
    add("keyboard", "ok", "sees the message appear");
    add("screenReader", v.live === "none" ? "bad" : v.live === "assertive" ? "warn" : "ok", v.live === "none" ? "hears nothing: new text isn't announced unless it's in a live region" : v.live === "assertive" ? "hears it, but it interrupts whatever was being read: keep alert for urgent things" : "hears it at the next pause");
    add("voice", "ok", "nothing to operate");
    return { results, axe };
  }
  if (v.presentationTable || v.tag === "table") {
    add("mouse", "ok", "reads the table");
    add("keyboard", "ok", "reads the table");
    add("screenReader", v.presentationTable ? "bad" : "ok", v.presentationTable ? "hears loose cells: no rows, columns or headers to navigate" : "can move by row and column, hearing the header for each cell");
    add("voice", "ok", "nothing to operate");
    return { results, axe };
  }
  if (v.hiddenButFocusable || v.inert) {
    add("mouse", "ok", "can't see or click the closed menu");
    add("keyboard", v.hiddenButFocusable ? "bad" : "ok", v.hiddenButFocusable ? "Tab moves focus into the invisible menu: focus disappears for several presses" : "inert removes it from the tab order too");
    add("screenReader", v.hiddenButFocusable ? "bad" : "ok", v.hiddenButFocusable ? "focus lands on links that are announced as nothing" : "the menu is skipped entirely");
    add("voice", "ok", "nothing visible to name");
    if (v.hiddenButFocusable) axe.push("aria-hidden-focus");
    return { results, axe };
  }
  add("mouse", "ok", "clicks it");
  add("keyboard", operable ? "ok" : "bad", !focusable ? "Tab skips it: a div isn't focusable without tabindex" : operable ? "Tab reaches it; Enter and Space press it" : "focusable, but Enter and Space do nothing without a key handler");
  const srProblems = [role === "generic" && "announced as plain text", !name && "has no name", v.needsState && !v.exposesState && "doesn't say whether it's open"].filter(Boolean) as string[];
  add("screenReader", srProblems.length ? "bad" : !focusable ? "warn" : "ok", srProblems.length ? srProblems.join(", ") : !focusable ? "announced as a button, but its Enter key does nothing and Tab never reaches it" : `"${name}, button${v.exposesState ? ", collapsed" : ""}"`);
  const labelInName = name.toLowerCase().startsWith(v.visibleText.toLowerCase());
  add("voice", labelInName ? "ok" : "bad", labelInName ? `"Click ${v.visibleText}" works` : `"Click ${v.visibleText}" fails: its name is "${name}"`);
  if (!labelInName) axe.push("label-content-name-mismatch");
  if (!name) axe.push("button-name");
  return { results, axe };
}
