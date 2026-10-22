"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DAU, DEBOUNCES, DISTINCT_QUERIES, K, KEYSTROKES, LOG, SEARCHES_PER_DAY, SERVES, TRIE, fmt, prefixTableGB, requestsWhileTyping, scale, scan, suggest, type Serve } from "@/lib/autocomplete";

const ACCENT = "var(--sys)";
const BUDGET_MS = 100;
const NETWORK_MS = 40; // round trip from the browser to the nearest region

export default function AutocompleteDemo() {
  const [prefix, setPrefix] = useState("how to c");
  const [serve, setServe] = useState<Serve>("scan");
  const [debounceMs, setDebounce] = useState(0);
  const [cachePrefixes, setCache] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const s = suggest(prefix);
  const sc = scan(prefix);
  const sv = SERVES.find((x) => x.id === serve)!;
  const total = NETWORK_MS + sv.ms;
  const client = { debounceMs, cachePrefixes };
  const z = scale(client);
  const sent = requestsWhileTyping(client);

  const packets: Packet[] =
    stage === 0 ? hops("k", ["browser", "api"], { label: `“${prefix}”` })
    : stage === 1 ? hops("l", ["logs", "builder"], { label: "counts per query" })
    : stage === 2 ? hops("b", ["builder", serve === "kv" ? "store" : "api"], { label: serve === "kv" ? "prefix table" : "new trie" })
    : stage === 3 ? hops("a", serve === "kv" ? ["api", "store", "api", "browser"] : ["api", "browser"], { label: `${s.list.length} suggestions · ${total} ms`, tone: total <= BUDGET_MS ? "good" : "bad" })
    : stage === 4 ? hops("c", ["browser", "api"], { label: `${sent.length} requests`, tone: sent.length < KEYSTROKES.length ? "good" : "accent" })
    : [];

  const captions = [
    `Step 1: each keystroke can be a request: ${fmt(z.peak)} a second at peak.`,
    `Step 2: a batch job counts a day of query logs: ${LOG.length} distinct queries here, ${fmt(DISTINCT_QUERIES)} in production.`,
    `Step 3: the trie has ${TRIE.nodes} nodes; the node for “${prefix}” already holds its top ${K}.`,
    `Step 4: ${sv.label}: ${sv.ms} ms on the server plus ${NETWORK_MS} ms of network is ${total} ms, ${total <= BUDGET_MS ? "inside" : "over"} the ${BUDGET_MS} ms budget.`,
    `Step 5: typing “how to cook rice” with one typo sends ${sent.length} requests instead of ${KEYSTROKES.length}.`,
  ];
  const caption = stage !== null ? captions[stage] : `“${prefix}” → ${s.list.length ? s.list.map((x) => x[0]).slice(0, 2).join(", ") + "…" : "no suggestions"} · ${total} ms · ${sent.length} requests per search · ${fmt(z.peak)}/s at peak.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design search autocomplete"
        blurb={`Every keystroke in a search box asks for the five most popular queries starting with what's typed, and the answer has to arrive in under ${BUDGET_MS} ms or the user has typed past it. Build suggestions from query logs, store them so each lookup is one step, and send fewer requests from the browser.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="A search box with suggestions">
                <label className="block text-xs text-[var(--muted)]">
                  Type a search
                  <input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 40))} className="mt-1 block min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--inset)] px-3 text-sm text-[var(--text)]" placeholder="how, wh, pi…" />
                </label>
                <ul className="mt-2 divide-y divide-[var(--line)] rounded-md border border-[var(--line)]" aria-live="polite">
                  {s.list.length ? (
                    s.list.map(([q, c]) => (
                      <li key={q} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">
                          <b>{q.slice(0, prefix.length)}</b>
                          {q.slice(prefix.length)}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">{fmt(c)}</span>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-1.5 text-sm text-[var(--muted)]">No logged query starts with that.</li>
                  )}
                </ul>
                <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">
                  trie: {s.steps} node steps · scan: compared {sc.compared} queries, then sorted
                </p>
              </section>
              <SystemMap
                title="Browser, suggest service, prefix store, query logs and the trie builder"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "browser", label: "Browser", sub: debounceMs ? `debounce ${debounceMs} ms` : "every key", at: [12, 28], mobileAt: [22, 9], state: "active" },
                  { id: "api", label: "Suggest service", sub: serve === "trie" ? "trie in RAM" : serve === "kv" ? "stateless" : "→ SQL", at: [45, 28], mobileAt: [50, 38], state: total <= BUDGET_MS ? "good" : "bad" },
                  { id: "store", label: serve === "scan" ? "Database" : "Prefix store", sub: serve === "kv" ? "prefix → top 5" : serve === "scan" ? "LIKE scan" : "unused", at: [82, 28], mobileAt: [80, 9], state: serve === "trie" ? "dim" : serve === "scan" ? "bad" : "active" },
                  { id: "logs", label: "Query logs", sub: "every search", at: [12, 78], mobileAt: [22, 88], state: "idle" },
                  { id: "builder", label: "Trie builder", sub: "hourly batch", at: [45, 78], mobileAt: [78, 70], state: "idle" },
                ]}
                links={[
                  { from: "browser", to: "api", label: "GET /suggest?q=" },
                  { from: "api", to: "store", label: "lookup", dim: serve === "trie" },
                  { from: "logs", to: "builder", label: "counts" },
                  { from: "builder", to: serve === "kv" ? "store" : "api", label: "publish" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={1}
              />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Serve from" accent={ACCENT} value={serve} onChange={setServe} options={SERVES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Suggesting…">
                Type a key
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Size it per keystroke" what={`${fmt(DAU)} people search ${SEARCHES_PER_DAY} times a day, and each search is many keystrokes. Autocomplete gets far more requests than search itself, and each has a hard deadline.`} accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {z.perSearch} requests per search · {fmt(z.rps)}/s average · {fmt(z.peak)}/s at peak
                </p>
              </FlowStep>
              <FlowArrow label="query logs" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Count queries from the logs, offline" what="Popularity comes from what people actually searched. A batch job counts queries over a window (a day, weighted towards recent hours), drops blocked terms, and keeps only queries searched enough times to be worth suggesting. Trending topics show up at the next rebuild." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">{LOG.length} queries counted · top: {[...LOG].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([q]) => q).join(", ")}</p>
              </FlowStep>
              <FlowArrow label="build" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Store the top 5 at every prefix" what="A trie has one node per prefix. Finding all queries under a node and sorting them on every keystroke is too slow, so the builder stores the top 5 at each node while it builds: a lookup is one step per character, then read the list." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">
                  {TRIE.nodes} nodes for {LOG.length} queries · “{prefix}” → {s.steps} steps
                </p>
              </FlowStep>
              <FlowArrow label="serve" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title={`Answer inside ${BUDGET_MS} ms`} what="The network already takes a good share of the budget. Querying a database per keystroke spends the rest; an in-memory trie or a precomputed prefix table answers in a millisecond and is replaced wholesale when the builder publishes a new one." accent={ACCENT} active={at(3)}>
                <Choices label="Serve from" accent={ACCENT} value={serve} onChange={setServe} options={SERVES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{sv.one}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: total <= BUDGET_MS ? "var(--good)" : "var(--bad)" }}>
                  {NETWORK_MS} ms network + {sv.ms} ms server = {total} ms
                  {serve === "kv" ? ` · prefix table ≈ ${Math.round(prefixTableGB())} GB, sharded by prefix` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="fewer requests" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Send fewer requests from the browser" what="Wait for a short pause before asking (debounce), and keep answers for prefixes already seen, so a backspace costs nothing. Cache suggestion responses at the CDN too: popular prefixes are the same for everyone." accent={ACCENT} active={at(4)}>
                <Choices label="Debounce" accent={ACCENT} value={String(debounceMs)} onChange={(v) => setDebounce(Number(v))} options={DEBOUNCES.map((d) => ({ id: String(d), label: d ? `${d} ms` : "none" }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={cachePrefixes} onChange={(e) => setCache(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Reuse answers for prefixes already seen
                </label>
                <p className="font-mono text-xs">
                  {KEYSTROKES.length} keystrokes → {sent.length} requests: {sent.map((p) => `“${p}”`).join(" ")}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Query counts and latencies are illustrative. Personalised suggestions add a second, per-user lookup merged with these.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
