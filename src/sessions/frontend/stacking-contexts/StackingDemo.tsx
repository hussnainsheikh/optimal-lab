"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState, type CSSProperties } from "react";
import { Choices } from "@/components/session/ui";

const ACCENT = "var(--web)";
type Parent = "none" | "zindex" | "transform" | "portal";
const PARENT: Record<Parent, { label: string; css: string; style: CSSProperties }> = {
  none: { label: "Plain parent", css: ".card { position: relative; }", style: { position: "relative" } },
  zindex: { label: "Parent has z-index: 1", css: ".card { position: relative; z-index: 1; }", style: { position: "relative", zIndex: 1 } },
  transform: { label: "Parent has transform", css: ".card { transform: translateX(0); }", style: { transform: "translateX(0)" } },
  portal: { label: "Modal moved to <body>", css: ".card { position: relative; z-index: 1; }\n/* modal rendered via a portal */", style: { position: "relative", zIndex: 1 } },
};

export default function StackingDemo() {
  const [p, setP] = useState<Parent>("zindex");
  const trapped = p === "zindex" || p === "transform";
  const modal = <div className="absolute grid place-items-center rounded-lg border-2 text-sm font-medium" style={{ zIndex: 9999, left: "18%", right: "18%", top: p === "portal" ? 30 : -66, height: 70, background: "var(--panel)", borderColor: ACCENT }}>Modal · z-index: 9999</div>;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Stacking contexts and z-index" blurb="The modal has z-index 9999 and the header only 10, yet the modal can end up underneath. z-index only competes inside the same stacking context, and some CSS properties quietly create a new one. This is the real browser rendering it." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Live stacking example">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`.header { position: sticky; z-index: 10; }\n${PARENT[p].css}\n.modal { position: absolute; z-index: 9999; }`}</pre>
              <div className="relative mt-4 h-56 overflow-hidden rounded-lg border border-[var(--line)]" style={{ isolation: "isolate" }}>
                <div className="absolute inset-x-0 top-0 grid h-16 place-items-center text-sm font-medium" style={{ zIndex: 10, position: "absolute", background: "var(--c2)", color: "var(--on-accent)" }}>Header · z-index: 10</div>
                <div className="absolute inset-x-6 top-24 h-28 rounded-lg border border-[var(--line-strong)] p-2 text-xs text-[var(--muted)]" style={{ ...PARENT[p].style, position: "absolute" }}>
                  .card{p === "zindex" ? " (stacking context, z 1)" : p === "transform" ? " (stacking context via transform)" : p === "portal" ? " (z 1)" : " (no stacking context)"}
                  {p !== "portal" && modal}
                </div>
                {p === "portal" && modal}
              </div>
              <p className="mt-3 font-mono text-sm" style={{ color: trapped ? "var(--bad)" : "var(--good)" }}>{trapped ? "Modal is trapped below the header" : "Modal is on top"}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={trapped ? "The card forms a stacking context. Everything inside it, the modal included, is painted as one layer at the card's level, which is below the header's 10. 9999 only beats siblings inside the card." : p === "portal" ? "Rendering the modal at the top of the document puts it in the root context, where 9999 really does beat 10." : "The card doesn't create a context, so the modal competes directly with the header, and 9999 wins."}>
              <Choices label="Card styles" accent={ACCENT} value={p} onChange={setP} options={(Object.keys(PARENT) as Parent[]).map((k) => ({ id: k, label: PARENT[k].label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Stacking contexts are nested layers" what="Each context is painted as a unit. Children's z-index only orders things within their parent's context." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Like layers inside a group in a design tool.</p></FlowStep>
              <FlowArrow label="what creates one" accent={ACCENT} />
              <FlowStep n={2} title="More than z-index creates them" what="Positioned + z-index, but also transform, opacity &lt; 1, filter, will-change, isolation: isolate, and position: fixed/sticky." accent={ACCENT} active={p === "transform"}><p className="text-sm text-[var(--muted)]">A harmless animation can start the bug.</p></FlowStep>
              <FlowArrow label="the trap" accent={ACCENT} />
              <FlowStep n={3} title="A high number can't escape" what="Raising the modal to 999999 won't help. You'd have to raise the card, which drags everything inside along." accent={ACCENT} active={trapped}><p className="text-sm text-[var(--muted)]">Inspect with DevTools&apos; Layers panel.</p></FlowStep>
              <FlowArrow label="the fix" accent={ACCENT} />
              <FlowStep n={4} title="Portal overlays to the top" what="Render modals, menus and tooltips at the end of &lt;body&gt; (React's createPortal, or the native &lt;dialog&gt; top layer), and keep a small z-index scale." accent={ACCENT} active={p === "portal"}><p className="font-mono text-xs">dialog.showModal()</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
