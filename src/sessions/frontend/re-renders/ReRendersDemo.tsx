"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ACTIONS, TREE, simulate, type Result, type StateKey } from "@/lib/reRenders";

const ACCENT = "var(--web)";

export default function ReRendersDemo() {
  const [memo, setMemo] = useState<"off" | "on">("off");
  const [last, setLast] = useState<{ action: StateKey; n: number } | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const results = last ? simulate(last.action, memo === "on") : null;
  const rendered = results?.filter((r) => r.rendered) ?? [];
  const action = last ? ACTIONS.find((a) => a.id === last.action)! : null;

  const fire = (id: StateKey) => {
    const res = simulate(id, memo === "on");
    setTotals((t) => {
      const next = { ...t };
      for (const r of res) if (r.rendered) next[r.comp.id] = (next[r.comp.id] ?? 0) + 1;
      return next;
    });
    setLast((l) => ({ action: id, n: (l?.n ?? 0) + 1 }));
  };

  const caption = !action
    ? "Pick an action to change some state, and watch which components render again."
    : `${action.label} (${action.note}): ${rendered.length} of ${TREE.length} components re-rendered${memo === "on" ? " with memo" : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Why components re-render"
        blurb="React re-renders a component when its state changes, when its parent re-renders, or when a context it reads changes. Most re-renders are cheap, but knowing the rules tells you where memo helps and where it can't."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The component tree">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Component tree</p>
                <p className="font-mono text-xs text-[var(--muted)]">{memo === "on" ? "every component wrapped in memo" : "no memo"}</p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(results ?? simulate("count", false).map((r) => ({ ...r, rendered: false, reason: "not affected" as const }))).map((r: Result) => (
                  <li key={`${r.comp.id}-${last?.n ?? 0}`} style={{ marginLeft: r.depth * 20 }}>
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors"
                      style={{
                        borderColor: r.rendered ? ACCENT : "var(--line)",
                        background: r.rendered ? "color-mix(in srgb, var(--web) 16%, transparent)" : "var(--inset)",
                      }}
                    >
                      <span className="font-mono text-sm">
                        &lt;{r.comp.name} /&gt;
                        {r.comp.readsTheme && <span className="ml-2 text-[11px] text-[var(--faint)]">reads ThemeContext</span>}
                        {r.comp.owns && <span className="ml-2 text-[11px] text-[var(--faint)]">state: {r.comp.owns.join(", ")}</span>}
                        {r.comp.props && <span className="ml-2 text-[11px] text-[var(--faint)]">props: {r.comp.props.join(", ")}</span>}
                      </span>
                      <span className="text-xs" style={{ color: r.rendered ? "var(--text)" : "var(--faint)" }}>
                        {last ? r.reason : ""} <span className="font-mono text-[var(--faint)]">· {totals[r.comp.id] ?? 0} renders</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <p className="mb-2 text-sm font-medium">Change some state</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => (
                    <button key={a.id} type="button" onClick={() => fire(a.id)} className="min-h-11 rounded-md px-4 text-sm font-semibold text-[var(--on-accent)]" style={{ background: ACCENT }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <Choices
                label="memo"
                accent={ACCENT}
                value={memo}
                onChange={(v) => setMemo(v)}
                options={[
                  { id: "off", label: "Off" },
                  { id: "on", label: "Wrap every component in memo" },
                ]}
              />
              {Object.keys(totals).length > 0 && (
                <button type="button" onClick={() => { setTotals({}); setLast(null); }} className="min-h-11 rounded-md px-3 text-sm text-[var(--muted)] hover:text-[var(--text)]">
                  Reset counts
                </button>
              )}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="State changes in one component" what="Calling a state setter schedules a re-render of the component that owns that state." accent={ACCENT}>
                <p className="font-mono text-sm">{action ? action.note : "Nothing yet."}</p>
              </FlowStep>
              <FlowArrow label="that component renders" accent={ACCENT} />

              <FlowStep n={2} title="Its children render too" what="By default, when a component renders, every component inside it renders again, even if their props didn't change." accent={ACCENT} active={!!last && memo === "off"}>
                <p className="text-sm">{results ? `${results.filter((r) => r.reason === "parent re-rendered").length} rendered only because their parent did.` : "—"}</p>
              </FlowStep>
              <FlowArrow label="unless memo stops it" accent={ACCENT} />

              <FlowStep n={3} title="memo skips children whose props are the same" what="A memo component compares its new props with the old ones and skips rendering when nothing changed. It can't skip if a prop really changed, or if a new object or function is created on every render." accent={ACCENT} active={!!last && memo === "on"}>
                <p className="text-sm">{results ? `${results.filter((r) => r.reason === "skipped by memo").length} skipped by memo.` : "—"}</p>
              </FlowStep>
              <FlowArrow label="but context goes around it" accent={ACCENT} />

              <FlowStep n={4} title="Context readers render wherever they are" what="When a context value changes, every component that reads it renders, even deep under a memo'd parent that skipped. Switch the theme with memo on to see it." accent={ACCENT} active={last?.action === "theme"}>
                <p className="text-sm">{results ? `${results.filter((r) => r.reason === "context changed").length} rendered because ThemeContext changed.` : "—"}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
