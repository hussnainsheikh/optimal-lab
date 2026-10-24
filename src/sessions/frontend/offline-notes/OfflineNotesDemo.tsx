"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BASE, LAPTOP_SAVED, PHONE_CLOCK_SKEW_MIN, PHONE_SAVED, eviction, resolve, storageCheck, sync, type Storage, type Strategy } from "@/lib/offlineNotes";

const ACCENT = "var(--web)";

type Opts = { store: Storage; notes: number; idempotent: boolean; inOrder: boolean; strategy: Strategy; bothEditDinner: boolean; persisted: boolean; installed: boolean };
const NAIVE: Opts = { store: "localStorage", notes: 1000, idempotent: false, inOrder: false, strategy: "lww", bothEditDinner: false, persisted: false, installed: false };
const TUNED: Opts = { store: "indexedDB", notes: 1000, idempotent: true, inOrder: true, strategy: "merge", bothEditDinner: false, persisted: true, installed: false };

export default function OfflineNotesDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const st = storageCheck(o.store, o.notes);
  const sy = sync(o.idempotent, o.inOrder);
  const res = resolve(o.strategy, o.bothEditDinner);
  const ev = eviction(o.persisted, o.installed);

  const nodes: MapNode[] = [
    { id: "phone", label: "Phone, offline", sub: "edits on the train", at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "store", label: o.store === "indexedDB" ? "IndexedDB" : "localStorage", sub: st.ok ? `${Math.round(st.usedKb).toLocaleString("en-US")} KB used` : "quota exceeded", at: [50, 22], mobileAt: [75, 12], state: st.ok ? "good" : "bad" },
    { id: "outbox", label: "Outbox", sub: `${sy.log.length} sends · ${sy.problems} problem${sy.problems === 1 ? "" : "s"}`, at: [86, 22], mobileAt: [75, 45], state: sy.problems ? "bad" : "good" },
    { id: "server", label: "Sync server", sub: `${sy.packingLists} "Packing list" note${sy.packingLists === 1 ? "" : "s"}`, at: [86, 78], mobileAt: [75, 80], state: sy.packingLists > 1 ? "bad" : "good" },
    { id: "laptop", label: "Laptop", sub: "edited the same note", at: [50, 78], mobileAt: [25, 80], state: res.lostEdits || res.conflicts ? "wait" : "good" },
    { id: "browser", label: "Browser storage", sub: ev.safe ? "kept" : "may be cleared", at: [14, 78], mobileAt: [25, 45], state: ev.safe ? "good" : "bad" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("s", ["phone", "store"], { label: `${o.notes} notes`, tone: st.ok ? "good" : "bad" })
    : stage === 1 ? hops("q", ["phone", "outbox"], { label: "4 changes queued" })
    : stage === 2 ? hops("y", ["outbox", "server"], { label: sy.problems ? `${sy.problems} problem${sy.problems === 1 ? "" : "s"}` : "all applied", tone: sy.problems ? "bad" : "good" })
    : stage === 3 ? hops("m", ["laptop", "server", "phone"], { label: res.lostEdits ? `${res.lostEdits} edits lost` : res.conflicts ? "1 conflict" : "merged", tone: res.lostEdits ? "bad" : res.conflicts ? "accent" : "good" })
    : stage === 4 ? hops("e", ["browser", "store"], { label: ev.safe ? "persisted" : "best effort", tone: ev.safe ? "good" : "bad" })
    : [];

  const captions = [
    st.ok ? `Step 1: ${o.notes.toLocaleString("en-US")} notes take ${Math.round(st.usedKb).toLocaleString("en-US")} KB in ${o.store}: ${st.note}.` : `Step 1: ${st.note}.`,
    "Step 2: offline, every change goes into an outbox on the device: create a note, edit another, delete a draft, edit the new one.",
    sy.problems ? `Step 3: replaying the outbox: ${sy.log.filter((l) => l.bad).map((l) => l.result).join("; ")}.` : "Step 3: the outbox replays in order, and the retried create is recognised by its idempotency key.",
    o.strategy === "lww" ? `Step 4: last write wins by each device's clock: ${res.note}, and ${res.lostEdits} edits are silently lost.` : `Step 4: a three-way merge against the last synced version: ${res.note}.`,
    `Step 5: ${ev.note}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${st.ok ? "stored" : "storage full"} · ${sy.problems} sync problem${sy.problems === 1 ? "" : "s"} · ${res.lostEdits} lost edit${res.lostEdits === 1 ? "" : "s"}, ${res.conflicts} conflict${res.conflicts === 1 ? "" : "s"} · data ${ev.safe ? "kept" : "at risk"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · case study"
        title="An offline-first notes app"
        blurb="An offline-first app treats the device as the place the data lives and the server as somewhere to sync with. That means choosing storage that can hold it, queuing changes safely, replaying them in order, merging edits made on two devices, and asking the browser not to throw it all away."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="An offline phone stores notes locally and queues changes in an outbox; the outbox syncs to a server, which also takes edits from a laptop; the browser decides whether to keep local data"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "phone", to: "store", label: "save" },
                  { from: "phone", to: "outbox", label: "queue" },
                  { from: "outbox", to: "server", label: "sync" },
                  { from: "laptop", to: "server", label: "sync" },
                  { from: "browser", to: "store", label: "evict?" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The Trip plan note after syncing">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  “Trip plan” after sync · {o.strategy === "lww" ? "last write wins" : "three-way merge"}
                </p>
                <ol className="mt-2 space-y-0.5 text-xs">
                  {res.lines.map((l, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-x-2 rounded px-1.5 py-0.5" style={{ background: l.conflict ? "color-mix(in srgb, var(--bad) 18%, transparent)" : undefined }}>
                      <span className="break-words">{l.text}</span>
                      <span className="font-mono text-[10px] text-[var(--faint)]">{l.text === BASE[i] ? "unchanged" : l.from}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  Phone saved at {PHONE_SAVED} (its clock says {PHONE_CLOCK_SKEW_MIN} min); laptop at {LAPTOP_SAVED}.
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Offline as an afterthought
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Offline first
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Syncing…">
                Go offline, then sync
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Keep the notes on the device" what="localStorage is small (about 5 MB, and strings take two bytes a character) and every call blocks the page. IndexedDB is asynchronous, stores structured data and blobs, and gets a real share of the disk." accent={ACCENT} active={at(0)}>
                <Choices<Storage> accent={ACCENT} value={o.store} onChange={(v) => set({ store: v })} options={[{ id: "localStorage", label: "localStorage" }, { id: "indexedDB", label: "IndexedDB" }]} />
                <Slider label="Notes" value={o.notes} min={100} max={2000} step={100} format={(v) => v.toLocaleString("en-US")} onChange={(v) => set({ notes: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: st.ok ? "var(--good)" : "var(--bad)" }}>
                  {Math.round(st.usedKb).toLocaleString("en-US")} KB · {st.note}
                </p>
              </FlowStep>
              <FlowArrow label="changes" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Queue every change in an outbox" what="Each change is saved locally at once and added to an outbox to send later. Give every operation an id, sent as an idempotency key, so a retry after a lost response doesn't apply it twice." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.idempotent} onChange={(e) => set({ idempotent: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  An Idempotency-Key on every operation
                </label>
              </FlowStep>
              <FlowArrow label="back online" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Replay it in order" what="An edit to a note depends on the create before it. Sending the outbox in parallel, or newest first, sends an edit for a note the server hasn't heard of." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.inOrder} onChange={(e) => set({ inOrder: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Send one at a time, oldest first
                </label>
                <ol className="space-y-0.5 text-[11px]">
                  {sy.log.map((l, i) => (
                    <li key={i} style={{ color: l.bad ? "var(--bad)" : "var(--muted)" }}>
                      {l.op.at} {l.op.kind} “{l.op.note}”: {l.result}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="the same note, two devices" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Merge edits from two devices" what="Last write wins by timestamp throws away one device's work, and trusts device clocks that drift. A three-way merge compares both versions with the last synced one: changes to different lines both survive; only the same line changed twice needs the person to decide." accent={ACCENT} active={at(3)}>
                <Choices<Strategy> accent={ACCENT} value={o.strategy} onChange={(v) => set({ strategy: v })} options={[{ id: "lww", label: "Last write wins" }, { id: "merge", label: "Three-way merge" }]} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.bothEditDinner} onChange={(e) => set({ bothEditDinner: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The laptop also changed the dinner line
                </label>
              </FlowStep>
              <FlowArrow label="weeks later" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Ask the browser to keep it" what="Browser storage is best-effort by default: it can be cleared when the disk is full, and Safari removes script-written data after seven days without a visit. navigator.storage.persist() asks for it to be kept." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.persisted} onChange={(e) => set({ persisted: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  navigator.storage.persist() granted
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.installed} onChange={(e) => set({ installed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Installed to the home screen
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The merge is a real line-by-line three-way merge; last-write-wins really compares the skewed clocks; storage sizes and quotas are approximate.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
