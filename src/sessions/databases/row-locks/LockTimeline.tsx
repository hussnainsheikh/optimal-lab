import type { Seg } from "@/lib/rowLocks";

const FILL: Record<Seg["kind"], string> = {
  work: "color-mix(in srgb, var(--db) 70%, transparent)",
  wait: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--faint) 45%, transparent) 0 4px, transparent 4px 8px)",
  fail: "var(--bad)",
};

/** One lane per transaction: solid while it works with a lock, striped while it waits, red on an error. */
export function LockTimeline({ lanes, segs, end, title }: { lanes: { id: string; label: string }[]; segs: Seg[]; end: number; title: string }) {
  const span = Math.max(end, 1);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={title}>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{title}</p>
      <div className="mt-3 space-y-2">
        {lanes.map((l) => (
          <div key={l.id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-xs text-[var(--muted)]" title={l.label}>{l.label}</span>
            <div className="relative h-6 min-w-0 flex-1 rounded bg-[var(--inset)]">
              {segs
                .filter((s) => s.txn === l.id && s.to > s.from)
                .map((s, i) => (
                  <span
                    key={i}
                    title={`${s.label}: ${s.from}–${s.to} ms`}
                    className="absolute top-0 h-full rounded-sm"
                    style={{ left: `${(s.from / span) * 100}%`, width: `${Math.max(0.8, ((Math.min(s.to, span) - s.from) / span) * 100)}%`, background: FILL[s.kind] }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between pl-[5.5rem] font-mono text-[10px] text-[var(--faint)]">
        <span>0 ms</span>
        <span>{span.toLocaleString("en-US")} ms</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: FILL.work }} />holds the lock, working</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: FILL.wait }} />waiting for a lock</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: FILL.fail }} />error</span>
      </div>
    </section>
  );
}
