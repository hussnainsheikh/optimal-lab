"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { RULES, winner } from "@/lib/cssCascade";

const ACCENT = "var(--web)";

export default function CascadeDemo() {
  const [on, setOn] = useState<Set<string>>(new Set(["a", "btn", "btnp"]));
  const w = winner(on);
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="The CSS cascade and specificity" blurb="Several rules can set the same property on one element. The browser picks a winner: !important first, then the most specific selector, then whichever came last. Switch rules on and off." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Rules and the result">
              <p className="font-mono text-xs text-[var(--muted)]">&lt;a id=&quot;buy&quot; class=&quot;btn primary&quot;&gt;</p>
              <p className="mt-2 text-3xl font-semibold" style={{ color: w.rule?.color ?? "var(--text)" }}>Buy now</p>
              <ul className="mt-4 space-y-1.5">
                {RULES.map((r) => {
                  const active = on.has(r.id), win = w.rule?.id === r.id;
                  return (
                    <li key={r.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: win ? ACCENT : "var(--line)", background: win ? "var(--inset)" : undefined }}>
                        <input type="checkbox" checked={active} onChange={() => toggle(r.id)} style={{ accentColor: ACCENT }} />
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="flex-1 font-mono text-xs" style={{ textDecoration: active && !win ? "line-through" : undefined, color: active ? undefined : "var(--faint)" }}>{r.selector}</span>
                        <span className="font-mono text-[11px] text-[var(--faint)]">{r.important ? "!imp " : ""}({r.spec.join(",")})</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Specificity as (inline, ids, classes, elements). Crossed out: applies but loses.</p>
            </section>
          }
          panel={<SystemMapPanel caption={w.rule ? `${w.rule.selector} wins. ${w.reason}` : w.reason}><p className="text-sm text-[var(--muted)]">Tick the rules in the list to apply them.</p></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Importance and origin first" what="!important declarations beat normal ones. Browser defaults lose to your styles." accent={ACCENT} active={!!w.rule?.important}><p className="text-sm text-[var(--muted)]">Cascade layers (@layer) also sit here.</p></FlowStep>
              <FlowArrow label="then" accent={ACCENT} />
              <FlowStep n={2} title="Specificity" what="Count ids, then classes/attributes/pseudo-classes, then elements. Compare left to right; inline styles beat any selector." accent={ACCENT}><p className="font-mono text-xs">#buy (0,1,0,0) &gt; .btn.primary (0,0,2,0)</p></FlowStep>
              <FlowArrow label="tie" accent={ACCENT} />
              <FlowStep n={3} title="Source order" what="With equal specificity, the later declaration wins. That's why CSS import order matters." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A common source of “why didn&apos;t my style apply?”.</p></FlowStep>
              <FlowArrow label="keep it sane" accent={ACCENT} />
              <FlowStep n={4} title="Keep specificity flat" what="Prefer single classes, avoid ids and !important in component CSS. Utility CSS and CSS modules sidestep most fights." accent={ACCENT}><p className="text-sm text-[var(--muted)]">:where() has zero specificity.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
