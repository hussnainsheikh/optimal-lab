"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { POLICIES, runs, SCRIPTS, type Policy } from "@/lib/cspPolicy";

const ACCENT = "var(--web)";

export default function CspDemo() {
  const [p, setP] = useState<Policy>("none");
  const pol = POLICIES.find((x) => x.id === p)!;
  const r = SCRIPTS.map((s) => ({ ...s, ok: runs(p, s) }));
  const evilRuns = r.filter((s) => s.evil && s.ok).length;
  const goodBlocked = r.filter((s) => !s.evil && !s.ok).length;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Content Security Policy" blurb="Even if an attacker manages to inject a script tag, a Content-Security-Policy header can tell the browser not to run it. The page below has three legitimate scripts and two injected ones. Tighten the policy." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Scripts on the page">
              <p className="break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{pol.header}</p>
              <ul className="mt-3 space-y-1.5">{r.map((s) => <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2 rounded-lg border p-2" style={{ borderColor: s.ok === !s.evil ? "var(--line)" : "var(--bad)" }}><span className="break-all font-mono text-[11px]" style={{ color: s.evil ? "var(--bad)" : undefined }}>{s.label}</span><span className="text-right font-mono text-xs" style={{ color: s.ok ? (s.evil ? "var(--bad)" : "var(--good)") : "var(--muted)" }}>{s.ok ? "runs" : "blocked"}</span></li>)}</ul>
              <p className="mt-3 font-mono text-sm">{evilRuns} injected scripts run · {goodBlocked} legitimate scripts blocked</p>
            </section>
          }
          panel={<SystemMapPanel caption={p === "none" ? "Without a policy, injected scripts run like your own: cookies and data are stolen." : p === "self" ? "Only same-origin files run. The injected code is stopped, but so are your analytics and your inline config." : p === "self+analytics" ? "Allow-listing analytics fixes it, but the inline config is still blocked, and domain allow-lists are often bypassable." : "Only scripts carrying this response's random nonce run. Your own tags get it; injected ones can't guess it. Scripts they load are trusted via strict-dynamic."}><Choices label="Policy" accent={ACCENT} value={p} onChange={setP} options={POLICIES.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Defence in depth against XSS" what="Escaping output prevents injection; CSP limits the damage if something slips through." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See the XSS session.</p></FlowStep>
              <FlowArrow label="sources" accent={ACCENT} />
              <FlowStep n={2} title="Allow-lists by origin" what="'self' and named domains. Simple, but inline scripts stop working and CDNs can host attacker code." accent={ACCENT} active={p === "self" || p === "self+analytics"}><p className="text-sm text-[var(--muted)]">Never add &apos;unsafe-inline&apos; to script-src.</p></FlowStep>
              <FlowArrow label="better" accent={ACCENT} />
              <FlowStep n={3} title="Nonces and strict-dynamic" what="A fresh random nonce per response marks your scripts. Recommended by Google's CSP guidance." accent={ACCENT} active={p === "nonce"}><p className="font-mono text-xs">&lt;script nonce=&quot;r4nd0m&quot;&gt;</p></FlowStep>
              <FlowArrow label="roll out" accent={ACCENT} />
              <FlowStep n={4} title="Report-only first" what="Content-Security-Policy-Report-Only logs violations without blocking, so you can fix them before enforcing." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Also set frame-ancestors and object-src &apos;none&apos;.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
