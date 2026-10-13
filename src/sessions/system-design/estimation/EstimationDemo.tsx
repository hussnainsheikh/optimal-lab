"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { estimate, fmtN } from "@/lib/estimation";

const ACCENT = "var(--sys)";
const DAU = [1e5, 1e6, 1e7, 1e8, 5e8];

export default function EstimationDemo() {
  const [di, setDi] = useState(2);
  const [up, setUp] = useState(2);
  const [mb, setMb] = useState(2);
  const [views, setViews] = useState(50);
  const e = estimate({ dau: DAU[di], uploadsPerUser: up, photoMb: mb, viewsPerUpload: views, replicas: 3 });
  const rows: [string, string, string][] = [
    ["Uploads per day", fmtN(e.uploads), `${fmtN(DAU[di])} users × ${up}`],
    ["Write QPS (average)", fmtN(e.writeQps), "uploads ÷ 86,400 s"],
    ["Read QPS (average)", fmtN(e.readQps), `writes × ${views} views`],
    ["Read QPS (peak, ×3)", fmtN(e.peakRead), "traffic isn't flat"],
    ["New storage per day", `${e.storageDayTb.toFixed(1)} TB`, `× ${mb} MB × 3 copies`],
    ["Storage per year", `${e.storageYearPb.toFixed(1)} PB`, "× 365"],
    ["Peak egress", `${e.egressGbps.toFixed(0)} Gbps`, "peak reads × size"],
    ["App servers for reads", String(e.servers), "~2,000 req/s each"],
  ];
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Back-of-envelope estimation" blurb="Before designing a photo-sharing app, rough numbers tell you what's hard. Is it reads or writes? Storage or bandwidth? Change the assumptions and see which number explodes first." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Estimates">
              <table className="w-full text-sm">
                <tbody>{rows.map(([k, v, how]) => <tr key={k} className="border-b border-[var(--line)] last:border-0"><td className="py-2 pr-2">{k}<p className="text-[11px] text-[var(--faint)]">{how}</p></td><td className="text-right font-mono text-lg" style={{ color: ACCENT }}>{v}</td></tr>)}</tbody>
              </table>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Reads outnumber writes ${views}:1, so this is a read-heavy system: cache and CDN everything. Storage grows by ${e.storageYearPb.toFixed(1)} PB a year, which means object storage with tiering, not a database.`}>
              <Slider label="Daily active users" accent={ACCENT} value={di} min={0} max={DAU.length - 1} step={1} format={(i) => fmtN(DAU[i])} onChange={setDi} />
              <Slider label="Uploads per user per day" accent={ACCENT} value={up} min={0.1} max={10} step={0.1} format={(v) => v.toFixed(1)} onChange={setUp} />
              <Slider label="Average photo size" accent={ACCENT} value={mb} min={0.2} max={8} step={0.2} format={(v) => `${v.toFixed(1)} MB`} onChange={setMb} />
              <Slider label="Views per photo" accent={ACCENT} value={views} min={1} max={500} step={1} format={String} onChange={setViews} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="State assumptions out loud" what="Users, actions per user, object sizes, read/write ratio. Round aggressively: the order of magnitude is what matters." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A day ≈ 100,000 seconds.</p></FlowStep>
              <FlowArrow label="traffic" accent={ACCENT} />
              <FlowStep n={2} title="Turn daily totals into QPS" what="Divide by 86,400, then multiply by 2–5 for peaks. 10k QPS is a cache problem; 100 QPS is one database." accent={ACCENT}><p className="text-sm text-[var(--muted)]">The ratio tells you where to optimise.</p></FlowStep>
              <FlowArrow label="storage" accent={ACCENT} />
              <FlowStep n={3} title="Storage and bandwidth over time" what="Size × count × replicas × retention. Petabytes mean object storage and lifecycle rules; huge egress means a CDN." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Bandwidth bills can beat compute.</p></FlowStep>
              <FlowArrow label="use it" accent={ACCENT} />
              <FlowStep n={4} title="Let the numbers pick the design" what="The biggest number names the hard problem. Design for that, and say what changes at 10× growth." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Interviewers want the reasoning, not precision.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
