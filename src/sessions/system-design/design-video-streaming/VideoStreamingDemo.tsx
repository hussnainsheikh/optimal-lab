"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ABRS, CDN_HIT, LADDER, MAX_BUFFER, PLAY_S, SEGMENT_S, UPLOADS_PER_DAY, VIDEO_S, WATCH_HOURS, WORKERS, bandwidth, egress, manifest, play, storageMB, transcodeS, type Abr, type Play } from "@/lib/videoStreaming";

const ACCENT = "var(--sys)";
const dur = (s: number) => (s < 120 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

export default function VideoStreamingDemo() {
  const [workers, setWorkers] = useState(100);
  const [hit, setHit] = useState(0.95);
  const [abr, setAbr] = useState<Abr>("fixed1080");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const p = play(abr);
  const e = egress(p.avgMbps, hit);
  const tt = transcodeS(workers, true);

  const packets: Packet[] =
    stage === 0 ? hops("u", ["creator", "upload", "originals"], { label: `${VIDEO_S / 60} min video` })
    : stage === 1 ? hops("t", ["originals", "transcode"], { label: `${(VIDEO_S / SEGMENT_S) * LADDER.length} jobs` })
    : stage === 2 ? hops("s", ["transcode", "origin"], { label: "segments + playlists" })
    : stage === 3 ? hops("c", ["player", "cdn"], { label: "GET 720p/seg_12.ts" }).concat(hops("m", ["cdn", "origin"], { label: "miss", start: 0.6, tone: "bad" }))
    : stage === 4 ? hops("a", ["cdn", "player"], { label: p.stallS ? `${p.stallS} s stalled` : "no stalls", tone: p.stallS ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the creator uploads a ${VIDEO_S / 60}-minute video; the original goes to object storage.`,
    `Step 2: ${workers} workers transcode it into ${LADDER.length} renditions in ${dur(tt)}, instead of ${dur(transcodeS(1, false))} on one machine.`,
    `Step 3: each rendition is cut into ${SEGMENT_S}-second segments with a playlist; ${Math.round(storageMB())} MB stored per video.`,
    `Step 4: the CDN answers ${Math.round(hit * 100)}% of segment requests; the origin serves ${e.originPB.toFixed(1)} PB a day.`,
    `Step 5: ${ABRS.find((x) => x.id === abr)!.label}: ${p.stallS ? `${p.stallS} s of stalls` : "no stalls"}, average ${p.avgMbps.toFixed(1)} Mbps.`,
  ];
  const caption = stage !== null ? captions[stage] : `${ABRS.find((x) => x.id === abr)!.label}: starts in ${p.startup.toFixed(1)} s · ${p.stallS ? `${p.stallS} s stalled in ${p.stalls} stalls` : "no stalls"} · average ${p.avgMbps.toFixed(1)} Mbps · ${p.switches} switches.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design video streaming"
        blurb="A creator uploads a video and millions watch it on networks that change by the second. Transcode it into a ladder of qualities in parallel, cut it into short segments, serve them from a CDN, and let the player choose a quality for every segment. Then put a viewer on a train that goes through a tunnel."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Creator, upload service, originals, transcoders, origin, CDN and the player"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "creator", label: "Creator", sub: "uploads", at: [10, 20], mobileAt: [20, 8], state: "active" },
                  { id: "upload", label: "Upload service", sub: "resumable", at: [38, 20], mobileAt: [80, 8], state: "idle" },
                  { id: "originals", label: "Originals", sub: "object storage", at: [66, 20], mobileAt: [80, 36], state: "idle" },
                  { id: "transcode", label: `Transcoders ×${workers}`, sub: dur(tt), at: [88, 52], mobileAt: [20, 36], state: "active" },
                  { id: "origin", label: "Origin", sub: "segments", at: [66, 84], mobileAt: [20, 64], state: "idle" },
                  { id: "cdn", label: "CDN edge", sub: `${Math.round(hit * 100)}% hits`, at: [38, 84], mobileAt: [80, 64], state: "good" },
                  { id: "player", label: "Player", sub: ABRS.find((x) => x.id === abr)!.label, at: [10, 84], mobileAt: [50, 92], state: p.stallS ? "bad" : "good" },
                ]}
                links={[
                  { from: "creator", to: "upload", label: "file" },
                  { from: "upload", to: "originals", label: "store" },
                  { from: "originals", to: "transcode", label: "jobs" },
                  { from: "transcode", to: "origin", label: "segments" },
                  { from: "origin", to: "cdn", label: "miss" },
                  { from: "cdn", to: "player", label: "segments" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.85}
              />
              <Chart p={p} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Player" accent={ACCENT} value={abr} onChange={setAbr} options={ABRS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Streaming…">
                Upload and watch
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Upload the original once" what="Big uploads fail halfway, so upload in parts that can resume. Keep the original untouched in object storage: every rendition is made from it, and can be made again when codecs improve." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">{UPLOADS_PER_DAY.toLocaleString("en-US")} uploads a day</p>
              </FlowStep>
              <FlowArrow label="original" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Transcode a ladder, in parallel" what="One file per quality, from 240p for a weak phone signal to 1080p for fibre. Encoding is slow, so split the video into segments and encode every segment of every rendition as a separate job across many machines." accent={ACCENT} active={at(1)}>
                <Choices label="Workers" accent={ACCENT} value={String(workers)} onChange={(v) => setWorkers(Number(v))} options={WORKERS.map((w) => ({ id: String(w), label: String(w) }))} />
                <p className="mt-2 font-mono text-xs">
                  {(VIDEO_S / SEGMENT_S) * LADDER.length} jobs · {dur(tt)} with {workers} worker{workers === 1 ? "" : "s"} · {dur(transcodeS(1, false))} on one machine, whole file
                </p>
                <p className="mt-1 font-mono text-xs">{LADDER.map((r) => `${r.id} ${r.mbps} Mbps`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="renditions" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Cut into segments with a playlist" what={`Each rendition is cut into ${SEGMENT_S}-second segments, all aligned at the same timestamps so the player can switch quality between any two. A master playlist (HLS or DASH) lists the renditions; each rendition's playlist lists its segments.`} accent={ACCENT} active={at(2)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{manifest()}</pre>
                <p className="mt-1 font-mono text-xs">
                  {Math.round(storageMB())} MB per video · {((storageMB() * UPLOADS_PER_DAY) / 1e6).toFixed(0)} TB of new renditions a day
                </p>
              </FlowStep>
              <FlowArrow label="segments" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Serve segments from a CDN" what="Segments are plain files over HTTP, so any CDN can cache them near viewers. Popular videos are almost always at the edge; the long tail of rarely watched videos falls through to the origin." accent={ACCENT} active={at(3)}>
                <Choices label="CDN hit ratio" accent={ACCENT} value={String(hit)} onChange={(v) => setHit(Number(v))} options={CDN_HIT.map((h) => ({ id: String(h), label: `${Math.round(h * 100)}%` }))} />
                <p className="mt-2 font-mono text-xs">
                  {(WATCH_HOURS / 1e6).toFixed(0)}M hours watched a day at {p.avgMbps.toFixed(1)} Mbps = {e.totalPB.toFixed(0)} PB · origin serves {e.originPB.toFixed(1)} PB
                </p>
              </FlowStep>
              <FlowArrow label="the player chooses" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Adapt the bitrate in the player" what={`Before each segment the player picks a rendition. Too high and the buffer drains until playback stalls; too low and it looks bad on a good connection. The network drops to 1.5 Mbps at 30 s and almost nothing in a tunnel at 70 s.`} accent={ACCENT} active={at(4)}>
                <Choices label="Player" accent={ACCENT} value={abr} onChange={setAbr} options={ABRS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{ABRS.find((x) => x.id === abr)!.one}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">stalled</span>
                  <span className="text-right text-[var(--faint)]">avg Mbps</span>
                  <span className="text-right text-[var(--faint)]">switches</span>
                  {ABRS.map((x) => {
                    const y = play(x.id);
                    return <Row key={x.id} cells={[x.label, `${y.stallS} s`, y.avgMbps.toFixed(1), String(y.switches)]} on={x.id === abr} bad={y.stallS > 0} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Playback simulated in 50 ms steps over a fixed bandwidth trace; the buffer holds up to {MAX_BUFFER} s.</p>
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
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad && i === 1 ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Bandwidth, the rendition of each segment while it downloads, and the buffer below.
function Chart({ p }: { p: Play }) {
  const W = 300;
  const T = Math.max(p.end, PLAY_S + 5);
  const x = (t: number) => (t / T) * W;
  const TOP = 70; // bitrate panel height
  const y = (mbps: number) => TOP - (mbps / 8) * (TOP - 6);
  const BUF_Y = TOP + 12;
  const BUF_H = 34;
  const by = (b: number) => BUF_Y + BUF_H - (b / MAX_BUFFER) * BUF_H;
  const bw = Array.from({ length: Math.ceil(T) + 1 }, (_, t) => `${x(t)},${y(bandwidth(t))}`).join(" ");
  const buf = p.bufferTrace.map(([t, b]) => `${x(t)},${by(b)}`).join(" ");
  const stalls = p.bufferTrace.filter(([t, b]) => t > p.startup && b < 0.05 && t < p.end - 0.5);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`Playback over ${PLAY_S} seconds: ${p.stallS} seconds stalled, average ${p.avgMbps.toFixed(1)} Mbps`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">a viewer on a train</p>
        <p className="font-mono text-xs" style={{ color: p.stallS ? "var(--bad)" : "var(--good)" }}>
          {p.stallS ? `${p.stallS} s stalled` : "no stalls"}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${BUF_Y + BUF_H + 10}`} className="mt-2 w-full" aria-hidden>
        {p.segments.map((s) => (
          <rect key={s.i} x={x(s.requestedAt)} y={y(s.mbps)} width={Math.max(0.6, x(s.doneAt) - x(s.requestedAt) - 0.3)} height={TOP - y(s.mbps)} fill={ACCENT} opacity={0.55} />
        ))}
        <polyline points={bw} fill="none" stroke="var(--text)" strokeWidth={0.8} strokeLinejoin="round" />
        <line x1={0} x2={W} y1={TOP} y2={TOP} stroke="var(--line-strong)" strokeWidth={0.5} />
        {stalls.map(([t]) => (
          <rect key={t} x={x(t) - 0.6} y={BUF_Y} width={1.6} height={BUF_H} fill="var(--bad)" opacity={0.5} />
        ))}
        <polyline points={buf} fill="none" stroke="var(--good)" strokeWidth={0.9} />
        <line x1={0} x2={W} y1={BUF_Y + BUF_H} y2={BUF_Y + BUF_H} stroke="var(--line-strong)" strokeWidth={0.5} />
        {[0, 30, 60, 90, 120].map((t) => (
          <text key={t} x={x(t)} y={BUF_Y + BUF_H + 8} fontSize={6} fill="var(--faint)" textAnchor={t === 0 ? "start" : "middle"}>
            {t}s
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: "var(--text)" }} /> network Mbps
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: ACCENT, opacity: 0.55 }} /> rendition downloading
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: "var(--good)" }} /> buffer, 0–{MAX_BUFFER} s
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: "var(--bad)", opacity: 0.5 }} /> stalled
        </span>
      </div>
    </section>
  );
}
