"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DETECT_HOURS, LEAKS, SECRET_SCANNING_MINUTES, SERVICES, STORES, TTL_DYNAMIC_H, hours, run, type LeakId, type Store } from "@/lib/secrets";

const ACCENT = "var(--sys)";

export default function SecretsDemo() {
  const [store, setStore] = useState<Store>("code");
  const [leak, setLeak] = useState<LeakId>("public-repo");
  const [scanning, setScanning] = useState(false);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = run(store, leak, scanning);
  const label = STORES.find((s) => s.id === store)!.label;
  const maxExposure = Math.max(...STORES.map((s) => run(s.id, leak, scanning).exposureHours), 1);

  const captions = [
    `Step 1: the database password is ${label.toLowerCase()}: ${STORES.find((s) => s.id === store)!.one}`,
    `Step 2: who can read it: ${r.whoCanRead}.`,
    `Step 3: ${LEAKS.find((l) => l.id === leak)!.label.toLowerCase()}. ${r.leaked ? "The password goes with it." : "It never had the password."}`,
    `Step 4: rotating it takes ${hours(r.rotateHours)} and ${r.redeploys} redeploy${r.redeploys === 1 ? "" : "s"}.`,
    r.leaked ? `Step 5: the leaked password works for ${hours(r.exposureHours)}.` : "Step 5: nothing leaked.",
  ];
  const caption = stage !== null ? captions[stage] : r.leaked ? `${label}, ${LEAKS.find((l) => l.id === leak)!.label.toLowerCase()}: the password works for ${hours(r.exposureHours)} after the leak; rotating it means ${r.redeploys} redeploys.` : `${label}: this leak doesn't reach the password.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Secrets management"
        blurb={`${SERVICES} services share a database password and a payments API key. Where those secrets live decides how they leak, how long a leaked one keeps working, and how much work it is to change. Pick a place, pick a leak, and see.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="How long a leaked password works, for each place it could live">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{LEAKS.find((l) => l.id === leak)!.label}</p>
              <ul className="mt-3 space-y-2">
                {STORES.map((s) => {
                  const y = run(s.id, leak, scanning);
                  return (
                    <li key={s.id} className="grid grid-cols-[8rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[10rem_minmax(0,1fr)_3.5rem]">
                      <span className="truncate" style={{ fontWeight: s.id === store ? 700 : 400 }}>
                        {s.label}
                      </span>
                      <span className="flex h-3 overflow-hidden rounded bg-[var(--track)]">
                        <span className="h-full" style={{ width: `${(y.exposureHours / maxExposure) * 100}%`, background: y.exposureHours > 12 ? "var(--bad)" : ACCENT }} />
                      </span>
                      <span className="text-right font-mono">{y.leaked ? hours(y.exposureHours) : "safe"}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted)]">How long the leaked password works: until someone notices ({DETECT_HOURS} h here), plus the time to rotate it.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Where it lives" accent={ACCENT} value={store} onChange={setStore} options={STORES.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Leaking…">
                Walk through a leak
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Keep secrets out of code" what="A secret in the repository is in every clone, every fork, every CI log that prints a diff, and in git history after you delete it. It is the most common way keys leak." accent={ACCENT} active={at(0)}>
                <Choices label="Where it lives" accent={ACCENT} value={store} onChange={setStore} options={STORES.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 font-mono text-xs">{STORES.find((s) => s.id === store)!.one}</p>
                {r.inGitHistory && <p className="mt-1 text-xs" style={{ color: "var(--bad)" }}>Deleting the line doesn&rsquo;t remove it: it stays in every commit before.</p>}
              </FlowStep>
              <FlowArrow label="who can read it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Give each service only its own secrets" what="A secrets manager decides per service which secrets it may read, and logs every read. A file on a server or a CI variable is readable by anyone with access to that server or that pipeline." accent={ACCENT} active={at(1)}>
                <p className="text-xs">{r.whoCanRead}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: r.audit ? "var(--good)" : "var(--bad)" }}>
                  {r.audit ? "every read logged" : "no record of who read it"}
                </p>
              </FlowStep>
              <FlowArrow label="it leaks" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Notice leaks fast" what={`Secrets leak in predictable ways. A scanner on every push (GitHub push protection, gitleaks) catches a committed key in minutes instead of the ${DETECT_HOURS} hours it takes someone to notice.`} accent={ACCENT} active={at(2)}>
                <Choices label="Leak" accent={ACCENT} value={leak} onChange={setLeak} options={LEAKS.map((l) => ({ id: l.id, label: l.label }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={scanning} onChange={(e) => setScanning(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Secret scanning on every push ({SECRET_SCANNING_MINUTES} min)
                </label>
                <p className="font-mono text-xs" style={{ color: r.leaked ? "var(--bad)" : "var(--good)" }}>
                  {r.leaked ? "the password leaked" : "this leak can't reach it"}
                </p>
              </FlowStep>
              <FlowArrow label="rotate it" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Make rotation boring" what="If changing a password means editing twelve services and redeploying them in step, it won't happen often, and in an incident it will be slow. Services that read secrets at runtime pick up a new value without a deploy." accent={ACCENT} active={at(3)}>
                <ol className="list-decimal space-y-0.5 pl-5 text-xs">
                  {r.rotateSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="mt-1 font-mono text-xs">
                  {hours(r.rotateHours)} · {r.redeploys} redeploys
                </p>
              </FlowStep>
              <FlowArrow label="or don't keep it at all" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Prefer credentials that expire" what={`Dynamic secrets: the secrets manager creates a database user per service instance on demand, valid for ${TTL_DYNAMIC_H} h. A leaked one dies on its own, and revoking one instance doesn't touch the others. Cloud workload identity does the same for cloud APIs, with no stored key at all.`} accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: r.exposureHours > 12 ? "var(--bad)" : "var(--good)" }}>
                  {r.leaked ? `leaked password works for ${hours(r.exposureHours)}` : "not leaked"}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Detection and rotation times are illustrative; their order is what holds in practice.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
