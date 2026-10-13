"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { simulate, STRATEGIES, type Strategy } from "@/lib/branching";

const ACCENT = "var(--ops)";

export default function BranchingDemo() {
  const [s, setS] = useState<Strategy>("trunk");
  const r = simulate(s);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Branching strategies" blurb="Three developers work for two weeks. The longer their work stays on separate branches, the further it drifts from everyone else's, and the more painful merging gets. Numbers are illustrative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Branches and merges">
              <div className="relative h-8 rounded bg-[var(--inset)]"><span className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded" style={{ background: ACCENT }} /><span className="absolute left-2 top-0 font-mono text-[10px] text-[var(--faint)]">main</span></div>
              {r.devs.map((d) => (
                <div key={d.name} className="relative mt-2 h-7">
                  <span className="absolute left-0 top-1 text-xs">{d.name}</span>
                  <div className="absolute inset-y-0 left-12 right-2">
                    {d.merges.map((m, i) => { const from = i ? d.merges[i - 1] : 0; return <span key={m} className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded" style={{ left: `${(from / 10) * 100}%`, width: `${((m - from) / 10) * 100}%`, background: m - from > 3 ? "var(--auto)" : "var(--ghost)" }} />; })}
                    {d.merges.map((m) => <span key={m} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(m / 10) * 100}%`, background: ACCENT }} />)}
                  </div>
                </div>
              ))}
              <div className="mt-1 flex justify-between pl-12 font-mono text-[10px] text-[var(--faint)]"><span>day 0</span><span>day 10</span></div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Merges to main", String(r.integrations)], ["Conflicting lines per merge", `~${r.conflictLines}`], ["Idea → main", `~${r.leadTimeDays} days`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={<SystemMapPanel caption={s === "trunk" ? "Small changes merge every day behind feature flags. Each merge is tiny, so conflicts are rare and easy, and main is always close to what's deployed." : s === "feature" ? "Short-lived branches with a pull request each: a good default. Keep them to a couple of days." : "Two weeks apart, branches drift so far that merge day becomes integration week. Conflicts grow roughly with the square of branch age."}><Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Branches drift" what="Every day apart, both sides change the same code more. Conflicts grow faster than linearly." accent={ACCENT} active={s === "longlived"}><p className="text-sm text-[var(--muted)]">“Merge hell”.</p></FlowStep>
              <FlowArrow label="integrate often" accent={ACCENT} />
              <FlowStep n={2} title="Trunk-based development" what="Merge small changes to main at least daily. Unfinished features hide behind flags." accent={ACCENT} active={s === "trunk"}><p className="text-sm text-[var(--muted)]">Needs good tests and fast CI.</p></FlowStep>
              <FlowArrow label="with review" accent={ACCENT} />
              <FlowStep n={3} title="Short-lived feature branches" what="A branch per change, reviewed in a PR, merged within a day or two." accent={ACCENT} active={s === "feature"}><p className="text-sm text-[var(--muted)]">GitHub flow.</p></FlowStep>
              <FlowArrow label="releases" accent={ACCENT} />
              <FlowStep n={4} title="Release branches only if you must" what="Mobile apps or on-prem software may need maintained release lines. Web services rarely do." accent={ACCENT}><p className="text-sm text-[var(--muted)]">GitFlow suits shipped versions, not SaaS.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
