"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type NodeState, type Packet } from "@/components/system/SystemMap";
import { ALL_LOAD, DIRECTIVES, ISLANDS, RUNTIME_KB, T, TUNED, WHOLE, WHOLE_PAGE_KB, run as simulate, type Directive, type Opts } from "@/lib/islandsHydration";

const ACCENT = "var(--web)";
const OUTCOME = { works: { label: "works", color: "var(--good)" }, plain: { label: "works as plain HTML", color: "var(--good)" }, dead: { label: "nothing happens", color: "var(--bad)" } } as const;
const POS: Record<string, { at: [number, number]; mobileAt: [number, number] }> = {
  search: { at: [50, 22], mobileAt: [75, 12] },
  theme: { at: [86, 22], mobileAt: [75, 45] },
  copy: { at: [86, 78], mobileAt: [75, 80] },
  newsletter: { at: [50, 78], mobileAt: [25, 80] },
  comments: { at: [14, 78], mobileAt: [25, 45] },
};

export default function IslandsDemo() {
  const [o, setO] = useState<Opts>(ALL_LOAD);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = simulate(o);
  const whole = o.mode === "whole";
  const setDirective = (id: string, d: Directive) => setO((c) => ({ ...c, mode: "islands", directive: { ...c.directive, [id]: d } }));
  const withDirective = (d: Directive) => r.rows.filter((x) => !whole && o.directive[x.island.id] === d);
  const stateOf = (id: string): NodeState => {
    const row = r.rows.find((x) => x.island.id === id)!;
    return row.outcome === "dead" ? "bad" : row.outcome === "plain" ? "dim" : "good";
  };

  const nodes: MapNode[] = [
    { id: "page", label: "Static HTML", sub: whole ? `+ ${WHOLE_PAGE_KB} KB to hydrate it all` : `+ ${r.jsAtLoad} KB at load`, at: [14, 22], mobileAt: [25, 12], state: r.jsAtLoad > 100 ? "bad" : "good" },
    ...ISLANDS.map((i) => {
      const row = r.rows.find((x) => x.island.id === i.id)!;
      return { id: i.id, label: i.label, sub: whole ? `hydrated at ${row.ready} ms` : row.ready === null ? "no JavaScript" : `${o.directive[i.id]} · ready ${row.ready} ms`, ...POS[i.id], state: stateOf(i.id) };
    }),
  ];

  const step = (d: Directive) => withDirective(d).map((x) => x.island.id);
  const packetsFor = (ids: string[], label: string, tone: "accent" | "good" | "bad" = "accent"): Packet[] => (ids.length ? hops(`p-${label}`, ["page", ids[0]], { label, tone }) : []);
  const packets: Packet[] =
    stage === 0 ? hops("h", ["page", "search"], { label: whole ? "HTML + whole app" : "HTML" })
    : stage === 1 ? (whole ? hops("w", ["page", "comments"], { label: `${WHOLE_PAGE_KB} KB`, tone: "bad" }) : packetsFor(step("load"), "client:load"))
    : stage === 2 ? packetsFor(step("idle"), "client:idle", "good")
    : stage === 3 ? packetsFor(step("visible"), "client:visible", "good")
    : stage === 4 ? packetsFor(step("none"), "plain HTML", r.dead ? "bad" : "good")
    : [];

  const names = (d: Directive) => withDirective(d).map((x) => x.island.label.toLowerCase()).join(", ") || "nothing";
  const captions = [
    whole ? `Step 1: the page arrives as HTML at ${T.html} ms, and then the whole page is hydrated as one app.` : `Step 1: the page arrives as finished HTML at ${T.html} ms. It's readable now; only the islands need JavaScript.`,
    whole ? `Step 2: ${WHOLE_PAGE_KB} KB of JavaScript hydrates every component, interactive or not, before anything responds: ready at ${r.interactiveTop} ms.` : `Step 2: client:load hydrates ${names("load")} straight away: ${r.jsAtLoad} KB, ${r.mainThreadAtLoad} ms of main-thread work.`,
    whole ? "Step 3: there's nothing left to schedule: it all happened at load." : `Step 3: client:idle waits until the page has settled (${T.idle} ms) for ${names("idle")}.`,
    whole ? "Step 4: comments at the bottom were hydrated at load too, whether anyone scrolls there or not." : `Step 4: client:visible loads ${names("visible")} only when scrolled into view.`,
    r.dead ? `Step 5: ${r.dead} interaction${r.dead === 1 ? "" : "s"} found no JavaScript and no working HTML fallback.` : "Step 5: every interaction worked, with JavaScript or as plain HTML.",
  ];
  const caption = stage !== null ? captions[stage] : `${r.jsAtLoad} KB at load, ${r.jsTotal} KB in total · search ready at ${r.interactiveTop} ms · ${r.dead} dead click${r.dead === 1 ? "" : "s"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Islands and partial hydration"
        blurb="Most of a blog post is text that never changes. With islands, the page is plain HTML and only the interactive parts load JavaScript, each when it's needed: at once, when the browser is idle, or when it scrolls into view. A reader scrolls and clicks on a fixed schedule; see which clicks work."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A static HTML page hosts five interactive islands that each load their own JavaScript: search, a theme switch, copy-code buttons, a newsletter form and comments"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={ISLANDS.map((i) => ({ from: "page", to: i.id, label: whole ? "hydrate" : o.directive[i.id] === "none" ? "HTML only" : `client:${o.directive[i.id]}`, dim: !whole && o.directive[i.id] === "none" }))}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Each island, when it's ready, and what the reader's click does">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {whole ? "one hydrated app" : "islands"} · {r.jsAtLoad} KB at load · {r.jsTotal} KB total
                </p>
                <ul className="mt-2 space-y-2">
                  {r.rows.map((row) => (
                    <li key={row.island.id} className="rounded-md bg-[var(--inset)] p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {row.island.label} <span className="font-mono text-[10px] text-[var(--faint)]">{row.island.kb} KB · {row.island.y}</span>
                        </span>
                        <select aria-label={`When ${row.island.label} loads`} value={o.directive[row.island.id]} disabled={whole} onChange={(e) => setDirective(row.island.id, e.target.value as Directive)} className="h-11 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-xs">
                          {DIRECTIVES.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.astro}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">
                        Ready {row.ready === null ? "never (no JS)" : `at ${row.ready} ms`} · at {row.island.click} ms the reader {row.island.action}: <span style={{ color: OUTCOME[row.outcome].color }}>{OUTCOME[row.outcome].label}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The page" accent={ACCENT} value={o.mode} onChange={(m) => setO((c) => ({ ...c, mode: m }))} options={[{ id: "whole", label: "One hydrated app" }, { id: "islands", label: "Islands" }]} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(ALL_LOAD)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Every island at load
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Each when needed
                </button>
                <button type="button" onClick={() => setO(WHOLE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Whole app
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Reading…">
                Read the post
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send the page as HTML" what="The server renders the whole post to HTML. Text, images and links work at once. A fully hydrated app then runs every component again in the browser to attach handlers, even the ones that never change." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs text-[var(--muted)]">
                  whole app: {WHOLE_PAGE_KB} KB · islands: {r.jsTotal} KB including a {RUNTIME_KB} KB shared runtime
                </p>
              </FlowStep>
              <FlowArrow label="client:load" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Hydrate what's used right away" what="client:load fetches and hydrates an island immediately. Keep it for what people reach for in the first seconds, like search: everything here competes for the network and the main thread at the worst moment." accent={ACCENT} active={at(1)}>
                <IslandList rows={withDirective("load")} empty="No island loads at once." />
                <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">main thread at load: {r.mainThreadAtLoad} ms of hydration</p>
              </FlowStep>
              <FlowArrow label="client:idle" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Defer the rest until idle" what="client:idle waits for the page to finish loading and the browser to be idle (requestIdleCallback), so it doesn't slow the first paint or the first interaction." accent={ACCENT} active={at(2)}>
                <IslandList rows={withDirective("idle")} empty="No island waits for idle." />
              </FlowStep>
              <FlowArrow label="client:visible" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Load what's below the fold when it's seen" what={`client:visible uses an IntersectionObserver: the code downloads only when the island scrolls into view. Here the reader reaches the middle at ${T.scrollMiddle} ms and the bottom at ${T.scrollBottom} ms, so the island has to be ready before the first click there.`} accent={ACCENT} active={at(3)}>
                <IslandList rows={withDirective("visible")} empty="No island waits to be visible." />
              </FlowStep>
              <FlowArrow label="no JavaScript" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Make it work without JavaScript first" what="A newsletter form that's a real <form method=post> and a search that's a GET form work as plain HTML, and JavaScript improves them when it arrives. A copy button or theme switch can't, so they need their island." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.enhance} onChange={(e) => setO((c) => ({ ...c, enhance: e.target.checked }))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Real forms and links underneath (progressive enhancement)
                </label>
                <IslandList rows={withDirective("none")} empty="Every island ships JavaScript." />
                <p className="mt-2 text-[11px] text-[var(--faint)]">Directives are Astro&apos;s names; other island frameworks have the same choices. Downloads that start together share the bandwidth and hydrations queue on one main thread; sizes and times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function IslandList({ rows, empty }: { rows: ReturnType<typeof simulate>["rows"]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-[var(--faint)]">{empty}</p>;
  return (
    <ul className="space-y-0.5 text-xs">
      {rows.map((row) => (
        <li key={row.island.id} className="flex flex-wrap justify-between gap-x-2">
          <span>{row.island.label}</span>
          <span style={{ color: OUTCOME[row.outcome].color }}>{row.ready === null ? "no JS" : `ready ${row.ready} ms`} · {OUTCOME[row.outcome].label}</span>
        </li>
      ))}
    </ul>
  );
}
