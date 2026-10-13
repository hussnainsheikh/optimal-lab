"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { DEFENSES, fetchAs, URLS, type Defense } from "@/lib/ssrf";

const ACCENT = "var(--sec)";

export default function SsrfDemo() {
  const [d, setD] = useState<Defense>("blocklist");
  const leaks = URLS.filter((_, i) => fetchAs(i, d).leak).length;
  const caption = d === "none" ? `The server fetches whatever it's given, from inside your network. ${leaks} of 5 URLs reach internal systems, including cloud credentials.`
    : d === "blocklist" ? `String matching stops the obvious ones, but the same IP written as a number, or a redirect, gets through: ${leaks} leaks.`
    : "Resolve the hostname, refuse private and link-local IPs, and check again on every redirect. Only the public page is fetched.";
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="SSRF: server-side request forgery" blurb="Your app shows previews of links, so your server fetches any URL a user pastes. That server sits inside your network and can reach things the attacker can't. Paste these URLs and see what comes back." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="URLs and results">
              <ul className="space-y-2">
                {URLS.map((u, i) => {
                  const r = fetchAs(i, d);
                  return (
                    <li key={u.url} className="rounded-lg border p-2" style={{ borderColor: r.leak ? "var(--bad)" : "var(--line)", background: "var(--inset)" }}>
                      <p className="break-all font-mono text-xs">{u.url}</p>
                      <p className="mt-1 flex flex-wrap justify-between gap-2 text-xs"><span className="text-[var(--muted)]">{u.what} · {u.ip}</span><span className="font-mono" style={{ color: r.blocked ? "var(--good)" : r.leak ? "var(--bad)" : "var(--muted)" }}>{r.blocked ? "blocked" : r.leak ? "fetched: internal data leaked" : "fetched"}</span></p>
                    </li>
                  );
                })}
              </ul>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Defence" accent={ACCENT} value={d} onChange={setD} options={DEFENSES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="The server is inside the fence" what="It can reach metadata endpoints, admin panels and databases that the internet can't." accent={ACCENT} active={d === "none"}><p className="font-mono text-xs">169.254.169.254 hands out cloud credentials</p></FlowStep>
              <FlowArrow label="blocklists" accent={ACCENT} />
              <FlowStep n={2} title="String blocklists leak" what="IPs have many spellings (decimal, hex, IPv6), DNS names can point anywhere, and redirects change the target after your check." accent={ACCENT} active={d === "blocklist"}><p className="text-sm text-[var(--muted)]">Also DNS rebinding: a name that resolves differently the second time.</p></FlowStep>
              <FlowArrow label="check the real destination" accent={ACCENT} />
              <FlowStep n={3} title="Check the resolved IP, every hop" what="Resolve, reject private/loopback/link-local ranges, connect to that exact IP, and repeat for each redirect. Allowlist domains when you can." accent={ACCENT} active={d === "resolve-check"}><p className="text-sm text-[var(--muted)]">Use IMDSv2 so metadata needs a token.</p></FlowStep>
              <FlowArrow label="and isolate" accent={ACCENT} />
              <FlowStep n={4} title="Fetch from a sandbox" what="Run fetchers in an isolated network with egress rules, so a mistake reaches nothing valuable." accent={ACCENT}><p className="text-sm text-[var(--muted)]">AI agents with a browsing tool have the same risk.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
