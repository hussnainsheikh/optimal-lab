"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { HOURS, LEAK, LEAKS, LIMIT_MB, diff, fmtMB, fmtMin, graph, mark, minutesToOom, series, type Leak, type Series, type Verdict } from "@/lib/memoryLeaks";

const ACCENT = "var(--os)";
const delta = (kb: number) => {
  const mb = Math.abs(kb / 1024);
  return `${kb >= 0 ? "+" : "−"}${mb < 10 ? mb.toFixed(1) : Math.round(mb).toLocaleString("en-US")} MB`;
};
const VERDICT_COLOR: Record<Verdict, string> = { root: "var(--c1)", "in use": "var(--muted)", "still reachable": "var(--bad)", "definitely lost": "var(--bad)", garbage: "var(--good)" };

function Chart({ s, label }: { s: Series; label: string }) {
  const W = 600, H = 180, top = LIMIT_MB * 1.05;
  const x = (min: number) => (min / (HOURS * 60)) * W;
  const y = (mb: number) => H - (mb / top) * H;
  const pts = s.samples;
  const band = [...pts.map((p) => `${x(p.min)},${y(p.high)}`), ...[...pts].reverse().map((p) => `${x(p.min)},${y(p.low)}`)].join(" ");
  const floor = pts.map((p) => `${x(p.min)},${y(p.low)}`).join(" ");
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
          <rect x="0" y="0" width={W} height={H} fill="var(--inset)" />
          {[2, 4, 6].map((h) => (
            <line key={h} x1={x(h * 60)} x2={x(h * 60)} y1="0" y2={H} stroke="var(--line)" />
          ))}
          <line x1="0" x2={W} y1={y(LIMIT_MB)} y2={y(LIMIT_MB)} stroke="var(--bad)" strokeDasharray="6 4" strokeWidth="1.5" />
          <polygon points={band} fill={`color-mix(in srgb, ${ACCENT} 22%, transparent)`} />
          <polyline points={floor} fill="none" stroke={ACCENT} strokeWidth="2.5" />
          {pts.filter((p) => p.restart).map((p) => (
            <circle key={p.min} cx={x(p.min)} cy={y(LIMIT_MB)} r="5" fill="var(--bad)" />
          ))}
        </svg>
        <span className="absolute left-1 top-0 font-mono text-[10px] text-[var(--bad)]">1 GB limit</span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
        <span>0 h</span><span>2 h</span><span>4 h</span><span>6 h</span><span>8 h</span>
      </div>
    </div>
  );
}

