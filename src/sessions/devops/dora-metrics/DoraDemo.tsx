"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { deployBand, failBand, leadBand, PRESETS, restoreBand, type Band } from "@/lib/dora";

const ACCENT = "var(--ops)";
const COLOR: Record<Band, string> = { Elite: "var(--good)", High: ACCENT, Medium: "var(--auto)", Low: "var(--bad)" };
const hrs = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} h` : `${Math.round(h * 60)} min`);

export default function DoraDemo() {
  const [p, setP] = useState<keyof typeof PRESETS>("weekly");
  const x = PRESETS[p];
  const rows: [string, string, Band, string][] = [
    ["Deployment frequency", x.deploys >= 1 ? `${x.deploys}/week` : `every ${Math.round(1 / x.deploys)} weeks`, deployBand(x.deploys), "How often you ship to production"],
    ["Lead time for changes", hrs(x.lead), leadBand(x.lead), "Commit to running in production"],
    ["Change failure rate", `${x.fail}%`, failBand(x.fail), "Deploys that cause an incident or rollback"],
    ["Time to restore", hrs(x.restore), restoreBand(x.restore), "From failure to recovery"],
  ];
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="DORA metrics" blurb="Years of research found four numbers that separate high-performing teams: two for speed, two for stability. The surprise is that they move together. Teams that ship more often also break less and recover faster." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Metrics">
              <ul className="space-y-2">{rows.map(([k, v, b, d]) => <li key={k} className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-2 rounded-lg bg-[var(--inset)] p-2"><span className="text-sm">{k}<span className="block text-[11px] text-[var(--faint)]">{d}</span></span><span className="font-mono">{v}</span><span className="rounded px-2 py-0.5 text-center text-xs" style={{ background: COLOR[b], color: "var(--on-accent)" }}>{b}</span></li>)}</ul>
            </section>
          }
          panel={<SystemMapPanel caption={p === "quarterly" ? "Big, infrequent releases bundle hundreds of changes. When one fails, it's hard to find which change did it, so recovery is slow too." : p === "weekly" ? "Better: smaller batches, quicker feedback. Automation and smaller changes push further." : "Many tiny deploys a day. Each is low-risk and easy to roll back, so failures are rare and short."}><Choices label="Team" accent={ACCENT} value={p} onChange={setP} options={(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => ({ id: k, label: PRESETS[k].label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Two speed metrics" what="Deployment frequency and lead time: how fast value reaches users." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Measured from your CI/CD and git history.</p></FlowStep>
              <FlowArrow label="and" accent={ACCENT} />
              <FlowStep n={2} title="Two stability metrics" what="Change failure rate and time to restore: how often you break things, and how fast you fix them." accent={ACCENT}><p className="text-sm text-[var(--muted)]">From incidents and rollbacks.</p></FlowStep>
              <FlowArrow label="the finding" accent={ACCENT} />
              <FlowStep n={3} title="Small batches win both" what="Smaller, more frequent changes are easier to review, test, deploy and roll back." accent={ACCENT} active={p === "continuous"}><p className="text-sm text-[var(--muted)]">Accelerate (Forsgren, Humble, Kim).</p></FlowStep>
              <FlowArrow label="careful" accent={ACCENT} />
              <FlowStep n={4} title="Use them to improve, not to rank" what="Track trends within a team. Turned into targets for comparing people, they get gamed." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Pair with developer experience surveys.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
