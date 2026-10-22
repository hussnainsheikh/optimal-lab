"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { STORES, TAMPERS, attack, buildLog, type Store, type Tamper } from "@/lib/auditLogs";

const ACCENT = "var(--sys)";

export default function AuditLogsDemo() {
  const [store, setStore] = useState<Store>("table");
  const [tamper, setTamper] = useState<Tamper>("edit");
  const [dba, setDba] = useState(true);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const original = buildLog();
  const v = attack(store, tamper, dba);
  const label = STORES.find((s) => s.id === store)!.label;

  const captions = [
    `Step 1: ${original.length} entries. Entry 4: kim exported 4,000 patient records, a minute after being made admin.`,
    `Step 2: kim wants entry 4 gone. ${TAMPERS.find((t) => t.id === tamper)!.one}`,
    v.succeeded ? `Step 3: ${label.toLowerCase()}: the change goes through.` : `Step 3: ${label.toLowerCase()}: ${v.detected ? `the change is made, but verification flags entry ${v.detectedAt}` : "the change is refused"}.`,
    `Step 4: ${v.how}`,
    v.succeeded ? "Step 5: the log now lies, and nobody can tell." : "Step 5: the tampering is visible, or impossible.",
  ];
  const caption = stage !== null ? captions[stage] : `${label}: ${v.succeeded ? "the tampering goes unnoticed" : v.detected ? `tampering detected at entry ${v.detectedAt}` : "the tampering is refused"}. ${v.how}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Audit logs"
        blurb="An audit log records who did what and when, for investigations, compliance and customers who ask. It's only worth anything if the people it records can't change it. An insider exports patient records, then tries to edit the log. See which designs notice."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The audit log after the tampering attempt">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">audit_log · {label}</p>
                <p className="font-mono text-xs" style={{ color: v.succeeded ? "var(--bad)" : "var(--good)" }}>
                  {v.succeeded ? "tampering unnoticed" : v.detected ? `broken at #${v.detectedAt}` : "refused"}
                </p>
              </div>
              <ol className="mt-3 space-y-0.5 font-mono text-[10px] sm:text-[11px]">
                {v.log.map((e) => {
                  const orig = original.find((o) => o.seq === e.seq)!;
                  const changed = orig.action !== e.action || orig.hash !== e.hash;
                  const broken = v.detectedAt !== null && e.seq >= v.detectedAt;
                  return (
                    <li key={e.seq} className="grid grid-cols-[1.25rem_2.5rem_2rem_minmax(0,1fr)] gap-x-1.5 sm:grid-cols-[1.25rem_2.5rem_2rem_minmax(0,1fr)_4rem_4rem]" style={{ color: changed ? "var(--bad)" : "var(--text)" }}>
                      <span className="text-[var(--faint)]">{e.seq}</span>
                      <span>{e.at}</span>
                      <span>{e.actor}</span>
                      <span className="min-w-0 truncate">{e.action}</span>
                      {(store === "chain" || store === "anchored") && (
                        <>
                          <span className="hidden text-[var(--faint)] sm:inline">{e.prev}</span>
                          <span className="hidden sm:inline" style={{ color: broken ? "var(--bad)" : "var(--muted)" }}>
                            {e.hash}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {v.log.length < original.length && (
                <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--bad)" }}>
                  entries {original.filter((o) => !v.log.some((e) => e.seq === o.seq)).map((o) => o.seq).join(", ")} removed
                </p>
              )}
              {(store === "chain" || store === "anchored") && <p className="mt-2 text-[11px] text-[var(--muted)]">Columns: previous hash, this entry&rsquo;s hash. 32-bit FNV-1a for display; real systems use SHA-256.</p>}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="How the log is stored" accent={ACCENT} value={store} onChange={setStore} options={STORES.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Tampering…">
                Try to hide it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Record who, what, when and on what" what="Each entry names the actor, the action, the target and the time, written by the server at the moment it happens, never reconstructed later. Role changes and bulk exports are the entries investigators look for first." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {original.slice(2, 5).map((e) => (
                    <li key={e.seq} style={{ color: e.seq === 4 ? "var(--bad)" : "var(--text)" }}>
                      #{e.seq} {e.at} {e.actor}: {e.action}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="an insider" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Assume someone will try to edit it" what="The people with the most reason to change the log are often the ones with access to it: an admin, a database administrator, a compromised service account." accent={ACCENT} active={at(1)}>
                <Choices label="What they try" accent={ACCENT} value={tamper} onChange={setTamper} options={TAMPERS.map((t) => ({ id: t.id, label: t.label }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={dba} onChange={(e) => setDba(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The insider has database admin rights
                </label>
              </FlowStep>
              <FlowArrow label="the storage" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Make it append-only" what="Give the application's database user INSERT on the log and nothing else. That stops the app, and anyone who compromises it, from rewriting history. It doesn't stop a database administrator." accent={ACCENT} active={at(2)}>
                <Choices label="How the log is stored" accent={ACCENT} value={store} onChange={setStore} options={STORES.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 text-xs">{STORES.find((s) => s.id === store)!.one}</p>
              </FlowStep>
              <FlowArrow label="chain the entries" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Chain each entry to the one before" what="Store in each entry the hash of the previous entry. Changing or deleting any entry breaks the link to the next, and a verifier that re-hashes the log finds exactly where. But someone who can rewrite the whole tail can recompute every hash after their edit." accent={ACCENT} active={at(3)}>
                <p className="text-xs" style={{ color: v.succeeded ? "var(--bad)" : "var(--good)" }}>
                  {v.how}
                </p>
              </FlowStep>
              <FlowArrow label="anchor it elsewhere" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Anchor the latest hash where they can't reach" what="Every few minutes, copy the newest hash somewhere the insider can't write: another cloud account, write-once object storage, a transparency log. A rewritten chain no longer ends at the anchored hash." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {STORES.map((s) => {
                    const y = attack(s.id, tamper, dba);
                    return (
                      <Row key={s.id} a={s.label} b={y.succeeded ? "unnoticed" : y.detected ? `caught at #${y.detectedAt}` : "refused"} bad={y.succeeded} bold={s.id === store} />
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Retention matters as much: keep the log as long as regulations and investigations need, and no longer, since it is personal data too.</p>
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
