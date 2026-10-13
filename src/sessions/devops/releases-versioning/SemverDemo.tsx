"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { accepts, CURRENT, next, RANGES, type Change } from "@/lib/semver";

const ACCENT = "var(--ops)";
const CHANGES: { id: Change; label: string }[] = [
  { id: "fix", label: "Fixed a bug" },
  { id: "feature", label: "Added a new option" },
  { id: "breaking", label: "Renamed a function (breaking)" },
];

export default function SemverDemo() {
  const [on, setOn] = useState<Set<Change>>(new Set(["fix"]));
  const v = next(on);
  const toggle = (c: Change) => setOn((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Semantic versioning" blurb={`Your library is at ${CURRENT.join(".")}. A version number is a promise: MAJOR changes may break callers, MINOR adds features, PATCH only fixes. Projects that depend on you pick ranges that trust those promises.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Version and ranges">
              <p className="font-mono text-3xl"><span className="text-[var(--muted)]">{CURRENT.join(".")} → </span><span style={{ color: ACCENT }}>{v.join(".")}</span></p>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">dependent&apos;s range</th><th className="font-normal">means</th><th className="font-normal">gets {v.join(".")}?</th></tr></thead>
                <tbody>{RANGES.map((r) => { const ok = accepts(r.range, v); return <tr key={r.range}><td className="py-1.5 font-mono">{r.range}</td><td className="text-xs text-[var(--muted)]">{r.rule}</td><td style={{ color: ok ? "var(--good)" : "var(--muted)" }}>{ok ? "✓ on next install" : "✗ stays"}</td></tr>; })}</tbody>
              </table>
            </section>
          }
          panel={
            <SystemMapPanel caption={on.has("breaking") ? "A breaking change bumps MAJOR. Caret ranges won't pick it up, so nobody breaks by accident; they upgrade on purpose. A loose >= range would grab it and break." : on.has("feature") ? "New, compatible features bump MINOR and reset PATCH. Caret users get it automatically." : on.size ? "Only fixes: a PATCH release that every compatible range accepts." : "No changes, no release."}>
              <div className="w-full space-y-1.5">{CHANGES.map((c) => <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={on.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: ACCENT }} />{c.label}</label>)}</div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="PATCH: fixes only" what="Same API, bugs fixed. Safe to take automatically." accent={ACCENT} active={v[2] !== CURRENT[2]}><p className="font-mono text-xs">2.4.1 → 2.4.2</p></FlowStep>
              <FlowArrow label="additions" accent={ACCENT} />
              <FlowStep n={2} title="MINOR: new, backwards-compatible" what="New functions or options; existing code keeps working." accent={ACCENT} active={v[1] !== CURRENT[1] && v[0] === CURRENT[0]}><p className="font-mono text-xs">2.4.1 → 2.5.0</p></FlowStep>
              <FlowArrow label="breaks" accent={ACCENT} />
              <FlowStep n={3} title="MAJOR: anything incompatible" what="Removed or renamed APIs, changed behaviour. Write a migration guide." accent={ACCENT} active={v[0] !== CURRENT[0]}><p className="font-mono text-xs">2.4.1 → 3.0.0</p></FlowStep>
              <FlowArrow label="automate" accent={ACCENT} />
              <FlowStep n={4} title="Let commits decide the bump" what="Conventional commits (fix:, feat:, feat!:) let release tooling compute the version and changelog." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Lockfiles still pin exact versions per app.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
