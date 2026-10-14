"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState, type ReactNode } from "react";
import { Choices, Slider } from "@/components/session/ui";
import {
  clientCap,
  LIBRARIES,
  model,
  NEON_MAX_CLIENTS,
  NEON_TIERS,
  platform,
  PLATFORMS,
  SUPABASE_TIERS,
  type Input,
  type LibraryId,
  type PlatformId,
  type PoolMode,
  type Result,
} from "@/lib/connPool";

const ACCENT = "var(--db)";
const n = (v: number) => (v === Infinity ? "no limit" : v.toLocaleString("en-US"));

type Seg = { value: number; color: string; label: string; striped?: boolean };

function StackBar({ title, total, segs, mark }: { title: ReactNode; total: number; segs: Seg[]; mark?: { at: number; label: string } }) {
  const scale = Math.max(1, total, ...[segs.reduce((a, s) => a + s.value, 0)]);
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs text-[var(--muted)]">{title}</p>
      <div className="relative mt-1.5 flex h-5 overflow-hidden rounded bg-[var(--track)]">
        {segs.filter((s) => s.value > 0).map((s) => (
          <span
            key={s.label}
            title={`${s.label}: ${n(s.value)}`}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${(s.value / scale) * 100}%`,
              background: s.striped ? `repeating-linear-gradient(45deg, ${s.color} 0 4px, transparent 4px 8px)` : s.color,
            }}
          />
        ))}
        {mark && mark.at < scale && (
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-[var(--text)]" style={{ left: `${(mark.at / scale) * 100}%` }} />
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted)]">
        {segs.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className="h-2 w-2.5 rounded-sm" style={{ background: s.striped ? `repeating-linear-gradient(45deg, ${s.color} 0 2px, transparent 2px 4px)` : s.color }} />
            {s.label} <span className="font-mono">{n(s.value)}</span>
          </span>
        ))}
        {mark && <span className="flex items-center gap-1"><span className="h-2.5 w-0.5 bg-[var(--text)]" />{mark.label}</span>}
      </div>
    </div>
  );
}

function Fixed({ label, value, why }: { label: string; value: string; why: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md bg-[var(--inset)] px-3 py-2">
      <span className="text-sm">
        {label}
        <span className="block text-xs text-[var(--faint)]">{why}</span>
      </span>
      <span className="shrink-0 font-mono text-sm" style={{ color: ACCENT }}>{value}</span>
    </div>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--inset)] p-2">
      <dt className="text-xs text-[var(--faint)]">{k}</dt>
      <dd className="font-mono text-base sm:text-lg" style={{ color }}>{v}</dd>
    </div>
  );
}

const BINDING: Record<Result["binding"], string> = {
  none: "nothing: all fits",
  "app-pool": "the app's own pool",
  "client-cap": "pooler client limit",
  "pool-size": "pool size",
  "max-connections": "Postgres max_connections",
};

function caption(i: Input, r: Result, pooler: string | null): string {
  switch (r.binding) {
    case "client-cap":
      return `${n(r.clientsWanted)} app connections, but ${pooler} accepts ${n(r.clientsAccepted)}. The other ${n(r.clientsRefused)} are refused, and every query on those instances fails.`;
    case "max-connections":
      return pooler
        ? `The pool wants ${n(r.serverWanted)} server connections, but Postgres only has ${n(r.usable - r.otherPoolConns)} left. The pool size is set higher than the database can give.`
        : `${n(r.clientsWanted)} connections wanted, ${n(r.usable)} slots usable. ${n(r.dbRefused)} are refused and ${r.failedPct}% of queries fail.`;
    case "pool-size":
      if (r.pinned > 0 && r.pinned >= r.serverOpen)
        return `${n(r.pinned)} pinned sessions each keep a connection to themselves, but the proxy may open only ${n(r.serverLimit)}. Pinned clients without one, and everyone else, wait until the timeout.`;
      return r.waitMs === Infinity
        ? i.mode === "session" && platform(i.platform).modes.includes("session")
          ? `${n(r.serverWanted)} connections each hold a server connection for their whole session, but the pool has ${n(r.serverLimit)}. The rest wait until the timeout, then fail.`
          : `No server connections to share. Queries wait until the timeout.`
        : `${n(r.serverWanted)} transactions in flight share ${n(r.serverOpen)} server connections. No errors: each query waits about ${r.waitMs} ms for a turn.`;
    case "app-pool":
      return `Each instance has ${i.busy} queries in flight but only ${i.appPool} connections in its own pool, so queries wait about ${r.waitMs} ms inside the app.`;
    default:
      return pooler
        ? `${n(r.clientsAccepted)} app connections share ${n(r.serverOpen)} server connections. Everything fits.`
        : `${n(r.clientsWanted)} of ${n(r.usable)} usable connections. Everything fits.`;
  }
}

export default function PoolDemo() {
  const [platformId, setPlatformId] = useState<PlatformId>("pgbouncer");
  const [mode, setMode] = useState<PoolMode>("session");
  const [maxConnections, setMaxConnections] = useState(100);
  const [otherConnections, setOtherConnections] = useState(5);
  const [maxClients, setMaxClients] = useState(100);
  const [poolSize, setPoolSize] = useState(20);
  const [maxConnPercent, setMaxConnPercent] = useState(100);
  const [otherPools, setOtherPools] = useState(0);
  const [instances, setInstances] = useState(8);
  const [library, setLibrary] = useState<LibraryId>("node-postgres");
  const [appPool, setAppPool] = useState(10);
  const [busy, setBusy] = useState(3);
  const [queryMs, setQueryMs] = useState(20);
  const [pinnedPct, setPinnedPct] = useState(0);
  const [supaTier, setSupaTier] = useState("Micro");
  const [neonTier, setNeonTier] = useState("1 CU");

  const p = platform(platformId);

  const pickSupaTier = (t: string) => {
    const tier = SUPABASE_TIERS.find((x) => x[0] === t) ?? SUPABASE_TIERS[0];
    setSupaTier(tier[0]);
    setMaxConnections(tier[1]);
    setMaxClients(tier[2]);
    setPoolSize(Math.round(tier[1] * 0.4));
  };
  const pickNeonTier = (t: string) => {
    const tier = NEON_TIERS.find((x) => x[0] === t) ?? NEON_TIERS[2];
    setNeonTier(tier[0]);
    setMaxConnections(tier[1]);
  };
  // Picking a platform loads its real defaults; every value stays adjustable where the platform allows it.
  const pickPlatform = (id: PlatformId) => {
    setPlatformId(id);
    const next = platform(id);
    setMode(next.modes[0]); // each platform's default mode
    if (id === "direct") setMaxConnections(100);
    if (id === "pgbouncer") {
      setMaxConnections(100);
      setMaxClients(100);
      setPoolSize(20);
    }
    if (id === "supabase") pickSupaTier("Micro");
    if (id === "neon") pickNeonTier("1 CU");
    if (id === "rds-proxy") {
      setMaxConnections(100);
      setMaxConnPercent(100);
    }
  };
  const pickLibrary = (id: LibraryId) => {
    setLibrary(id);
    const lib = LIBRARIES.find((l) => l.id === id);
    if (lib && id !== "custom") setAppPool(lib.pool);
  };

  const input: Input = { platform: platformId, mode, maxConnections, otherConnections, maxClients, poolSize, maxConnPercent, otherPools, instances, appPool, busy, queryMs, pinnedPct };
  const r = model(input);
  const pooled = Boolean(p.pooler);
  const appOnDb = pooled ? r.serverOpen : r.clientsAccepted;
  const lib = LIBRARIES.find((l) => l.id === library) ?? LIBRARIES[0];
  const bad = "var(--bad)";
  const wait = "var(--auto)";

  const config =
    platformId === "pgbouncer"
      ? `; pgbouncer.ini\npool_mode = ${mode}\nmax_client_conn = ${maxClients}\ndefault_pool_size = ${poolSize}\n\n-- postgresql.conf\nmax_connections = ${maxConnections}`
      : platformId === "supabase"
        ? `Compute: ${supaTier}  (max connections ${maxConnections}, pooler max clients ${maxClients})\nDatabase Settings → Connection pooling → Pool size: ${poolSize}\nConnect via port ${mode === "session" ? "5432 (session)" : "6543 (transaction)"}`
        : platformId === "neon"
          ? `Compute: ${neonTier}  → max_connections = ${maxConnections}\nPooled URL (-pooler host): transaction mode,\nmax_client_conn = ${NEON_MAX_CLIENTS}, default_pool_size = ${r.serverLimit}\n(fixed by Neon)`
          : platformId === "rds-proxy"
            ? `aws rds modify-db-proxy-target-group \\\n  --connection-pool-config MaxConnectionsPercent=${maxConnPercent},ConnectionBorrowTimeout=120\n# max_connections = ${maxConnections} (DB parameter group)`
            : `-- postgresql.conf\nmax_connections = ${maxConnections}\n// app: ${lib.label} pool = ${appPool} per instance`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Connection pooling"
        blurb="Every Postgres connection is a process using memory, so the database caps them with max_connections. A pooler sits in front with two more limits: how many app connections it accepts, and how many real connections its pool opens. Pick a platform, then change any number and see which limit breaks first."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Connections at each layer">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                {n(instances)} instances × {n(appPool)} connections → {p.pooler ?? "Postgres"}
              </p>
              <div className="mt-3">
                {pooled && (
                  <StackBar
                    title={<>1 · App connections into {p.pooler} <span className="text-[var(--faint)]">(client limit {n(clientCap(input))})</span></>}
                    total={r.clientsWanted}
                    segs={[
                      { value: r.clientsAccepted, color: ACCENT, label: "accepted" },
                      { value: r.clientsRefused, color: bad, label: "refused" },
                    ]}
                  />
                )}
                {pooled && (
                  <StackBar
                    title={<>2 · Server connections the app needs <span className="text-[var(--faint)]">(pool size {n(r.serverLimit)}, {mode === "session" && p.modes.includes("session") ? "one per connected client" : "one per transaction in flight"})</span></>}
                    total={r.serverWanted}
                    mark={{ at: r.serverLimit, label: "pool size" }}
                    segs={[
                      { value: r.serverOpen, color: ACCENT, label: "running" },
                      { value: r.dbRefused, color: bad, label: "refused by Postgres" },
                      { value: Math.max(0, r.serverWanted - r.serverOpen - r.dbRefused), color: wait, label: "queued", striped: true },
                    ]}
                  />
                )}
                <StackBar
                  title={<>{pooled ? "3" : "1"} · Postgres <span className="font-mono">max_connections = {n(maxConnections)}</span></>}
                  total={maxConnections}
                  segs={[
                    { value: Math.min(p.reserved, maxConnections), color: "var(--faint)", label: "reserved" },
                    { value: Math.min(otherConnections, Math.max(0, maxConnections - p.reserved)), color: "var(--line-strong)", label: "other direct" },
                    { value: r.otherPoolConns, color: "var(--muted)", label: "other pools" },
                    { value: appOnDb, color: ACCENT, label: pooled ? `${p.pooler} pool` : "app" },
                    { value: Math.max(0, r.usable - r.otherPoolConns - appOnDb), color: "var(--track)", label: "free" },
                    { value: pooled ? 0 : r.dbRefused, color: bad, label: "refused" },
                  ]}
                />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat k="Queries failing" v={`${r.failedPct}%`} color={r.failedPct ? bad : "var(--good)"} />
                <Stat k="Wait per query" v={r.waitMs === Infinity ? `${p.timeoutS || "∞"} s, then error` : `${r.waitMs} ms`} color={r.waitMs === Infinity ? bad : r.waitMs > 0 ? wait : "var(--good)"} />
                <Stat k="Queued" v={n(r.waiting)} color={r.waiting ? wait : "var(--good)"} />
                <Stat k="Limit hit" v={BINDING[r.binding]} color={r.binding === "none" ? "var(--good)" : r.failedPct ? bad : wait} />
              </dl>

              <div className="mt-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">What you&apos;d see</p>
                {r.errors.length === 0 ? (
                  <p className="mt-1 text-sm text-[var(--good)]">{r.waiting ? "No errors, only slower queries." : "No errors."}</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {r.errors.map((e) => (
                      <li key={e.text} className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs">
                        <span className="text-[var(--faint)]">{e.where}: </span>
                        <span className={e.exact ? "font-mono break-words" : ""} style={{ color: bad }}>{e.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <pre className="mt-4 overflow-x-auto rounded-md bg-[var(--inset)] p-3 font-mono text-xs text-[var(--muted)]">{config}</pre>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption(input, r, p.pooler)}>
              <div className="w-full space-y-5">
                <Choices label="Platform" accent={ACCENT} value={platformId} onChange={pickPlatform} options={PLATFORMS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="text-xs text-[var(--muted)]">{p.note}</p>

                {platformId === "supabase" && (
                  <Choices label="Compute size" accent={ACCENT} value={supaTier} onChange={pickSupaTier} options={SUPABASE_TIERS.map(([t]) => ({ id: t, label: t }))} />
                )}
                {platformId === "neon" && (
                  <Choices label="Compute size" accent={ACCENT} value={neonTier} onChange={pickNeonTier} options={NEON_TIERS.map(([t]) => ({ id: t, label: t }))} />
                )}

                {p.modes.length > 1 ? (
                  <Choices label="Pool mode" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "session", label: "Session" }, { id: "transaction", label: "Transaction" }]} />
                ) : (
                  pooled && <Fixed label="Pool mode" value={p.modes[0]} why={platformId === "rds-proxy" ? "multiplexed per transaction, unless pinned" : "fixed by the platform"} />
                )}

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Database and pooler limits</p>
                  {p.maxConn === "editable" ? (
                    <Slider label="max_connections" hint={platformId === "rds-proxy" ? "On RDS the parameter group sets it from instance memory." : "Postgres default is 100."} accent={ACCENT} value={maxConnections} min={20} max={1000} step={10} format={n} onChange={setMaxConnections} />
                  ) : (
                    <Fixed label="max_connections" value={n(maxConnections)} why="set by the compute size" />
                  )}
                  <Fixed label="Reserved slots" value={String(p.reserved)} why={p.reservedNote} />
                  <Slider label="Other direct connections" hint="Admin tools, migrations, cron, other services. Illustrative." accent={ACCENT} value={otherConnections} min={0} max={100} step={1} format={n} onChange={setOtherConnections} />
                  {p.clientCap === "editable" && (
                    <Slider label="max_client_conn" hint="App connections PgBouncer accepts. Default 100." accent={ACCENT} value={maxClients} min={20} max={5000} step={20} format={n} onChange={setMaxClients} />
                  )}
                  {p.clientCap === "tier" && <Fixed label="Pooler max clients" value={n(maxClients)} why="set by the compute size" />}
                  {p.clientCap === "fixed" && <Fixed label="max_client_conn" value={n(NEON_MAX_CLIENTS)} why="fixed by Neon" />}
                  {p.clientCap === "none" && pooled && <Fixed label="Client limit" value="none documented" why="clients idle 30 min are closed" />}
                  {p.poolSize === "editable" && pooled && (
                    <Slider
                      label={platformId === "supabase" ? "Pool size" : "default_pool_size"}
                      hint={platformId === "supabase" ? `Guidance: ≤ 40% of max (${Math.round(maxConnections * 0.4)}) with heavy REST API use, ≤ 80% (${Math.round(maxConnections * 0.8)}) otherwise.` : "Server connections per user + database pair. Default 20."}
                      accent={ACCENT}
                      value={poolSize}
                      min={1}
                      max={Math.max(200, maxConnections)}
                      step={1}
                      format={n}
                      onChange={setPoolSize}
                    />
                  )}
                  {p.poolSize === "derived" && <Fixed label="default_pool_size" value={n(r.serverLimit)} why="0.9 × max_connections, fixed by Neon" />}
                  {p.poolSize === "percent" && (
                    <Slider label="MaxConnectionsPercent" hint={`The proxy may open ${n(r.serverLimit)} of ${n(maxConnections)}.`} accent={ACCENT} value={maxConnPercent} min={1} max={100} step={1} format={(v) => `${v}%`} onChange={setMaxConnPercent} />
                  )}
                  {pooled && (
                    <Slider label="Other pools" hint="Each extra user + database pair gets its own pool of the same size. Here all are busy." accent={ACCENT} value={otherPools} min={0} max={5} step={1} format={n} onChange={setOtherPools} />
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Your app</p>
                  <Choices label="Driver or ORM" accent={ACCENT} value={library} onChange={pickLibrary} options={LIBRARIES.map((l) => ({ id: l.id, label: l.label }))} />
                  <p className="text-xs text-[var(--muted)]">{lib.note}</p>
                  <Slider label="App instances" hint="Servers, containers or serverless functions running at once." accent={ACCENT} value={instances} min={1} max={500} step={1} format={n} onChange={setInstances} />
                  <Slider label="Pool size per instance" accent={ACCENT} value={appPool} min={1} max={50} step={1} format={n} onChange={(v) => { setAppPool(v); setLibrary("custom"); }} />
                  <Slider label="Queries in flight per instance" hint="At peak." accent={ACCENT} value={busy} min={1} max={30} step={1} format={n} onChange={setBusy} />
                  <Slider label="Query time" accent={ACCENT} value={queryMs} min={1} max={500} step={1} format={(v) => `${v} ms`} onChange={setQueryMs} />
                  {platformId === "rds-proxy" && (
                    <Slider label="Pinned sessions" hint="SET, temp tables or prepared statements pin a client to one connection." accent={ACCENT} value={pinnedPct} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={setPinnedPct} />
                  )}
                </div>
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The app's own pool" what="Your driver or ORM keeps a few connections per instance. Total connections = instances × pool size, and serverless multiplies instances fast." accent={ACCENT} active={r.binding === "app-pool"}>
                <p className="font-mono text-xs">{n(instances)} × {n(appPool)} = {n(r.clientsWanted)} connections</p>
              </FlowStep>
              <FlowArrow label="into the pooler" accent={ACCENT} />
              <FlowStep n={2} title="Pooler client limit" what="max_client_conn (PgBouncer) or pooler max clients (Supabase). Cheap to raise: idle client connections cost the pooler little. Past it, connections are refused." accent={ACCENT} active={r.binding === "client-cap"}>
                <p className="text-sm text-[var(--muted)]">Failure: refused at connect time.</p>
              </FlowStep>
              <FlowArrow label="share real connections" accent={ACCENT} />
              <FlowStep n={3} title="Pool size and pool mode" what="How many real connections the pooler opens per user + database. In session mode each client keeps one for its whole session, so the pool must be as big as the client count. In transaction mode only in-flight transactions need one." accent={ACCENT} active={r.binding === "pool-size"}>
                <p className="text-sm text-[var(--muted)]">Failure: queries queue, then time out.</p>
              </FlowStep>
              <FlowArrow label="into Postgres" accent={ACCENT} />
              <FlowStep n={4} title="max_connections" what="The hard ceiling. Reserved slots, admin tools and every pool share it. Keep the sum of all pool sizes below it with headroom; more connections than a few per CPU core mostly adds contention." accent={ACCENT} active={r.binding === "max-connections"}>
                <p className="font-mono text-xs">Σ pool sizes + other direct + reserved ≤ max_connections</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
