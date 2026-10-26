"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BARE, CONDITIONS, FULL, GOOD, KINDS, NAIVE, NET, PROMPTS, STRATEGIES, installChecks, manifestJson, pushOutcome, respond, type Condition, type Kind, type Manifest, type Prompt, type Strategy } from "@/lib/pwa";

const ACCENT = "var(--web)";
const RESULT_COLOR = { fresh: "var(--good)", cached: "var(--good)", "old version": "var(--muted)", failed: "var(--bad)" } as const;

export default function PwaDemo() {
  const [m, setM] = useState<Manifest>(BARE);
  const [sw, setSw] = useState(false);
  const [strategies, setStrategies] = useState<Record<Kind, Strategy>>(NAIVE);
  const [condition, setCondition] = useState<Condition>("offline");
  const [prompt, setPrompt] = useState<Prompt>("load");
  const [iosInstalled, setIosInstalled] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const setMan = (p: Partial<Manifest>) => setM((c) => ({ ...c, ...p }));
  const install = installChecks(m);
  const outcomes = KINDS.map((k) => ({ kind: k, ...respond(strategies[k.id], condition, k.id, sw) }));
  const failed = outcomes.filter((o) => o.result === "failed").length;
  const push = pushOutcome(prompt, iosInstalled);
  const pushOk = push.filter((p) => p.ok).length;

  const preset = (good: boolean) => {
    setM(good ? FULL : BARE);
    setSw(good);
    setStrategies(good ? GOOD : NAIVE);
    setPrompt(good ? "action" : "load");
    setIosInstalled(good);
  };

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: install.installable ? "offers Install" : "just a tab", at: [14, 22], mobileAt: [25, 12], state: install.installable ? "good" : "wait" },
    { id: "manifest", label: "Web app manifest", sub: `${install.checks.filter((c) => c.ok).length} of ${install.checks.length} checks`, at: [50, 22], mobileAt: [75, 12], state: install.installable ? "good" : "bad" },
    { id: "sw", label: "Service worker", sub: sw ? "intercepts every request" : "not registered", at: [86, 22], mobileAt: [75, 45], state: sw ? "active" : "dim" },
    { id: "cache", label: "Cache storage", sub: sw ? "precached shell + runtime cache" : "empty", at: [86, 78], mobileAt: [75, 80], state: sw ? "good" : "dim" },
    { id: "net", label: "Network", sub: CONDITIONS.find((c) => c.id === condition)!.label.toLowerCase(), at: [50, 78], mobileAt: [25, 80], state: condition === "offline" || condition === "lie-fi" ? "bad" : "good" },
    { id: "push", label: "Push service", sub: `${pushOk} of 4 browsers prompt`, at: [14, 78], mobileAt: [25, 45], state: pushOk === 4 ? "good" : "wait" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("m", ["manifest", "browser"], { label: install.installable ? "installable" : "missing fields", tone: install.installable ? "good" : "bad" })
    : stage === 1 ? (sw ? hops("r", ["browser", "sw", "cache"], { label: "install: precache" }) : hops("r", ["browser", "net"], { label: "no worker", tone: "bad" }))
    : stage === 2 ? (sw ? hops("s", ["sw", "net"], { label: `${strategies.api} for /api` }) : [])
    : stage === 3 ? hops("o", sw ? ["browser", "sw", failed ? "net" : "cache"] : ["browser", "net"], { label: failed ? `${failed} failed` : "all answered", tone: failed ? "bad" : "good" })
    : stage === 4 ? hops("p", ["push", "browser"], { label: prompt === "action" ? "after a click" : "on load", tone: pushOk === 4 ? "good" : "bad" })
    : [];

  const captions = [
    install.installable ? "Step 1: the manifest has everything Chrome checks, so the browser offers to install the app." : `Step 1: the manifest is missing ${install.checks.filter((c) => !c.ok).length} thing${install.checks.filter((c) => !c.ok).length === 1 ? "" : "s"}, so there's no install prompt.`,
    sw ? "Step 2: a service worker is registered; on install it caches the app shell, and from then on it sees every request." : "Step 2: no service worker: every request goes straight to the network.",
    sw ? `Step 3: the shell uses ${strategies.shell}, the API ${strategies.api}, images ${strategies.images}.` : "Step 3: without a service worker there's nothing to choose.",
    `Step 4: ${CONDITIONS.find((c) => c.id === condition)!.label.toLowerCase()}: ${outcomes.map((o) => `${o.kind.label.toLowerCase()} ${o.result}`).join(", ")}.`,
    `Step 5: asking for notifications ${prompt === "load" ? "on page load" : "after a click"}: ${pushOk} of 4 browsers show the prompt.`,
  ];
  const caption = stage !== null ? captions[stage] : `${install.installable ? "Installable" : "Not installable"} · ${condition}: ${failed} of 3 kinds of request fail · push prompts in ${pushOk} of 4 browsers.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Progressive web apps"
        blurb="A progressive web app is a website that can be installed, keep working without a connection, and send notifications. Each of those has one piece behind it: a manifest, a service worker with a caching strategy, and a well-timed permission request. Set them up for a small shop, then take it offline."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The browser reads the web app manifest; a service worker sits between the page and the network and answers from cache storage; a push service delivers notifications"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "manifest", to: "browser", label: "install" },
                  { from: "browser", to: "sw", label: "fetch", dim: !sw },
                  { from: "sw", to: "cache", label: "match / put", dim: !sw },
                  { from: "sw", to: "net", label: "fetch", dim: !sw },
                  { from: "browser", to: "net", label: "fetch", dim: sw },
                  { from: "push", to: "browser", label: "notification" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="How each kind of request is answered">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{CONDITIONS.find((c) => c.id === condition)!.label}</p>
                <p className="text-[11px] text-[var(--faint)]">{CONDITIONS.find((c) => c.id === condition)!.what}</p>
                <ul className="mt-2 space-y-1.5">
                  {outcomes.map((o) => (
                    <li key={o.kind.id} className="rounded-md bg-[var(--inset)] p-2 text-xs">
                      <span className="flex flex-wrap justify-between gap-x-2">
                        <span className="font-medium">
                          {o.kind.label} <span className="text-[10px] font-normal text-[var(--faint)]">{o.kind.what}</span>
                        </span>
                        <span className="font-mono" style={{ color: RESULT_COLOR[o.result] }}>
                          {o.result} · {o.ms >= 1000 ? `${o.ms / 1000} s` : `${o.ms} ms`}
                        </span>
                      </span>
                      <span className="block text-[11px] text-[var(--muted)]">{o.note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Network" accent={ACCENT} value={condition} onChange={setCondition} options={CONDITIONS.map((c) => ({ id: c.id, label: c.label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => preset(false)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Just a website
                </button>
                <button type="button" onClick={() => preset(true)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  A full PWA
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Open the app
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Describe the app in a manifest" what="A JSON file linked from every page gives the app's name, icons, start URL and how it opens. Browsers offer to install it only when the essentials are there; Safari lets people add any site to the home screen by hand." accent={ACCENT} active={at(0)}>
                <div className="flex flex-wrap gap-x-3">
                  {(
                    [
                      ["name", "name"],
                      ["icon192", "192 icon"],
                      ["icon512", "512 icon"],
                      ["startUrl", "start_url"],
                      ["https", "HTTPS"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex min-h-11 items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={m[k]} onChange={(e) => setMan({ [k]: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      {label}
                    </label>
                  ))}
                </div>
                <Choices label="display" accent={ACCENT} value={m.display} onChange={(v) => setMan({ display: v })} options={[{ id: "browser", label: "browser" }, { id: "minimal-ui", label: "minimal-ui" }, { id: "standalone", label: "standalone" }]} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{manifestJson(m)}</pre>
                <ul className="mt-1 grid gap-x-3 text-[11px] sm:grid-cols-2">
                  {install.checks.map((c) => (
                    <li key={c.label} style={{ color: c.ok ? "var(--muted)" : "var(--bad)" }}>
                      {c.ok ? "✓" : "✕"} {c.label}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="register()" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Register a service worker" what="A service worker is a script the browser runs apart from the page. Once installed it sits between the app and the network: every request the page makes goes through its fetch handler first, even with no connection." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={sw} onChange={(e) => setSw(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  navigator.serviceWorker.register(&quot;/sw.js&quot;)
                </label>
              </FlowStep>
              <FlowArrow label="each request" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Pick a strategy per kind of request" what={`Cache first is instant and works offline but can be stale; network first is fresh but waits for the network (here up to ${NET.timeout / 1000} s before falling back); stale-while-revalidate answers from cache and refreshes in the background.`} accent={ACCENT} active={at(2)}>
                <div className="space-y-2">
                  {KINDS.map((k) => (
                    <label key={k.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{k.label}</span>
                      <select value={strategies[k.id]} disabled={!sw} onChange={(e) => setStrategies((s) => ({ ...s, [k.id]: e.target.value as Strategy }))} className="h-11 rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-xs">
                        {STRATEGIES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="real networks" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Test it where networks are bad" what="Offline is the easy case: requests fail at once. Lie-fi, a connection that's there but useless, is worse: without a timeout, network-only requests hang. After a deploy, cached files are the old version until the worker updates them." accent={ACCENT} active={at(3)}>
                <p className="text-xs text-[var(--muted)]">Change the network in the panel. {failed ? `${failed} of 3 kinds of request fail.` : "Every kind of request gets an answer."}</p>
              </FlowStep>
              <FlowArrow label="later" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Ask for notifications at the right moment" what="Browsers push back on permission prompts that appear on page load: Firefox and Safari need a click first, and Chrome hides prompts from sites people keep refusing. On iPhone, web push only works once the app is added to the home screen." accent={ACCENT} active={at(4)}>
                <Choices accent={ACCENT} value={prompt} onChange={setPrompt} options={PROMPTS.map((p) => ({ id: p.id, label: p.label }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={iosInstalled} onChange={(e) => setIosInstalled(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  On iPhone, added to the home screen
                </label>
                <ul className="space-y-0.5 text-[11px]">
                  {push.map((p) => (
                    <li key={p.where} style={{ color: p.ok ? "var(--good)" : "var(--bad)" }}>
                      {p.where}: {p.note}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Install checks follow Chrome&apos;s criteria; strategies behave as in Workbox; network times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
