"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames } from "@/lib/terraformState";

const ACCENT = "var(--ops)";

export default function TfStateDemo() {
  const [lock, setLock] = useState("off");
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Terraform state and locking" blurb="Terraform keeps a state file mapping your code to real resources. It's how it knows what to change or delete. If two people apply at once without a lock, one can overwrite the other's state and lose track of real infrastructure." />
      <div className="mt-6"><Run key={lock} lock={lock} setLock={setLock} /></div>
    </SessionPage>
  );
}

function Run({ lock, setLock }: { lock: string; setLock: (v: string) => void }) {
  const fr = frames(lock === "on");
  const playback = usePlayback(fr.length, 1700);
  const f = fr[playback.i];
  const orphan = f.real.filter((r) => !f.state.includes(r));
  const chips = (xs: string[], orphanList: string[] = []) => <div className="mt-1 flex flex-wrap gap-1">{xs.map((x) => <span key={x} className="rounded px-1.5 py-0.5 font-mono text-xs" style={{ background: orphanList.includes(x) ? "var(--bad)" : "var(--inset)", color: orphanList.includes(x) ? "var(--on-accent)" : undefined }}>{x}</span>)}</div>;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Engineers, state and cloud">
          <div className="grid grid-cols-2 gap-2">
            {[["Ana", f.a], ["Ben", f.b]].map(([n, s]) => <div key={n} className="rounded-lg border border-[var(--line)] p-2"><p className="text-sm font-medium">{n}</p><p className="font-mono text-xs" style={{ color: s.startsWith("Error") ? "var(--auto)" : "var(--muted)" }}>{s}</p></div>)}
          </div>
          <div className="mt-3 rounded-lg border-2 p-2.5" style={{ borderColor: f.bad ? "var(--bad)" : ACCENT }}>
            <p className="text-xs text-[var(--muted)]">terraform.tfstate (remote){lock === "on" ? " + lock" : ""}</p>{chips(f.state)}
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] p-2.5">
            <p className="text-xs text-[var(--muted)]">What actually exists in the cloud</p>{chips(f.real, orphan)}
            {orphan.length > 0 && <p className="mt-1 text-xs text-[var(--bad)]">Not in state: {orphan.join(", ")}</p>}
          </div>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="State locking" accent={ACCENT} value={lock} onChange={setLock} options={[{ id: "off", label: "Off" }, { id: "on", label: "On" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="State maps code to reality" what="Resource addresses to cloud ids and attributes. Without it, Terraform can't update or delete what it made." accent={ACCENT}><p className="text-sm text-[var(--muted)]">It can contain secrets: protect it.</p></FlowStep>
          <FlowArrow label="share it" accent={ACCENT} />
          <FlowStep n={2} title="Use a remote backend" what="S3, GCS, Terraform Cloud: one shared copy with versioning, not files on laptops." accent={ACCENT}><p className="font-mono text-xs">backend &quot;s3&quot; {"{ bucket = …, use_lockfile = true }"}</p></FlowStep>
          <FlowArrow label="serialize writes" accent={ACCENT} />
          <FlowStep n={3} title="Lock during apply" what="Only one plan/apply holds the lock; others fail fast and retry. Run applies from CI so it's one at a time anyway." accent={ACCENT} active={lock === "on"}><p className="text-sm text-[var(--muted)]">force-unlock only if you&apos;re sure.</p></FlowStep>
          <FlowArrow label="when it goes wrong" accent={ACCENT} />
          <FlowStep n={4} title="Repair with import and state commands" what="terraform import adopts an orphan; state mv and rm fix addresses. Split large states so one mistake has a small blast radius." accent={ACCENT} active={!!f.bad}><p className="font-mono text-xs">terraform import aws_elasticache_cluster.cache …</p></FlowStep>
        </>
      }
    />
  );
}
