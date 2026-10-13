"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { QUERIES, RECORDS, resolve } from "@/lib/dnsZone";

const ACCENT = "var(--ops)";

export default function DnsRecordsDemo() {
  const [qi, setQi] = useState("1");
  const q = QUERIES[Number(qi)];
  const r = resolve(q.name, q.type);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="DNS records" blurb="Your domain's zone is a small table of records: A and AAAA for addresses, CNAME for aliases, MX for mail, TXT for verification and email policy, NS for who's in charge. Run a few lookups against it." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Zone and lookup">
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[11px]">
                  <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">name</th><th className="font-normal">type</th><th className="font-normal">value</th><th className="font-normal">TTL</th></tr></thead>
                  <tbody>{RECORDS.map((x, i) => <tr key={i} title={x.note} style={{ background: r.chain.some((c) => c.startsWith(`${x.name} ${x.type}`)) ? "var(--inset)" : undefined, color: r.chain.some((c) => c.startsWith(`${x.name} ${x.type}`)) ? ACCENT : undefined }}><td className="py-1 pr-2">{x.name}</td><td className="pr-2">{x.type}</td><td className="break-all pr-2">{x.value}</td><td>{x.ttl}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-4 font-mono text-xs text-[var(--faint)]">$ dig {q.name} {q.type}</p>
              <ol className="mt-1 space-y-1 font-mono text-xs">{r.chain.map((c, i) => <li key={i} className="rounded bg-[var(--inset)] px-2 py-1" style={{ color: c.includes("NXDOMAIN") ? "var(--bad)" : undefined }}>{c}</li>)}</ol>
            </section>
          }
          panel={<SystemMapPanel caption={r.answer === null ? "No record for that name: the resolver returns NXDOMAIN, and resolvers cache that negative answer too." : r.chain.length > 1 ? "A CNAME says “ask about this other name instead”, so the lookup takes another step. Fine for subdomains; the bare domain can't be a CNAME." : "A direct answer from the zone, cached by resolvers for the TTL."}><Choices label="Lookup" accent={ACCENT} value={qi} onChange={setQi} options={QUERIES.map((x, i) => ({ id: String(i), label: x.q }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="A, AAAA: names to addresses" what="The basic answer: an IPv4 or IPv6 address. A name can have several for simple load spreading." accent={ACCENT}><p className="text-sm text-[var(--muted)]">dig +short example.com</p></FlowStep>
              <FlowArrow label="aliases" accent={ACCENT} />
              <FlowStep n={2} title="CNAME: follow another name" what="Point www or api at a load balancer or CDN whose IPs change. Not allowed at the apex; providers offer ALIAS/ANAME instead." accent={ACCENT} active={r.chain.length > 1}><p className="text-sm text-[var(--muted)]">A CNAME can&apos;t coexist with other records on that name.</p></FlowStep>
              <FlowArrow label="mail and proof" accent={ACCENT} />
              <FlowStep n={3} title="MX and TXT" what="MX says where mail goes. TXT carries SPF, DKIM, DMARC and domain-verification tokens." accent={ACCENT} active={q.type === "MX" || q.type === "TXT"}><p className="text-sm text-[var(--muted)]">Missing SPF/DMARC sends your mail to spam.</p></FlowStep>
              <FlowArrow label="changes" accent={ACCENT} />
              <FlowStep n={4} title="TTL decides how fast changes spread" what="Resolvers cache answers for the TTL. Lower it a day before a migration, then raise it again." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Manage zones as code (Terraform, OctoDNS).</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
