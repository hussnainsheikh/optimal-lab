// What a bundler does for a small app, in development and for production. Output files are
// named by a real SHA-256 of their contents (first 8 hex digits), so an edit really changes
// the names it should, and a chunk that imports another by its hashed name really changes too.
// Dev-server and build timings are illustrative.

import { sha256Hex } from "./hashing";

export type Edit = "header" | "settings" | "css" | "react" | "main";
export const EDITS: { id: Edit; label: string; file: string }[] = [
  { id: "header", label: "Edit Header.tsx", file: "src/Header.tsx" },
  { id: "settings", label: "Edit Settings.tsx (lazy)", file: "src/Settings.tsx" },
  { id: "css", label: "Edit styles.css", file: "src/styles.css" },
  { id: "main", label: "Edit main.tsx", file: "src/main.tsx" },
  { id: "react", label: "Upgrade React", file: "package.json" },
];

function sources(edit: Edit | null) {
  return {
    header: `export function Header({title}){return jsx("h1",{className:"title",children:${edit === "header" ? "title+\" ✦\"" : "title"}})}`,
    settings: `export default function Settings(){return jsx("form",{children:[${edit === "settings" ? '"Theme","Language"' : '"Theme"'}]})}`,
    app: 'import{Header}from"./Header";const Settings=lazy(()=>import("./Settings"));export function App(){return jsx(Header,{title:"Shop"})}',
    main: `createRoot(root).render(jsx(App,{}))${edit === "main" ? ';console.info("v2")' : ""}`,
    css: `.title{color:${edit === "css" ? "#1d4ed8" : "navy"}}`,
    vendor: `/* react-dom ${edit === "react" ? "19.0.1" : "19.0.0"} */function createRoot(){}`,
  };
}

export const SIZES = { index: 42, vendor: 140, settings: 18, css: 9, manifest: 0.3 };
export type OutFile = { id: keyof typeof SIZES; name: string; kb: number };

export function build(edit: Edit | null, manifest: boolean): OutFile[] {
  const s = sources(edit);
  const h = (text: string) => sha256Hex(text).slice(0, 8);
  const vendor = `assets/vendor-${h(s.vendor)}.js`;
  const settings = `assets/Settings-${h(s.settings)}.js`;
  const css = `assets/index-${h(s.css)}.css`;
  // Without a manifest, the entry chunk contains the other chunks' hashed names.
  const indexBody = manifest ? `${s.app}${s.header}${s.main}import("vendor");import("Settings")` : `${s.app}${s.header}${s.main}import("./${vendor}");import("./${settings}")`;
  const out: OutFile[] = [
    { id: "index", name: `assets/index-${h(indexBody)}.js`, kb: SIZES.index },
    { id: "vendor", name: vendor, kb: SIZES.vendor },
    { id: "settings", name: settings, kb: SIZES.settings },
    { id: "css", name: css, kb: SIZES.css },
  ];
  if (manifest) out.push({ id: "manifest", name: `assets/manifest-${h(JSON.stringify({ vendor, settings }))}.js`, kb: SIZES.manifest });
  return out;
}

/** Which files a returning visitor has to download again after the edit. */
export function redownload(edit: Edit, manifest: boolean) {
  const before = build(null, manifest);
  const after = build(edit, manifest);
  const changed = after.filter((f) => !before.some((b) => b.name === f.name));
  return { before, after, changed, kb: changed.reduce((a, f) => a + f.kb, 0), total: after.reduce((a, f) => a + f.kb, 0) };
}

// ---- development ----------------------------------------------------------------------

export type DevMode = "bundle" | "esm";
export const MODULES = 1200;
export const PAGE_MODULES = 40;

export function devStart(mode: DevMode) {
  return mode === "bundle"
    ? { ms: MODULES * 1.5 + 600, what: `bundles all ${MODULES.toLocaleString("en-US")} modules before serving anything` }
    : { ms: 250 + PAGE_MODULES * 3, what: `pre-bundles dependencies with esbuild, then transforms only the ${PAGE_MODULES} modules this page requests` };
}

export function hotUpdate(mode: DevMode, edit: Edit) {
  if (edit === "main") return { ms: mode === "bundle" ? 900 : 120, kind: "full reload" as const, stateKept: false, why: "main.tsx is the entry and no module above it accepts the update, so the page reloads" };
  if (edit === "react") return { ms: mode === "bundle" ? 2400 : 900, kind: "full reload" as const, stateKept: false, why: "a dependency changed, so dependencies are re-bundled and the page reloads" };
  if (edit === "css") return { ms: mode === "bundle" ? 350 : 25, kind: "style swap" as const, stateKept: true, why: "only the stylesheet is replaced" };
  return { ms: mode === "bundle" ? 400 : 30, kind: "hot module update" as const, stateKept: true, why: "the component module is swapped and React Fast Refresh keeps its state" };
}

// ---- transform ------------------------------------------------------------------------

export const BEFORE = `import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root") as HTMLElement;
if (import.meta.env.DEV) {
  enableDebugPanel();
}
createRoot(root).render(<App />);`;

export const AFTER = `import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { App } from "./App";
const root = document.getElementById("root");
createRoot(root).render(jsx(App, {}));`;

export const MINIFIED = `import{jsx as o}from"react/jsx-runtime";import{createRoot as t}from"react-dom/client";import{App as r}from"./App";t(document.getElementById("root")).render(o(r,{}));`;
