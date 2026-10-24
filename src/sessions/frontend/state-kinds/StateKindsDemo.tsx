"use client";

import { Fragment, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DEFAULT_HOMES, GOOD_HOMES, HOMES, PIECES, SCENARIOS, evaluate, type Home, type PieceId, type Scenario } from "@/lib/stateHomes";

const ACCENT = "var(--web)";

const STEP_TEXT: Record<Scenario, { title: string; what: string }> = {
  navigate: { title: "Go to another page and back", what: "Component state dies when the component unmounts. A store or a query cache lives outside components and survives; the URL comes back with the Back button. Open menus should reset; filters and drafts shouldn't." },
  reload: { title: "Reload the page", what: "A reload wipes everything in memory: component state and stores. Server data is simply fetched again. Only the URL and browser storage keep what the person chose." },
  share: { title: "Send the link to a colleague", what: "Only the URL travels. Filters belong in it; a private draft or your own user must not." },
  tab: { title: "Open a second tab", what: "Each tab has its own memory. localStorage is shared across tabs of the same site, and server data is fetched by each tab from the same source." },
  edit: { title: "A colleague edits an order", what: "Server data copied into client state is a snapshot that nothing updates. A query cache knows the data came from the server and refetches it when it's stale, on window focus or when told to." },
};

