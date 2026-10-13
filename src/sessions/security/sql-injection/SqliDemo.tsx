"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { INPUTS, run, type Mode } from "@/lib/sqlInjection";

const ACCENT = "var(--sec)";

export default function SqliDemo() {
  const [inputId, setInputId] = useState("or");
  const [mode, setMode] = useState<Mode>("concat");
  const input = INPUTS.find((i) => i.id === inputId)!;
  const r = run(input.value, mode);
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="SQL injection" blurb="A login form looks up the username you type. If the code pastes your text straight into the SQL, a quote mark ends the string early and the rest of your input becomes part of the query. The database here is a simulation." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The query and what the database does">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Username typed</p>
              <p className="mt-1 rounded-md bg-[var(--inset)] px-2 py-1.5 font-mono text-sm">{input.value}</p>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">SQL sent to the database</p>
              <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-sm" style={{ color: r.dangerous ? "var(--bad)" : undefined }}>{r.sql}</pre>
              {r.params && <p className="mt-1 font-mono text-xs text-[var(--muted)]">{r.params} (sent separately, as data)</p>}
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Rows returned</p>
              <table className="mt-1 w-full font-mono text-sm"><tbody>{r.rows.length ? r.rows.map((u) => <tr key={u.id}><td className="py-0.5">{u.id}</td><td>{u.username}</td><td style={{ color: u.role === "admin" ? "var(--bad)" : undefined }}>{u.role}</td></tr>) : <tr><td className="text-[var(--faint)]">none</td></tr>}</tbody></table>
              <p className="mt-3 rounded-lg border p-3 text-sm" style={{ borderColor: r.dangerous ? "var(--bad)" : "var(--good)", color: r.dangerous ? "var(--bad)" : undefined }}>{r.effect}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={r.effect}>
              <Choices label="Username" accent={ACCENT} value={inputId} onChange={setInputId} options={INPUTS.map((i) => ({ id: i.id, label: i.label }))} />
              <Choices label="How the code builds the query" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "concat", label: "Glue strings together" }, { id: "param", label: "Parameterized query" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Gluing text into SQL" what={"`... WHERE username = '${input}'` works for alice. The input is trusted to be just a name."} accent={ACCENT} active={mode === "concat"}><p className="font-mono text-xs">&quot;SELECT … WHERE username = &apos;&quot; + input + &quot;&apos;&quot;</p></FlowStep>
              <FlowArrow label="a quote in the input" accent={ACCENT} />
              <FlowStep n={2} title="Input becomes code" what="A ' closes the string. What follows is parsed as SQL: OR conditions, comments, even new statements." accent={ACCENT} active={r.dangerous}><p className="text-sm text-[var(--muted)]">The attacker is now writing part of your query.</p></FlowStep>
              <FlowArrow label="separate code from data" accent={ACCENT} />
              <FlowStep n={3} title="Parameterized queries" what="Send the SQL with a placeholder, and the value separately. The database never parses the value as SQL, whatever it contains." accent={ACCENT} active={mode === "param"}><p className="font-mono text-xs">db.query(&quot;… WHERE username = $1&quot;, [input])</p></FlowStep>
              <FlowArrow label="defense in depth" accent={ACCENT} />
              <FlowStep n={4} title="And limit the damage" what="Use ORMs and query builders that parameterize for you, and connect with a database user that can't DROP tables." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Escaping by hand is easy to get wrong; parameters aren&apos;t.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
