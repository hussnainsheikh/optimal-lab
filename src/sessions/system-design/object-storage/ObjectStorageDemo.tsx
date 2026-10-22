"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { AFR, FAILS, NODES, OBJECT_MB, REPAIR_HOURS, SCHEMES, ZONES, lossPerYear, nines, overhead, scheme, status, type Piece, type Scheme } from "@/lib/objectStorage";

const ACCENT = "var(--sys)";
const KEY = "photos/2024/cat.jpg";
const hours = (h: number) => (h < 24 ? `${h} hour` : h === 24 ? "1 day" : `${h / 24} days`);

export default function ObjectStorageDemo() {
  const [s, setS] = useState<Scheme>("rep3");
  const [failed, setFailed] = useState<string[]>([]);
  const [repair, setRepair] = useState(24);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const sc = scheme(s);
  const st = status(s, failed);
  const preset = FAILS.find((f) => f.nodes.length === failed.length && f.nodes.every((n) => failed.includes(n)))?.id ?? "custom";
  const toggle = (n: string) => setFailed((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const inZone = (z: string) => st.pieces.filter((p) => p.node.startsWith(z));
  const aliveIn = (z: string) => inZone(z).filter((p) => !failed.includes(p.node)).length;
  const zoneDown = (z: string) => [1, 2, 3].every((i) => failed.includes(`${z}${i}`));
  const zones = ZONES.map((z) => `zone${z}`);
  const pieceLabel = (p: Piece) => (sc.k === 1 ? `copy ${p.i + 1}` : p.parity ? `p${p.i - sc.k + 1}` : `d${p.i + 1}`);

  const packets: Packet[] =
    stage === 0 ? hops("k", ["client", "api", "meta"], { label: `GET ${KEY.split("/").pop()}` })
    : stage === 1 ? hops("w", ["client", "api"], { label: `${OBJECT_MB} MB` })
    : stage === 2 ? zones.flatMap((z) => hops(`p${z}`, ["api", z], { label: `${inZone(z.slice(4)).length} × ${OBJECT_MB / sc.k} MB` }))
    : stage === 3 ? zones.filter((z) => aliveIn(z.slice(4)) > 0).flatMap((z) => hops(`r${z}`, [z, "api"], { label: `${aliveIn(z.slice(4))} pieces`, tone: st.readable ? "good" : "bad" }))
    : stage === 4 && st.lost && st.readable ? hops("rep", [zones.find((z) => aliveIn(z.slice(4)) > 0)!, "zoneA"], { label: `rebuild ${st.rebuiltMB} MB` })
    : [];

  const captions = [
    `Step 1: the front end asks the metadata service where ${KEY} lives.`,
    `Step 2: ${sc.label}: ${sc.k + sc.m} pieces of ${OBJECT_MB / sc.k} MB, ${overhead(s)}× the object's size on disk.`,
    `Step 3: ${ZONES.map((z) => `zone ${z} holds ${inZone(z).length}`).join(", ")}.`,
    st.readable ? `Step 4: ${st.alive} of ${sc.k + sc.m} pieces are reachable; any ${sc.k} rebuild the object${st.decode ? ", decoding the missing data from parity" : ""}.` : `Step 4: only ${st.alive} of ${sc.k + sc.m} pieces are left, fewer than ${sc.k}. The object is gone.`,
    `Step 5: with repairs done in ${hours(repair)}, the chance of losing an object in a year is about 1 in ${Math.round(1 / lossPerYear(s, repair)).toLocaleString("en-US")}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${sc.label}: ${overhead(s)}× storage · ${st.lost} pieces lost, ${st.readable ? `still readable${st.margin === 0 ? ", with no margin left" : ""}` : "object lost"} · ${nines(lossPerYear(s, repair))} nines a year.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Distributed object storage"
        blurb={`An object store like S3 keeps billions of files on cheap disks that fail every day. Store one ${OBJECT_MB} MB photo on nine nodes in three zones as two copies, three copies or erasure-coded pieces, then fail disks and a whole zone. Count what it costs in disk and what it buys in durability.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A client, the front end, the metadata service and storage nodes in three zones"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "client", label: "Client", sub: "PUT / GET", at: [10, 22], mobileAt: [20, 9], state: "active" },
                  { id: "api", label: "Front end", sub: st.readable ? "serving" : "404 data lost", at: [40, 22], mobileAt: [50, 34], state: st.readable ? "active" : "bad" },
                  { id: "meta", label: "Metadata", sub: "key → placement", at: [76, 22], mobileAt: [80, 9], state: "idle" },
                  ...ZONES.map((z, i) => ({
                    id: `zone${z}`,
                    label: `Zone ${z}`,
                    sub: `${aliveIn(z)}/${inZone(z).length} pieces`,
                    at: [16 + i * 34, 80] as [number, number],
                    mobileAt: [16 + i * 34, 80] as [number, number],
                    state: zoneDown(z) ? ("bad" as const) : aliveIn(z) < inZone(z).length ? ("wait" as const) : ("good" as const),
                  })),
                ]}
                links={[
                  { from: "client", to: "api", label: "request" },
                  { from: "api", to: "meta", label: "where?" },
                  ...zones.map((z) => ({ from: "api", to: z, label: "pieces", dim: zoneDown(z.slice(4)) })),
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <Nodes pieceLabel={pieceLabel} pieces={st.pieces} failed={failed} toggle={toggle} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Scheme" accent={ACCENT} value={s} onChange={setS} options={SCHEMES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Fail" accent={ACCENT} value={preset} onChange={(id) => setFailed(FAILS.find((f) => f.id === id)?.nodes ?? [])} options={FAILS.map((f) => ({ id: f.id, label: f.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Storing…">
                Store and read it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Look up where the object lives" what="The key isn't a file path on one disk. A metadata service maps it to a placement: which nodes hold its pieces. Front ends are stateless; any of them can serve any key." accent={ACCENT} active={at(0)}>
                <p className="break-all font-mono text-xs">
                  {KEY} → {sc.label.toLowerCase()} · {st.pieces.map((p) => p.node).join(", ")}
                </p>
              </FlowStep>
              <FlowArrow label={`${OBJECT_MB} MB`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Split it and add redundancy" what="Copies are simple: any one copy is the whole object. Erasure coding cuts the object into k pieces and computes m parity pieces from them; any k of the k + m rebuild it. Same protection, far less disk." accent={ACCENT} active={at(1)}>
                <Choices label="Scheme" accent={ACCENT} value={s} onChange={setS} options={SCHEMES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{sc.one}</p>
                <p className="mt-1 font-mono text-xs">
                  {sc.k + sc.m} pieces × {OBJECT_MB / sc.k} MB = {(sc.k + sc.m) * (OBJECT_MB / sc.k)} MB on disk · 1 PB of photos needs {overhead(s)} PB of disk
                </p>
              </FlowStep>
              <FlowArrow label="pieces" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Spread the pieces across zones" what="Never two pieces on one disk, and as evenly as possible across zones, so a whole zone going dark costs a known number of pieces. With three zones, erasure 6+3 puts 3 pieces in each: a zone is exactly its whole margin." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">{ZONES.map((z) => `zone ${z}: ${inZone(z).map(pieceLabel).join(", ") || "nothing"}`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="disks fail" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Lose disks and zones" what="At this scale a disk dies every few minutes somewhere. A read needs any k pieces: a copy, or six fragments, decoding missing data from parity. Tap a node above to fail it, or pick a case." accent={ACCENT} active={at(3)}>
                <Choices label="Fail" accent={ACCENT} value={preset} onChange={(id) => setFailed(FAILS.find((f) => f.id === id)?.nodes ?? [])} options={FAILS.map((f) => ({ id: f.id, label: f.label }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">pieces left</span>
                  <span className="text-right text-[var(--faint)]">readable</span>
                  {SCHEMES.map((x) => {
                    const y = status(x.id, failed);
                    return <Row key={x.id} cells={[x.label, `${y.alive}/${x.k + x.m}`, y.readable ? (y.margin === 0 ? "yes, no margin" : "yes") : "LOST"]} on={x.id === s} bad={!y.readable} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="rebuild" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Repair before the next failure" what="Durability is a race: an object is lost only if more pieces fail than the margin before the first one is rebuilt. Fast repair matters as much as the scheme. Rebuilding an erasure-coded piece reads k pieces, so repair traffic is the hidden cost." accent={ACCENT} active={at(4)}>
                <Choices label="Repair time" accent={ACCENT} value={String(repair)} onChange={(v) => setRepair(Number(v))} options={REPAIR_HOURS.map((h) => ({ id: String(h), label: hours(h) }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">disk</span>
                  <span className="text-right text-[var(--faint)]">nines / year</span>
                  {SCHEMES.map((x) => (
                    <Row key={x.id} cells={[x.label, `${overhead(x.id)}×`, String(nines(lossPerYear(x.id, repair)))]} on={x.id === s} />
                  ))}
                </div>
                <p className="mt-2 font-mono text-xs">
                  {st.lost === 0 ? "nothing to repair" : !st.readable ? "nothing left to rebuild from" : `rebuilding ${st.rebuiltMB} MB reads ${st.repairMB} MB from the surviving pieces`}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Disks fail independently at {AFR * 100}% a year in this model. Real failures are correlated (a rack, a bad batch, a zone), which is why placement across zones matters more than the nines.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on: boolean; bad?: boolean }) {
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

// Nine storage nodes in three zones, each showing the piece it holds. Tap to fail one.
function Nodes({ pieces, failed, toggle, pieceLabel }: { pieces: Piece[]; failed: string[]; toggle: (n: string) => void; pieceLabel: (p: Piece) => string }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Storage nodes by zone and the piece each holds">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">storage nodes · tap to fail</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ZONES.map((z) => (
          <div key={z} className="space-y-1.5">
            <p className="text-center font-mono text-[11px] text-[var(--muted)]">zone {z}</p>
            {NODES.filter((n) => n.startsWith(z)).map((n) => {
              const p = pieces.find((x) => x.node === n);
              const down = failed.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggle(n)}
                  aria-pressed={down}
                  aria-label={`Node ${n}${p ? `, holds ${pieceLabel(p)}` : ", empty"}${down ? ", failed" : ""}`}
                  className="flex min-h-11 w-full flex-col items-center justify-center rounded-md border font-mono text-[11px]"
                  style={{
                    borderColor: down ? "var(--bad)" : p ? (p.parity ? "var(--c3)" : ACCENT) : "var(--line)",
                    background: down ? "color-mix(in srgb, var(--bad) 14%, transparent)" : p ? `color-mix(in srgb, ${p.parity ? "var(--c3)" : ACCENT} 16%, transparent)` : "transparent",
                    textDecoration: down ? "line-through" : "none",
                  }}
                >
                  <span className="text-[var(--faint)]">{n}</span>
                  <span>{p ? pieceLabel(p) : "·"}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
