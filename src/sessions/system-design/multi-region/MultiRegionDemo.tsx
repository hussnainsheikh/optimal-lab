"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DESIGNS, LAG_MS, REGIONS, WRITES_PER_SEC, access, conflict, copies, lostOnFailure, readOther, residency, rtt, type Design, type Fail, type Region } from "@/lib/multiRegion";

const ACCENT = "var(--sys)";
const IDS: Region[] = ["us", "eu", "ap"];
const POS: Record<Region, { user: [number, number]; region: [number, number] }> = {
  us: { user: [14, 16], region: [14, 80] },
  eu: { user: [50, 12], region: [50, 56] },
  ap: { user: [86, 16], region: [86, 80] },
};
const reg = (r: Region) => REGIONS.find((x) => x.id === r)!;
const ms = (n: number | null) => (n === null ? "down" : `${n} ms`);
const lostLabel = (n: number) => (n === Infinity ? "everything since the last backup" : n === 0 ? "nothing" : `~${n.toLocaleString("en-US")} writes`);

export default function MultiRegionDemo() {
  const [d, setD] = useState<Design>("replicas");
  const [user, setUser] = useState<Region>("eu");
  const [down, setDown] = useState<Fail>("none");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const a = access(d, user, down);
  const c = conflict(d);
  const res = residency(d);
  const lost = lostOnFailure(d, down);
  const regionState = (r: Region): MapNode["state"] => (down === r ? "bad" : d === "single" && r !== "us" ? "dim" : d === "replicas" && r !== "us" ? "idle" : "active");

  const packets: Packet[] =
    stage === 0 ? hops("dns", [`u${user}`, a.readAt ? `r${a.readAt}` : `r${user}`], { label: "nearest region", tone: a.readAt ? "accent" : "bad" })
    : stage === 1 ? (a.readAt ? hops("rd", [`u${user}`, `r${a.readAt}`], { label: `read ${ms(a.readMs)}` }) : [])
    : stage === 2 ? (a.writeAt ? hops("wr", [`u${user}`, `r${a.writeAt}`], { label: `write ${ms(a.writeMs)}`, tone: (a.writeMs ?? 0) > 50 ? "bad" : "good" }) : hops("wr", [`u${user}`, `r${user}`], { label: "write refused", tone: "bad" }))
    : stage === 3 ? (d === "single" ? [] : IDS.filter((r) => r !== (a.writeAt ?? "us") && down !== r).flatMap((r) => hops(`rep${r}`, [`r${a.writeAt ?? "us"}`, `r${r}`], { label: `copy +${LAG_MS} ms` })))
    : stage === 4 ? hops("pii", [`ueu`, `r${d === "single" ? "us" : "eu"}`], { label: res.ok ? "stays in EU" : "leaves EU", tone: res.ok ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: GeoDNS sends ${reg(user).users} users to ${a.readAt ? reg(a.readAt).label : "nowhere: every region they could use is down"}.`,
    a.readMs === null ? "Step 2: there is nowhere to read this user's data from." : `Step 2: a read is served from ${reg(a.readAt!).label} in ${a.readMs} ms.`,
    a.writeMs === null ? "Step 3: writes can't be taken right now." : `Step 3: a write goes to ${reg(a.writeAt!).label}: ${a.writeMs} ms.`,
    down === "none" ? `Step 4: no region is down. Writes reach the other regions about ${LAG_MS} ms later.` : `Step 4: ${reg(down).label} is down. Lost: ${lostLabel(lost)}. ${a.note[0].toUpperCase()}${a.note.slice(1)}.`,
    `Step 5: a European user's data is stored ${res.where}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${DESIGNS.find((x) => x.id === d)!.label}: ${reg(user).users} users read in ${ms(a.readMs)} and write in ${ms(a.writeMs)} · EU data ${res.ok ? "stays in the EU" : res.where}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Multi-region systems"
        blurb="A social app has users in the US, Europe and Singapore. Light takes 165 ms to get from Frankfurt to Singapore and back, and no database can make it faster. Spread the data over three regions four ways, then pick whose request to follow, take a region down, and see where European users' data ends up."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Users in three places and three cloud regions"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  ...IDS.map((r) => ({ id: `u${r}`, label: `${reg(r).users} users`, sub: `reads ${ms(access(d, r, down).readMs)}`, at: POS[r].user, state: r === user ? ("active" as const) : ("idle" as const) })),
                  ...IDS.map((r) => ({
                    id: `r${r}`,
                    label: reg(r).label,
                    sub: down === r ? "down" : d === "single" ? (r === "us" ? "everything" : "unused") : d === "replicas" ? (r === "us" ? "primary" : "replica") : d === "active" ? "read + write" : `${reg(r).users} data`,
                    at: POS[r].region,
                    state: regionState(r),
                  })),
                ]}
                links={[
                  ...IDS.map((r) => ({ from: `u${r}`, to: `r${r}`, label: `${rtt(r, r)} ms`, dim: d === "single" && r !== "us" })),
                  { from: "rus", to: "reu", label: `${rtt("us", "eu")} ms`, dashed: true, dim: d === "single" || d === "home" },
                  { from: "reu", to: "rap", label: `${rtt("eu", "ap")} ms`, dashed: true, dim: d === "single" || d === "home" },
                  { from: "rus", to: "rap", label: `${rtt("us", "ap")} ms`, dashed: true, dim: d === "single" || d === "home" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.95}
              />
              <Table d={d} down={down} user={user} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Design" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Follow" accent={ACCENT} value={user} onChange={setUser} options={IDS.map((r) => ({ id: r, label: `${reg(r).users} user` }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Routing…">
                Follow a request
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Route each user to the nearest region" what="GeoDNS or anycast sends each user to the closest healthy region, and health checks take a region out when it fails. That only helps if the nearest region can actually answer." accent={ACCENT} active={at(0)}>
                <Choices label="Follow" accent={ACCENT} value={user} onChange={setUser} options={IDS.map((r) => ({ id: r, label: `${reg(r).users} user` }))} />
                <p className="mt-2 font-mono text-xs">{IDS.map((r) => `${reg(r).city} ${rtt(user, r)} ms`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="read" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Serve reads from a local copy" what="Most traffic is reads. A replica in each region turns a 165 ms read into a 14 ms one, at the price of reading data that may be a few hundred milliseconds old." accent={ACCENT} active={at(1)}>
                <Choices label="Design" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{DESIGNS.find((x) => x.id === d)!.one}</p>
                <p className="mt-1 font-mono text-xs">
                  {reg(user).users} user reads own data in {ms(a.readMs)} · reads a Singapore friend&rsquo;s post in {readOther(d, user, "ap")} ms
                </p>
              </FlowStep>
              <FlowArrow label="write" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Decide where writes go" what="One primary keeps writes ordered but puts an ocean in front of most users. Writing locally everywhere is fast, and two regions can then change the same row before they hear about each other." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">write from {reg(user).users}: {ms(a.writeMs)}</p>
                <p className="mt-2 text-xs" style={{ color: c.lost ? "var(--bad)" : "var(--good)" }}>
                  Two people rename the same group at once, from Europe and Singapore. {c.note}
                </p>
              </FlowStep>
              <FlowArrow label="a region fails" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Lose a region" what={`Cross-region replication is asynchronous; synchronous would add a round trip to every write. So a region that dies takes its last ~${LAG_MS} ms of writes with it, at ${WRITES_PER_SEC.toLocaleString("en-US")} writes a second across the app.`} accent={ACCENT} active={at(3)}>
                <Choices label="Take down" accent={ACCENT} value={down} onChange={setDown} options={[{ id: "none" as Fail, label: "Nothing" }, ...IDS.map((r) => ({ id: r as Fail, label: reg(r).city }))]} />
                <p className="mt-2 font-mono text-xs" style={{ color: down !== "none" && (lost > 0 || a.writeMs === null) ? "var(--bad)" : "var(--text)" }}>
                  lost: {lostLabel(lost)} · {reg(user).users} user: {a.note}
                </p>
              </FlowStep>
              <FlowArrow label="where data lives" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep data where the law says" what="GDPR and data-localisation laws can require personal data to stay in a jurisdiction. Copying everything everywhere for speed breaks that; pinning each user to a home region keeps it, and makes cross-region reads slower." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">full copies</span>
                  <span className="text-right text-[var(--faint)]">EU data stays in EU</span>
                  {DESIGNS.map((x) => (
                    <Row key={x.id} cells={[x.label, String(copies(x.id)), residency(x.id).ok ? "yes" : "no"]} on={x.id === d} />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Round trips are typical public-cloud figures. Real systems mix these: home regions for personal data, replicas for shared content, and a synchronously replicated store (Spanner, CockroachDB) where ordering matters more than write latency.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on }: { cells: string[]; on: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Read and write latency for each group of users, under the chosen design and failure.
function Table({ d, down, user }: { d: Design; down: Fail; user: Region }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Read and write latency for each group of users">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">own data · {down === "none" ? "all regions up" : `${reg(down).label} down`}</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1 font-mono text-xs">
        <span />
        <span className="text-right text-[var(--faint)]">read</span>
        <span className="text-right text-[var(--faint)]">write</span>
        {IDS.map((r) => {
          const x = access(d, r, down);
          const tone = (n: number | null) => (n === null ? "var(--bad)" : n > 50 ? "var(--c2)" : "var(--good)");
          return (
            <Cells key={r} label={`${reg(r).users} users`} on={r === user} read={ms(x.readMs)} write={ms(x.writeMs)} readTone={tone(x.readMs)} writeTone={tone(x.writeMs)} />
          );
        })}
      </div>
    </section>
  );
}

function Cells({ label, on, read, write, readTone, writeTone }: { label: string; on: boolean; read: string; write: string; readTone: string; writeTone: string }) {
  return (
    <>
      <span className="font-sans" style={{ fontWeight: on ? 600 : 400 }}>
        {label}
      </span>
      <span className="text-right" style={{ color: readTone }}>
        {read}
      </span>
      <span className="text-right" style={{ color: writeTone }}>
        {write}
      </span>
    </>
  );
}
