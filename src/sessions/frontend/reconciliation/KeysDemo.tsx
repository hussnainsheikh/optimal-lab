"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { NEW, START } from "@/lib/listKeys";

const ACCENT = "var(--web)";

function Row({ name }: { name: string }) {
  const [note, setNote] = useState(`notes on ${name}`);
  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-sm font-medium">{name}</span>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="min-h-9 rounded border border-[var(--line)] bg-[var(--inset)] px-2 text-xs" aria-label={`Notes for ${name}`} style={{ color: note.endsWith(name) ? undefined : "var(--bad)" }} />
    </li>
  );
}

function List({ items, byIndex }: { items: typeof START; byIndex: boolean }) {
  return <ul className="space-y-1">{items.map((it, i) => <Row key={byIndex ? i : it.id} name={it.name} />)}</ul>;
}

export default function KeysDemo() {
  const [items, setItems] = useState(START);
  const [gen, setGen] = useState(0);
  const inserted = items.length > START.length;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Reconciliation and keys" blurb="When a list re-renders, React matches old and new items by key and reuses the matching DOM, including any state inside it. Use the array index as the key and inserting at the top shifts every match by one. These two lists are real React; try it." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section key={gen} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two lists">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-2 font-mono text-xs" style={{ color: inserted ? "var(--bad)" : "var(--muted)" }}>key={"{index}"}</p><List items={items} byIndex /></div>
                <div><p className="mb-2 font-mono text-xs" style={{ color: inserted ? "var(--good)" : "var(--muted)" }}>key={"{item.id}"}</p><List items={items} byIndex={false} /></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={inserted} onClick={() => setItems([NEW, ...items])} className="min-h-11 rounded-md px-4 text-sm disabled:opacity-40" style={{ background: ACCENT, color: "var(--on-accent)" }}>Insert Zoe at the top</button>
                <button type="button" onClick={() => { setItems(START); setGen((g) => g + 1); }} className="min-h-11 rounded-md border border-[var(--line)] px-4 text-sm">Reset</button>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={inserted ? "Left: React saw keys 0, 1, 2, 3 and reused the first three inputs for Zoe, Ada and Bo, so their state moved with them: every note is next to the wrong name, and Cy's is new. Right: keys a, b, c survived, so only Zoe's row was created." : "Both lists look the same. Edit a note if you like, then insert Zoe at the top."}><p className="text-sm text-[var(--muted)]">Each row keeps its note in its own useState, which React preserves by key.</p></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Render, then diff" what="React compares the new element tree with the previous one and changes only what differs." accent={ACCENT}><p className="text-sm text-[var(--muted)]">That&apos;s reconciliation.</p></FlowStep>
              <FlowArrow label="lists" accent={ACCENT} />
              <FlowStep n={2} title="Keys say which item is which" what="Same key: same component, keep its DOM and state. New key: create. Missing key: destroy." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Keys only need to be unique among siblings.</p></FlowStep>
              <FlowArrow label="the bug" accent={ACCENT} />
              <FlowStep n={3} title="Index keys break on insert, delete, sort" what="Positions change but keys don't follow the data, so state ends up on the wrong row." accent={ACCENT} active={inserted}><p className="text-sm text-[var(--muted)]">Fine only for static lists.</p></FlowStep>
              <FlowArrow label="trick" accent={ACCENT} />
              <FlowStep n={4} title="Change the key to reset state" what="Giving a component a new key throws away its state on purpose: a form keyed by user id resets when the user changes." accent={ACCENT}><p className="font-mono text-xs">&lt;Profile key={"{userId}"} /&gt;</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
