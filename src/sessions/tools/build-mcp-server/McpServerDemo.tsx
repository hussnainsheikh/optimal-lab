"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { DEFS, outcome, REQUESTS, TOKENS, VERSIONS, type Version } from "@/lib/mcpServer";

const ACCENT = "var(--tools)";

export default function McpServerDemo() {
  const [v, setV] = useState<Version>("vague");
  const results = REQUESTS.map((_, i) => outcome(v, i));
  const ok = results.filter((r) => r.ok).length;
  return (
    <SessionPage>
      <SessionHeader kicker="Tools · interactive" title="Building an MCP server" blurb="An MCP server exposes tools that any client (Claude, an IDE, an agent) can call. The model only knows your tool through its name, description and input schema, and it has to read whatever you return. Try three versions of the same order-lookup tool." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Tool definition and outcomes">
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{DEFS[v]}</pre>
              <ul className="mt-3 space-y-2">
                {REQUESTS.map((q, i) => (
                  <li key={q} className="rounded-lg border p-2" style={{ borderColor: results[i].ok ? "var(--line)" : "var(--bad)" }}>
                    <p className="text-sm">“{q}”</p>
                    <p className="mt-1 break-all font-mono text-xs" style={{ color: results[i].ok ? "var(--good)" : "var(--bad)" }}>{results[i].call}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{results[i].note}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-sm">{ok}/3 handled well · ~{TOKENS[v].toLocaleString()} result tokens per lookup</p>
            </section>
          }
          panel={<SystemMapPanel caption={v === "vague" ? "A generic name and a free-text parameter leave the model guessing when to call it and what to send." : v === "clear" ? "Specific name, a description that says when to use it, and typed, required fields: the right calls every time. But raw results flood the context." : "Same good definition, and results trimmed to what answers the question."}><Choices label="Tool version" accent={ACCENT} value={v} onChange={setV} options={VERSIONS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Name and describe for the model" what="Say what the tool does and when to use it, in plain words. The description is the model's only documentation." accent={ACCENT} active={v === "vague"}><p className="font-mono text-xs">search_orders, not query</p></FlowStep>
              <FlowArrow label="constrain inputs" accent={ACCENT} />
              <FlowStep n={2} title="Type every parameter" what="Use enums, formats and required fields in the JSON schema. Validate on the server anyway, and return a helpful error the model can fix." accent={ACCENT} active={v === "clear"}><p className="text-sm text-[var(--muted)]">Fewer, well-shaped tools beat many vague ones.</p></FlowStep>
              <FlowArrow label="shape outputs" accent={ACCENT} />
              <FlowStep n={3} title="Return just enough" what="Summaries, ids and pagination instead of raw dumps. Context is the model's working memory and it isn't free." accent={ACCENT} active={v === "clear-lean"}><p className="text-sm text-[var(--muted)]">Offer a details tool for drill-down.</p></FlowStep>
              <FlowArrow label="ship it" accent={ACCENT} />
              <FlowStep n={4} title="Run it locally or remotely" what="stdio for local tools, Streamable HTTP with OAuth for shared ones. Test with the MCP Inspector, then with real prompts." accent={ACCENT}><p className="font-mono text-xs">npx @modelcontextprotocol/inspector</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
