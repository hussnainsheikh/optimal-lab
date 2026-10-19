"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ATTACKERS, DATA_KEYS, NONE, RECORDS, REENCRYPT_MB_S, exposed, rotation, rowAsSeen, type Protections } from "@/lib/encryption";

const ACCENT = "var(--sys)";

export default function EncryptionDemo() {
  const [p, setP] = useState<Protections>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const set = (k: keyof Protections, v: boolean) => setP((cur) => ({ ...cur, [k]: v }));
  const at = (i: number) => stage === i;
  const seen = ATTACKERS.filter((a) => exposed(a.id, p));
  const rot = rotation();
  const row = rowAsSeen(p);

  const packets: Packet[] =
    stage === 0 ? hops("edge", ["phone", "lb"], { label: p.tlsEdge ? "TLS" : "plain HTTP", tone: p.tlsEdge ? "good" : "bad" })
    : stage === 1 ? hops("int", ["lb", "app", "db"], { label: p.tlsInternal ? "mTLS" : "plain", tone: p.tlsInternal ? "good" : "bad" })
    : stage === 2 ? hops("disk", ["db", "backup"], { label: p.atRest ? "encrypted" : "readable", tone: p.atRest ? "good" : "bad" })
    : stage === 3 ? hops("sql", ["app", "db"], { label: p.fieldLevel ? "ciphertext" : "diagnosis", tone: p.fieldLevel ? "good" : "bad" })
    : stage === 4 ? hops("kms", ["app", "kms"], { label: "unwrap key", tone: "good" })
    : [];
  const att = (id: string) => (exposed(id as never, p) ? "bad" : "good");

  const captions = [
    `Step 1: the phone talks to the load balancer${p.tlsEdge ? " over TLS: the café Wi-Fi sees only ciphertext" : " in plain HTTP: anyone on the café Wi-Fi reads it"}.`,
    `Step 2: inside the data centre, ${p.tlsInternal ? "services talk over mutual TLS" : "services talk in plain text: one compromised host can listen to the rest"}.`,
    `Step 3: the disk and its backups are ${p.atRest ? "encrypted with keys kept in a KMS" : "readable by whoever holds a copy"}.`,
    `Step 4: through SQL, the diagnosis column reads ${p.fieldLevel ? "as ciphertext: the app encrypted it before storing it" : "in plain text: disk encryption is transparent to anyone who can query"}.`,
    `Step 5: keys live in a KMS; rotating means re-wrapping ${DATA_KEYS.toLocaleString("en-US")} data keys in ${Math.round(rot.rewrapMinutes * 60)} s, not re-encrypting ${rot.reencryptTB.toFixed(1)} TB in ${rot.reencryptHours.toFixed(0)} h.`,
  ];
  const caption = stage !== null ? captions[stage] : `${seen.length} of ${ATTACKERS.length} attackers can read a patient's diagnosis: ${seen.map((a) => a.label.toLowerCase()).join(", ")}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Encryption at rest and in transit"
        blurb="A health app stores patients' records. Five attackers sit in five different places: on the café Wi-Fi, inside your network, holding a stolen backup, reading rows through SQL, and on the app server itself. Each kind of encryption stops some of them and not others. Turn them on and see who can still read a diagnosis."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A phone, the load balancer, the app server, the database, its backups, and a key management service, with five attackers"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "phone", label: "Phone", sub: `Wi-Fi: ${exposed("wifi", p) ? "sniffed" : "safe"}`, at: [10, 30], mobileAt: [20, 8], state: att("wifi") },
                  { id: "lb", label: "Load balancer", sub: p.tlsEdge ? "TLS ends here" : "HTTP", at: [36, 30], mobileAt: [72, 8], state: "active" },
                  { id: "app", label: "App server", sub: "always sees plaintext", at: [62, 30], mobileAt: [72, 38], state: "bad" },
                  { id: "db", label: "Database", sub: p.fieldLevel ? "diagnosis encrypted" : "diagnosis readable", at: [62, 78], mobileAt: [22, 66], state: att("sql") },
                  { id: "backup", label: "Disk / backup", sub: p.atRest ? "encrypted" : "readable", at: [90, 78], mobileAt: [72, 92], state: att("disk") },
                  { id: "kms", label: "KMS", sub: "master keys", at: [90, 30], mobileAt: [22, 38], state: "idle" },
                ]}
                links={[
                  { from: "phone", to: "lb", label: p.tlsEdge ? "TLS" : "HTTP" },
                  { from: "lb", to: "app", label: p.tlsInternal ? "mTLS" : "plain" },
                  { from: "app", to: "db", label: p.tlsInternal ? "TLS" : "plain" },
                  { from: "db", to: "backup", label: "snapshots" },
                  { from: "app", to: "kms", label: "unwrap", dashed: true },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="What each attacker can read">
                <ul className="space-y-0.5 text-xs">
                  {ATTACKERS.map((a) => {
                    const bad = exposed(a.id, p);
                    return (
                      <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span>{a.label}</span>
                        <span className="font-mono" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>
                          {bad ? "reads the diagnosis" : "sees ciphertext"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Following…">
                Follow a record
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Encrypt in transit to the edge" what="TLS between the device and your load balancer keeps the network between them (the café Wi-Fi, the ISP) from reading or changing traffic. It ends at the load balancer." accent={ACCENT} active={at(0)}>
                <Toggle checked={p.tlsEdge} onChange={(v) => set("tlsEdge", v)} label="TLS from devices to the load balancer" />
              </FlowStep>
              <FlowArrow label="inside the network" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Keep encrypting inside" what="“Inside the VPC” is not a trust boundary: one compromised host can watch the traffic of others. TLS between services, or mutual TLS from a service mesh, closes that." accent={ACCENT} active={at(1)}>
                <Toggle checked={p.tlsInternal} onChange={(v) => set("tlsInternal", v)} label="TLS between services and to the database" />
              </FlowStep>
              <FlowArrow label="stored" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Encrypt at rest" what="Disk, database and backup encryption make a stolen drive or a leaked snapshot useless, as long as the keys are kept somewhere else (a KMS). The database decrypts transparently for anyone who can query it, so it does nothing against SQL injection or a rogue admin." accent={ACCENT} active={at(2)}>
                <Toggle checked={p.atRest} onChange={(v) => set("atRest", v)} label="Encrypt disks and backups with KMS keys" />
              </FlowStep>
              <FlowArrow label="the most sensitive fields" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Encrypt sensitive fields in the app" what="For the few columns that matter most, the app encrypts before writing and decrypts after reading. Whoever reads the database sees ciphertext. The cost: no searching or sorting on those columns, and the app becomes the place to defend." accent={ACCENT} active={at(3)}>
                <Toggle checked={p.fieldLevel} onChange={(v) => set("fieldLevel", v)} label="Field-level encryption for the diagnosis" />
                <p className="font-mono text-xs">
                  SELECT name, dob, diagnosis → {row.name} · {row.dob} · <span style={{ color: p.fieldLevel ? "var(--good)" : "var(--bad)" }}>{row.diagnosis}</span>
                </p>
              </FlowStep>
              <FlowArrow label="the keys" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Manage keys with envelope encryption" what={`Data is encrypted with data keys; data keys are encrypted (“wrapped”) by a master key that never leaves the KMS. Rotating the master key means re-wrapping the small data keys, not re-encrypting the data. Every unwrap is a logged KMS call.`} accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span className="font-sans">re-encrypt {(RECORDS / 1e6).toFixed(0)}M records ({rot.reencryptTB.toFixed(1)} TB) at {REENCRYPT_MB_S} MB/s</span>
                  <span className="text-right" style={{ color: "var(--bad)" }}>
                    {rot.reencryptHours.toFixed(1)} h
                  </span>
                  <span className="font-sans">re-wrap {DATA_KEYS.toLocaleString("en-US")} data keys ({rot.rewrapKB.toFixed(0)} KB)</span>
                  <span className="text-right" style={{ color: "var(--good)" }}>
                    {Math.round(rot.rewrapMinutes * 60)} s
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The compromised app server reads everything whatever you turn on: it has to decrypt to do its job. Least privilege, short-lived credentials and audit logs limit what it can reach.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
