"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { FIXES, stops } from "@/lib/focusOrder";

const ACCENT = "var(--web)";

export default function FocusDemo() {
  const [on, setOn] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Keyboard and focus" blurb="Many people never touch a mouse: screen reader users, power users, people with motor impairments. They move with Tab. Every interactive element must be reachable, show where focus is, and dialogs must keep focus inside and give it back on close. Press Tab through this page." />
      <div className="mt-6"><Run key={[...on].sort().join()} on={on} toggle={toggle} /></div>
    </SessionPage>
  );
}

function Run({ on, toggle }: { on: Set<string>; toggle: (id: string) => void }) {
  const seq = stops(on);
  const playback = usePlayback(seq.length, 900);
  const cur = seq[playback.i];
  const bad = seq.slice(0, playback.i + 1).filter((s) => s.note === "bad").length;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Focus sequence">
          <ol className="space-y-1">
            {seq.map((s, i) => (
              <li key={i} className="rounded px-2 py-1.5 text-sm" style={{ marginLeft: s.where === "dialog" ? 16 : 0, background: s.where === "dialog" ? "var(--inset)" : undefined, outline: i === playback.i ? (on.has("outline") ? `3px solid ${ACCENT}` : "1px dotted var(--faint)") : undefined, outlineOffset: 2, color: s.note === "bad" ? "var(--bad)" : s.label.startsWith("—") ? "var(--faint)" : undefined, opacity: i <= playback.i ? 1 : 0.35 }}>{s.label}</li>
            ))}
          </ol>
          {!on.has("outline") && <p className="mt-2 text-xs text-[var(--bad)]">outline: none: you can barely tell which item has focus.</p>}
          <p className="mt-2 font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>{bad} keyboard traps or dead ends so far</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={cur.note === "bad" ? "A keyboard user is stuck or lost here." : cur.where === "dialog" ? "Inside the dialog." : "Tab moves focus in DOM order."}>
          <div className="w-full space-y-1.5">{FIXES.map((f) => <label key={f.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={on.has(f.id)} onChange={() => toggle(f.id)} style={{ accentColor: ACCENT }} />{f.label}</label>)}</div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Press Tab" status={`stop ${playback.i + 1} of ${seq.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Use real interactive elements" what="&lt;button&gt; and &lt;a href&gt; are focusable and work with Enter and Space for free. A clickable div is neither." accent={ACCENT} active={!on.has("button")}><p className="text-sm text-[var(--muted)]">tabindex=&quot;0&quot; plus key handlers is the hard way.</p></FlowStep>
          <FlowArrow label="see it" accent={ACCENT} />
          <FlowStep n={2} title="Never remove the focus ring" what="Style it with :focus-visible instead of deleting it." accent={ACCENT} active={!on.has("outline")}><p className="font-mono text-xs">:focus-visible {"{ outline: 2px solid; }"}</p></FlowStep>
          <FlowArrow label="dialogs" accent={ACCENT} />
          <FlowStep n={3} title="Trap focus while open" what="Tab cycles within the dialog; Escape closes it; the page behind is inert." accent={ACCENT} active={!on.has("trap")}><p className="text-sm text-[var(--muted)]">&lt;dialog&gt; with showModal() does this natively.</p></FlowStep>
          <FlowArrow label="close" accent={ACCENT} />
          <FlowStep n={4} title="Restore focus" what="Send focus back to the button that opened it, so the user carries on where they were." accent={ACCENT} active={!on.has("restore")}><p className="text-sm text-[var(--muted)]">Test by unplugging your mouse for ten minutes.</p></FlowStep>
        </>
      }
    />
  );
}
