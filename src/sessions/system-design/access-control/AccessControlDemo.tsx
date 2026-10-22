"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DEPTS, DOCS, MODELS, REQUESTS, USERS, decide, docName, roleCount, score, userName, type Model } from "@/lib/accessControl";

const ACCENT = "var(--sys)";
const SCALES = [3, 20];

export default function AccessControlDemo() {
  const [m, setM] = useState<Model>("rbac");
  const [depts, setDepts] = useState(3);
  const s = score(m);
  const model = MODELS.find((x) => x.id === m)!;
  const caption = `${model.label}: ${s.right} of ${REQUESTS.length} decisions match what the business intended${s.overGrants.length ? `, ${s.overGrants.length} too permissive` : ""}${s.underGrants.length ? `, ${s.underGrants.length} too strict` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Role- and attribute-based access control"
        blurb={`A document app: ${USERS.length} people in ${DEPTS.length} departments, ${DOCS.length} documents, one of them locked and two shared. The business has a clear idea of who may do what. Write it as roles, as rules over attributes, or as relationships, and check eight real requests against each.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Eight requests decided by ${model.label}, against what was intended`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{model.label}</p>
                <p className="font-mono text-xs" style={{ color: s.right === REQUESTS.length ? "var(--good)" : "var(--bad)" }}>
                  {s.right} / {REQUESTS.length} right
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {REQUESTS.map((r, i) => {
                  const d = decide(m, r);
                  const ok = d === r.intended;
                  return (
                    <li key={i} className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-2 text-xs">
                      <span className="min-w-0">
                        {userName(r.user)} {r.action}s {docName(r.doc)} <span className="text-[var(--faint)]">({r.why})</span>
                      </span>
                      <span className="text-center font-mono text-[11px] text-[var(--muted)]">{r.intended ? "should" : "shouldn't"}</span>
                      <span className="rounded text-center font-mono text-[11px]" style={{ color: ok ? "var(--good)" : "var(--bad)", border: `1px solid ${ok ? "var(--good)" : "var(--bad)"}` }}>
                        {d ? "allow" : "deny"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-[var(--muted)]">
                People: {USERS.map((u) => `${u.name} (${u.dept}, ${u.title})`).join(" · ")}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Documents: {DOCS.map((d) => `${d.name} (${d.dept}, ${d.status}${d.sharedWith.length ? `, shared with ${d.sharedWith.map(userName).join(", ")}` : ""})`).join(" · ")}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Model" accent={ACCENT} value={m} onChange={setM} options={MODELS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <ul className="w-full space-y-0.5 font-mono text-[11px] text-[var(--muted)]">
                {model.policy.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Roles: permissions by job" what="RBAC gives each person roles and each role a list of permissions. It's easy to audit and fits coarse rules. It can't see the document: an editor can edit every document, including another department's and a locked contract." accent={ACCENT} active={m === "rbac"}>
                <Line m="rbac" />
                <Choices label="Departments" accent={ACCENT} value={String(depts)} onChange={(v) => setDepts(Number(v))} options={SCALES.map((d) => ({ id: String(d), label: String(d) }))} />
                <p className="mt-2 font-mono text-xs">
                  roles needed to say “your department only”: RBAC {roleCount("rbac", depts)} · attributes {roleCount("abac", depts)}
                </p>
              </FlowStep>
              <FlowArrow label="look at the document" accent={ACCENT} />

              <FlowStep n={2} title="Attributes: rules over the user and the document" what="ABAC evaluates a rule on each request: same department, the document isn't locked, not a contractor. One rule replaces a role per department. It still can't express “Ana shared this with Raj”, because sharing isn't an attribute of either of them." accent={ACCENT} active={m === "abac"}>
                <Line m="abac" />
              </FlowStep>
              <FlowArrow label="follow the links" accent={ACCENT} />

              <FlowStep n={3} title="Relationships: owner, member, shared with" what="ReBAC stores relationships as data (doc:contract#viewer@user:raj) and checks by following them, combined with attribute conditions. This is the model of Google's Zanzibar and the open-source systems based on it, built for sharing at scale." accent={ACCENT} active={m === "rebac"}>
                <Line m="rebac" />
              </FlowStep>
              <FlowArrow label="in production" accent={ACCENT} />

              <FlowStep n={4} title="Keep the decision in one place" what="Whichever model, put the decision behind one function or policy service the code calls (“can user X do Y to Z?”), not scattered if-statements. Then the rules can be tested, reviewed and logged, and every decision explained." accent={ACCENT}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">right</span>
                  <span className="text-right text-[var(--faint)]">too open</span>
                  <span className="text-right text-[var(--faint)]">too strict</span>
                  {MODELS.map((x) => {
                    const y = score(x.id);
                    const w = x.id === m ? 700 : 400;
                    return (
                      <Row key={x.id} w={w} cells={[x.label, `${y.right}/${REQUESTS.length}`, String(y.overGrants.length), String(y.underGrants.length)]} />
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Real systems mix them: roles for staff tiers, attributes for conditions, relationships for sharing.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Line({ m }: { m: Model }) {
  const s = score(m);
  return (
    <ul className="space-y-0.5 font-mono text-xs">
      <li style={{ color: s.right === REQUESTS.length ? "var(--good)" : "var(--text)" }}>
        {s.right} of {REQUESTS.length} right
      </li>
      {s.overGrants.map((r, i) => (
        <li key={`o${i}`} style={{ color: "var(--bad)" }}>
          too open: {userName(r.user)} {r.action}s {docName(r.doc)}
        </li>
      ))}
      {s.underGrants.map((r, i) => (
        <li key={`u${i}`} style={{ color: "var(--bad)" }}>
          too strict: {userName(r.user)} can&rsquo;t {r.action} {docName(r.doc)}
        </li>
      ))}
    </ul>
  );
}

function Row({ cells, w }: { cells: string[]; w: number }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: w }}>
          {c}
        </span>
      ))}
    </>
  );
}