export default function MemoryLeaksDemo() {
  const [leak, setLeak] = useState<Leak>("cache");
  const [rps, setRps] = useState(50);
  const [fixed, setFixed] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const L = LEAK[leak];
  const s = series(leak, rps, fixed);
  const asWritten = series(leak, rps, false);
  const oom = minutesToOom(leak, rps);
  const b = oom !== null && oom < 150 ? Math.max(4, Math.round(oom * 0.8)) : 120;
  const a = Math.max(2, Math.round(b / 2));
  const rows = diff(leak, rps, a, b);
  const g = mark(graph(leak), L.gc);
  const culprit = g.find((n) => n.verdict === "still reachable" && n.path.length) ?? g.find((n) => n.verdict === "definitely lost");
  const leaking = leak !== "none" && !fixed;
  const last = s.samples[s.samples.length - 1];

  const choose = (l: Leak) => {
    setLeak(l);
    setFixed(false);
  };

  const nodes: MapNode[] = [
    { id: "traffic", label: "Requests", sub: `${rps} per second`, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "svc", label: "Service", sub: L.gc ? "garbage-collected" : "native, malloc/free", at: [43, 25], mobileAt: [28, 42], state: on(0) || on(1) ? "active" : "idle" },
    { id: "heap", label: "Heap", sub: `live ${fmtMB(last.live)} after 8 h`, at: [78, 25], mobileAt: [72, 42], state: leaking ? "bad" : "good" },
    { id: "prof", label: "Profiler", sub: L.gc ? "heap snapshots" : "heaptrack / LSan", at: [43, 78], mobileAt: [28, 82], state: on(2) || on(3) ? "active" : "idle" },
    { id: "oom", label: "Memory limit", sub: s.restarts ? `${s.restarts} OOM kill${s.restarts === 1 ? "" : "s"}` : "1 GB, never hit", at: [78, 78], mobileAt: [72, 82], state: s.restarts ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["traffic", "svc", "heap"], { label: "allocate" })
    : stage === 1 ? hops("b", ["svc", "heap"], { label: L.gc ? "collect" : "free()", tone: leaking ? "bad" : "good" })
    : stage === 2 ? hops("c", ["heap", "prof"], { label: "snapshot × 2" })
    : stage === 3 ? hops("d", ["prof", "heap"], { label: culprit ? "who holds it?" : "nothing held" })
    : stage === 4 ? hops("e", ["heap", "oom"], { label: s.restarts ? "OOM kill" : "under limit", tone: s.restarts ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${rps} requests a second, each making short-lived objects. ${L.label}.`,
    leaking ? `Step 2: the floor after each collection climbs ${fmtMB(s.mbPerHour)} an hour: that's the leak, not the garbage.` : "Step 2: the floor after each collection is flat: memory swings, but nothing accumulates.",
    `Step 3: two snapshots ${fmtMin(a)} and ${fmtMin(b)} after start. ${leak === "none" ? "Nothing grows between them." : `${rows[0].what} grew by ${(rows[0].countB - rows[0].countA).toLocaleString("en-US")}.`}`,
    culprit ? (culprit.verdict === "definitely lost" ? `Step 4: no pointer reaches “${culprit.label}” at all: definitely lost.` : `Step 4: ${culprit.path.map((id) => g.find((n) => n.id === id)?.label).join(" → ")} keeps it alive.`) : "Step 4: everything unreachable is collected; nothing is wrongly held.",
    s.restarts ? `Step 5: the container hits 1 GB and is killed ${s.restarts} time${s.restarts === 1 ? "" : "s"} in 8 hours.` : fixed && leak !== "none" ? "Step 5: fixed. The floor levels off and the limit is never hit." : "Step 5: memory stays under the limit for all 8 hours.",
  ];
  const caption = stage !== null ? captions[stage] : `${L.label} at ${rps} req/s: ${s.restarts ? `first OOM kill after ${fmtMin(oom ?? 0)}, ${s.restarts} in 8 hours.` : fixed && leak !== "none" ? "fixed, the floor is flat." : leak === "none" ? "memory swings but the floor is flat." : `the floor climbs ${fmtMB(s.mbPerHour)} an hour.`}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Memory leaks"
        blurb="A leak is memory a program keeps but will never use again. It doesn't crash anything at first: the service just gets a little bigger every hour until the kernel kills it. Even garbage-collected languages leak, because a collector can only free what nothing points to. Pick a leak, find it, fix it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Requests allocate memory in a service's heap; a profiler takes snapshots; the container's memory limit kills it when the heap grows too large"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "traffic", to: "svc", label: "requests" },
                  { from: "svc", to: "heap", label: "allocate" },
                  { from: "heap", to: "prof", label: "snapshot" },
                  { from: "heap", to: "oom", label: "cgroup limit" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Memory over 8 hours">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Memory over 8 hours {fixed && leak !== "none" ? "· fixed" : ""}</p>
                <div className="mt-2">
                  <Chart s={s} label={`Memory over 8 hours: ${s.restarts ? `${s.restarts} OOM kills` : "never reaches the limit"}`} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: ACCENT }} />floor: memory right after a collection</span>
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: `color-mix(in srgb, ${ACCENT} 22%, transparent)` }} />garbage between collections</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--bad)" }} />OOM kill and restart</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => choose("listener")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Forgotten listener
                </button>
                <button type="button" onClick={() => choose("native")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Missing free()
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Hunting…">
                Hunt the leak
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Watch memory over hours" what="A leak is slow. Each request leaves a few kilobytes behind, so you only see it over hours, as a service that needs restarting every night or a pod that keeps getting OOM-killed." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Leak> accent={ACCENT} value={leak} onChange={choose} options={LEAKS.map((id) => ({ id, label: LEAK[id].label }))} />
                  <p className="text-xs text-[var(--muted)]">{L.blurb}</p>
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{L.code}</pre>
                  <Slider label="Traffic" value={rps} min={10} max={200} step={10} format={(v) => `${v} req/s`} onChange={setRps} accent={ACCENT} />
                </div>
              </FlowStep>
              <FlowArrow label="a memory graph" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Look at the floor, not the peaks" what={L.gc ? "Memory always swings: garbage piles up and the collector clears it, letting the heap grow to about twice the live data first. Only the level right after a collection, the live data, tells you about a leak. A rising floor is a leak." : "Native code has no collector, so memory in use is the live data plus what's in flight. If it only ever goes up under steady traffic, something isn't being freed."} accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <p><span className="block text-[var(--faint)]">Floor grows</span><span className="font-mono" style={{ color: asWritten.mbPerHour ? "var(--bad)" : "var(--good)" }}>{fmtMB(asWritten.mbPerHour)}/h</span></p>
                    <p><span className="block text-[var(--faint)]">First OOM kill</span><span className="font-mono">{oom === null ? "never" : fmtMin(oom)}</span></p>
                    <p><span className="block text-[var(--faint)]">Kills in 8 h</span><span className="font-mono">{asWritten.restarts}</span></p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Each restart frees everything, so the graph looks like a saw. Restarting on a schedule hides the leak; it doesn&rsquo;t fix it.</p>
                </div>
              </FlowStep>
              <FlowArrow label="two points in time" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Diff two heap snapshots" what={L.gc ? "A heap snapshot lists every live object by type, taken right after a forced collection so garbage isn't counted. Take two some time apart and sort by growth: steady types stay flat, the leak grows with traffic." : "Native tools record the call stack of every malloc that hasn't been freed. Group by allocation site and sort by growth: the leaking site keeps climbing."} accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">{L.gc ? "Object type" : "Allocation site"}</th>
                          <th className="py-1 pr-2 text-right font-normal">Count at {fmtMin(a)} → {fmtMin(b)}</th>
                          <th className="py-1 text-right font-normal">Size growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.what} className="border-t border-[var(--line)]" style={{ color: r.leak ? "var(--bad)" : "var(--muted)" }}>
                            <td className="py-1 pr-2 font-mono">{r.what}</td>
                            <td className="py-1 pr-2 text-right font-mono">{r.countA.toLocaleString("en-US")} → {r.countB.toLocaleString("en-US")}</td>
                            <td className="py-1 text-right font-mono">{delta(r.kbB - r.kbA)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="the growing type" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Find what still points at it" what={L.gc ? "A collector marks everything reachable from the roots (globals and the stacks) and frees the rest. So a leak in a collected language is always still reachable: something holds a reference. The retainer path shows what." : "A leak checker (LeakSanitizer, Valgrind) does the same mark from the roots at exit. A block that nothing points to is “definitely lost”: the pointer went out of scope without a free()."} accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <ul className="space-y-1 text-xs">
                    {g.filter((n) => !n.root).map((n) => (
                      <li key={n.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono">{n.label}</span>
                        <span className="rounded px-1.5 text-[11px]" style={{ color: VERDICT_COLOR[n.verdict], border: `1px solid ${VERDICT_COLOR[n.verdict]}` }}>{n.verdict}</span>
                        {n.path.length > 0 && <span className="text-[11px] text-[var(--faint)]">{n.path.map((id) => g.find((x) => x.id === id)?.label).join(" → ")}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-[var(--muted)]">
                    {leak === "none" ? "The old cart is unreachable, so it's garbage: collected on the next cycle, not a leak." : L.gc ? "The request finished long ago, but a long-lived object still points at its data." : "Unreachable in native code means lost for good: nothing will ever free it."}
                  </p>
                </div>
              </FlowStep>
              <FlowArrow label="the fix" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Fix it, then watch the floor again" what="Drop the reference or free the block, then check the same graph. The floor should go flat, or level off at a bound you chose." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Choices<"as" | "fixed"> accent={ACCENT} value={fixed ? "fixed" : "as"} onChange={(v) => setFixed(v === "fixed")} options={[{ id: "as", label: "As written" }, { id: "fixed", label: "Fixed" }]} />
                  <p className="text-sm">{L.fix}</p>
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{L.fixCode}</pre>
                  <p className="font-mono text-xs" style={{ color: s.restarts ? "var(--bad)" : "var(--good)" }}>
                    {s.restarts ? `${s.restarts} OOM kill${s.restarts === 1 ? "" : "s"} in 8 hours` : s.plateau ? `levels off at ${fmtMB(s.plateau)} of live data · no OOM kills` : "flat floor · no OOM kills"}
                  </p>
                  <p className="text-[11px] text-[var(--faint)]">Rates, sizes and the 1 GB limit are illustrative. The pacing (heap grows to 2× the live data before a collection, as with Go&rsquo;s GOGC=100) and the reachability marking are how collectors and leak checkers really work.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
