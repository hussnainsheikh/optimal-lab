"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { CHUNKS, partialParse, PER_CHUNK, strictParse, TTFT, type Partial } from "@/lib/streamingJson";

const ACCENT = "var(--native)";
type Mode = "wait" | "raw" | "partial";
const FRAMES = CHUNKS.length + 1;

export default function StreamingUiDemo() {
  const [mode, setMode] = useState<Mode>("partial");
  const playback = usePlayback(FRAMES, 220);
  const n = playback.i;
  const text = CHUNKS.slice(0, n).join("");
  const done = n === CHUNKS.length;
  const ms = n === 0 ? 0 : TTFT + (n - 1) * PER_CHUNK;
  const data: Partial | null = mode === "wait" ? (done ? strictParse(text) : null) : mode === "partial" ? partialParse(text) : null;
  const caption = mode === "wait" ? (done ? `Everything appears at once after ${ms} ms.` : `Spinner for ${ms} ms. The user can't tell if anything is happening.`)
    : mode === "raw" ? "Text arrives fast, but it's half-written JSON with brackets and quotes: unreadable."
    : done ? "Finished. The UI filled in as fields arrived." : `At ${ms} ms: parsed what's arrived so far and closed the open brackets.`;
  return (
    <SessionPage>
      <SessionHeader kicker="AI Native · interactive" title="Streaming UI and partial results" blurb="The model writes a JSON answer a few characters at a time. Wait for it all, show the raw text, or parse each partial chunk and render what you can. Press play." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="What the user sees">
              <p className="flex justify-between font-mono text-xs text-[var(--faint)]"><span>{n}/{CHUNKS.length} chunks</span><span>{ms} ms</span></p>
              <div className="mt-2 min-h-48 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-3">
                {mode === "raw" ? (
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs">{text}<span className="animate-pulse">▍</span></pre>
                ) : data ? (
                  <div>
                    <p className="font-medium">{data.title}</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{(data.steps ?? []).map((s, i) => <li key={i}>{s}</li>)}</ol>
                    {!done && <p className="mt-2 text-xs text-[var(--faint)]">still writing…</p>}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--faint)]">{mode === "wait" ? "Loading…" : "Waiting for the first token…"}</p>
                )}
              </div>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Received so far</p>
              <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-[var(--inset)] p-2 font-mono text-[11px] text-[var(--muted)]">{text || "—"}</pre>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Rendering" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "wait", label: "Wait for all of it" }, { id: "raw", label: "Show raw text" }, { id: "partial", label: "Parse partial JSON" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next chunk" status={`${ms} ms`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Time to first token matters most" what="Generation takes seconds. Streaming shows progress after a few hundred milliseconds instead." accent={ACCENT} active={mode === "wait"}><p className="text-sm text-[var(--muted)]">Perceived speed beats raw speed.</p></FlowStep>
              <FlowArrow label="but chunks are incomplete" accent={ACCENT} />
              <FlowStep n={2} title="Partial output is broken output" what="Mid-stream JSON doesn't parse, markdown has unclosed bold and code fences, and a word can be cut in half." accent={ACCENT} active={mode === "raw"}><p className="font-mono text-xs">{"{\"title\":\"Reset your rou"}</p></FlowStep>
              <FlowArrow label="repair, then render" accent={ACCENT} />
              <FlowStep n={3} title="Parse leniently" what="Close open strings and brackets, parse, and render the fields you have. Libraries do this for JSON and for markdown." accent={ACCENT} active={mode === "partial"}><p className="text-sm text-[var(--muted)]">Keep the layout stable so it doesn&apos;t jump.</p></FlowStep>
              <FlowArrow label="and finish well" accent={ACCENT} />
              <FlowStep n={4} title="Handle stop, errors and the final check" what="Let users cancel, show when the stream died, and validate the complete result once it's done." accent={ACCENT} active={done}><p className="text-sm text-[var(--muted)]">Partial is for display; validate the final.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
