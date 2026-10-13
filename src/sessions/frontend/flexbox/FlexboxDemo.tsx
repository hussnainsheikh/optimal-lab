"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Slider } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { layout } from "@/lib/flexbox";

const ACCENT = "var(--web)";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)"];

export default function FlexboxDemo() {
  const [width, setWidth] = useState(800);
  const r = layout(width);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Flexbox: how space is shared" blurb="Each item asks for its flex-basis. If the row has room left over, flex-grow decides who gets it. If it's too narrow, flex-shrink decides who gives up space, weighted by size. Drag the container width." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The flex row">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Container {width}px · {r.free >= 0 ? `${r.free}px left over` : `${-r.free}px too narrow`}</p>
              <div className="mt-3 overflow-hidden">
                <div className="flex h-16 rounded border border-dashed border-[var(--line-strong)]" style={{ width: `${(width / 900) * 100}%` }}>
                  {r.sizes.map((s, i) => (
                    <div key={s.name} className="grid place-items-center overflow-hidden border-r border-[var(--panel)] font-mono text-xs" style={{ width: `${(s.size / width) * 100}%`, background: COLORS[i], color: "var(--on-accent)" }}>{s.name}</div>
                  ))}
                </div>
              </div>
              <table className="mt-4 w-full font-mono text-xs">
                <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">item</th><th className="font-normal">basis</th><th className="font-normal">grow</th><th className="font-normal">shrink</th><th className="text-right font-normal">final</th></tr></thead>
                <tbody>{r.sizes.map((s, i) => <tr key={s.name}><td className="py-1" style={{ color: COLORS[i] }}>{s.name}</td><td>{s.basis}</td><td>{s.grow}</td><td>{s.shrink}</td><td className="text-right">{s.size.toFixed(0)}px <span className="text-[var(--faint)]">({s.delta >= 0 ? "+" : ""}{s.delta.toFixed(0)})</span></td></tr>)}</tbody>
              </table>
            </section>
          }
          panel={<SystemMapPanel caption={r.mode === "grow" ? `${r.free}px spare: split 2:1 between main and aside; nav has grow 0 and stays at 120.` : `${-r.free}px short: each item gives up shrink × basis, so aside (shrink 2) shrinks fastest.`}><Slider label="Container width" accent={ACCENT} value={width} min={380} max={900} step={20} format={(v) => `${v}px`} onChange={setWidth} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Start from flex-basis" what="Each item's starting size. Here 120 + 300 + 160 = 580px." accent={ACCENT}><p className="font-mono text-sm">flex: grow shrink basis</p></FlowStep>
              <FlowArrow label="compare with the container" accent={ACCENT} />
              <FlowStep n={2} title="Extra room goes by flex-grow" what="Leftover space is split in proportion to grow. Grow 0 means “never get bigger”." accent={ACCENT} active={r.mode === "grow"}><p className="text-sm text-[var(--muted)]">main gets 2 shares, aside 1, nav none.</p></FlowStep>
              <FlowArrow label="or not enough room" accent={ACCENT} />
              <FlowStep n={3} title="A shortfall goes by shrink × basis" what="Big items with a high shrink lose the most. That's why a long word or image can refuse to shrink: min-width: auto stops it." accent={ACCENT} active={r.mode === "shrink"}><p className="text-sm text-[var(--muted)]">Add min-width: 0 to let flex items shrink below their content.</p></FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} />
              <FlowStep n={4} title="Common patterns" what="flex: 1 shares space equally. flex: none keeps an item fixed. A sidebar is often flex: 0 0 240px with the main area at flex: 1." accent={ACCENT}><p className="text-sm text-[var(--muted)]">For two-dimensional layouts, use Grid.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
