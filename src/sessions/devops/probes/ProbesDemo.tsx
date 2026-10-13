"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { SETS, simulate, type ProbeSet } from "@/lib/probes";

const ACCENT = "var(--ops)";
const APP_COLOR = { starting: "var(--auto)", ready: "var(--good)", hung: "var(--bad)", restarting: "var(--faint)" };
const REQ_COLOR = { ok: "var(--good)", error: "var(--bad)", skipped: "var(--ghost)" };

export default function ProbesDemo() {
  const [set, setSet] = useState<ProbeSet>("none");
  const r = simulate(set);
  const caption =
    set === "none" ? `Traffic hits the pod while it's warming up and after it hangs: ${r.errors} failed requests, and it never recovers.`
    : set === "readiness" ? "No errors: the pod only gets traffic when ready. But after the hang it's removed from service and never restarted."
    : set === "liveness" ? `The hang is detected and the container restarted, but traffic still hits it while it warms up: ${r.errors} errors.`
    : "Readiness keeps traffic away while it isn't ready; liveness restarts it when it hangs. Zero errors, and it recovers.";
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Liveness and readiness probes" blurb="This app takes 20 s to warm up, and at 60 s it deadlocks: the process is alive but answers nothing. Kubernetes only knows what your probes tell it. Requests arrive every 5 seconds." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Pod timeline">
              {[["App state", (t: (typeof r.ticks)[number]) => APP_COLOR[t.app], (t: (typeof r.ticks)[number]) => t.app] as const, ["Requests", (t: (typeof r.ticks)[number]) => REQ_COLOR[t.request], (t: (typeof r.ticks)[number]) => t.request] as const].map(([label, color, title]) => (
                <div key={label} className="mt-3 first:mt-0">
                  <p className="text-xs text-[var(--muted)]">{label}</p>
                  <div className="mt-1 flex gap-px">{r.ticks.map((t) => <span key={t.t} title={`${t.t}s: ${title(t)}`} className="h-6 flex-1 rounded-sm" style={{ background: color(t) }} />)}</div>
                </div>
              ))}
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0 s</span><span>60 s (hangs)</span><span>120 s</span></div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                {Object.entries(APP_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: c }} /> {k}</span>)}
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: REQ_COLOR.skipped }} /> not sent to this pod</span>
              </div>
              <p className="mt-3 font-mono text-sm">{r.errors} failed requests · {r.restarts} restarts</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Probes configured" accent={ACCENT} value={set} onChange={setSet} options={SETS.map((s) => ({ id: s.id, label: s.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Without probes, “running” means healthy" what="Kubernetes sends traffic as soon as the process starts, and never notices a hang." accent={ACCENT} active={set === "none"}><p className="text-sm text-[var(--muted)]">Errors during warm-up, and forever after the hang.</p></FlowStep>
              <FlowArrow label="am I ready for traffic?" accent={ACCENT} />
              <FlowStep n={2} title="Readiness: should I get traffic?" what="While the readiness check fails, the pod is taken out of the Service. Nothing is restarted." accent={ACCENT} active={set === "readiness" || set === "both"}><p className="font-mono text-xs">readinessProbe: httpGet /ready</p></FlowStep>
              <FlowArrow label="am I alive?" accent={ACCENT} />
              <FlowStep n={3} title="Liveness: should I be restarted?" what="After a few failed checks, the container is killed and started again. Point it at something that fails only when the process is truly stuck." accent={ACCENT} active={set === "liveness" || set === "both"}><p className="font-mono text-xs">livenessProbe: httpGet /live, failureThreshold: 3</p></FlowStep>
              <FlowArrow label="use both" accent={ACCENT} />
              <FlowStep n={4} title="Use both, and keep them different" what="Readiness can check dependencies; liveness shouldn't, or a database blip restarts every pod. A startupProbe covers slow starts." accent={ACCENT} active={set === "both"}><p className="text-sm text-[var(--muted)]">Both: {simulate("both").errors} errors, {simulate("both").restarts} restart.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
