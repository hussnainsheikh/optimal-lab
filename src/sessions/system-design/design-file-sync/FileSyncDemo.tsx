"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { FILE_BYTES, FIXED, INSERT_AT, INSERT_BYTES, SCENARIOS, commit, kb, upload, type Chunking, type Scenario } from "@/lib/fileSync";

const ACCENT = "var(--sys)";
const CHUNKINGS: { id: Chunking; label: string }[] = [
  { id: "fixed", label: "Fixed 16 KB" },
  { id: "cdc", label: "Content-defined" },
];

export default function FileSyncDemo() {
  const [scenario, setScenario] = useState<Scenario>("insert");
  const [how, setHow] = useState<Chunking>("fixed");
  const [dedupe, setDedupe] = useState(true);
  const [conflict, setConflict] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const u = upload(scenario, how, dedupe);
  const head = conflict ? 4 : 3;
  const c = commit(3, head);

  const packets: Packet[] =
    stage === 0 ? hops("h", ["laptop", "blocks"], { label: `${u.chunks.length} hashes` })
    : stage === 1 ? hops("m", ["blocks", "laptop"], { label: `missing: ${u.missing.size}` })
    : stage === 2 ? (u.missing.size ? hops("u", ["laptop", "blocks", "s3"], { label: kb(u.uploadBytes), tone: u.uploadBytes > FILE_BYTES / 2 ? "bad" : "good" }) : hops("u", ["laptop", "blocks"], { label: "nothing to send", tone: "good" }))
    : stage === 3 ? hops("c", ["laptop", "meta", "notify", "phone"], { label: c.ok ? "v4 committed" : "conflict", tone: c.ok ? "good" : "bad" })
    : stage === 4 ? hops("d", ["phone", "blocks"], { label: `fetch ${u.missing.size} chunks` })
    : [];

  const captions = [
    `Step 1: the laptop cuts the file into ${u.chunks.length} chunks and hashes each one.`,
    `Step 2: it sends the hashes; the server already has ${u.chunks.length - u.missing.size} of them.`,
    `Step 3: ${kb(u.uploadBytes)} uploaded of a ${kb(u.fileBytes)} file.`,
    `Step 4: ${c.note} The phone is told a new version exists.`,
    `Step 5: the phone downloads only the ${u.missing.size} chunk${u.missing.size === 1 ? "" : "s"} it doesn't have.`,
  ];
  const caption = stage !== null ? captions[stage] : `${SCENARIOS.find((x) => x.id === scenario)!.label}, ${how === "fixed" ? "fixed 16 KB" : "content-defined"} chunks: ${u.missing.size} of ${u.chunks.length} chunks uploaded, ${kb(u.uploadBytes)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design file sync (like Dropbox)"
        blurb="A file changes on a laptop and should appear on a phone. Sending the whole file every time wastes bandwidth and storage. Split it into chunks named by their hash, upload only the chunks the server lacks, and see why where you cut the chunks decides how much an edit costs. All the chunking below runs on a real 1 MB file."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Laptop, block service, block store, metadata service, notifications and phone"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "laptop", label: "Laptop", sub: "sync client", at: [12, 28], mobileAt: [22, 8], state: "active" },
                  { id: "blocks", label: "Block service", sub: dedupe ? "has / put chunk" : "put file", at: [46, 28], mobileAt: [78, 8], state: "active" },
                  { id: "s3", label: "Block store", sub: "by hash", at: [84, 28], mobileAt: [78, 42], state: "idle" },
                  { id: "meta", label: "Metadata", sub: `file → ${u.chunks.length} hashes`, at: [12, 78], mobileAt: [22, 42], state: c.ok ? "good" : "bad" },
                  { id: "notify", label: "Notifications", sub: "long poll", at: [46, 78], mobileAt: [22, 85], state: "idle" },
                  { id: "phone", label: "Phone", sub: "other device", at: [84, 78], mobileAt: [78, 85], state: "active" },
                ]}
                links={[
                  { from: "laptop", to: "blocks", label: "chunks" },
                  { from: "blocks", to: "s3", label: "store" },
                  { from: "laptop", to: "meta", label: "commit" },
                  { from: "meta", to: "notify", label: "changed" },
                  { from: "notify", to: "phone", label: "pull", dashed: true },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Strips scenario={scenario} dedupe={dedupe} on={how} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Change" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Syncing…">
                Save and sync
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Split the file into chunks and hash each" what="Each chunk is named by the hash of its bytes, so identical chunks have identical names wherever they appear: in another version, another file, or another user's account. A file is just a list of chunk hashes." accent={ACCENT} active={at(0)}>
                <Choices label="Chunks" accent={ACCENT} value={how} onChange={setHow} options={CHUNKINGS} />
                <p className="mt-2 font-mono text-xs">
                  {u.chunks.length} chunks · first hashes {u.chunks.slice(0, 3).map((x) => x.hash).join(", ")}…
                </p>
              </FlowStep>
              <FlowArrow label="hashes" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Ask which chunks the server is missing" what="The client sends the list of hashes first. The server answers with the ones it doesn't have, and only those are uploaded. A file someone else already uploaded costs nothing to store again." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Skip chunks the server already has
                </label>
                <Choices label="Change" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{SCENARIOS.find((x) => x.id === scenario)!.one}</p>
              </FlowStep>
              <FlowArrow label="missing chunks" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Cut chunks by content, not by position" what={`Insert ${INSERT_BYTES} bytes ${INSERT_AT / 1024} KB in and every fixed ${FIXED / 1024} KB boundary after it shifts: every later chunk gets a new hash and is uploaded again. A rolling hash over the bytes picks boundaries from the content, so they move with it and only the edited chunk changes.`} accent={ACCENT} active={at(2)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">chunks sent</span>
                  <span className="text-right text-[var(--faint)]">bytes sent</span>
                  {CHUNKINGS.map((x) => {
                    const y = upload(scenario, x.id, dedupe);
                    return <Row key={x.id} cells={[x.label, `${y.missing.size}/${y.chunks.length}`, kb(y.uploadBytes)]} on={x.id === how} bad={y.uploadBytes > FILE_BYTES / 2 && scenario !== "first"} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="new version" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Commit the version, then tell other devices" what="Once its chunks are stored, the client commits the new list of hashes to the metadata service as the next version, saying which version it started from. Other devices hold a long poll open and are told a new version exists." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={conflict} onChange={(e) => setConflict(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The phone also edited version 3 offline and synced first
                </label>
                <p className="font-mono text-xs" style={{ color: c.ok ? "var(--good)" : "var(--bad)" }}>
                  {c.note}
                </p>
              </FlowStep>
              <FlowArrow label="download" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Download only what changed" what="The phone fetches the new list of hashes, compares it with what it has, and downloads only the missing chunks. Conflicts aren't merged for arbitrary files; the safe answer is to keep both copies and let a person choose." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">
                  {u.missing.size} chunks · {kb(u.uploadBytes)} down instead of {kb(u.fileBytes)}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">A real 1 MB file of random bytes, chunked with a gear rolling hash (4–64 KB, about 16 KB on average) and hashed with FNV-1a; production systems use larger chunks and SHA-256.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on: boolean; bad: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad && i > 0 ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Each chunk drawn to scale; filled chunks were uploaded, outlined ones the server had.
function Strips({ scenario, dedupe, on }: { scenario: Scenario; dedupe: boolean; on: Chunking }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The file's chunks, and which were uploaded">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the file, chunk by chunk</p>
      <div className="mt-3 space-y-3">
        {CHUNKINGS.map((x) => {
          const y = upload(scenario, x.id, dedupe);
          return (
            <div key={x.id} style={{ opacity: x.id === on ? 1 : 0.6 }}>
              <div className="flex justify-between font-mono text-[11px]">
                <span>{x.label}</span>
                <span style={{ color: y.uploadBytes > FILE_BYTES / 2 && scenario !== "first" ? "var(--bad)" : "var(--muted)" }}>{kb(y.uploadBytes)} sent</span>
              </div>
              <div className="mt-1 flex h-5 gap-px overflow-hidden rounded-sm">
                {y.chunks.map((c) => (
                  <span key={c.start} title={`${kb(c.size)} · ${c.hash}`} style={{ flexGrow: c.size, flexBasis: 0, background: y.missing.has(c.start) ? ACCENT : "transparent", border: `1px solid ${y.missing.has(c.start) ? ACCENT : "var(--line-strong)"}` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: ACCENT }} /> uploaded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-[var(--line-strong)]" /> already on the server
        </span>
      </div>
    </section>
  );
}
