"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { NEEDS, STORES } from "@/lib/storageChoice";

const ACCENT = "var(--web)";

export default function StorageDemo() {
  const [n, setN] = useState("auth");
  const need = NEEDS.find((x) => x.id === n)!;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Browser storage" blurb="Browsers offer five places to keep data. They differ in size, lifetime, whether they're sent to the server, and whether scripts can read them. That last one matters most for security. Pick what you're storing." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Storage options">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-xs [&_td]:pr-3 [&_th]:pr-3">
                  <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal" /><th className="font-normal">size</th><th className="font-normal">sent to server</th><th className="font-normal">API</th><th className="font-normal">readable by JS</th><th className="font-normal">lasts</th></tr></thead>
                  <tbody>{STORES.map((s) => <tr key={s.id} style={{ background: s.id === need.pick ? ACCENT : undefined, color: s.id === need.pick ? "var(--on-accent)" : undefined }}><td className="py-1.5 pl-1 font-medium">{s.name}</td><td>{s.size}</td><td>{s.sent}</td><td>{s.api}</td><td>{s.js}</td><td className="pr-1">{s.life}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={need.why}><Choices label="You need to store" accent={ACCENT} value={n} onChange={setN} options={NEEDS.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Secrets don't belong where scripts can read them" what="Any XSS can read localStorage. HttpOnly cookies are invisible to JavaScript." accent={ACCENT} active={n === "auth"}><p className="font-mono text-xs">Set-Cookie: sid=…; HttpOnly; Secure; SameSite=Lax</p></FlowStep>
              <FlowArrow label="small settings" accent={ACCENT} />
              <FlowStep n={2} title="localStorage and sessionStorage" what="Simple string key-value stores. Synchronous, so keep them small." accent={ACCENT} active={n === "theme" || n === "wizard"}><p className="text-sm text-[var(--muted)]">Wrap access in try/catch: private modes can throw.</p></FlowStep>
              <FlowArrow label="real data" accent={ACCENT} />
              <FlowStep n={3} title="IndexedDB for lots of structured data" what="Async, indexed, transactional. Use a wrapper like idb or Dexie." accent={ACCENT} active={n === "offline"}><p className="text-sm text-[var(--muted)]">Ask navigator.storage.persist() to avoid eviction.</p></FlowStep>
              <FlowArrow label="offline" accent={ACCENT} />
              <FlowStep n={4} title="Cache API with a service worker" what="Store whole responses so the app loads offline." accent={ACCENT} active={n === "assets"}><p className="text-sm text-[var(--muted)]">Workbox simplifies strategies.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
