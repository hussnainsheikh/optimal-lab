"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CHANGES, FILES, build, type Change } from "@/lib/dockerLayers";

const ACCENT = "var(--ops)";

export default function LayersDemo() {
  const [fileId, setFileId] = useState<"naive" | "ordered">("naive");
  const [change, setChange] = useState<Change>("code");
  const file = FILES.find((f) => f.id === fileId)!;
  const { rows, seconds } = build(file.lines, change);
  const maxSec = Math.max(...file.lines.map((l) => l.seconds), 1);
  const firstRebuilt = rows.findIndex((r) => !r.cached);

  const caption =
    change === "none"
      ? "Nothing changed, so every layer comes from the cache: the build finishes in a moment."
      : `${firstRebuilt >= 0 ? `“${rows[firstRebuilt].text}” sees a change, so it and every layer after it rebuild` : "Every layer is reused"}: ${seconds} s.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="DevOps · interactive"
        title="Docker images and layer caching"
        blurb="Each line of a Dockerfile builds a layer, and Docker reuses a layer only if nothing it depends on changed, including every layer above it. Change one file and see how much reruns, then reorder the file."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The Dockerfile and which layers rebuild">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Dockerfile · {file.label}</p>
                <p className="font-mono text-sm" style={{ color: seconds > 30 ? "var(--bad)" : "var(--good)" }}>build: {seconds} s</p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {rows.map((r, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 rounded-md border px-2.5 py-2" style={{ borderColor: r.cached ? "var(--line)" : ACCENT, background: r.cached ? "var(--inset)" : "color-mix(in srgb, var(--ops) 14%, transparent)" }}>
                    <span className="min-w-0 break-words font-mono text-xs sm:text-sm">{r.text}</span>
                    <span className="text-right text-xs">
                      <span style={{ color: r.cached ? "var(--good)" : "var(--text)" }}>{r.cached ? "CACHED" : `rebuild ${r.seconds} s`}</span>
                      <span className="mt-1 block h-1 rounded bg-[var(--track)]">
                        <span className="block h-full rounded" style={{ width: `${r.cached ? 0 : (r.seconds / maxSec) * 100}%`, background: ACCENT }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Dockerfile" accent={ACCENT} value={fileId} onChange={setFileId} options={FILES.map((f) => ({ id: f.id, label: f.label }))} />
              <p className="w-full text-xs text-[var(--muted)]">{file.note}</p>
              <Choices label="What changed since the last build?" accent={ACCENT} value={change} onChange={setChange} options={CHANGES.map((c) => ({ id: c.id, label: c.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Every instruction makes a layer" what="FROM, COPY and RUN each produce a snapshot of the filesystem. The image is the stack of them." accent={ACCENT}>
                <p className="font-mono text-sm">{file.lines.length} instructions → {file.lines.length} layers</p>
              </FlowStep>
              <FlowArrow label="build again" accent={ACCENT} />

              <FlowStep n={2} title="Docker checks each layer's inputs" what="For COPY, the files copied. For RUN, the command and the layer below it. Same inputs, same layer: reuse it." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">{change === "code" ? "src/app.js changed: any COPY that includes it has new inputs." : change === "deps" ? "package.json changed: every COPY that includes it has new inputs." : "Nothing changed."}</p>
              </FlowStep>
              <FlowArrow label="the first changed layer" accent={ACCENT} />

              <FlowStep n={3} title="One change rebuilds everything below it" what="Once a layer rebuilds, every layer after it must too, even if its own instruction is unchanged." accent={ACCENT} active>
                <p className="text-sm">
                  {firstRebuilt >= 0 ? `From line ${firstRebuilt + 1} down: ${rows.filter((r) => !r.cached).length} layers, ${seconds} s.` : "Nothing rebuilt."}
                </p>
              </FlowStep>
              <FlowArrow label="put slow, stable steps first" accent={ACCENT} />

              <FlowStep n={4} title="Order from least to most often changed" what="Install dependencies before copying your code. Code changes every commit; dependencies rarely do." accent={ACCENT}>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {FILES.map((f) => (
                    <li key={f.id} className="flex flex-wrap justify-between gap-x-3">
                      <span>{f.label}</span>
                      <span className="font-mono text-[var(--text)]">{CHANGES.filter((c) => c.id !== "none").map((c) => `${c.id === "code" ? "code" : "deps"}: ${build(f.lines, c.id).seconds} s`).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
