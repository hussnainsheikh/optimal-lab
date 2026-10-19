"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { BASE, BASE_VERSION, EDITS, FULL_RECORDS, OFFLINE_FROM, RECONNECT_AT, STRATEGIES, sync, syncBytes, type Strategy, type Task } from "@/lib/offlineSync";

const ACCENT = "var(--sys)";
const clock = (m: number) => `09:${String(m).padStart(2, "0")}`;
const show = (t: Task) => `“${t.title}” · ${t.done ? "done" : "not done"} · due ${t.due}`;

export default function OfflineSyncDemo() {
  const [strategy, setStrategy] = useState<Strategy>("recordLww");
  const [skew, setSkew] = useState(0);
  const [delta, setDelta] = useState(true);
  const { stage, busy, run } = useWalk(5, 1200);
  const at = (i: number) => stage === i;
  const r = sync(strategy, skew);
  const phone = EDITS.filter((e) => e.device === "phone");
  const laptop = EDITS.filter((e) => e.device === "laptop");
  const lostKey = new Set(r.lost.map((e) => `${e.device}-${e.at}`));

  const packets: Packet[] =
    stage === 0 ? hops("local", ["phone", "sqlite"], { label: "write" })
    : stage === 1 ? hops("lap", ["laptop", "server"], { label: "due, title" })
    : stage === 2 ? hops("push", ["server", "push", "phone"], { label: "wake up" })
    : stage === 3 ? hops("up", ["sqlite", "phone", "server"], { label: `${r.pending} changes, v${BASE_VERSION}`, tone: r.conflictFields.length ? "bad" : "accent" })
    : stage === 4 ? [...hops("down1", ["server", "phone"], { label: "merged", tone: r.lost.length ? "bad" : "good" }), ...hops("down2", ["server", "laptop"], { label: "merged", tone: r.lost.length ? "bad" : "good" })]
    : [];

  const captions = [
    `Step 1: offline from ${clock(OFFLINE_FROM)}, the phone saves to its own database and queues ${r.pending} changes.`,
    `Step 2: meanwhile the laptop, online, changes the due date and the title. The server is now at v${BASE_VERSION + 1}.`,
    `Step 3: at ${clock(RECONNECT_AT)} the phone is back online, and a push notification tells it to sync.`,
    `Step 4: the phone sends its changes based on v${BASE_VERSION}; the server sees the title changed on both sides.`,
    `Step 5: ${STRATEGIES.find((x) => x.id === strategy)!.label.toLowerCase()}: ${r.lost.length} edit${r.lost.length === 1 ? "" : "s"} lost${r.needsUser ? ", one question for the user" : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGIES.find((x) => x.id === strategy)!.label}: ${show(r.final)}. ${r.lost.length} of ${EDITS.length} edits lost.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Mobile and offline sync"
        blurb={`A to-do app on a phone and a laptop. The task is ${show(BASE)}. The phone goes offline on the train and edits it; meanwhile the laptop edits it too. When the phone reconnects, the server holds two versions of one record. Pick how to merge them and count the edits that disappear.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A phone with a local SQLite database, a laptop, the sync server and a push notification service"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "sqlite", label: "Local SQLite", sub: `${r.pending} queued`, at: [12, 22], mobileAt: [22, 10], state: stage !== null && stage <= 3 ? "active" : "idle" },
                  { id: "phone", label: "Phone", sub: stage !== null && stage < 2 ? "offline" : "online", at: [12, 74], mobileAt: [22, 50], state: stage !== null && stage < 2 ? "wait" : "active" },
                  { id: "server", label: "Sync server", sub: `v${stage === null || stage >= 1 ? BASE_VERSION + 1 : BASE_VERSION}`, at: [55, 50], mobileAt: [72, 50], state: stage === 3 && r.conflictFields.length ? "bad" : "active" },
                  { id: "push", label: "Push service", sub: "APNs / FCM", at: [55, 12], mobileAt: [72, 12], state: stage === 2 ? "active" : "idle" },
                  { id: "laptop", label: "Laptop", sub: "online", at: [90, 74], mobileAt: [50, 90], state: "active" },
                ]}
                links={[
                  { from: "phone", to: "sqlite", label: "local writes" },
                  { from: "phone", to: "server", label: "sync", dashed: true },
                  { from: "laptop", to: "server", label: "live edits" },
                  { from: "server", to: "push", label: "notify" },
                  { from: "push", to: "phone", label: "wake", dashed: true },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="The edits from each device and which ones survive">
                <ol className="space-y-1 font-mono text-[11px]">
                  {[...EDITS].sort((x, y) => x.at - y.at).map((e) => {
                    const lost = lostKey.has(`${e.device}-${e.at}`);
                    return (
                      <li key={`${e.device}-${e.at}`} className="grid grid-cols-[3rem_3.5rem_minmax(0,1fr)] gap-2" style={{ color: lost ? "var(--bad)" : "var(--text)", textDecoration: lost ? "line-through" : "none" }}>
                        <span>{clock(e.at)}</span>
                        <span>{e.device}</span>
                        <span className="min-w-0 break-words">
                          {e.field} = {String(e.value)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-2 text-xs">
                  Result: <span className="font-mono">{show(r.final)}</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Resolve conflicts with" accent={ACCENT} value={strategy} onChange={setStrategy} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Syncing…">
                Ride the train
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write locally first" what="The app reads and writes its own database on the phone, so it works in a tunnel exactly as it does on wifi. Each change also goes into an outbox: a queue of operations waiting to be sent." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {phone.map((e) => (
                    <li key={e.at}>
                      {clock(e.at)} {e.field} = {String(e.value)} → outbox
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="meanwhile" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Version every record" what={`The server keeps a version number per record. Both devices started from v${BASE_VERSION}; the laptop's save made it v${BASE_VERSION + 1}. A change that says “based on v${BASE_VERSION}” arriving after that is how the server knows it missed something.`} accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {laptop.map((e) => (
                    <li key={e.at}>
                      {clock(e.at)} laptop: {e.field} = {String(e.value)}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="back online" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Sync on reconnect, and send only changes" what="When the network returns, or a silent push notification says there's news, the app sends its outbox and pulls what changed since its last sync. Sending the whole dataset each time is simple and doesn't scale." accent={ACCENT} active={at(2)}>
                <Toggle checked={delta} onChange={setDelta} label="Send only changes since the last sync" />
                <p className="font-mono text-xs">
                  {delta ? `${r.pending} operations + a sync token` : `all ${FULL_RECORDS.toLocaleString("en-US")} tasks`} = {(syncBytes(delta, r.pending) / 1024).toFixed(1)} KB
                </p>
              </FlowStep>
              <FlowArrow label="two versions" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Detect the conflict" what="Changes to different fields of the same record aren't really a conflict. Changes to the same field are. Timestamps from the devices' own clocks decide “last” under last-write-wins, and phone clocks are often wrong." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">conflicting fields: {r.conflictFields.join(", ") || "none"}</p>
                <Choices label="Phone clock" accent={ACCENT} value={String(skew)} onChange={(v) => setSkew(Number(v))} options={[{ id: "0", label: "Correct" }, { id: "-10", label: "10 min slow" }]} />
              </FlowStep>
              <FlowArrow label="merge" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Choose how to resolve it" what="Whole-record last-write-wins is the default in many tools and quietly loses data. Merging by field keeps every change that didn't collide. When two people really did change the same thing, keeping both and asking (or a CRDT, see collaborative editing) is the only way to lose nothing." accent={ACCENT} active={at(4)}>
                <Choices label="Resolve conflicts with" accent={ACCENT} value={strategy} onChange={setStrategy} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === strategy)!.one}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {STRATEGIES.map((x) => {
                    const y = sync(x.id, skew);
                    return <Row key={x.id} a={x.label} b={`${y.lost.length} lost${y.needsUser ? " · asks" : ""}`} bad={y.lost.length > 0} bold={x.id === strategy} />;
                  })}
                </div>
                <p className="mt-2 text-xs" style={{ color: r.lost.length ? "var(--bad)" : "var(--good)" }}>
                  {r.note}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ a, b, bad, bold }: { a: string; b: string; bad: boolean; bold: boolean }) {
  return (
    <>
      <span className="font-sans" style={{ fontWeight: bold ? 700 : 400 }}>
        {a}
      </span>
      <span className="text-right" style={{ fontWeight: bold ? 700 : 400, color: bad ? "var(--bad)" : "var(--good)" }}>
        {b}
      </span>
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
