// A product's UI with and without a design system. The "codebase" is a handful of real
// component snippets; rebranding is a real search over them, so near-duplicate colours the
// search misses are really missed. Dark-mode contrast uses WCAG's formula on the token values.
// Releases are matched against each app's dependency range with semver's caret, tilde and
// exact rules. Everything else is illustrative.

// WCAG relative luminance and contrast ratio (kept here so this module stands alone).
const channel = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const BRAND = "#2563eb";
export const NEW_BRAND = "#7c3aed";

export type Style = "hardcoded" | "tokens";

/** Six components, written with raw values or with tokens. */
export function codebase(style: Style): { file: string; css: string }[] {
  if (style === "tokens")
    return [
      { file: "Button.css", css: "background: var(--color-action-bg); color: var(--color-action-text); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);" },
      { file: "Link.css", css: "color: var(--color-action-bg);" },
      { file: "Tabs.css", css: "border-bottom: 2px solid var(--color-action-bg);" },
      { file: "Badge.css", css: "background: var(--color-action-bg); border-radius: var(--radius-md);" },
      { file: "Checkout.css", css: "background: var(--color-action-bg); padding: var(--space-2) var(--space-4);" },
      { file: "Promo.css", css: "outline: 2px solid var(--color-focus);" },
    ];
  return [
    { file: "Button.css", css: `background: ${BRAND}; color: #fff; padding: 8px 16px; border-radius: 6px;` },
    { file: "Link.css", css: `color: ${BRAND};` },
    { file: "Tabs.css", css: `border-bottom: 2px solid ${BRAND};` },
    { file: "Badge.css", css: "background: #2564eb; border-radius: 4px;" },
    { file: "Checkout.css", css: "background: rgb(37, 99, 235); padding: 10px 18px;" },
    { file: "Promo.css", css: `outline: 2px solid ${BRAND.toUpperCase()};` },
  ];
}

/** Find-and-replace the brand colour, the way someone would under a deadline. */
export function rebrand(style: Style) {
  const files = codebase(style);
  if (style === "tokens") return { edits: 1, filesTouched: ["tokens.json"], missed: [] as string[], note: "one value changed in tokens.json; every component follows" };
  const hit = files.filter((f) => f.css.includes(BRAND));
  const missed = files.filter((f) => !f.css.includes(BRAND) && /#2564eb|rgb\(37, 99, 235\)|#2563EB/i.test(f.css)).map((f) => f.file);
  return { edits: hit.length, filesTouched: hit.map((f) => f.file), missed, note: `searched for "${BRAND}": ${hit.length} files changed, ${missed.length} still blue` };
}

/** How many different paddings and radii the codebase has for things that should match. */
export function drift(style: Style) {
  const css = codebase(style).map((f) => f.css).join(" ");
  const paddings = new Set(css.match(/padding: [^;]+/g) ?? []);
  const radii = new Set(css.match(/border-radius: [^;]+/g) ?? []);
  return { paddings: paddings.size, radii: radii.size };
}

// ---- themes ---------------------------------------------------------------------------

export const PRIMITIVES: Record<string, string> = {
  "blue-400": "#60a5fa", "blue-600": "#2563eb", "gray-50": "#f9fafb", "gray-400": "#9ca3af", "gray-500": "#6b7280", "gray-900": "#111827", white: "#ffffff",
};

export type Theme = "light" | "dark";
export function semantic(theme: Theme, darkFix: boolean): Record<string, string> {
  if (theme === "light") return { "color-surface": "white", "color-text": "gray-900", "color-muted": "gray-500", "color-action-bg": "blue-600", "color-action-text": "white" };
  // A first dark theme often just flips the surface and keeps the brand blue.
  return { "color-surface": "gray-900", "color-text": "gray-50", "color-muted": darkFix ? "gray-400" : "gray-500", "color-action-bg": darkFix ? "blue-400" : "blue-600", "color-action-text": darkFix ? "gray-900" : "white" };
}

export function themeChecks(theme: Theme, darkFix: boolean) {
  const s = semantic(theme, darkFix);
  const hex = (token: string) => PRIMITIVES[s[token]];
  const pair = (label: string, fg: string, bg: string, min: number) => {
    const ratio = contrast(hex(fg), hex(bg));
    return { label, fg: s[fg], bg: s[bg], ratio, ok: ratio >= min, min };
  };
  return [
    pair("Body text on the page", "color-text", "color-surface", 4.5),
    pair("Secondary text on the page", "color-muted", "color-surface", 4.5),
    pair("Button label on the button", "color-action-text", "color-action-bg", 4.5),
    pair("Button against the page", "color-action-bg", "color-surface", 3),
  ];
}

// ---- releases ---------------------------------------------------------------------------

export type Change = "fix" | "feature" | "breaking";
export const CHANGES: { id: Change; label: string; what: string }[] = [
  { id: "fix", label: "Fix Button's focus ring", what: "a bug fix nobody has to change code for" },
  { id: "feature", label: "Add a danger variant", what: "a new option, old code still works" },
  { id: "breaking", label: "Rename kind to variant", what: "every <Button kind=…> must change" },
];

const parse = (v: string) => v.split(".").map(Number) as [number, number, number];
export function bump(current: string, c: Change) {
  const [ma, mi, pa] = parse(current);
  return c === "breaking" ? `${ma + 1}.0.0` : c === "feature" ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
}

/** npm's semver rules for ^, ~ and an exact version. */
export function satisfies(version: string, range: string) {
  const v = parse(version);
  const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (range.startsWith("^")) {
    const r = parse(range.slice(1));
    const upper = r[0] > 0 ? [r[0] + 1, 0, 0] : r[1] > 0 ? [0, r[1] + 1, 0] : [0, 0, r[2] + 1];
    return cmp(v, r) >= 0 && cmp(v, upper) < 0;
  }
  if (range.startsWith("~")) {
    const r = parse(range.slice(1));
    return cmp(v, r) >= 0 && cmp(v, [r[0], r[1] + 1, 0]) < 0;
  }
  return cmp(v, parse(range)) === 0;
}

export const CURRENT = "2.4.0";
export const APPS = [
  { name: "Storefront", range: "^2.4.0" },
  { name: "Checkout", range: "~2.3.0" },
  { name: "Admin", range: "2.1.0" },
  { name: "Marketing site", range: "^1.9.0" },
];

export function release(c: Change) {
  const next = bump(CURRENT, c);
  return { next, apps: APPS.map((a) => ({ ...a, gets: satisfies(next, a.range) })) };
}
