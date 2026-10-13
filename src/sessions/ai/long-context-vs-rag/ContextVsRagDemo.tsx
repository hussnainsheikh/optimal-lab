"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { compare, WINDOW } from "@/lib/contextVsRag";

const ACCENT = "var(--ai)";
const PAGES = [20, 50, 150, 300, 600, 2000, 10000];

export default function ContextVsRagDemo() {
  const [pi, setPi] = useState(1);
  const pages = PAGES[pi];
  const r = compare(pages);
  const rows = [
    { name: "Whole corpus in context", ...r.long },
    { name: "RAG: top 8 chunks", ...r.rag },
  ];
  const caption = !r.long.fits ? `${pages.toLocaleString()} pages is ${(r.all / 1000).toFixed(0)}k tokens, far past the ${WINDOW / 1000}k window. Most of it can't be included, so long context fails; RAG still finds the relevant chunks.`
    : pages <= 50 ? "Small corpus: put it all in context. It's simple, accurate, and cheap enough. RAG would add machinery for little gain."
    : "It fits, but every question pays for the whole corpus, it's slower, and accuracy drops as the relevant bit gets buried in the middle.";
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="Long context vs RAG" blurb="Context windows are now huge. Why not paste every document into each prompt instead of building retrieval? Grow the document set and compare cost, speed and accuracy per question. Figures are illustrative, at an example price of $3 per million input tokens." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Comparison">
              <p className="font-mono text-xs text-[var(--faint)]">{pages.toLocaleString()} pages ≈ {(r.all / 1000).toFixed(0)}k tokens · window {WINDOW / 1000}k</p>
              <span className="mt-2 block h-3 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${Math.min(100, (r.all / WINDOW) * 100)}%`, background: r.long.fits ? ACCENT : "var(--bad)" }} /></span>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal" /><th className="font-normal">tokens</th><th className="font-normal">cost</th><th className="font-normal">latency</th><th className="font-normal">accuracy</th></tr></thead>
                <tbody>{rows.map((x) => <tr key={x.name}><td className="py-2 pr-2 text-xs">{x.name}</td><td className="font-mono">{(x.tokens / 1000).toFixed(1)}k</td><td className="font-mono">${x.cost.toFixed(3)}</td><td className="font-mono">{x.latency.toFixed(1)} s</td><td className="font-mono" style={{ color: x.acc > 0.8 ? "var(--good)" : x.acc > 0.6 ? "var(--auto)" : "var(--bad)" }}>{Math.round(x.acc * 100)}%</td></tr>)}</tbody>
              </table>
              <p className="mt-3 font-mono text-xs text-[var(--muted)]">At 10,000 questions a day: long context ${(r.long.cost * 10000).toFixed(0)}/day vs RAG ${(r.rag.cost * 10000).toFixed(0)}/day</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Slider label="Document set" accent={ACCENT} value={pi} min={0} max={PAGES.length - 1} step={1} format={(i) => `${PAGES[i].toLocaleString()} pages`} onChange={setPi} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Small and stable: just use the context" what="A handbook or a few contracts fit easily. No index to build or keep fresh." accent={ACCENT} active={pages <= 50}><p className="text-sm text-[var(--muted)]">Prompt caching makes repeats cheap.</p></FlowStep>
              <FlowArrow label="it grows" accent={ACCENT} />
              <FlowStep n={2} title="Long prompts cost on every call" what="You pay for every token, every time, and latency grows with length. Models also miss facts buried mid-context." accent={ACCENT} active={pages > 50 && r.long.fits}><p className="text-sm text-[var(--muted)]">“Lost in the middle.”</p></FlowStep>
              <FlowArrow label="too big" accent={ACCENT} />
              <FlowStep n={3} title="Past the window, retrieve" what="RAG sends only the few chunks that matter. Cost stays flat as the corpus grows; quality depends on retrieval." accent={ACCENT} active={!r.long.fits}><p className="text-sm text-[var(--muted)]">Evaluate retrieval recall separately.</p></FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} />
              <FlowStep n={4} title="Often both" what="Retrieve generously (whole documents, not tiny snippets) into a large context. Permissions and freshness also favour retrieval." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Measure on your own questions.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
