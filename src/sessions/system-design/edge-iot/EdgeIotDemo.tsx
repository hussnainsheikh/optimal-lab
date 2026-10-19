"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { BACKLOG, BUFFER, EXCURSION, FLEET, FLEET_IN_RANGE, JITTER_S, MINUTES, MODES, OFFLINE, REBOOT, REV_B, UPDATES, clock, day, online, reconnectPeak, rollout, type DayResult, type Fate, type Mode, type Update } from "@/lib/edgeIot";

const ACCENT = "var(--sys)";
const FATE_COLOR: Record<Fate, string> = { live: "var(--good)", late: "var(--c1)", summarised: "var(--c5)", lost: "var(--bad)" };
const FATE_LABEL: Record<Fate, string> = { live: "sent live", late: "sent late", summarised: "summarised", lost: "lost" };
const jit = (s: number) => (s === 0 ? "none" : s < 120 ? `${s} s` : `${s / 60} min`);

export default function EdgeIotDemo() {
  const [mode, setMode] = useState<Mode>("ram");
  const [local, setLocal] = useState(false);
  const [jitter, setJitter] = useState(0);
  const [update, setUpdate] = useState<Update>("inplace");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = day(mode);
  const md = MODES.find((x) => x.id === mode)!;
  const alertAt = local ? EXCURSION[0] + 1 : r.excursionKnownAt;
  const peak = reconnectPeak(jitter);
  const ro = rollout(update);
  const driverLate = alertAt === null ? null : alertAt - EXCURSION[0];

  const packets: Packet[] =
    stage === 0 ? hops("rd", ["sensor", "gw"], { label: "3.6 °C" })
    : stage === 1 ? hops("q", ["gw", "broker"], { label: online(10 * 60) ? "reading" : "no signal", tone: "bad" })
    : stage === 2 ? (local ? hops("al", ["sensor", "gw", "cab"], { label: "9.8 °C · alarm", tone: "good" }) : hops("al", ["sensor", "gw"], { label: "9.8 °C · queued", tone: "bad" }))
    : stage === 3 ? hops("bk", ["gw", "broker", "db"], { label: `backlog · ${peak.perSec.toLocaleString("en-US")}/s`, tone: jitter ? "good" : "bad" })
    : stage === 4 ? hops("fw", ["db", "broker", "gw"], { label: "firmware v2.4", tone: ro.bricked ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: the sensor reads 3.6 °C, once a minute, whether or not there's signal.",
    `Step 2: from ${clock(OFFLINE[1][0])} to ${clock(OFFLINE[1][1])} there's no signal. ${md.label}: ${r.lost} of ${MINUTES} readings never reach the cloud${r.lostToReboot ? `, ${r.lostToReboot} of them wiped by the reboot at ${clock(REBOOT)}` : ""}.`,
    `Step 3: the fridge door is open at ${clock(EXCURSION[0])}. ${alertAt === null ? "Nobody ever finds out." : local ? "The cab alarm sounds a minute later." : `The cloud finds out at ${clock(alertAt)}, ${driverLate} minutes later.`}`,
    `Step 4: the tower comes back and ${FLEET_IN_RANGE.toLocaleString("en-US")} trucks upload their backlogs: ${peak.perSec.toLocaleString("en-US")} messages a second${jitter ? `, spread over ${jit(jitter)}` : ", all at once"}.`,
    `Step 5: ${UPDATES.find((x) => x.id === update)!.label}: ${ro.bricked ? `${ro.bricked.toLocaleString("en-US")} trucks bricked` : `${ro.rolledBack} fell back to the old build, none bricked`}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${md.label}: ${r.lost} readings lost · open door ${alertAt === null ? "never noticed" : `noticed after ${driverLate} min`} · reconnect peak ${peak.perSec.toLocaleString("en-US")}/s · ${ro.bricked.toLocaleString("en-US")} bricked.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Edge and IoT systems"
        blurb={`A refrigerated truck carries a temperature sensor that reads once a minute. The truck drives through dead zones, the device reboots once, and at ${clock(EXCURSION[0])} the fridge door is left open for 15 minutes. Decide what the device does offline, where alerts fire, how a fleet reconnects, and how firmware gets updated.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The sensor, the truck's gateway, the cab alarm, the MQTT broker and the time-series database"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "sensor", label: "Sensor", sub: "1 / min", at: [10, 28], mobileAt: [22, 9], state: "active" },
                  { id: "gw", label: "Truck gateway", sub: mode === "none" ? "no buffer" : `buffer ${BUFFER}`, at: [38, 28], mobileAt: [22, 42], state: r.lost ? "wait" : "good" },
                  { id: "cab", label: "Cab alarm", sub: local ? "local rule" : "off", at: [38, 80], mobileAt: [22, 85], state: local ? "good" : "dim" },
                  { id: "broker", label: "MQTT broker", sub: `${peak.connectsPerSec.toLocaleString("en-US")} connects/s`, at: [66, 28], mobileAt: [78, 42], state: peak.perSec > 1000 ? "bad" : "active" },
                  { id: "db", label: "Time-series DB", sub: `${r.lost} gaps`, at: [90, 80], mobileAt: [78, 85], state: r.excursionSeen ? "good" : "bad" },
                ]}
                links={[
                  { from: "sensor", to: "gw", label: "reading" },
                  { from: "gw", to: "cab", label: "alarm", dim: !local },
                  { from: "gw", to: "broker", label: "cellular", dashed: true },
                  { from: "broker", to: "db", label: "ingest" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <Timeline r={r} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Offline" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Driving…">
                Drive the route
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read locally, always" what="The device keeps measuring whether or not there's a connection. Each reading gets the device's own timestamp, so it can be placed correctly when it arrives hours later." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {MINUTES} readings a day · offline {OFFLINE.map(([a, b]) => `${clock(a)}–${clock(b)}`).join(", ")} · reboot {clock(REBOOT)}
                </p>
              </FlowStep>
              <FlowArrow label="no signal" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Store and forward while offline" what="Queue readings on the device and upload them on reconnect, with the device's timestamps. Memory is lost on a reboot; flash survives it but is small and wears out, so decide what to drop when it fills, or store summaries instead." accent={ACCENT} active={at(1)}>
                <Choices label="Offline" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{md.one}</p>
                <p className="mt-1 font-mono text-xs">
                  {r.live} live · {r.late} late · {r.summarised} summarised · <span style={{ color: r.lost ? "var(--bad)" : "var(--good)" }}>{r.lost} lost</span>
                  {r.lostToReboot > 0 && ` (${r.lostToReboot} in the reboot)`}
                  {r.lostToOverflow > 0 && ` (${r.lostToOverflow} overflowed)`}
                </p>
              </FlowStep>
              <FlowArrow label="the door opens" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Act at the edge" what="A rule that has to fire within a minute can't depend on the cloud. Run it on the device: warn the driver from the cab, and send the event when the network allows. The cloud gets the record; the edge gets the response time." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={local} onChange={(e) => setLocal(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Alarm in the cab when it goes above 8 °C
                </label>
                <p className="font-mono text-xs" style={{ color: alertAt === null || (driverLate ?? 0) > 5 ? "var(--bad)" : "var(--good)" }}>
                  door open {clock(EXCURSION[0])} · {alertAt === null ? "never noticed: the readings were lost" : `noticed ${clock(alertAt)}, after ${driverLate} min`}
                </p>
              </FlowStep>
              <FlowArrow label="signal returns" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Reconnect without a stampede" what={`When a tower comes back, every truck in range reconnects and uploads up to ${BACKLOG} readings at the same moment. Random jitter before reconnecting, and exponential backoff when the broker refuses, spread the load out.`} accent={ACCENT} active={at(3)}>
                <Choices label="Jitter" accent={ACCENT} value={String(jitter)} onChange={(v) => setJitter(Number(v))} options={JITTER_S.map((s) => ({ id: String(s), label: jit(s) }))} />
                <p className="mt-2 font-mono text-xs" style={{ color: peak.perSec > 1000 ? "var(--bad)" : "var(--good)" }}>
                  {FLEET_IN_RANGE.toLocaleString("en-US")} trucks · {peak.total.toLocaleString("en-US")} messages · {peak.connectsPerSec.toLocaleString("en-US")} TLS handshakes/s · {peak.perSec.toLocaleString("en-US")} messages/s
                </p>
              </FlowStep>
              <FlowArrow label="new firmware" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Update firmware so it can't brick" what={`Nobody can walk to ${FLEET.toLocaleString("en-US")} trucks with a cable. Write the update to a spare slot, boot it, and fall back if it doesn't report healthy; roll it out to a few devices first. This build boot-loops on hardware rev B (${REV_B * 100}% of the fleet).`} accent={ACCENT} active={at(4)}>
                <Choices label="Update" accent={ACCENT} value={update} onChange={setUpdate} options={UPDATES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{UPDATES.find((x) => x.id === update)!.one}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">updated</span>
                  <span className="text-right text-[var(--faint)]">fell back</span>
                  <span className="text-right text-[var(--faint)]">bricked</span>
                  {UPDATES.map((x) => {
                    const y = rollout(x.id);
                    return <Row key={x.id} cells={[x.label, y.reached.toLocaleString("en-US"), String(y.rolledBack), y.bricked.toLocaleString("en-US")]} on={x.id === update} bad={y.bricked > 0} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">0.5% of devices lose power while writing the image. One device&rsquo;s day is simulated minute by minute; fleet numbers are scaled from it.</p>
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
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad && i === 3 ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// The day in 15-minute slots, coloured by what happened to most readings in each.
function Timeline({ r }: { r: DayResult }) {
  const SLOT = 15;
  const slots = Array.from({ length: MINUTES / SLOT }, (_, i) => {
    const counts: Record<Fate, number> = { live: 0, late: 0, summarised: 0, lost: 0 };
    for (let m = i * SLOT; m < (i + 1) * SLOT; m++) counts[r.fate[m]]++;
    const fate = (Object.keys(counts) as Fate[]).sort((a, b) => counts[b] - counts[a])[0];
    return { i, fate, door: i * SLOT < EXCURSION[1] && (i + 1) * SLOT > EXCURSION[0], reboot: REBOOT >= i * SLOT && REBOOT < (i + 1) * SLOT };
  });
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`One day of readings: ${r.live} sent live, ${r.late} sent late, ${r.summarised} summarised, ${r.lost} lost`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">one day · 15-minute slots</p>
        <p className="font-mono text-xs" style={{ color: r.lost ? "var(--bad)" : "var(--good)" }}>
          {r.lost} lost
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-2">
            <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--faint)]">{half ? "12–24" : "00–12"}</span>
            <div className="grid min-w-0 flex-1 gap-px" style={{ gridTemplateColumns: "repeat(48, minmax(0, 1fr))" }}>
              {slots.slice(half * 48, half * 48 + 48).map((s) => (
                <span key={s.i} title={`${clock(s.i * SLOT)}: ${FATE_LABEL[s.fate]}`} className="relative h-5 rounded-[2px]" style={{ background: FATE_COLOR[s.fate], opacity: 0.85 }}>
                  {(s.door || s.reboot) && <span className="absolute inset-x-0 -top-1 mx-auto h-1.5 w-1.5 rounded-full" style={{ background: s.door ? "var(--c2)" : "var(--text)" }} />}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        {(Object.keys(FATE_LABEL) as Fate[]).map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: FATE_COLOR[f] }} /> {FATE_LABEL[f]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--c2)" }} /> door open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--text)" }} /> reboot
        </span>
      </div>
    </section>
  );
}
