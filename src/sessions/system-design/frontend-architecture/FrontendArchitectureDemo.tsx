"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CARDS, SERVER, STRATEGIES, TREE, depth, marks, run, type DataKey, type Event, type Strategy } from "@/lib/frontendArchitecture";

const ACCENT = "var(--sys)";
const EVENTS: { id: Event; label: string }[] = [
  { id: "load", label: "Load the page" },
  { id: "filter", label: "Change a filter" },
  { id: "cart", label: "Add to cart" },
];
const MARK = {
  fetch: { color: "var(--c1)", label: "fetches" },
  render: { color: "var(--sys)", label: "re-renders" },
  stale: { color: "var(--bad)", label: "shows a stale cart" },
  none: { color: "var(--line)", label: "" },
} as const;
const KIND: Record<DataKey, string> = { user: "server", products: "server", cart: "server", filters: "UI" };

export default function FrontendArchitectureDemo() {
  const [s, setS] = useState<Strategy>("effects");
  const [event, setEvent] = useState<Event>("load");
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(s);
  const all = Object.fromEntries(STRATEGIES.map((x) => [x.id, run(x.id)])) as Record<Strategy, ReturnType<typeof run>>;
  const at = (i: number) => stage === i;
  const shown: Event = stage === 2 ? "load" : stage === 3 ? "filter" : stage === 4 ? "cart" : event;
  const m = marks(s, shown);
  const label = STRATEGIES.find((x) => x.id === s)!.label;

  const captions = [
    `Step 1: ${TREE.length} components, ${CARDS} of them product cards.`,
    "Step 2: the user, the products and the cart come from the server; the filter is UI state.",
    `Step 3: ${label.toLowerCase()}: ${r.requestsOnLoad} requests in ${r.roundTrips} round trip${r.roundTrips === 1 ? "" : "s"} to load.`,
    `Step 4: changing the filter re-renders ${r.filterRerenders} components and sends ${r.filterRequests} request${r.filterRequests === 1 ? "" : "s"}.`,
    r.staleAfterCart ? `Step 5: adding to the cart leaves ${r.staleAfterCart} components showing the old cart.` : `Step 5: adding to the cart updates all ${r.cartRerenders} components that show it.`,
  ];
  const caption = stage !== null ? captions[stage] : `${label}: ${r.requestsOnLoad} requests to load · ${r.drilled.length} components passing props they don't use · ${r.filterRerenders} re-renders per filter change · ${r.staleAfterCart} stale after adding to the cart.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Frontend architecture"
        blurb={`A product page: a header with the user, filters, a list of ${CARDS} product cards that show what's in the cart, and a cart summary. The hard question isn't which framework; it's where each piece of state lives. Try four answers and count the requests, the props passed through, the re-renders and the stale copies.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`The component tree when you ${EVENTS.find((e) => e.id === shown)!.label.toLowerCase()}, with what each component does`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{EVENTS.find((e) => e.id === shown)!.label}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{label}</p>
              </div>
              <ul className="mt-3 space-y-1">
                {TREE.map((c) => {
                  const mk = m[c.id];
                  const drilled = r.drilled.find((d) => d.comp === c.label);
                  return (
                    <li key={c.id} className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth(c.id) * 1}rem` }}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: mk === "none" ? "transparent" : MARK[mk].color, border: `1px solid ${MARK[mk].color}` }} />
                      <span className="shrink-0 font-mono text-xs" style={{ color: mk === "stale" ? "var(--bad)" : "var(--text)" }}>
                        {c.label}
                        {c.count ? ` ×${c.count}` : ""}
                      </span>
                      <span className="flex min-w-0 flex-wrap gap-1">
                        {c.uses.map((k) => (
                          <span key={k} className="rounded px-1 font-mono text-[9px]" style={{ border: "1px solid var(--line-strong)", color: "var(--muted)" }}>
                            {k}
                          </span>
                        ))}
                        {drilled &&
                          drilled.keys.map((k) => (
                            <span key={k} className="rounded px-1 font-mono text-[9px]" style={{ border: "1px dashed var(--bad)", color: "var(--bad)" }}>
                              passes {k}
                            </span>
                          ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                {(["fetch", "render", "stale"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK[k].color }} /> {MARK[k].label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="rounded px-1 font-mono text-[9px]" style={{ border: "1px dashed var(--bad)", color: "var(--bad)" }}>
                    passes
                  </span>
                  a prop it only hands down
                </span>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Where state lives" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Show" accent={ACCENT} value={event} onChange={setEvent} options={EVENTS} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Walking…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Draw the component boundaries" what="Split the page by what changes together and what can be reused: the header, the filters, the list, a card, the cart summary. The tree decides how far data has to travel." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {TREE.length} components · deepest {Math.max(...TREE.map((c) => depth(c.id)))} levels · {CARDS} cards
                </p>
              </FlowStep>
              <FlowArrow label="what data" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Sort the state by where its truth lives" what="Server state (the user, products, the cart) belongs to the server; the browser holds a copy that can go stale. UI state (the open filter) belongs to the page, and if someone should be able to share or bookmark it, it belongs in the URL." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {(Object.keys(KIND) as DataKey[]).map((k) => (
                    <li key={k}>
                      {k} <span className="text-[var(--faint)]">({KIND[k]})</span> → {r.where[k]}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="load the page" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Load it once, near where it's used" what={`Fetching in every component that shows the data repeats the request: here the user twice and the cart in every card, and the cards can only ask after the list arrives. Fetching once at the top means every component in between passes props it doesn't use. A store or a query cache gives each component the data directly.`} accent={ACCENT} active={at(2)}>
                <Choices label="Where state lives" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <Table rows={STRATEGIES.map((x) => [x.label, `${all[x.id].requestsOnLoad} requests, ${all[x.id].roundTrips} round trip${all[x.id].roundTrips === 1 ? "" : "s"}`, `${all[x.id].drilled.length} pass-through`, x.id === s])} />
              </FlowStep>
              <FlowArrow label="change a filter" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Re-render only what reads the change" what="State held high re-renders everything below it when it changes. Components that subscribe to exactly the slice they read (a store selector, a query key, the URL) re-render alone. A cache keyed by the filter also answers instantly when the user goes back." accent={ACCENT} active={at(3)}>
                <Table rows={STRATEGIES.map((x) => [x.label, `${all[x.id].filterRerenders} re-renders, ${all[x.id].filterRequests} request${all[x.id].filterRequests === 1 ? "" : "s"}`, `back: ${all[x.id].backToFilterRequests} request${all[x.id].backToFilterRequests === 1 ? "" : "s"}`, x.id === s])} />
              </FlowStep>
              <FlowArrow label="change the server data" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep copies of server data honest" what="After adding to the cart, every component showing the cart must agree. Separate copies drift. A single copy in the page or a store agrees, but only knows what this tab did. A query cache invalidates the cart key and refetches the truth once, for everyone." accent={ACCENT} active={at(4)}>
                <Table rows={STRATEGIES.map((x) => [x.label, `${all[x.id].cartRerenders} re-render${all[x.id].cartRerenders === 1 ? "" : "s"}, ${all[x.id].cartRequests} request${all[x.id].cartRequests === 1 ? "" : "s"}`, all[x.id].staleAfterCart ? `${all[x.id].staleAfterCart} stale` : "none stale", x.id === s])} />
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Counts are from the tree above, with no memoisation. Server state: {SERVER.join(", ")}. Rendering on the server (see the CSR, SSR and SSG session) changes where the first fetch happens, not where state lives afterwards.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Table({ rows }: { rows: [string, string, string, boolean][] }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      {rows.map(([a, b, c, bold]) => (
        <Row key={a} a={a} b={b} c={c} bold={bold} />
      ))}
    </div>
  );
}

function Row({ a, b, c, bold }: { a: string; b: string; c: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span style={{ fontWeight: w }}>{a}</span>
      <span className="text-right font-mono" style={{ fontWeight: w }}>
        {b}
      </span>
      <span className="col-span-2 -mt-0.5 mb-1 font-mono text-[var(--muted)] sm:col-span-1 sm:m-0 sm:text-right" style={{ fontWeight: w }}>
        {c}
      </span>
    </>
  );
}
