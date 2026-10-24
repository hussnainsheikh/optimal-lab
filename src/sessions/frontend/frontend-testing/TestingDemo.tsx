"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BUG_LIST, LAYERED, NO_BUGS, UNIT_ONLY, runSuite, type Bugs, type Level, type Opts } from "@/lib/frontendTesting";

const ACCENT = "var(--web)";
const ALL_BUGS = Object.fromEntries(BUG_LIST.map((b) => [b.id, true])) as Bugs;
const dur = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
const LEVEL_LABEL: Record<Level, string> = { unit: "Unit", component: "Component", e2e: "End-to-end" };

export default function TestingDemo() {
  const [bugs, setBugs] = useState<Bugs>(ALL_BUGS);
  const [o, setO] = useState<Opts>(UNIT_ONLY);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const s = runSuite(bugs, o);
  const on = BUG_LIST.filter((b) => bugs[b.id]).length;
  const failsAt = (l: Level) => s.results.filter((r) => r.ran && r.test.level === l && r.failure).length;
  const ranAt = (l: Level) => s.results.filter((r) => r.ran && r.test.level === l).length;

  const nodes: MapNode[] = [
    { id: "app", label: "Checkout code", sub: `${on} bug${on === 1 ? "" : "s"} in it`, at: [14, 22], mobileAt: [25, 12], state: on ? "bad" : "good" },
    { id: "unit", label: "Unit tests", sub: o.unit ? `${failsAt("unit")} of ${ranAt("unit")} fail` : "not run", at: [50, 22], mobileAt: [75, 12], state: !o.unit ? "dim" : failsAt("unit") ? "wait" : "good" },
    { id: "component", label: "Component tests", sub: o.component ? `${failsAt("component")} of ${ranAt("component")} fail` : "not run", at: [86, 22], mobileAt: [75, 45], state: !o.component ? "dim" : failsAt("component") ? "wait" : "good" },
    { id: "e2e", label: "Browser (E2E)", sub: o.e2e ? `${failsAt("e2e")} of ${ranAt("e2e")} fail` : "not run", at: [86, 78], mobileAt: [75, 80], state: !o.e2e ? "dim" : failsAt("e2e") ? "wait" : "good" },
    { id: "api", label: "API server", sub: bugs.contract ? "renamed a field" : "as expected", at: [50, 78], mobileAt: [25, 80], state: bugs.contract ? "bad" : "good" },
    { id: "prod", label: "Customers", sub: s.escaped.length ? `${s.escaped.length} bug${s.escaped.length === 1 ? "" : "s"} reach them` : "nothing reaches them", at: [14, 78], mobileAt: [25, 45], state: s.escaped.length ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("b", ["app", "prod"], { label: `${on} bugs`, tone: on ? "bad" : "good" })
    : stage === 1 ? (o.unit ? hops("u", ["app", "unit"], { label: "call functions" }) : [])
    : stage === 2 ? (o.component ? hops("c", ["app", "component"], { label: "render, API mocked" }) : [])
    : stage === 3 ? (o.e2e ? hops("e", ["e2e", "app", "api"], { label: o.mobile ? "desktop + 390px" : "desktop" }) : [])
    : stage === 4 ? hops("p", ["app", "prod"], { label: s.escaped.length ? `${s.escaped.length} escaped` : "all caught", tone: s.escaped.length ? "bad" : "good" })
    : [];

  const levelCaption = (l: Level, flag: boolean) => (flag ? `${failsAt(l)} of ${ranAt(l)} ${LEVEL_LABEL[l].toLowerCase()} tests fail.` : `no ${LEVEL_LABEL[l].toLowerCase()} tests run.`);
  const captions = [
    `Step 1: the checkout has ${on} bug${on === 1 ? "" : "s"} switched on.`,
    `Step 2: ${levelCaption("unit", o.unit)}`,
    `Step 3: ${levelCaption("component", o.component)}`,
    `Step 4: ${levelCaption("e2e", o.e2e)}`,
    s.escaped.length ? `Step 5: ${s.escaped.map((e) => e.bug.label.toLowerCase()).join(", ")} ${s.escaped.length === 1 ? "gets" : "get"} past every test, in ${dur(s.ms)} of testing.` : `Step 5: every bug is caught, in ${dur(s.ms)} of testing.`,
  ];
  const caption = stage !== null ? captions[stage] : `${on - s.escaped.length} of ${on} bugs caught · ${dur(s.ms)} of tests.`;

  const results = (l: Level) => (
    <ul className="space-y-0.5 text-[11px]">
      {s.results
        .filter((r) => r.test.level === l)
        .map((r) => (
          <li key={r.test.id} style={{ color: !r.ran ? "var(--faint)" : r.failure ? "var(--bad)" : "var(--good)" }}>
            {!r.ran ? "–" : r.failure ? "✕" : "✓"} {r.test.name} <span className="text-[var(--faint)]">{r.test.ms >= 1000 ? `${(r.test.ms / 1000).toFixed(1)} s` : `${r.test.ms} ms`}</span>
            {r.failure && <span className="block pl-3 font-mono text-[10px]">{r.failure}</span>}
          </li>
        ))}
    </ul>
  );

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Testing components and flows"
        blurb="Unit tests are fast and pinpoint the broken function. Component tests check what a person sees and clicks, with the network faked. End-to-end tests drive a real browser against the real server: slow, but the only kind that sees a renamed API field or a button hidden on phones. Plant bugs in a checkout and see which tests catch them."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Unit and component tests check the checkout code; end-to-end tests drive a browser against the API server; what isn't caught reaches customers"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "unit", label: "functions", dim: !o.unit },
                  { from: "unit", to: "component", label: "then", dim: !o.component },
                  { from: "e2e", to: "app", label: "clicks", dim: !o.e2e },
                  { from: "app", to: "api", label: "fetch" },
                  { from: "app", to: "prod", label: "deploy" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Which tests caught each bug">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {on - s.escaped.length} of {on} bugs caught · {dur(s.ms)}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {s.caught.map((c) => (
                    <li key={c.bug.id} className="flex flex-wrap justify-between gap-x-2">
                      <span>{c.bug.label}</span>
                      <span style={{ color: c.caughtBy.length ? "var(--good)" : "var(--bad)" }}>{c.caughtBy.length ? c.caughtBy.map((l) => LEVEL_LABEL[l]).join(", ") : "escapes"}</span>
                    </li>
                  ))}
                  {s.caught.length === 0 && <li className="text-[var(--faint)]">No bugs switched on.</li>}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(UNIT_ONLY)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Unit tests only
                </button>
                <button type="button" onClick={() => setO(LAYERED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Every level
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Testing…">
                Run the tests
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Break the checkout" what="Five real kinds of bug: a calculation, a lost check, a server that changed its API, a CSS rule, and a race between two clicks." accent={ACCENT} active={at(0)}>
                <div className="space-y-0.5">
                  {BUG_LIST.map((b) => (
                    <label key={b.id} className="flex min-h-11 items-start gap-2 py-1 text-sm">
                      <input type="checkbox" checked={bugs[b.id]} onChange={(e) => setBugs((c) => ({ ...c, [b.id]: e.target.checked }))} className="mt-1 h-4 w-4" style={{ accentColor: ACCENT }} />
                      <span>
                        {b.label}
                        <span className="block text-[11px] text-[var(--faint)]">{b.what}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => setBugs(NO_BUGS)} className="mt-1 min-h-11 rounded-md border border-[var(--line)] px-3 text-xs text-[var(--muted)]">
                  Remove every bug
                </button>
              </FlowStep>
              <FlowArrow label="milliseconds" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Unit tests: call the functions" what="Fast and precise: they say exactly which function is wrong. They only see what you hand them, so a fixture written against the old API keeps passing after the server changes." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.unit} onChange={(e) => set({ unit: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Run unit tests
                </label>
                {results("unit")}
              </FlowStep>
              <FlowArrow label="tens of ms" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Component tests: render and click" what="Render the checkout in a simulated DOM, find things the way a person would (the Pay button) and click. They catch broken behaviour and lost checks, but there's no real layout and the API is mocked." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.component} onChange={(e) => set({ component: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Run component tests
                </label>
                {results("component")}
              </FlowStep>
              <FlowArrow label="seconds" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="End-to-end tests: a real browser, a real server" what="Drive the built app in a browser against a real backend. Slow and occasionally flaky, so keep them to the flows that matter. They're the only level here that sees the renamed field, and only a run at phone width sees the hidden button." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.e2e} onChange={(e) => set({ e2e: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Run end-to-end tests
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.mobile} disabled={!o.e2e} onChange={(e) => set({ mobile: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Also at a 390px phone width
                </label>
                {results("e2e")}
              </FlowStep>
              <FlowArrow label="deploy" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="See what got through" what="No single level catches everything. Many cheap unit and component tests, plus a few end-to-end tests for the money paths, catch the most for the time spent." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: s.escaped.length ? "var(--bad)" : "var(--good)" }}>
                  {s.escaped.length ? `${s.escaped.length} bug${s.escaped.length === 1 ? "" : "s"} reach customers` : "nothing reaches customers"} · {dur(s.ms)} per run
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Every test really runs its assertions against the checkout code with the chosen bugs; each bug is attributed by running the suite with only that bug on. Run times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
