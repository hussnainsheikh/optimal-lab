"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { IDS, request, type Check } from "@/lib/idor";

const ACCENT = "var(--sec)";

export default function IdorDemo() {
  const [id, setId] = useState("1042");
  const [check, setCheck] = useState<Check>("none");
  const r = request(Number(id), check);
  const caption = r.leak ? "The server checked that Ada is logged in, but not that the invoice is hers. Changing the number in the URL shows someone else's payroll."
    : r.status === 404 && check === "owner" && Number(id) !== 9999 ? "The query includes the owner, so another customer's invoice looks exactly like one that doesn't exist."
    : r.status === 200 ? "Ada's own invoice: allowed." : "No such invoice.";
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="IDOR: broken object-level authorisation" blurb="Ada is logged in and can view her invoice at /api/invoices/1041. What happens if she changes the number? An Insecure Direct Object Reference is the top API security risk: the app trusts an id it should have checked." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Request and response">
              <p className="font-mono text-xs text-[var(--faint)]">logged in as Ada (session cookie ✓)</p>
              <p className="mt-2 rounded-md bg-[var(--inset)] p-2 font-mono text-sm">GET /api/invoices/<b style={{ color: ACCENT }}>{id}</b></p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{check === "none" ? "SELECT * FROM invoices\nWHERE id = $1" : "SELECT * FROM invoices\nWHERE id = $1 AND owner_id = $2  -- current user"}</pre>
              <div className="mt-3 rounded-lg border-2 p-3" style={{ borderColor: r.leak ? "var(--bad)" : r.status === 200 ? "var(--good)" : "var(--line)" }}>
                <p className="font-mono text-sm">{r.status} {r.status === 200 ? "OK" : "Not Found"}</p>
                <p className="mt-1 text-sm" style={{ color: r.leak ? "var(--bad)" : undefined }}>{r.body}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Invoice id in the URL" accent={ACCENT} value={id} onChange={setId} options={IDS.map((x) => ({ id: String(x), label: x === 1041 ? "1041 (hers)" : String(x) }))} />
              <Choices label="Server check" accent={ACCENT} value={check} onChange={setCheck} options={[{ id: "none", label: "Logged in only" }, { id: "owner", label: "Owner check" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Authentication isn't authorisation" what="Knowing who Ada is doesn't say what she may see. Every object access needs its own check." accent={ACCENT} active={r.leak}><p className="text-sm text-[var(--muted)]">Ids in URLs, bodies and headers are all user input.</p></FlowStep>
              <FlowArrow label="check per object" accent={ACCENT} />
              <FlowStep n={2} title="Scope the query to the user" what="Put the owner or tenant in the WHERE clause, or check it in one shared policy function, so no endpoint can forget." accent={ACCENT} active={check === "owner"}><p className="text-sm text-[var(--muted)]">Row-level security in Postgres enforces it in the database.</p></FlowStep>
              <FlowArrow label="hide existence" accent={ACCENT} />
              <FlowStep n={3} title="Return 404, not 403" what="A 403 confirms the invoice exists. Treat “not yours” the same as “not there”." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Log it: repeated misses can be enumeration.</p></FlowStep>
              <FlowArrow label="defence in depth" accent={ACCENT} />
              <FlowStep n={4} title="Random ids help, but don't fix it" what="UUIDs make guessing harder, but ids leak through links, logs and emails. The check is still required." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Write tests that request other users&apos; objects.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
