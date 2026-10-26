"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type NodeState, type Packet } from "@/components/system/SystemMap";
import { ACTIONS, DRILLED, TREE, TUNED, addField, drilling, simulate, type Approach, type Key, type Opts } from "@/lib/contextTree";

const ACCENT = "var(--web)";

const APPROACHES: { id: Approach; label: string; code: string }[] = [
  { id: "props", label: "Pass props down", code: "<Main cart={cart} onAdd={add} />\n  <ProductGrid cart={cart} onAdd={add} />\n    <ProductCard cart={cart} onAdd={add} />\n      <AddToCart cart={cart} onAdd={add} />" },
  { id: "one", label: "One context", code: "<AppContext.Provider value={{ user, cart, theme, menu }}>\n  …\n</AppContext.Provider>\n\n// AddToCart\nconst { cart } = useContext(AppContext);" },
  { id: "split", label: "A context per kind", code: "<UserContext.Provider value={user}>\n<CartContext.Provider value={cart}>\n<ThemeContext.Provider value={theme}>\n  …\n\n// AddToCart\nconst cart = useContext(CartContext);" },
];

export default function ContextDemo() {
  const [o, setO] = useState<Opts>(DRILLED);
  const [action, setAction] = useState<Key>("cart");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const results = simulate(o, action);
  const rendered = results.filter((r) => r.rendered);
  const needed = rendered.filter((x) => x.comp.reads.includes(action) || x.comp.id === "app");
  const wasted = rendered.length - needed.length;
  const d = drilling(o);
  const owner = o.approach === "props" ? "app" : o.owner;
  const act = ACTIONS.find((a) => a.id === action)!;
  const r = (id: string) => results.find((x) => x.comp.id === id)!;
  const stateOf = (id: string): NodeState => {
    const x = r(id);
    if (!x.rendered) return "dim";
    return x.comp.reads.includes(action) || id === "app" ? "good" : "bad";
  };

  const nodes: MapNode[] = [
    { id: "app", label: owner === "app" ? "App" : "Providers", sub: owner === "app" ? "owns all the state" : "own the state", at: [14, 22], mobileAt: [25, 12], state: r("app").rendered || owner !== "app" ? "active" : "dim" },
    { id: "header", label: "Header", sub: r("header").rendered ? "renders" : "skipped", at: [50, 22], mobileAt: [75, 12], state: stateOf("header") },
    { id: "avatar", label: "UserMenu › Avatar", sub: "reads user, menu", at: [86, 22], mobileAt: [75, 45], state: stateOf("avatar") },
    { id: "grid", label: "Main › ProductGrid", sub: r("grid").rendered ? "renders, with 4 cards" : "skipped", at: [50, 78], mobileAt: [25, 45], state: stateOf("grid") },
    { id: "add", label: "AddToCart ×4", sub: "reads cart", at: [86, 78], mobileAt: [75, 80], state: stateOf("add1") },
    { id: "toggle", label: "Footer › ThemeToggle", sub: "reads theme", at: [14, 78], mobileAt: [25, 80], state: stateOf("toggle") },
  ];

  const triggerFrom = action === "cart" ? "add" : action === "theme" ? "toggle" : "avatar";
  const firstRendered = ["header", "grid", "toggle", "avatar", "add"].filter((id) => (id === "add" ? r("add1").rendered : id === "avatar" ? r("avatar").rendered : r(id).rendered));
  const packets: Packet[] =
    stage === 0 ? hops("o", ["app", "grid"], { label: owner === "app" ? "state in App" : "state in providers" })
    : stage === 1 ? (o.approach === "props" ? hops("p", ["app", "grid", "add"], { label: "cart prop" }) : hops("p", ["app", "add"], { label: "useContext" }))
    : stage === 2 ? hops("a", [triggerFrom, "app"], { label: act.label })
    : stage === 3 ? hops("r", ["app", ...firstRendered.slice(0, 2)], { label: `${rendered.length} render${rendered.length === 1 ? "" : "s"}`, tone: wasted ? "bad" : "good" })
    : stage === 4 ? hops("m", ["app", triggerFrom], { label: wasted ? `${wasted} wasted` : "only readers", tone: wasted ? "bad" : "good" })
    : [];

  const captions = [
    owner === "app" ? "Step 1: user, cart, theme and menu state all live in App, at the top of the tree." : "Step 1: the state lives in provider components that wrap the tree, which they get as children.",
    o.approach === "props" ? `Step 2: props are passed down by hand; ${d.components} components take props only to hand them on.` : `Step 2: components read what they need with useContext, ${o.approach === "split" ? "from a context per kind of data" : "from one shared context"}.`,
    `Step 3: ${act.label.toLowerCase()}: ${act.what}.`,
    `Step 4: ${rendered.length} of ${TREE.length} components render; ${wasted} of them don't use the ${action}.`,
    wasted ? `Step 5: ${wasted} renders could be skipped. Try state in providers, a context per kind, or memo.` : "Step 5: only the components that read the changed value rendered.",
  ];
  const caption = stage !== null ? captions[stage] : `${act.label}: ${rendered.length} of ${TREE.length} components render, ${wasted} for nothing.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Context and prop drilling"
        blurb="Data that many components need has to get from the top of the tree to them. Passing props by hand works but threads them through components that don't care. Context skips the middle, but it doesn't make renders cheaper by itself: where the state lives and how the context is split decide who renders."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="App or provider components hold the state; Header, ProductGrid and Footer sit in the middle; Avatar, AddToCart and ThemeToggle read the data"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "header", label: "renders" },
                  { from: "header", to: "avatar", label: o.approach === "props" ? "user, menu props" : "renders" },
                  { from: "app", to: "grid", label: o.approach === "props" ? "cart prop" : "renders" },
                  { from: "grid", to: "add", label: o.approach === "props" ? "cart prop" : "renders" },
                  { from: "app", to: "add", label: "context", dashed: true, dim: o.approach === "props" },
                  { from: "app", to: "toggle", label: o.approach === "props" ? "theme prop" : "renders" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Which components rendered and why">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {act.label} · {rendered.length} rendered · {wasted} wasted
                </p>
                <ul className="mt-2 space-y-1">
                  {results.map((x) => {
                    const useful = x.rendered && (x.comp.reads.includes(action) || x.comp.id === "app");
                    return (
                      <li key={x.comp.id} style={{ marginLeft: x.depth * 12 }}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-md border px-2 py-1" style={{ borderColor: x.rendered ? (useful ? "var(--good)" : "var(--bad)") : "var(--line)", background: x.rendered ? "var(--inset)" : "transparent" }}>
                          <span className="font-mono text-xs">
                            &lt;{x.comp.name.replace(/ #\d/, "")} /&gt;
                            {x.passesOnly.length > 0 && <span className="ml-1 text-[10px] text-[var(--faint)]">passes {x.passesOnly.join(", ")}</span>}
                          </span>
                          <span className="text-[10px]" style={{ color: x.rendered ? "var(--text)" : "var(--faint)" }}>
                            {x.reason}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Change" accent={ACCENT} value={action} onChange={setAction} options={ACTIONS.map((a) => ({ id: a.id, label: a.label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(DRILLED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Props from App
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Split contexts in providers
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Rendering…">
                Make the change
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide where the state lives" what="State kept in App makes App render on every change, and by default React renders everything App renders. State kept in a provider component that receives the tree as children leaves those children alone: they're the same elements as before." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={owner} onChange={(v) => set({ owner: v })} options={[{ id: "app", label: "In App" }, { id: "provider", label: "In provider components" }]} />
                {o.approach === "props" && <p className="mt-2 text-xs text-[var(--faint)]">With props, the state has to sit in App: it&apos;s where the props start.</p>}
              </FlowStep>
              <FlowArrow label="the data" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Get the data down the tree" what="Props make every step explicit, and every component in between has to accept and forward them. Context lets a component deep down read a value directly." accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={o.approach} onChange={(v) => set({ approach: v })} options={APPROACHES.map((a) => ({ id: a.id, label: a.label }))} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{APPROACHES.find((a) => a.id === o.approach)!.code}</pre>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {o.approach === "props" ? `${d.components} components forward ${d.props} props they don't use. Giving ProductCard the user's currency touches ${addField(o).length} files: ${addField(o).join(", ")}.` : `No component forwards anything. Giving ProductCard the user's currency touches ${addField(o).join(", ")} only.`}
                </p>
              </FlowStep>
              <FlowArrow label="setState" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Change one value" what="A click calls a state setter. The component that owns the state renders again, and React works out what else has to." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-sm">{act.what}</p>
              </FlowStep>
              <FlowArrow label="renders" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Follow the renders" what="A component renders if its parent rendered and made a new element for it, or if a context it reads has a new value. React compares context values with Object.is, so an object literal written in the provider is new on every render." accent={ACCENT} active={at(3)}>
                <ul className="grid gap-1 font-mono text-xs sm:grid-cols-3">
                  <li>rendered: {rendered.length}</li>
                  <li style={{ color: "var(--good)" }}>needed: {needed.length}</li>
                  <li style={{ color: wasted ? "var(--bad)" : undefined }}>wasted: {wasted}</li>
                </ul>
              </FlowStep>
              <FlowArrow label="fewer renders" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Cut the extra renders" what="Split one big context so readers only hear about their own data, memoize the provider's value so it changes only when its contents do, or wrap the components in the middle in memo." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.memoValue} disabled={o.approach === "props"} onChange={(e) => set({ memoValue: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  useMemo the provider value
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.memoMiddle} onChange={(e) => set({ memoMiddle: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  memo() on Header, Main, ProductGrid, ProductCard and Footer
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Renders are worked out with React&apos;s rules (parent renders, memo with equal props, context compared with Object.is, children elements reused); callbacks are assumed stable with useCallback.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
