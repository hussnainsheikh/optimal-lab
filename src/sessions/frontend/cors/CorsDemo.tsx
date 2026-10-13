"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, flow, type Case } from "@/lib/corsFlow";

const ACCENT = "var(--web)";

export default function CorsDemo() {
  const [c, setC] = useState<Case>("nocors");
  const f = flow(c);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="CORS" blurb="Your app at app.example.com fetches from api.partner.com. Browsers block scripts from reading responses from another origin unless that server opts in with CORS headers. For anything beyond a simple request, the browser asks first with a preflight." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Request flow">
              <ol className="space-y-1.5">{f.steps.map((s, i) => <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1.5" style={{ borderColor: s.bad ? "var(--bad)" : ACCENT }}><p className="text-[11px] text-[var(--muted)]">{s.from === "browser" ? "Browser → api.partner.com" : "api.partner.com → browser"}</p><p className="break-all font-mono text-xs" style={{ color: s.bad ? "var(--bad)" : undefined }}>{s.msg}</p></li>)}</ol>
              <p className="mt-3 rounded-lg p-2 text-center font-mono text-sm" style={{ background: f.ok ? "var(--good)" : "var(--bad)", color: "var(--on-accent)" }}>{f.ok ? "fetch() resolves with the data" : "TypeError: Failed to fetch (CORS)"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Request reached the server: {f.sent ? "yes" : "no"}</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.note}><Choices label="Scenario" accent={ACCENT} value={c} onChange={setC} options={CASES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Same-origin policy" what="Scripts can only read responses from their own scheme + host + port, unless the other side allows it." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Protects users&apos; logged-in sessions on other sites.</p></FlowStep>
              <FlowArrow label="opt in" accent={ACCENT} />
              <FlowStep n={2} title="The server names allowed origins" what="Access-Control-Allow-Origin with your exact origin (or * for public, cookieless APIs)." accent={ACCENT} active={c === "allowed" || c === "creds-star"}><p className="text-sm text-[var(--muted)]">Credentials require an exact origin.</p></FlowStep>
              <FlowArrow label="non-simple" accent={ACCENT} />
              <FlowStep n={3} title="Preflights for JSON, PUT, custom headers" what="The browser sends OPTIONS first. The server must answer with the allowed methods and headers." accent={ACCENT} active={c.startsWith("preflight")}><p className="font-mono text-xs">Access-Control-Max-Age: 600 caches it</p></FlowStep>
              <FlowArrow label="remember" accent={ACCENT} />
              <FlowStep n={4} title="CORS isn't server security" what="curl and servers ignore it. It controls what browsers let pages read. Protect APIs with auth." accent={ACCENT} active={c === "nocors"}><p className="text-sm text-[var(--muted)]">Fix it on the server, or proxy through your own origin.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