export default function StateKindsDemo() {
  const [homes, setHomes] = useState<Record<PieceId, Home>>(DEFAULT_HOMES);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const e = evaluate(homes);
  const cell = (p: PieceId, s: Scenario) => e.cells.find((c) => c.piece === p && c.scenario === s)!;
  const bugsIn = (s: Scenario) => e.cells.filter((c) => c.scenario === s && !c.ok);
  const uses = (h: Home) => PIECES.filter((p) => homes[p.id] === h).length;

  const nodes: MapNode[] = [
    { id: "local", label: "Component state", sub: `${uses("local")} piece${uses("local") === 1 ? "" : "s"}`, at: [14, 22], mobileAt: [25, 12], state: uses("local") ? "active" : "dim" },
    { id: "store", label: "Global store", sub: `${uses("store")} piece${uses("store") === 1 ? "" : "s"}`, at: [50, 22], mobileAt: [75, 12], state: uses("store") ? "active" : "dim" },
    { id: "query", label: "Query cache", sub: `${uses("query")} piece${uses("query") === 1 ? "" : "s"}`, at: [86, 22], mobileAt: [75, 45], state: uses("query") ? "active" : "dim" },
    { id: "server", label: "API server", sub: e.handSynced ? `${e.handSynced} copied by hand` : "the source of truth", at: [86, 78], mobileAt: [75, 80], state: e.handSynced ? "wait" : "good" },
    { id: "url", label: "URL", sub: `${uses("url")} piece${uses("url") === 1 ? "" : "s"}`, at: [50, 78], mobileAt: [25, 80], state: uses("url") ? "active" : "dim" },
    { id: "storage", label: "localStorage", sub: `${uses("storage")} piece${uses("storage") === 1 ? "" : "s"}`, at: [14, 78], mobileAt: [25, 45], state: uses("storage") ? "active" : "dim" },
  ];

  const tone = (s: Scenario) => (bugsIn(s).length ? "bad" : "good") as "bad" | "good";
  const packets: Packet[] =
    stage === 0 ? hops("n", ["local", "store"], { label: "unmount", tone: tone("navigate") })
    : stage === 1 ? hops("r", ["url", "local"], { label: "reload", tone: tone("reload") })
    : stage === 2 ? hops("s", ["store", "url"], { label: "link", tone: tone("share") })
    : stage === 3 ? hops("t", ["storage", "local"], { label: "2nd tab", tone: tone("tab") })
    : stage === 4 ? hops("e", ["server", uses("store") && PIECES.some((p) => p.server && homes[p.id] === "store") ? "store" : "query"], { label: "an order changed", tone: tone("edit") })
    : [];

  const captions = SCENARIOS.map((s, i) => {
    const b = bugsIn(s.id);
    return `Step ${i + 1}: ${s.label.toLowerCase()}. ${b.length ? `${b.length} problem${b.length === 1 ? "" : "s"}: ${b[0].bug}.` : "Everything behaves as it should."}`;
  });
  const caption = stage !== null ? captions[stage] : `${e.right} of ${PIECES.length} pieces in the right home · ${e.bugs.length} problem${e.bugs.length === 1 ? "" : "s"} across five everyday moments.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Local, shared and server state"
        blurb="Not all state is the same. Whether a menu is open, who's signed in, the orders from the API, the current filters and a half-written message each want a different home. Pick one for each, then reload, share the link, open a tab and let a colleague change the data."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="State can live in a component, a global store, a query cache backed by the API server, the URL, or localStorage"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "local", to: "store", label: "lift up" },
                  { from: "store", to: "server", label: "copied by hand", dim: !e.handSynced },
                  { from: "query", to: "server", label: "fetch, refetch" },
                  { from: "url", to: "local", label: "read on load" },
                  { from: "storage", to: "local", label: "read on load" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Where each piece of state lives, and how it behaves">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {e.right} of {PIECES.length} right · {e.bugs.length} problems
                </p>
                <ul className="mt-2 space-y-2">
                  {PIECES.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                      <label className="min-w-0 flex-1 text-xs">
                        <span className="block">{p.label}</span>
                        <select value={homes[p.id]} onChange={(ev) => setHomes((h) => ({ ...h, [p.id]: ev.target.value as Home }))} className="mt-1 h-11 w-full max-w-[14rem] rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-sm">
                          {HOMES.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="flex gap-1" aria-label={`${p.label}: results per moment`}>
                        {SCENARIOS.map((s) => {
                          const c = cell(p.id, s.id);
                          return (
                            <span key={s.id} title={`${s.label}: ${c.ok ? (c.want ? "fine" : "doesn't matter") : c.bug}`} className="grid h-6 w-6 place-items-center rounded text-[11px]" style={{ background: c.ok ? (c.want ? "color-mix(in srgb, var(--good) 25%, transparent)" : "var(--inset)") : "color-mix(in srgb, var(--bad) 30%, transparent)" }}>
                              {c.ok ? (c.want ? "✓" : "·") : "✕"}
                            </span>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Columns: navigate, reload, share, second tab, colleague edits. A dot means that moment doesn&apos;t matter for this piece.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setHomes(DEFAULT_HOMES)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All in a store or useState
                </button>
                <button type="button" onClick={() => setHomes(GOOD_HOMES)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Each in its home
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Using the app…">
                Use the app
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              {SCENARIOS.map((s, i) => {
                const b = bugsIn(s.id);
                return (
                  <Fragment key={s.id}>
                  <FlowStep n={i + 1} title={STEP_TEXT[s.id].title} what={STEP_TEXT[s.id].what} accent={ACCENT} active={at(i)}>
                    {b.length === 0 ? (
                      <p className="text-sm text-[var(--good)]">Nothing goes wrong here.</p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {b.map((c) => (
                          <li key={c.piece} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1" style={{ borderColor: "var(--bad)" }}>
                            <span className="font-medium">{PIECES.find((p) => p.id === c.piece)!.label}</span> in {HOMES.find((h) => h.id === homes[c.piece])!.label.toLowerCase()}: {c.bug}
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.id === "edit" && <p className="mt-2 text-[11px] text-[var(--faint)]">Each home&apos;s behaviour is fixed (for example, a store keeps whatever it was given until someone updates it); the pieces&apos; expectations are this session&apos;s. Suggested homes: {PIECES.map((p) => `${p.label.toLowerCase()} → ${HOMES.find((h) => h.id === p.best[0])!.short}`).join(", ")}.</p>}
                  </FlowStep>
                  {i < SCENARIOS.length - 1 && <FlowArrow label={["then reload", "then share", "then a tab", "meanwhile"][i]} accent={ACCENT} active={at(i + 1)} />}
                  </Fragment>
                );
              })}
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

