"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { MODES, PAYLOADS, render, type Mode } from "@/lib/xss";

const ACCENT = "var(--sec)";

export default function XssDemo() {
  const [payloadId, setPayloadId] = useState("img");
  const [mode, setMode] = useState<Mode>("innerHTML");
  const payload = PAYLOADS.find((p) => p.id === payloadId)!;
  const m = MODES.find((x) => x.id === mode)!;
  const out = render(payload, mode);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Cross-site scripting (XSS)"
        blurb="An attacker posts a comment with HTML in it. Every visitor who opens the page renders that comment. Whether the attacker's code runs depends on one line: how your page puts the comment on screen. Nothing on this page actually runs; the outcome is worked out and shown."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The comment, the HTML and what the visitor's browser does">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Stored comment</p>
              <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{payload.text}</pre>

              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">HTML that reaches the browser</p>
              <pre className="mt-1 whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{out.html || "(empty)"}</pre>

              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">What the visitor sees</p>
              <div className="mt-1 rounded-md border border-[var(--line)] bg-[var(--bg)] p-3 text-sm">
                <span className="font-semibold">anon:</span> {mode === "escaped" ? payload.text : preview(out.html)}
              </div>

              <div
                className="mt-4 rounded-lg border p-3 text-sm"
                style={{
                  borderColor: out.runs ? "var(--bad)" : "var(--good)",
                  background: out.runs ? "color-mix(in srgb, var(--bad) 12%, transparent)" : "color-mix(in srgb, var(--good) 10%, transparent)",
                }}
              >
                <p className="font-semibold" style={{ color: out.runs ? "var(--bad)" : "var(--good)" }}>
                  {out.runs ? "Attacker's code runs" : "No attacker code runs"}
                </p>
                <p className="mt-1 text-[var(--muted)]">{out.why}</p>
                {out.stolen && <p className="mt-2 font-mono text-xs">evil.example receives: ?c=session=8f3a…e21 (the visitor&apos;s login)</p>}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={out.runs ? "The visitor's session cookie just left for the attacker's server." : out.why}>
              <Choices label="The comment" accent={ACCENT} value={payloadId} onChange={setPayloadId} options={PAYLOADS.map((p) => ({ id: p.id, label: p.label }))} />
              <Choices label="How the page renders it" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
              <p className="w-full font-mono text-xs text-[var(--muted)]">{m.code}</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The attacker submits a comment" what="It looks like text, but it contains HTML: a tag, an attribute, a bit of JavaScript." accent={ACCENT}>
                <p className="font-mono text-xs break-all">{payload.text}</p>
              </FlowStep>
              <FlowArrow label="saved to the database" accent={ACCENT} />

              <FlowStep n={2} title="The server stores it as-is" what="Storing it is fine. The danger is in how it's shown later, to someone else, inside your site's origin." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">Every visitor who opens this page will get this comment.</p>
              </FlowStep>
              <FlowArrow label="sent to every visitor" accent={ACCENT} />

              <FlowStep n={3} title="The page renders it" what={m.note} accent={ACCENT} active>
                <p className="font-mono text-sm">{m.code}</p>
              </FlowStep>
              <FlowArrow label="the visitor's browser" accent={ACCENT} />

              <FlowStep n={4} title="What runs in the visitor's browser" what="Script on your page can read cookies, call your API as the user and change what they see. Escape by default, sanitize when you must allow HTML, and add CSP as a second layer." accent={ACCENT}>
                <ul className="space-y-1 text-sm">
                  {MODES.map((x) => {
                    const o = render(payload, x.id);
                    return (
                      <li key={x.id} className="flex justify-between gap-3" style={{ color: x.id === mode ? "var(--text)" : "var(--muted)" }}>
                        <span>{x.label}</span>
                        <span style={{ color: o.runs ? "var(--bad)" : "var(--good)" }}>{o.runs ? "runs" : "safe"}</span>
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

// A display-only preview: bold/italic shown, images as a broken-image box, scripts invisible.
// It never inserts the string as HTML.
function preview(html: string): ReactNode[] {
  const out: ReactNode[] = [];
  let bold = false;
  let italic = false;
  const parts = html.replace(/<script[\s\S]*?<\/script>/gi, "").split(/(<[^>]+>)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    const tag = part.match(/^<(\/?)(\w+)/);
    if (tag) {
      const closing = tag[1] === "/";
      const name = tag[2].toLowerCase();
      if (name === "b" || name === "strong") bold = !closing;
      else if (name === "i" || name === "em") italic = !closing;
      else if (name === "img")
        out.push(
          <span key={i} className="mx-1 inline-block rounded border border-dashed border-[var(--line-strong)] px-1 text-[10px] text-[var(--faint)]">
            broken image
          </span>,
        );
      return;
    }
    out.push(
      <span key={i} style={{ fontWeight: bold ? 700 : undefined, fontStyle: italic ? "italic" : undefined }}>
        {part}
      </span>,
    );
  });
  return out;
}
