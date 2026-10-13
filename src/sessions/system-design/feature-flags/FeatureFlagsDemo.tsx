"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { BUCKETS, evaluate, USERS } from "@/lib/featureFlags";

const ACCENT = "var(--sys)";

export default function FeatureFlagsDemo() {
  const [pct, setPct] = useState(10);
  const [staff, setStaff] = useState("yes");
  const [kill, setKill] = useState("no");
  const on = evaluate(pct, staff === "yes", kill === "yes");
  const n = on.filter(Boolean).length;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Feature flags and gradual rollout" blurb="The new checkout is deployed but switched off. A flag decides, per user, who sees it: staff first, then a growing percentage. Users are bucketed by hashing their id, so raising 10% to 30% keeps the first 10% in and adds more." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Users">
              <div className="grid max-w-sm grid-cols-10 gap-1">
                {USERS.map((u, i) => <span key={u.id} title={`${u.id} · bucket ${BUCKETS[i]}`} className="grid aspect-square place-items-center rounded font-mono text-[9px]" style={{ background: on[i] ? ACCENT : "var(--inset)", color: on[i] ? "var(--on-accent)" : "var(--faint)", outline: u.staff ? "1.5px solid var(--good)" : undefined }}>{BUCKETS[i]}</span>)}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Number: the user&apos;s hash bucket (0–99). Filled: sees the new checkout. Green outline: staff.</p>
              <pre className="overflow-x-auto mt-3 rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`if (killSwitch) return false${staff === "yes" ? "\nif (user.isStaff) return true" : ""}\nreturn hash("new-checkout:" + user.id) % 100 < ${pct}`}</pre>
              <p className="mt-2 font-mono text-sm">{n} of {USERS.length} users on the new checkout</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={kill === "yes" ? "Kill switch on: everyone is back on the old checkout instantly, with no deploy." : `Users whose bucket is below ${pct} get it. Raise the slider: nobody who had it loses it, and nobody flips back and forth between page loads.`}>
              <Slider label="Rollout" accent={ACCENT} value={pct} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={setPct} />
              <Choices label="Staff first" accent={ACCENT} value={staff} onChange={setStaff} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
              <Choices label="Kill switch" accent={ACCENT} value={kill} onChange={setKill} options={[{ id: "no", label: "Off" }, { id: "yes", label: "On" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Deploy dark" what="Merge and ship code behind a flag that's off. Deploying and releasing become separate decisions." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Trunk-based development relies on this.</p></FlowStep>
              <FlowArrow label="target" accent={ACCENT} />
              <FlowStep n={2} title="Staff, beta users, then a percentage" what="Rules run in order. Try it on yourself first, then on a small slice of real traffic." accent={ACCENT} active={staff === "yes"}><p className="text-sm text-[var(--muted)]">Watch errors and metrics per variant.</p></FlowStep>
              <FlowArrow label="stable buckets" accent={ACCENT} />
              <FlowStep n={3} title="Hash for consistency" what="Hashing the user id with the flag name gives each user a fixed bucket per flag, so experiences don't flicker." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Different flags get independent buckets.</p></FlowStep>
              <FlowArrow label="clean up" accent={ACCENT} />
              <FlowStep n={4} title="Kill switches and flag debt" what="Keep an instant off switch for risky features, and delete flags after full rollout; old flags rot into confusing branches." accent={ACCENT} active={kill === "yes"}><p className="text-sm text-[var(--muted)]">LaunchDarkly, Unleash, Flagsmith.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
