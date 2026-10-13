"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CHANGES, plan, type Action, type Change } from "@/lib/terraform";

const ACCENT = "var(--ops)";
const SIGN: Record<Action, { s: string; c: string; word: string }> = {
  create: { s: "+", c: "var(--good)", word: "will be created" },
  update: { s: "~", c: "var(--auto)", word: "will be updated in-place" },
  replace: { s: "-/+", c: "var(--bad)", word: "must be replaced" },
  destroy: { s: "-", c: "var(--bad)", word: "will be destroyed" },
  "no-op": { s: " ", c: "var(--faint)", word: "no changes" },
};

export default function TerraformDemo() {
  const [change, setChange] = useState<Change>("add-bucket");
  const p = plan(change);
  const caption = {
    "add-bucket": "A new block in the config with nothing in state: Terraform will create it.",
    resize: "instance_type can change on a running instance: an in-place update.",
    "new-ami": "The machine image can't change on a running instance, so Terraform destroys it and creates a new one. Read plans for -/+.",
    "remove-db": "Deleting the block means Terraform deletes the real database. This is why you review plans, and use prevent_destroy.",
    drift: "Nobody changed the code, but the real resource no longer matches it. The plan will undo the console edit.",
  }[change];
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Terraform: plan and apply" blurb="You describe the infrastructure you want. Terraform compares it with what exists and prints a plan of exactly what it will create, change or destroy. Nothing happens until you apply. Make a change and read the plan." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="terraform plan output">
              <p className="font-mono text-xs text-[var(--faint)]">$ terraform plan</p>
              <div className="mt-2 space-y-3 overflow-x-auto rounded-md bg-[var(--inset)] p-3 font-mono text-xs">
                {p.rows.map((r) => (
                  <div key={r.addr} style={{ color: r.action === "no-op" ? "var(--faint)" : undefined }}>
                    <p><span style={{ color: SIGN[r.action].c }}>{SIGN[r.action].s.padEnd(3)}</span> {r.addr} <span className="text-[var(--muted)]">{SIGN[r.action].word}</span></p>
                    {r.action !== "no-op" && r.diffs.map((d) => (
                      <p key={d.k} className="pl-8">{d.k} = {d.from && <span className="text-[var(--bad)]">&quot;{d.from}&quot;</span>}{d.from && d.to && " → "}{d.to && <span className="text-[var(--good)]">&quot;{d.to}&quot;</span>}{d.forces && <span className="text-[var(--bad)]"> # forces replacement</span>}</p>
                    ))}
                  </div>
                ))}
                <p className="border-t border-[var(--line)] pt-2">Plan: <b>{p.add}</b> to add, <b>{p.change}</b> to change, <b>{p.destroy}</b> to destroy.</p>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="What changed" accent={ACCENT} value={change} onChange={setChange} options={CHANGES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Write the desired state" what="HCL files describe resources and their settings, not the steps to make them." accent={ACCENT}><p className="font-mono text-xs">resource &quot;aws_instance&quot; &quot;web&quot; {"{ … }"}</p></FlowStep>
              <FlowArrow label="refresh and compare" accent={ACCENT} />
              <FlowStep n={2} title="Plan diffs config, state and reality" what="Terraform reads the real resources, compares them with your config, and works out create, update, replace or destroy for each." accent={ACCENT} active={change === "drift"}><p className="text-sm text-[var(--muted)]">Some settings can&apos;t change in place and force a replacement.</p></FlowStep>
              <FlowArrow label="review" accent={ACCENT} />
              <FlowStep n={3} title="Review the plan" what="In CI, post the plan on the pull request. Look hard at every - and -/+ before merging." accent={ACCENT} active={p.destroy > 0}><p className="font-mono text-xs">terraform plan -out=tfplan</p></FlowStep>
              <FlowArrow label="apply exactly that" accent={ACCENT} />
              <FlowStep n={4} title="Apply the saved plan" what="Applying the saved plan does exactly what was reviewed, then records the result in state." accent={ACCENT}><p className="font-mono text-xs">terraform apply tfplan</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
