"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DISALLOW, FP_RATES, FRONTIERS, HOSTS, PAGES, POLITE_S, WEB_URLS, WORKERS, bloomGB, crawl, exactGB, hashSetGB, normalize, type Frontier, type Options } from "@/lib/webCrawler";

const ACCENT = "var(--sys)";
const EXAMPLE = "HTTPS://News.Example/p/3/?utm_source=newsletter#comments";

export default function WebCrawlerDemo() {
  const [o, setO] = useState<Options>({ frontier: "fifo", normalize: false, robots: false, fingerprint: false });
  const [fp, setFp] = useState(0.01);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Options>) => setO((c) => ({ ...c, ...p }));
  const r = crawl(o);

  const packets: Packet[] =
    stage === 0 ? hops("s", ["frontier", "fetchers"], { label: "robots.txt first" })
    : stage === 1 ? hops("n", ["parser", "seen", "frontier"], { label: o.normalize ? "normalized" : "raw URL", tone: r.duplicateFetches ? "bad" : "good" })
    : stage === 2 ? hops("f", ["frontier", "fetchers", "web"], { label: `${r.peakPerHost}/s to one host`, tone: r.peakPerHost > 1 ? "bad" : "good" })
    : stage === 3 ? hops("p", ["web", "fetchers", "parser"], { label: o.fingerprint ? "same bytes: skip" : "index again", tone: o.fingerprint ? "good" : "bad" })
    : stage === 4 ? hops("b", ["parser", "seen"], { label: `bloom ${bloomGB(fp).toFixed(0)} GB` })
    : [];

  const captions = [
    `Step 1: the crawl starts from ${HOSTS.length} seed pages; ${o.robots ? "robots.txt is read first, so the shop's cart is skipped" : `robots.txt is ignored: ${r.robotsViolations} disallowed pages fetched`}.`,
    `Step 2: ${o.normalize ? "every link is normalized before the seen check" : `links are compared as written: ${r.duplicateFetches} fetches of pages already fetched`}.`,
    `Step 3: ${FRONTIERS.find((x) => x.id === o.frontier)!.label}: ${r.seconds.toFixed(0)} s for the crawl, at most ${r.peakPerHost} request${r.peakPerHost === 1 ? "" : "s"} a second to one host.`,
    `Step 4: ${o.fingerprint ? `${r.skippedMirror} mirror pages recognised by their content and skipped` : `${r.duplicateContent} mirror pages indexed a second time`}.`,
    `Step 5: remembering ${(WEB_URLS / 1e9).toFixed(0)}B URLs takes ${exactGB().toFixed(0)} GB as strings, ${bloomGB(fp).toFixed(0)} GB as a Bloom filter at ${fp * 100}% false positives.`,
  ];
  const caption = stage !== null ? captions[stage] : `${r.fetches} fetches for ${r.unique} pages in ${r.seconds.toFixed(0)} s · ${r.duplicateFetches} repeats · peak ${r.peakPerHost}/s on one host · ${r.robotsViolations} robots violations · ${r.duplicateContent} duplicates indexed.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a web crawler"
        blurb={`Start from a few pages, follow every link, and fetch the web without hammering anyone's server or fetching the same page twice. A small web of ${HOSTS.length} hosts and ${PAGES.size} pages, with links written in messy ways, a mirror site and a robots.txt, crawled by ${WORKERS} fetchers in simulated time.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Frontier, fetchers, the web, parser and the seen-URL set"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "frontier", label: "Frontier", sub: o.frontier === "perHost" ? "queue per host" : "one queue", at: [14, 28], mobileAt: [22, 9], state: o.frontier === "fifo" ? "bad" : "good" },
                  { id: "fetchers", label: `Fetchers ×${WORKERS}`, sub: `${r.fetches} fetches`, at: [50, 28], mobileAt: [78, 9], state: "active" },
                  { id: "web", label: "The web", sub: `peak ${r.peakPerHost}/s per host`, at: [86, 28], mobileAt: [78, 50], state: r.peakPerHost > 1 ? "bad" : "good" },
                  { id: "parser", label: "Parser", sub: o.fingerprint ? "+ content hash" : "extract links", at: [68, 80], mobileAt: [78, 90], state: "active" },
                  { id: "seen", label: "Seen URLs", sub: o.normalize ? "normalized" : "raw strings", at: [30, 80], mobileAt: [22, 70], state: r.duplicateFetches ? "bad" : "good" },
                ]}
                links={[
                  { from: "frontier", to: "fetchers", label: "next URL" },
                  { from: "fetchers", to: "web", label: "GET" },
                  { from: "fetchers", to: "parser", label: "HTML" },
                  { from: "parser", to: "seen", label: "links" },
                  { from: "seen", to: "frontier", label: "new only" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Timeline hits={r.hits} seconds={r.seconds} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Frontier" accent={ACCENT} value={o.frontier} onChange={(f: Frontier) => set({ frontier: f })} options={FRONTIERS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Crawling…">
                Crawl
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Seed the frontier and read robots.txt" what="The frontier is the list of URLs still to fetch, started from seed pages. Before fetching from a host, read its robots.txt and drop the paths it disallows; ignoring it gets the crawler blocked, and sometimes into legal trouble." accent={ACCENT} active={at(0)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.robots} onChange={(e) => set({ robots: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Obey robots.txt (Disallow: {DISALLOW.prefix} on {DISALLOW.host})
                </label>
                <p className="font-mono text-xs" style={{ color: r.robotsViolations ? "var(--bad)" : "var(--good)" }}>
                  {r.robotsViolations} disallowed pages fetched
                </p>
              </FlowStep>
              <FlowArrow label="links found" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Normalize URLs before checking “seen”" what="The same page is linked as many strings: different case, a fragment, a tracking parameter, a trailing slash. Normalize every link to one form before checking whether it has been seen, or the crawler fetches the same page again and again." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.normalize} onChange={(e) => set({ normalize: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Normalize links
                </label>
                <p className="break-all font-mono text-[11px]">
                  {EXAMPLE} → {normalize(EXAMPLE)}
                </p>
                <p className="mt-1 font-mono text-xs" style={{ color: r.duplicateFetches ? "var(--bad)" : "var(--good)" }}>
                  {r.fetches} fetches for {r.unique} pages · {r.duplicateFetches} repeats
                </p>
              </FlowStep>
              <FlowArrow label="schedule" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Be polite: one request per host at a time" what={`Links cluster by host, so a plain queue sends bursts at one server. Waiting in line for that server wastes fetchers. A queue per host, each with the time it may next be hit (here every ${POLITE_S} s), lets fetchers work on whichever host is ready.`} accent={ACCENT} active={at(2)}>
                <Choices label="Frontier" accent={ACCENT} value={o.frontier} onChange={(f: Frontier) => set({ frontier: f })} options={FRONTIERS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{FRONTIERS.find((x) => x.id === o.frontier)!.one}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">time</span>
                  <span className="text-right text-[var(--faint)]">peak/host</span>
                  {FRONTIERS.map((x) => {
                    const y = crawl({ ...o, frontier: x.id });
                    return <Row key={x.id} cells={[x.label, `${y.seconds.toFixed(0)} s`, `${y.peakPerHost}/s`]} on={x.id === o.frontier} bad={[false, y.peakPerHost > 1]} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="page content" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Skip pages you've already seen by content" what="Mirrors, print versions and copied pages have different URLs and identical content. Hash the content (or a near-duplicate fingerprint like SimHash) and skip a page whose hash is already indexed, along with its links." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.fingerprint} onChange={(e) => set({ fingerprint: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Fingerprint page content
                </label>
                <p className="font-mono text-xs" style={{ color: r.duplicateContent ? "var(--bad)" : "var(--good)" }}>
                  mirror.example copies blog.example · {o.fingerprint ? `${r.skippedMirror} copies skipped` : `${r.duplicateContent} copies indexed`}
                </p>
              </FlowStep>
              <FlowArrow label="at web scale" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep the seen set small" what={`At ${(WEB_URLS / 1e9).toFixed(0)} billion URLs, the seen set is the crawler's biggest structure. A Bloom filter answers “definitely new” or “probably seen” in a fraction of the memory; a false positive means a new page is skipped this round.`} accent={ACCENT} active={at(4)}>
                <Choices label="False positives" accent={ACCENT} value={String(fp)} onChange={(v) => setFp(Number(v))} options={FP_RATES.map((p) => ({ id: String(p), label: `${p * 100}%` }))} />
                <p className="mt-2 font-mono text-xs">
                  URLs as strings {exactGB().toFixed(0)} GB · 8-byte hashes {hashSetGB().toFixed(0)} GB · Bloom filter {bloomGB(fp).toFixed(0)} GB, skipping {(WEB_URLS * fp / 1e6).toFixed(0)}M new URLs
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Synthetic web with a fixed seed; fetches take 0.3 s. Real crawlers also prioritise by page importance and recrawl pages by how often they change.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on: boolean; bad: boolean[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: i > 0 && bad[i - 1] ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// When each host was hit: one row per host, one tick per request.
function Timeline({ hits, seconds }: { hits: Record<string, number[]>; seconds: number }) {
  const T = Math.max(20, Math.ceil(seconds / 10) * 10);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`Requests to each host over ${Math.round(seconds)} seconds`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">requests per host over time</p>
        <p className="font-mono text-xs text-[var(--muted)]">0 → {T} s</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {HOSTS.map((h) => (
          <div key={h.host} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate font-mono text-[10px] text-[var(--muted)] sm:w-28">{h.host}</span>
            <div className="relative h-4 min-w-0 flex-1 rounded-sm bg-[var(--inset)]">
              {(hits[h.host] ?? []).map((t, i) => (
                <span key={i} className="absolute top-0.5 bottom-0.5 w-px" style={{ left: `${(t / T) * 100}%`, background: ACCENT }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
