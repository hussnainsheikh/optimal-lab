"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { sizes } from "@/lib/boxModel";

const ACCENT = "var(--web)";

export default function BoxModelDemo() {
  const [pad, setPad] = useState(20);
  const [border, setBorder] = useState(4);
  const [margin, setMargin] = useState(16);
  const [bs, setBs] = useState("content");
  const s = sizes(200, pad, border, margin, bs === "border");
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="The CSS box model" blurb="Every element is a box: content, then padding, then border, then margin. With the default box-sizing, width: 200px sets only the content, so padding and border make the box wider. border-box makes width mean what you'd expect. This box is rendered live." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Live box">
              <pre className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`.card {\n  box-sizing: ${bs === "border" ? "border-box" : "content-box"};\n  width: 200px;\n  padding: ${pad}px;\n  border: ${border}px solid;\n  margin: ${margin}px;\n}`}</pre>
              <div className="mt-3 overflow-x-auto rounded-lg bg-[var(--inset)]">
                <div className="inline-block" style={{ background: "color-mix(in srgb, var(--auto) 25%, transparent)" }}>
                  <div style={{ boxSizing: bs === "border" ? "border-box" : "content-box", width: 200, padding: pad, border: `${border}px solid var(--text)`, margin, background: "color-mix(in srgb, var(--good) 30%, transparent)" }}>
                    <div className="grid h-12 place-items-center font-mono text-xs" style={{ background: ACCENT, color: "var(--on-accent)" }}>{s.content}px</div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]"><span style={{ color: ACCENT }}>■</span> content · <span className="text-[var(--good)]">■</span> padding · ▬ border · <span className="text-[var(--auto)]">■</span> margin</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[["Content", `${s.content}px`], ["Visible box", `${s.borderBoxW}px`], ["Space taken", `${s.space}px`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={bs === "content" ? `content-box: 200 content + ${2 * pad} padding + ${2 * border} border = ${s.borderBoxW}px wide. Two of these won't fit in a 400px row.` : `border-box: the visible box is exactly 200px; the content shrinks to ${s.content}px to make room. That's why most resets set it globally.`}>
              <Choices label="box-sizing" accent={ACCENT} value={bs} onChange={setBs} options={[{ id: "content", label: "content-box (default)" }, { id: "border", label: "border-box" }]} />
              <Slider label="Padding" accent={ACCENT} value={pad} min={0} max={40} step={2} format={(v) => `${v}px`} onChange={setPad} />
              <Slider label="Border" accent={ACCENT} value={border} min={0} max={12} step={1} format={(v) => `${v}px`} onChange={setBorder} />
              <Slider label="Margin" accent={ACCENT} value={margin} min={0} max={40} step={2} format={(v) => `${v}px`} onChange={setMargin} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Four layers" what="Content holds text and children; padding is space inside the border; margin is space outside it." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Background covers content and padding.</p></FlowStep>
              <FlowArrow label="width means…" accent={ACCENT} />
              <FlowStep n={2} title="content-box adds padding and border" what="The historical default: the declared width is only the content." accent={ACCENT} active={bs === "content"}><p className="text-sm text-[var(--muted)]">Source of many overflow bugs.</p></FlowStep>
              <FlowArrow label="fix" accent={ACCENT} />
              <FlowStep n={3} title="border-box everywhere" what="Width includes padding and border. Set it once for all elements." accent={ACCENT} active={bs === "border"}><p className="font-mono text-xs">*, *::before, *::after {"{ box-sizing: border-box; }"}</p></FlowStep>
              <FlowArrow label="quirk" accent={ACCENT} />
              <FlowStep n={4} title="Vertical margins collapse" what="Two stacked blocks with 24px and 16px margins are 24px apart, not 40. Flex and grid children don't collapse; gap is simpler." accent={ACCENT}><p className="text-sm text-[var(--muted)]">DevTools shows the box diagram for any element.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
