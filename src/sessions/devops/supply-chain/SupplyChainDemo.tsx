"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { ATTACKS, caught, DEFENSES, type Def } from "@/lib/supplyChain";

const ACCENT = "var(--ops)";

export default function SupplyChainDemo() {
  const [on, setOn] = useState<Set<Def>>(new Set(["lock"]));
  const toggle = (d: Def) => setOn((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const n = ATTACKS.filter((a) => caught(on, a)).length;
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Software supply chain security" blurb="Most of the code you ship isn't yours: dependencies, base images, build tools. Attackers target that chain. Each defence closes a different gap; turn them on and see which attacks get through." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Pipeline and attacks">
              <ol className="flex flex-wrap items-center gap-1 text-xs">{["Dependencies", "Build", "Artifact", "Deploy"].map((s, i) => <li key={s} className="flex items-center gap-1"><span className="rounded px-2 py-1" style={{ background: DEFENSES.some((d) => d.stage === s && on.has(d.id)) ? ACCENT : "var(--inset)", color: DEFENSES.some((d) => d.stage === s && on.has(d.id)) ? "var(--on-accent)" : undefined }}>{s}</span>{i < 3 && <span className="text-[var(--faint)]">→</span>}</li>)}</ol>
              <ul className="mt-4 space-y-1.5">{ATTACKS.map((a) => { const c = caught(on, a); return <li key={a.name} className="rounded-lg border p-2 text-sm" style={{ borderColor: c ? "var(--good)" : "var(--bad)" }}><p className="flex justify-between gap-2"><span>{a.name}</span><span className="font-mono text-xs" style={{ color: c ? "var(--good)" : "var(--bad)" }}>{c ? "stopped" : "gets through"}</span></p>{c && <p className="text-xs text-[var(--muted)]">{a.note}</p>}</li>; })}</ul>
              <p className="mt-3 font-mono text-sm">{n} of {ATTACKS.length} stopped</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={n === ATTACKS.length ? "Every attack here is stopped: pinned and scanned inputs, builds only in CI, and a cluster that refuses anything unsigned." : "Each defence covers one part of the chain. Signing does nothing unless deploys verify it."}>
              <div className="w-full space-y-1.5">{DEFENSES.map((d) => <label key={d.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={on.has(d.id)} onChange={() => toggle(d.id)} style={{ accentColor: ACCENT }} /><span className="flex-1">{d.label}</span><span className="text-[10px] text-[var(--faint)]">{d.stage}</span></label>)}</div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Control what comes in" what="Lockfiles pin exact versions; scanners flag known-bad packages and CVEs; review new dependencies." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Dependabot or Renovate for controlled updates.</p></FlowStep>
              <FlowArrow label="build" accent={ACCENT} />
              <FlowStep n={2} title="Build in one trusted place" what="CI builds from source and records provenance (SLSA): which commit, which workflow, which inputs." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Also produce an SBOM.</p></FlowStep>
              <FlowArrow label="sign" accent={ACCENT} />
              <FlowStep n={3} title="Sign artifacts" what="Sign images by digest with keys only CI holds (or keyless with Sigstore)." accent={ACCENT}><p className="font-mono text-xs">cosign sign registry/app@sha256:…</p></FlowStep>
              <FlowArrow label="enforce" accent={ACCENT} />
              <FlowStep n={4} title="Verify at deploy" what="An admission policy rejects images that aren't signed by your pipeline. Without this step, signing is decoration." accent={ACCENT} active={!on.has("verify")}><p className="text-sm text-[var(--muted)]">Kyverno, Sigstore policy-controller.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
