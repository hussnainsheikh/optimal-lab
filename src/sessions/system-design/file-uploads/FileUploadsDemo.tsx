"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DROP_AT, FILES, LB_TIMEOUT_S, PART_MB, ROUTES, START, UPLINK_MBPS, UPLOADS_PER_MIN, run, secs, secondsFor, type Processing, type Settings } from "@/lib/fileUploads";

const ACCENT = "var(--sys)";
const PROCESSINGS: { id: Processing; label: string }[] = [
  { id: "inline", label: "Inline, in the request" },
  { id: "queue", label: "From a queue, after upload" },
];

export default function FileUploadsDemo() {
  const [s, setS] = useState<Settings>(START);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const at = (i: number) => stage === i;
  const r = run(s);
  const f = FILES.find((x) => x.id === s.file)!;
  const viaApp = s.route === "app";

  const packets: Packet[] =
    stage === 0 ? hops("ask", ["browser", "api"], { label: viaApp ? `${f.mb} MB` : "sign?" })
    : stage === 1 ? (viaApp ? hops("up", ["browser", "api", "storage"], { label: r.ok ? `${f.mb} MB` : "timeout", tone: r.ok ? "accent" : "bad" }) : [...hops("url", ["api", "browser"], { label: "signed URL" }), ...hops("put", ["browser", "storage"], { label: s.route === "multipart" ? "part 1…n" : `${f.mb} MB`, start: 0.5 })])
    : stage === 2 ? (s.drop && r.ok ? hops("retry", ["browser", viaApp ? "api" : "storage"], { label: `resend ${Math.round(r.resentMb)} MB`, tone: r.resentMb > PART_MB ? "bad" : "good" }) : [])
    : stage === 3 && r.ok ? (s.processing === "queue" ? hops("evt", ["storage", "queue", "worker"], { label: "ObjectCreated" }) : hops("inl", ["api", "worker"], { label: "resize now", tone: "bad" }))
    : stage === 4 && r.ok ? hops("thumb", ["worker", "storage"], { label: "thumbnails", tone: "good" })
    : [];

  const captions = [
    viaApp ? `Step 1: the browser POSTs ${f.mb} MB to your API.` : "Step 1: the browser asks your API for a signed upload URL; the API checks who it is and what it may upload.",
    viaApp ? (r.ok ? `Step 2: ${secs(r.uploadSec)} on the wire, with an API worker holding the connection the whole time.` : `Step 2: ${r.failReason}`) : `Step 2: the file goes straight to storage: ${secs(r.uploadSec)} at ${UPLINK_MBPS} Mbps; your API did ${secs(r.appBusySec)} of work.`,
    s.drop ? (r.ok ? `Step 3: the connection drops at ${Math.round(DROP_AT * 100)}%; ${Math.round(r.resentMb)} MB is sent again.` : "Step 3: it never got this far.") : "Step 3: no drop this time. Turn it on to see what a retry costs.",
    !r.ok ? "Step 4: nothing to process." : s.processing === "queue" ? "Step 4: storage puts an event on a queue; a worker picks it up." : `Step 4: the request waits ${f.processSec} s for thumbnails before it answers.`,
    r.ok ? `Step 5: thumbnails exist ${secs(r.doneSec)} after the upload started; the user waited ${secs(r.totalSec)}.` : "Step 5: the upload failed.",
  ];
  const caption = stage !== null ? captions[stage] : r.ok ? `${f.label} ${ROUTES.find((x) => x.id === s.route)!.label.toLowerCase()}: the user waits ${secs(r.totalSec)}; your servers carry ${r.appMbIn} MB and ${r.appWorkersBusy.toFixed(2)} workers on average for uploads alone.` : `${f.label} through the app server fails: ${r.failReason}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="File uploads and object storage"
        blurb={`A user uploads from a ${UPLINK_MBPS} Mbps connection, ${UPLOADS_PER_MIN} uploads a minute across the site. Send files through your API, straight to object storage with a presigned URL, or in parts; drop the connection halfway; then make thumbnails in the request or from a queue. Count what the user waits for and what your servers carry.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="A browser, your API, object storage, a queue and a thumbnail worker"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "browser", label: "Browser", sub: `${f.mb} MB file`, at: [13, 50], mobileAt: [50, 8], state: "active" },
                { id: "api", label: "Your API", sub: viaApp ? (r.ok ? `carries ${f.mb} MB` : "timed out") : "signs URLs", at: [40, 16], mobileAt: [22, 38], state: viaApp ? (r.ok ? "active" : "bad") : "idle" },
                { id: "storage", label: "Storage", sub: s.route === "multipart" ? `${Math.max(1, Math.ceil(f.mb / PART_MB))} parts` : "one object", at: [52, 82], mobileAt: [72, 50], state: r.ok ? "good" : "dim" },
                { id: "queue", label: "Queue", sub: s.processing === "queue" ? "ObjectCreated" : "unused", at: [86, 18], mobileAt: [28, 88], state: s.processing === "queue" ? "idle" : "dim" },
                { id: "worker", label: "Worker", sub: `${f.processSec} s a file`, at: [86, 74], mobileAt: [78, 88], state: r.ok ? "idle" : "dim" },
              ]}
              links={[
                { from: "browser", to: "api", label: viaApp ? "the file" : "sign me a URL" },
                { from: "api", to: "storage", label: "the file", dim: !viaApp },
                { from: "browser", to: "storage", label: "PUT", dim: viaApp },
                { from: "storage", to: "queue", label: "event", dashed: true, dim: s.processing !== "queue" },
                { from: "queue", to: "worker", label: "job", dim: s.processing !== "queue" },
                { from: "api", to: "worker", label: "inline", dim: s.processing !== "inline" },
                { from: "worker", to: "storage", label: "thumbnails", dashed: true },
              ]}
              packets={packets}
              aspect={1.5}
              mobileAspect={0.95}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="File" accent={ACCENT} value={s.file} onChange={(v) => set({ file: v })} options={FILES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Uploading…">
                Upload it
              </RunButton>
              <p className="w-full font-mono text-sm" style={{ color: r.ok ? "var(--text)" : "var(--bad)" }}>
                {r.ok ? `user waits ${secs(r.totalSec)}` : "failed"} · API carries {r.appMbIn} MB
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide who carries the bytes" what="Your API has to know who is uploading and what they may upload. It doesn't have to carry the file. Through the API, every byte occupies a worker and crosses your network twice; with a presigned URL, storage takes the bytes and your API only signs." accent={ACCENT} active={at(0)}>
                <Choices label="Route" accent={ACCENT} value={s.route} onChange={(v) => set({ route: v })} options={ROUTES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{ROUTES.find((x) => x.id === s.route)!.one}</p>
              </FlowStep>
              <FlowArrow label="the upload" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Mind the timeouts and the workers" what={`At ${UPLINK_MBPS} Mbps a 200 MB video takes ${secs(secondsFor(200))}. The load balancer in front of your API gives up at ${LB_TIMEOUT_S} s. Even when it fits, each upload pins a worker for its whole length; by Little's law, ${UPLOADS_PER_MIN} uploads a minute × seconds each = workers busy doing nothing but waiting for bytes.`} accent={ACCENT} active={at(1)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">user waits</span>
                  <span className="text-right text-[var(--faint)]">API workers</span>
                  {ROUTES.map((x) => {
                    const y = run({ ...s, route: x.id });
                    return <Row key={x.id} cells={[x.label, y.ok ? secs(y.totalSec) : "fails", y.appWorkersBusy.toFixed(2)]} bad={!y.ok} bold={x.id === s.route} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="the connection drops" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Resume instead of restarting" what={`Mobile connections drop. A single request, through the API or as one PUT, starts again from zero. A multipart upload sends ${PART_MB} MB parts; the parts already stored stay stored, and only the part in flight is sent again.`} accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.drop} onChange={(e) => set({ drop: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The connection drops at {Math.round(DROP_AT * 100)}%
                </label>
                <ul className="space-y-0.5 font-mono text-xs">
                  {ROUTES.map((x) => {
                    const y = run({ ...s, route: x.id, drop: true });
                    return (
                      <li key={x.id} style={{ fontWeight: x.id === s.route ? 700 : 400, color: !y.ok ? "var(--bad)" : y.resentMb > PART_MB ? "var(--bad)" : "var(--text)" }}>
                        {x.label}: {y.ok ? `resend ${Math.round(y.resentMb)} MB, ${secs(y.totalSec)} in all` : "fails before the drop matters"}
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label="the file is stored" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Process it after, not during" what="Thumbnails, virus scans and transcoding are slow and can fail on their own. Storage can emit an event when an object lands; a queue and a worker do the work, retry it if it fails, and the user isn't kept waiting." accent={ACCENT} active={at(3)}>
                <Choices label="Thumbnails" accent={ACCENT} value={s.processing} onChange={(v) => set({ processing: v })} options={PROCESSINGS} />
                <p className="mt-2 font-mono text-xs">
                  {r.ok ? `user waits ${secs(r.totalSec)} · thumbnails ready at ${secs(r.doneSec)}` : "upload failed"}
                </p>
              </FlowStep>
              <FlowArrow label="and keep it safe" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Sign narrowly, keep the bucket private" what="A presigned URL is a capability: sign one key, one method, a size limit and the content type, for a few minutes. Keep the bucket private, serve files through signed reads or a CDN, and scan before anyone else can download them." accent={ACCENT} active={at(4)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  <li>PUT uploads/u42/7f3c.mp4 · expires in 10 min</li>
                  <li>content-type: video/mp4 · content-length ≤ 2 GB</li>
                  <li>bucket: private · reads via signed URL or CDN</li>
                  <li>on ObjectCreated: scan → thumbnails → mark ready</li>
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The 5 GB single-PUT limit and the multipart design are S3&rsquo;s; Google Cloud Storage and Azure Blob Storage have equivalents (resumable uploads, block blobs).</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad?: boolean; bold?: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: bad && i === 1 ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
