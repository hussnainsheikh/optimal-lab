"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CACHE_SIZES, CAMPAIGN, CODEGENS, READ_RATIO, ROW_BYTES, VOLUMES, YEARS, base62, collisions, counted, fmt, hashCode, hitRatio, size, type CodeGen } from "@/lib/urlShortener";

const ACCENT = "var(--sys)";
const COUNTER_AT = 3_521_614_606; // where this server's block of the counter is up to

export default function UrlShortenerDemo() {
  const [volume, setVolume] = useState(100e6);
  const [gen, setGen] = useState<CodeGen>("counter");
  const [cache, setCache] = useState(1e6);
  const [status, setStatus] = useState<301 | 302>(301);
  const [url, setUrl] = useState("https://shop.example.com/sale/summer?utm_source=newsletter");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const z = size(volume);
  const code = gen === "hash" ? hashCode(url) : gen === "counter" ? base62(COUNTER_AT) : hashCode(`${url}#salt`);
  const hit = cache ? hitRatio(cache, z.total) : 0;
  const dbReads = z.peakReads * (1 - hit);
  const clash = gen === "counter" ? 0 : collisions(z.total, gen === "hash" ? 62 ** 7 : z.space);
  const cacheHit = hit > 0.5;

  const packets: Packet[] =
    stage === 0 ? hops("c", ["browser", "api"], { label: "POST /links" })
    : stage === 1 ? hops("w", ["api", "db"], { label: `INSERT ${code}` })
    : stage === 2 ? hops("g", cacheHit ? ["browser", "api", "cache"] : ["browser", "api", "cache", "db"], { label: `GET /${code}`, tone: cacheHit ? "good" : "accent" })
    : stage === 3 ? hops("r", ["api", "browser"], { label: `${status} Location` })
    : stage === 4 ? hops("q", ["api", "queue"], { label: "click event" })
    : [];

  const captions = [
    `Step 1: ${fmt(volume)} new links a month is ${z.writes.toFixed(0)} writes a second and ${fmt(z.reads)} redirects a second, ${fmt(z.peakReads)} at peak.`,
    `Step 2: the long URL gets the code ${code}.`,
    `Step 3: ${cache ? `${(hit * 100).toFixed(0)}% of redirects are answered by the cache` : "every redirect reads the database"}; the database sees ${fmt(dbReads)} reads a second at peak.`,
    `Step 4: the browser gets ${status} and goes to the long URL.`,
    `Step 5: the click is put on a queue; analytics counts ${counted(status)} of ${CAMPAIGN.clicks} clicks.`,
  ];
  const caption = stage !== null ? captions[stage] : `${fmt(volume)} links a month · ${z.len}-character codes · ${fmt(z.peakReads)} redirects/s at peak · ${(hit * 100).toFixed(0)}% from cache · ${status} counts ${counted(status)} of ${CAMPAIGN.clicks} clicks.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a URL shortener"
        blurb="Turn a long link into a short one, send everyone who clicks it to the right place in milliseconds, and count the clicks. Size it, choose how codes are made, put a cache in front of the database, pick the redirect status, and move click counting off the request path."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Browser, shortener service, cache, database and click queue"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "browser", label: "Browser", sub: "clicks a link", at: [11, 30], mobileAt: [22, 9], state: "active" },
                  { id: "api", label: "Shortener", sub: "stateless", at: [42, 30], mobileAt: [22, 45], state: "active" },
                  { id: "cache", label: "Cache", sub: cache ? `${(hit * 100).toFixed(0)}% hits` : "none", at: [75, 18], mobileAt: [78, 30], state: cache ? "good" : "dim" },
                  { id: "db", label: "Database", sub: `${fmt(dbReads)} reads/s`, at: [75, 75], mobileAt: [78, 66], state: dbReads > 20000 ? "bad" : "idle" },
                  { id: "queue", label: "Click queue", sub: "→ analytics", at: [42, 80], mobileAt: [22, 88], state: "idle" },
                ]}
                links={[
                  { from: "browser", to: "api", label: "request" },
                  { from: "api", to: "cache", label: "code →  URL", dim: !cache },
                  { from: "cache", to: "db", label: "miss" },
                  { from: "api", to: "db", label: "insert" },
                  { from: "api", to: "queue", label: "click", dashed: true },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Sizing">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">back of the envelope</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="writes / s" value={z.writes.toFixed(0)} />
                  <Stat label="redirects / s, peak" value={fmt(z.peakReads)} />
                  <Stat label={`links in ${YEARS} years`} value={fmt(z.total)} />
                  <Stat label="storage" value={`${z.storageTB.toFixed(1)} TB`} />
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="New links / month" accent={ACCENT} value={String(volume)} onChange={(v) => setVolume(Number(v))} options={VOLUMES.map((v) => ({ id: String(v), label: fmt(v) }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Shortening…">
                Shorten and click
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Size it first" what={`Reads dominate: a link is made once and clicked about ${READ_RATIO} times. Every row is about ${ROW_BYTES} bytes. The number of links over ${YEARS} years sets the code length: base 62 (0–9, a–z, A–Z) with room to spare.`} accent={ACCENT} active={at(0)}>
                <Choices label="New links / month" accent={ACCENT} value={String(volume)} onChange={(v) => setVolume(Number(v))} options={VOLUMES.map((v) => ({ id: String(v), label: fmt(v) }))} />
                <p className="mt-2 font-mono text-xs">
                  {fmt(z.total)} links → 62^{z.len} = {fmt(z.space)} codes · {z.len} characters
                </p>
              </FlowStep>
              <FlowArrow label="long URL" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Generate the short code" what="The code must be unique, short, and preferably not guessable. Hashing gives the same code for the same URL but collides; a counter never collides but leaks how many links exist; random codes need a uniqueness check." accent={ACCENT} active={at(1)}>
                <label className="block text-xs text-[var(--muted)]">
                  Long URL
                  <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--inset)] px-3 font-mono text-xs text-[var(--text)]" />
                </label>
                <div className="mt-2">
                  <Choices label="Codes" accent={ACCENT} value={gen} onChange={setGen} options={CODEGENS.map((x) => ({ id: x.id, label: x.label }))} />
                </div>
                <p className="mt-2 text-xs">{CODEGENS.find((x) => x.id === gen)!.one}</p>
                <p className="mt-1 break-all font-mono text-xs">
                  sho.rt/{code} · {gen === "counter" ? `counter ${COUNTER_AT.toLocaleString("en-US")} in base 62` : `${fmt(clash)} expected ${gen === "hash" ? "collisions" : "retries"} over ${fmt(z.total)} links`}
                </p>
              </FlowStep>
              <FlowArrow label="GET /code" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Look it up through a cache" what="A few links get most of the clicks (a Zipf curve), so a cache holding the most popular codes answers most redirects. The database keeps every mapping, keyed by code." accent={ACCENT} active={at(2)}>
                <Choices label="Cached codes" accent={ACCENT} value={String(cache)} onChange={(v) => setCache(Number(v))} options={CACHE_SIZES.map((c) => ({ id: String(c), label: c ? fmt(c) : "none" }))} />
                <p className="mt-2 font-mono text-xs">
                  hit ratio {(hit * 100).toFixed(0)}% · database {fmt(dbReads)} reads/s at peak · cache ≈ {((cache * ROW_BYTES) / 1e9).toFixed(1)} GB
                </p>
              </FlowStep>
              <FlowArrow label="redirect" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Pick the redirect status" what="301 Moved Permanently is cached by the browser, so repeat clicks never reach you: less load, fewer clicks counted, and you can't change where the link goes. 302 Found sends every click through you." accent={ACCENT} active={at(3)}>
                <Choices label="Status" accent={ACCENT} value={String(status)} onChange={(v) => setStatus(Number(v) as 301 | 302)} options={[{ id: "301", label: "301 permanent" }, { id: "302", label: "302 temporary" }]} />
                <p className="mt-2 font-mono text-xs" style={{ color: status === 301 ? "var(--bad)" : "var(--good)" }}>
                  a campaign: {CAMPAIGN.clicks} clicks from {CAMPAIGN.browsers} browsers → {counted(status)} reach the server
                </p>
              </FlowStep>
              <FlowArrow label="click event" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Count clicks off the hot path" what="Updating a counter row on every redirect turns a read into a write on the hottest rows. Put a click event on a queue and return the redirect; a consumer aggregates counts for the dashboard a few seconds later." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">{fmt(z.peakReads * (status === 302 ? 1 : CAMPAIGN.browsers / CAMPAIGN.clicks))} click events/s at peak, batched into counts per minute</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Popularity follows a Zipf curve (s = 1). The random code shown is derived from the URL so it stays stable while you read.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
