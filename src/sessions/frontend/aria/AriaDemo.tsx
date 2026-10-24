"use client";

import { Fragment, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { USERS, WIDGETS, judge, type User } from "@/lib/ariaWidgets";

const ACCENT = "var(--web)";
const FIRST = Object.fromEntries(WIDGETS.map((w) => [w.id, w.variants[0].id])) as Record<string, string>;
const BEST = Object.fromEntries(WIDGETS.map((w) => [w.id, w.variants[w.variants.length - 1].id])) as Record<string, string>;
const MARK = { ok: "✓", bad: "✕", warn: "!" } as const;
const COLOR = { ok: "var(--good)", bad: "var(--bad)", warn: "var(--muted)" } as const;
const USER_POS: Record<User, { at: [number, number]; mobileAt: [number, number] }> = {
  mouse: { at: [86, 22], mobileAt: [75, 45] },
  keyboard: { at: [86, 78], mobileAt: [75, 80] },
  screenReader: { at: [50, 78], mobileAt: [25, 80] },
  voice: { at: [14, 78], mobileAt: [25, 45] },
};

export default function AriaDemo() {
  const [pick, setPick] = useState<Record<string, string>>(FIRST);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const judged = WIDGETS.map((w) => {
    const v = w.variants.find((x) => x.id === pick[w.id])!;
    return { w, v, ...judge(v) };
  });
  const failsFor = (u: User) => judged.filter((j) => j.results.find((r) => r.user === u)!.ok === "bad").length;
  const problems = judged.reduce((a, j) => a + j.results.filter((r) => r.ok !== "ok").length, 0);
  const widgetsWithProblems = judged.filter((j) => j.results.some((r) => r.ok !== "ok")).length;
  const axeCaught = judged.filter((j) => j.axe.length).length;

  const nodes: MapNode[] = [
    { id: "markup", label: "Your markup", sub: `${WIDGETS.length} widgets`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "tree", label: "Accessibility tree", sub: `${widgetsWithProblems} widget${widgetsWithProblems === 1 ? "" : "s"} with problems`, at: [50, 22], mobileAt: [75, 12], state: widgetsWithProblems ? "bad" : "good" },
    ...USERS.map((u) => ({ id: u.id, label: u.label, sub: failsFor(u.id) ? `${failsFor(u.id)} blocked` : "all fine", ...USER_POS[u.id], state: (failsFor(u.id) ? "bad" : "good") as "bad" | "good" })),
  ];

  const packetsFor = (i: number): Packet[] => {
    const j = judged[i];
    const bad = j.results.find((r) => r.ok === "bad");
    return hops(`w${i}`, ["markup", "tree", bad ? bad.user : "screenReader"], { label: j.w.label.replace(/^An? /, ""), tone: bad ? "bad" : "good" });
  };
  const packets: Packet[] = stage !== null ? packetsFor(stage) : [];

  const captions = judged.map((j, i) => {
    const bad = j.results.filter((r) => r.ok === "bad");
    return `Step ${i + 1}: ${j.w.label.toLowerCase()} as ${j.v.label}: ${bad.length ? `${bad.map((r) => USERS.find((u) => u.id === r.user)!.label.toLowerCase()).join(" and ")} users are blocked` : "works for everyone"}${j.axe.length ? `; axe reports ${j.axe.join(", ")}` : bad.length ? "; no automated rule catches it" : ""}.`;
  });
  const caption = stage !== null ? captions[stage] : `${widgetsWithProblems} of ${WIDGETS.length} widgets have problems · an automated scan flags ${axeCaught}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="ARIA"
        blurb="ARIA attributes change what assistive technology is told: roles, names, states and live updates. They don't add behaviour. Used to fill a gap native HTML can't, ARIA helps. Used instead of native HTML, it promises things the page doesn't do. Try each widget written several ways and see who it works for."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Your markup becomes the accessibility tree, which mouse, keyboard, screen reader and voice control users each rely on differently"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "markup", to: "tree", label: "roles, names, states" },
                  ...USERS.map((u) => ({ from: "tree", to: u.id, label: u.id === "mouse" ? "pixels and clicks" : u.id === "keyboard" ? "focus" : u.id === "voice" ? "names" : "speech" })),
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Which users each widget works for">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {problems} problem{problems === 1 ? "" : "s"} · scanner flags {axeCaught} of {widgetsWithProblems} widgets
                </p>
                <table className="mt-2 w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[var(--faint)]">
                      <th className="text-left font-normal">Widget</th>
                      {USERS.map((u) => (
                        <th key={u.id} className="w-10 font-normal" title={u.label}>
                          {u.label.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {judged.map((j) => (
                      <tr key={j.w.id} className="border-t border-[var(--line)]">
                        <td className="py-1 pr-1">
                          {j.w.label.replace(/^An? /, "")}
                          <span className="block font-mono text-[10px] text-[var(--faint)]">{j.v.label}</span>
                        </td>
                        {USERS.map((u) => {
                          const r = j.results.find((x) => x.user === u.id)!;
                          return (
                            <td key={u.id} className="text-center" title={r.why} style={{ color: COLOR[r.ok] }}>
                              {MARK[r.ok]}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setPick(FIRST)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  ARIA everywhere
                </button>
                <button type="button" onClick={() => setPick(BEST)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Native first, ARIA for the gaps
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Testing…">
                Test every widget
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              {judged.map((j, i) => (
                <Fragment key={j.w.id}>
                  <FlowStep n={i + 1} title={j.w.label} what={j.w.what} accent={ACCENT} active={at(i)}>
                    <Choices accent={ACCENT} value={pick[j.w.id]} onChange={(v) => setPick((p) => ({ ...p, [j.w.id]: v }))} options={j.w.variants.map((v) => ({ id: v.id, label: v.label }))} />
                    <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{j.v.code}</pre>
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {j.results.map((r) => (
                        <li key={r.user} style={{ color: COLOR[r.ok] }}>
                          {MARK[r.ok]} {USERS.find((u) => u.id === r.user)!.label}: <span className="text-[var(--muted)]">{r.why}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">axe-core: {j.axe.length ? j.axe.join(", ") : "no violations reported"}</p>
                    {i === judged.length - 1 && <p className="mt-2 text-[11px] text-[var(--faint)]">Outcomes follow from each variant&apos;s role, focusability, key handling, accessible name, exposed state, aria-hidden and live region; rule ids are axe-core&apos;s.</p>}
                  </FlowStep>
                  {i < judged.length - 1 && <FlowArrow label="next widget" accent={ACCENT} active={at(i + 1)} />}
                </Fragment>
              ))}
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
