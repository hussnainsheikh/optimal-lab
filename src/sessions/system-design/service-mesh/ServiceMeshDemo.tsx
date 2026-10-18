"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CANARIES, HANG_MS, HOPS_DIRECT, HOPS_MESH, MTLS_MS, OFF, PODS, REQUESTS, RETRIES, RETRY_BUDGET, SIDECAR_MB, SIDECAR_MS, TIMEOUT_MS, V1, V2, ms, run, type Settings } from "@/lib/serviceMesh";

const ACCENT = "var(--sys)";

export default function ServiceMeshDemo() {
  const [s, setS] = useState<Settings>(OFF);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(s);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const at = (i: number) => stage === i;
  const path = s.mesh ? HOPS_MESH : HOPS_DIRECT;
  const toV1 = path.map((p) => (p === "pricing" ? "v1" : p));
  const toV2 = path.map((p) => (p === "pricing" ? "v2" : p));

  const packets: Packet[] =
    stage === 0 ? hops("req", toV1, { label: "GET /price" })
    : stage === 1 ? hops("side", toV1, { label: s.mesh ? "via sidecars" : "direct", tone: s.mesh ? "accent" : "bad" })
    : stage === 2 ? (s.mesh ? [{ id: "tls", from: "sideA", to: "sideB", label: r.encrypted ? "mTLS" : "plaintext", tone: r.encrypted ? "good" : "bad", duration: 0.6 }] : [{ id: "tls0", from: "checkout", to: "v1", label: "plaintext", tone: "bad", duration: 0.6 }])
    : stage === 3 ? [
        { id: "try1", from: s.mesh ? "sideB" : "checkout", to: "v1", label: "attempt 1: 503", tone: "bad", duration: 0.4 },
        ...(s.mesh && s.retries > 0 ? [{ id: "try2", from: "sideB", to: "v1", label: "retry: 200", tone: "good" as const, delay: 0.5, duration: 0.4 }] : []),
      ]
    : stage === 4 ? [...hops("c1", toV1, { label: `${r.toV1}%` }), ...(r.toV2 > 0 ? hops("c2", toV2, { label: `${r.toV2}%`, tone: "bad" }) : [])]
    : [];

  const captions = [
    `Step 1: checkout calls pricing ${REQUESTS} times. ${Math.round(V1.fail * 100)}% of attempts fail for a moment: a pod restarting, a dropped connection.`,
    s.mesh ? `Step 2: every call leaves through checkout's sidecar and arrives through pricing's. Each adds about ${SIDECAR_MS} ms.` : "Step 2: no sidecars. Whatever retrying, encrypting or routing happens is in the application code, in every language the team uses.",
    r.encrypted ? "Step 3: the sidecars verify each other's certificates and encrypt the call. Pricing knows the caller is checkout." : "Step 3: the call is plain text on the cluster network, from whoever sent it.",
    s.mesh && s.retries > 0 ? `Step 4: a failed attempt is retried by the sidecar, up to ${s.retries} time${s.retries === 1 ? "" : "s"}; users see ${r.userErrors.toFixed(1)} errors instead of ${r.firstTryErrors.toFixed(0)}.` : `Step 4: nothing retries. ${r.firstTryErrors.toFixed(0)} of ${REQUESTS} requests fail in front of the user.`,
    r.toV2 > 0 ? `Step 5: ${r.toV2} of ${REQUESTS} requests go to v2. ${r.canaryVerdict}` : "Step 5: all traffic on v1; v2 is deployed but nobody is routed to it.",
  ];
  const caption = stage !== null ? captions[stage] : `Users see ${r.userErrors.toFixed(r.userErrors < 1 && r.userErrors > 0 ? 1 : 0)} error${r.userErrors === 1 ? "" : "s"} in ${REQUESTS} requests · ${ms(r.avgMs)} average · worst wait ${ms(r.worstMs)} · ${r.encrypted ? "encrypted" : "plain text"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Service mesh"
        blurb={`Checkout calls the pricing service ${REQUESTS} times. Pricing v1 fails ${Math.round(V1.fail * 100)}% of attempts for a moment; v2 has a bug that fails ${Math.round(V2.fail * 100)}%. A mesh puts a sidecar proxy beside each service and lets it do the retries, the encryption, the traffic split and the metrics. Turn each one on and count what users see.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="Checkout and pricing with a sidecar beside each, two pricing versions, and the control plane that configures the sidecars"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "checkout", label: "Checkout", sub: `${REQUESTS} calls`, at: [10, 55], mobileAt: [50, 8], state: "active" },
                { id: "sideA", label: "Sidecar", sub: s.mesh ? (r.encrypted ? "mTLS" : "proxy") : "none", at: [32, 55], mobileAt: [50, 30], state: s.mesh ? "active" : "dim" },
                { id: "sideB", label: "Sidecar", sub: s.mesh ? (s.retries ? `retries ${s.retries}` : "proxy") : "none", at: [58, 55], mobileAt: [50, 52], state: s.mesh ? "active" : "dim" },
                { id: "v1", label: V1.label, sub: `${r.toV1} req · ${Math.round(V1.fail * 100)}% fail`, at: [86, 25], mobileAt: [22, 82], state: r.toV1 ? "good" : "dim" },
                { id: "v2", label: V2.label, sub: r.toV2 ? `${r.toV2} req · ${Math.round(V2.fail * 100)}% fail` : "no traffic", at: [86, 82], mobileAt: [78, 82], state: r.toV2 ? "bad" : "dim" },
                { id: "control", label: "Control plane", sub: s.mesh ? "pushes config" : "none", at: [45, 12], mobileAt: [84, 30], state: s.mesh ? "idle" : "dim" },
              ]}
              links={[
                { from: "checkout", to: "v1", label: "direct", dim: s.mesh },
                { from: "checkout", to: "sideA", label: "localhost", dim: !s.mesh },
                { from: "sideA", to: "sideB", label: r.encrypted ? "mTLS" : "plain", dim: !s.mesh },
                { from: "sideB", to: "v1", label: `${r.toV1}%`, dim: !s.mesh },
                { from: "sideB", to: "v2", label: `${r.toV2}%`, dim: !s.mesh || r.toV2 === 0 },
                { from: "control", to: "sideA", label: "config", dashed: true, dim: !s.mesh },
                { from: "control", to: "sideB", label: "config", dashed: true, dim: !s.mesh },
              ]}
              packets={packets}
              aspect={2.2}
              mobileAspect={1}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Calling…">
                Send 100 requests
              </RunButton>
              <p className="w-full font-mono text-sm" style={{ color: r.userErrors >= 1 ? "var(--bad)" : "var(--good)" }}>
                {r.userErrors.toFixed(r.userErrors < 1 && r.userErrors > 0 ? 1 : 0)} user-visible errors · avg {ms(r.avgMs)} · worst {ms(r.worstMs)}
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Two services talk directly" what="Checkout opens a connection to pricing and sends the call. Retrying, timing out, encrypting, measuring and choosing a version are all things its own code would have to do, in every service, in every language." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  no mesh: {run(OFF).firstTryErrors.toFixed(0)} errors reach users · worst wait {ms(HANG_MS)} on a dead connection · plain text
                </p>
              </FlowStep>
              <FlowArrow label="the same call" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Put a sidecar beside each service" what={`A proxy runs in every pod and captures the traffic in and out; the application thinks it's talking to localhost. A control plane pushes config to all of them. The price: about ${SIDECAR_MS} ms per sidecar on every call and ${SIDECAR_MB} MB of memory per pod.`} accent={ACCENT} active={at(1)}>
                <Toggle checked={s.mesh} onChange={(v) => set({ mesh: v })} label="Inject sidecars" />
                <p className="font-mono text-xs">
                  overhead +{r.overheadMs.toFixed(1)} ms a call · {PODS} pods × {SIDECAR_MB} MB = {(r.memoryMb / 1024).toFixed(1)} GB
                </p>
              </FlowStep>
              <FlowArrow label="encrypt it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Encrypt and identify every call" what={`The sidecars hold certificates issued by the mesh. Each call is mutual TLS: both ends prove who they are, and pricing can allow checkout and refuse everything else. The handshake costs about ${MTLS_MS} ms amortised over a kept-alive connection.`} accent={ACCENT} active={at(2)}>
                <Toggle checked={s.mtls} onChange={(v) => set({ mtls: v })} label="Mutual TLS" disabled={!s.mesh} />
                <p className="font-mono text-xs" style={{ color: r.encrypted ? "var(--good)" : "var(--bad)" }}>
                  {r.encrypted ? "encrypted" : "plain text"} · caller identity: {r.identity}
                </p>
              </FlowStep>
              <FlowArrow label="when it fails" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Retry and time out in the sidecar" what={`A transient failure is retried before the application hears of it, within a budget (at most ${Math.round(RETRY_BUDGET * 100)}% extra load) so retries can't become a storm. A timeout turns a hung connection into a fast failure, which can then be retried.`} accent={ACCENT} active={at(3)}>
                <Choices label="Retries per call" accent={ACCENT} value={String(s.retries)} onChange={(v) => set({ retries: Number(v) as Settings["retries"] })} options={RETRIES.map((n) => ({ id: String(n), label: String(n) }))} />
                <div className="mt-2">
                  <Toggle checked={s.timeout} onChange={(v) => set({ timeout: v })} label={`Timeout ${TIMEOUT_MS} ms`} disabled={!s.mesh} />
                </div>
                <p className="font-mono text-xs">
                  first try: {r.firstTryErrors.toFixed(1)} errors · after retries: {r.userErrors.toFixed(2)} · retries {r.retryAttempts.toFixed(1)} of {r.budgetCap} allowed{r.retriesCapped ? " (budget hit)" : ""} · worst wait {ms(r.worstMs)}
                </p>
                {!s.mesh && <p className="mt-1 text-xs text-[var(--faint)]">Without sidecars these do nothing unless every service implements them.</p>}
              </FlowStep>
              <FlowArrow label="a new version" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Split traffic for a canary" what="The sidecar routes a share of calls to v2 and reports errors and latency per version, because it sees every call. The bug shows up in the per-version numbers after a few users instead of after all of them." accent={ACCENT} active={at(4)}>
                <Choices label="Traffic to v2" accent={ACCENT} value={String(s.canary)} onChange={(v) => set({ canary: Number(v) as Settings["canary"] })} options={CANARIES.map((n) => ({ id: String(n), label: `${n}%` }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">requests</span>
                  <span className="text-right text-[var(--faint)]">errors</span>
                  <span className="text-right text-[var(--faint)]">rate</span>
                  {r.perVersion.map((v) => (
                    <Row key={v.label} cells={[v.label, String(v.requests), v.errors.toFixed(1), v.requests ? `${Math.round(v.rate * 100)}%` : "–"]} bad={v.requests > 0 && v.rate > 0.1} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{s.mesh ? r.canaryVerdict : "Without sidecars there is no per-version routing or per-version numbers; a deploy is all or nothing."}</p>
                <p className="mt-2 text-xs text-[var(--faint)]">Failure rates and timings are round numbers; the mechanism is the point. Istio, Linkerd and Cilium differ in how heavy the sidecar is (Cilium and Istio ambient mode have none).</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad }: { cells: string[]; bad?: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm" style={{ opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
