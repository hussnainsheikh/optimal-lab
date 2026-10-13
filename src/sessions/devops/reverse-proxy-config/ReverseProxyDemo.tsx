"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CONFIG, REQS } from "@/lib/reverseProxy";

const ACCENT = "var(--ops)";

export default function ReverseProxyDemo() {
  const [i, setI] = useState("0");
  const r = REQS[Number(i)];
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Configuring a reverse proxy" blurb="nginx sits in front of your app: it terminates TLS, serves static files itself, and forwards the rest to a pool of app servers. Requests are matched to location blocks, with the longest matching prefix winning." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="nginx config">
              <p className="font-mono text-sm">GET https://shop.example.com<b style={{ color: ACCENT }}>{r.path}</b></p>
              <ol className="mt-3 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">
                {CONFIG.map((l, k) => <li key={k} className="whitespace-pre rounded px-1" style={{ background: k >= r.block[0] && k <= r.block[1] ? ACCENT : undefined, color: k >= r.block[0] && k <= r.block[1] ? "var(--on-accent)" : undefined }}>{l}</li>)}
              </ol>
              <p className="mt-3 font-mono text-sm">→ {r.to}</p>
            </section>
          }
          panel={<SystemMapPanel caption={r.note}><Choices label="Request" accent={ACCENT} value={i} onChange={setI} options={REQS.map((x, k) => ({ id: String(k), label: x.path }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One entry point" what="The proxy owns ports 80/443 and the certificate. App servers stay on a private network." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Redirect 80 to 443 here.</p></FlowStep>
              <FlowArrow label="match" accent={ACCENT} />
              <FlowStep n={2} title="location blocks route by path" what="Prefix matches pick the longest; regex locations are checked in order. Be careful with trailing slashes on proxy_pass." accent={ACCENT}><p className="font-mono text-xs">nginx -t &amp;&amp; nginx -s reload</p></FlowStep>
              <FlowArrow label="forward" accent={ACCENT} />
              <FlowStep n={3} title="Pass the right headers" what="X-Forwarded-For and -Proto tell the app the real client and scheme; WebSockets need Upgrade and Connection." accent={ACCENT} active={r.path === "/ws"}><p className="text-sm text-[var(--muted)]">Set timeouts and body-size limits too.</p></FlowStep>
              <FlowArrow label="offload" accent={ACCENT} />
              <FlowStep n={4} title="Serve static files directly" what="nginx sends files faster than your app, with caching headers and compression." accent={ACCENT} active={r.to.startsWith("file")}><p className="text-sm text-[var(--muted)]">Caddy and Traefik do this with less config.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
