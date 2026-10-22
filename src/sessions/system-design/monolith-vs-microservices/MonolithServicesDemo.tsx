"use client";

import { useState } from "react";
import { FlowArrow, FlowSequence, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { ARCHES, CHANGES_PER_TEAM_PER_DAY, CROSS_TEAM, DEPLOY_MIN, ENGINEERS_PER_TEAM, MODULES, NETWORK_MS, TEAMS, UNIT_AVAILABILITY, minutes, pct, run, type Arch } from "@/lib/monolithServices";

const ACCENT = "var(--sys)";

export default function MonolithServicesDemo() {
  const [teams, setTeams] = useState(6);
  const results = Object.fromEntries(ARCHES.map((a) => [a.id, run(a.id, teams)])) as Record<Arch, ReturnType<typeof run>>;
  const fastestDeploy = ARCHES.reduce((a, b) => ((results[b.id].deployWaitMin ?? 1e9) < (results[a.id].deployWaitMin ?? 1e9) ? b : a));

  const caption =
    teams === TEAMS[0]
      ? `${teams} teams: one pipeline is busy ${pct(results.monolith.pipelineLoad, 0)} of the day, so a deploy waits ${minutes(results.monolith.deployWaitMin)}. Services add ${results.services.overheadMs.toFixed(1)} ms per request and ${results.services.deployables} things to run, for almost nothing back.`
      : teams === TEAMS[1]
        ? `${teams} teams: the shared pipeline is busy ${pct(results.monolith.pipelineLoad, 0)} of the day and a deploy waits ${minutes(results.monolith.deployWaitMin)}. The modular monolith cuts cross-team changes from ${results.monolith.crossTeamPerWeek.toFixed(0)} to ${results.modular.crossTeamPerWeek.toFixed(0)} a week without a network in the way.`
        : `${teams} teams want more deploys than one pipeline can run in a day, so changes wait for a release train. Separate services deploy in ${minutes(results.services.deployWaitMin)}, at the price of ${results.services.deployables} services and ${results.services.coordinatedDeploysPerWeek.toFixed(0)} coordinated releases a week.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Monolith, modular monolith or microservices"
        blurb={`One checkout request goes through ${MODULES.length} modules: ${MODULES.join(", ")}. Build them as one deployable, as one deployable with enforced boundaries, or as ${MODULES.length} services. Then grow the company from ${TEAMS[0]} teams to ${TEAMS[TEAMS.length - 1]} and see which costs move.`}
      />

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p aria-live="polite" className="min-h-10 text-sm">
          {caption}
        </p>
        <div className="mt-3">
          <Choices label="Teams" accent={ACCENT} value={String(teams)} onChange={(v) => setTeams(Number(v))} options={TEAMS.map((t) => ({ id: String(t), label: `${t} teams (${t * ENGINEERS_PER_TEAM} engineers)` }))} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {ARCHES.map((a) => {
          const r = results[a.id];
          return (
            <section key={a.id} aria-label={a.label} className="min-w-0 rounded-xl border bg-[var(--panel)] p-4" style={{ borderColor: a.id === fastestDeploy.id && teams > TEAMS[0] ? "var(--good)" : "var(--line)" }}>
              <h2 className="font-semibold">{a.label}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{a.one}</p>
              <Boxes arch={a.id} teams={teams} />
              <dl className="mt-3 space-y-1 text-xs">
                <Row k="deployables" v={String(r.deployables)} />
                <Row k="added per request" v={`${r.overheadMs < 1 ? r.overheadMs.toFixed(2) : r.overheadMs.toFixed(1)} ms`} bad={r.overheadMs > 1} />
                <Row k="requests with a slow hop" v={pct(r.slowShare, 1)} bad={r.slowShare > 0} />
                <Row k="availability" v={pct(r.availability)} bad={r.availability < 0.999} />
                <Row k="pipeline busy" v={pct(r.pipelineLoad, 0)} bad={r.pipelineLoad > 0.7} />
                <Row k="deploy waits" v={minutes(r.deployWaitMin)} bad={r.deployWaitMin === null || r.deployWaitMin > 30} />
                <Row k="cross-team changes / week" v={r.crossTeamPerWeek.toFixed(0)} bad={r.crossTeamPerWeek > 20} />
                <Row k="ordered releases / week" v={r.coordinatedDeploysPerWeek.toFixed(0)} bad={r.coordinatedDeploysPerWeek > 5} />
                <Row k="on-call rotations" v={String(r.onCallRotations)} />
              </dl>
            </section>
          );
        })}
      </div>

      <div className="mt-6">
        <FlowSequence mode="stage" accent={ACCENT}>
          <FlowStep n={1} title="Pay for the network on every request" what={`A call inside one process costs microseconds. Between services it's ${NETWORK_MS} ms with serialisation, it can fail, and one hop in a hundred is slow. Five hops means about one request in twenty meets a slow one.`} accent={ACCENT}>
            <p className="font-mono text-xs">
              monolith +{results.monolith.overheadMs.toFixed(2)} ms · services +{results.services.overheadMs.toFixed(1)} ms, {pct(results.services.slowShare, 1)} with a slow hop
            </p>
          </FlowStep>
          <FlowArrow label="and when one fails" accent={ACCENT} />
          <FlowStep n={2} title="Multiply the availabilities" what={`If the request needs all five services and each is up ${pct(UNIT_AVAILABILITY)} of the time, the request is up ${pct(results.services.availability)}: about ${((1 - results.services.availability) * 730).toFixed(1)} hours down a month instead of ${((1 - results.monolith.availability) * 730).toFixed(1)}. Timeouts, fallbacks and async calls win some of that back.`} accent={ACCENT}>
            <p className="font-mono text-xs">
              one deployable {pct(results.monolith.availability)} · five in a chain {pct(results.services.availability)}
            </p>
          </FlowStep>
          <FlowArrow label="but the teams grow" accent={ACCENT} />
          <FlowStep n={3} title="Queue for one pipeline" what={`Each team ships ${CHANGES_PER_TEAM_PER_DAY} changes a day and a deploy takes ${DEPLOY_MIN} minutes. One pipeline for everyone is a queue; past about 70% busy the wait climbs fast, and past 100% changes pile into a release train. Services give each team its own pipeline.`} accent={ACCENT}>
            <ul className="space-y-0.5 font-mono text-xs">
              {TEAMS.map((t) => (
                <li key={t} style={{ fontWeight: t === teams ? 700 : 400 }}>
                  {t} teams: one pipeline {minutes(run("monolith", t).deployWaitMin)} · own pipelines {minutes(run("services", t).deployWaitMin)}
                </li>
              ))}
            </ul>
          </FlowStep>
          <FlowArrow label="and step on each other" accent={ACCENT} />
          <FlowStep n={4} title="Draw boundaries before you draw networks" what={`Without boundaries ${Math.round(CROSS_TEAM.monolith * 100)}% of changes touch another team's code. A modular monolith enforces interfaces in the build and gets that to ${Math.round(CROSS_TEAM.modular * 100)}%, the same as services, with one deploy and no network. Split a module out when its deploys or its scaling need it, not before.`} accent={ACCENT}>
            <p className="text-xs text-[var(--muted)]">Rates and timings are round numbers; the shape of each trade-off is the point. Shopify and GitHub run large modular monoliths; Amazon and Netflix split early because of team count.</p>
          </FlowStep>
        </FlowSequence>
      </div>
    </SessionPage>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--muted)]">{k}</dt>
      <dd className="font-mono" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {v}
      </dd>
    </div>
  );
}

// The deployable units as boxes: one big box, one box with walls inside, or separate boxes.
function Boxes({ arch, teams }: { arch: Arch; teams: number }) {
  const services = run(arch, teams).deployables;
  if (arch === "services")
    return (
      <div className="mt-3 grid grid-cols-5 gap-1" aria-label={`${services} separate services`}>
        {Array.from({ length: Math.min(services, 20) }, (_, i) => (
          <span key={i} className="truncate rounded border px-1 py-1 text-center font-mono text-[9px]" style={{ borderColor: ACCENT }}>
            {MODULES[i] ?? `svc ${i + 1}`}
          </span>
        ))}
      </div>
    );
  return (
    <div className="mt-3 rounded-md border-2 p-1.5" style={{ borderColor: ACCENT }} aria-label="One deployable">
      <div className="grid grid-cols-5 gap-1">
        {MODULES.map((m) => (
          <span key={m} className="truncate rounded px-1 py-1 text-center font-mono text-[9px]" style={{ border: arch === "modular" ? "1px solid var(--line-strong)" : "1px dashed var(--line)" }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
