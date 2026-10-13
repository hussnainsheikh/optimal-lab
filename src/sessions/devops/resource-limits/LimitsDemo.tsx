"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { cpu, memory } from "@/lib/resourceLimits";

const ACCENT = "var(--ops)";

export default function LimitsDemo() {
  const [mem, setMem] = useState("512");
  const [cores, setCores] = useState("0.5");
  const m = memory(Number(mem));
  const c = cpu(Number(cores));
  const max = 1500;
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Requests, limits and OOM kills" blurb="Memory and CPU limits behave very differently. Go over the memory limit and the container is killed. Go over the CPU limit and it's only slowed down. This app leaks 40 MiB a minute." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Memory over 30 minutes and CPU time per request">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Memory used, 30 minutes</p>
              <div className="relative mt-2 flex h-32 items-end gap-px">
                {m.points.map((p) => (
                  <span key={p.min} className="flex-1 rounded-t-sm" title={`${p.min} min: ${p.used} MiB`} style={{ height: `${(p.used / max) * 100}%`, background: p.killed ? "var(--bad)" : ACCENT }} />
                ))}
                <span className="absolute inset-x-0 border-t border-dashed border-[var(--bad)]" style={{ bottom: `${(Number(mem) / max) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Dashed: the {mem} MiB limit. Red: OOMKilled, then restarted from scratch.</p>
              <p className="mt-2 font-mono text-sm" style={{ color: m.restarts ? "var(--bad)" : "var(--good)" }}>{m.restarts} OOM kills in 30 minutes</p>

              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">One request needing 0.8 CPU-seconds</p>
              <span className="mt-2 block h-3 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${(c.seconds / 1.6) * 100}%`, background: c.throttled ? "var(--auto)" : "var(--good)" }} /></span>
              <p className="mt-1 font-mono text-sm">{c.seconds.toFixed(2)} s{c.throttled ? " (throttled)" : ""}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${m.restarts ? `Memory crosses ${mem} MiB ${m.restarts}× and the container is killed each time.` : "Memory stays under the limit."} CPU limit ${cores}: requests take ${c.seconds.toFixed(2)} s.`}>
              <Choices label="Memory limit" accent={ACCENT} value={mem} onChange={setMem} options={["512", "1024", "2048"].map((x) => ({ id: x, label: `${x} MiB` }))} />
              <Choices label="CPU limit" accent={ACCENT} value={cores} onChange={setCores} options={["0.5", "1", "2"].map((x) => ({ id: x, label: `${x} CPU` }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Requests reserve, limits cap" what="The scheduler places pods by their requests. Limits are the ceiling enforced while they run." accent={ACCENT}><p className="font-mono text-xs">resources: requests: memory 256Mi · limits: memory {mem}Mi</p></FlowStep>
              <FlowArrow label="over the memory limit" accent={ACCENT} />
              <FlowStep n={2} title="Memory over the limit: killed" what="Memory can't be taken back from a running process, so the kernel kills it: OOMKilled, exit code 137. A leak becomes a restart loop." accent={ACCENT} active={m.restarts > 0}><p className="text-sm text-[var(--muted)]">A bigger limit only delays it; fix the leak.</p></FlowStep>
              <FlowArrow label="over the CPU limit" accent={ACCENT} />
              <FlowStep n={3} title="CPU over the limit: throttled" what="CPU time is rationed in short periods. Use it up and the container waits for the next period: slower, never killed." accent={ACCENT} active={c.throttled}><p className="text-sm text-[var(--muted)]">Throttling shows up as mysterious latency.</p></FlowStep>
              <FlowArrow label="setting them" accent={ACCENT} />
              <FlowStep n={4} title="Set them from measurements" what="Watch real usage, set memory request ≈ limit to avoid surprises, and be cautious with tight CPU limits on latency-sensitive services." accent={ACCENT}><p className="text-sm text-[var(--muted)]">kubectl top pod · container_cpu_cfs_throttled_seconds_total</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
