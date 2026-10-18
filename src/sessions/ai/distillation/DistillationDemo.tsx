"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CLASSES, EXAMPLE_COUNTS, LOGITS, STUDENTS, TEACHER, TEMPERATURES, accuracy, entropy, gain, labelCost, pct, softmax, type Target } from "@/lib/distillation";

const ACCENT = "var(--ai)";

export default function DistillationDemo() {
  const [studentId, setStudentId] = useState("s3");
  const [T, setT] = useState(4);
  const [target, setTarget] = useState<Target>("soft");
  const [n, setN] = useState(8000);
  const { stage, busy, run } = useWalk(5, 1100);
  const student = STUDENTS.find((s) => s.id === studentId)!;
  const p = softmax(LOGITS, T);
  const hard = p.map((_, i) => (i === 0 ? 1 : 0));
  const shown = target === "soft" ? p : hard;
  const acc = accuracy(student, n, target, T);
  const at = (i: number) => stage === i;

  const packets: Packet[] =
    stage === 1 ? hops("label", ["data", "teacher"], { label: "input" })
    : stage === 2 ? hops("dist", ["teacher", "labels"], { label: target === "soft" ? "distribution" : "label" })
    : stage === 3 ? hops("train", ["labels", "student"], { label: `${n.toLocaleString("en-US")} examples` })
    : stage === 4 ? hops("serve", ["student", "app"], { label: "answers", tone: acc >= 0.8 ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: the ${student.label.toLowerCase()} will do the job the ${TEACHER.label.toLowerCase()} does now, at ${(TEACHER.price / student.price).toFixed(0)}× less per token.`,
    "Step 2: the teacher labels inputs nobody has labelled. For this cat photo it is sure, but not completely.",
    target === "soft" ? `Step 3: at temperature ${T} the teacher's answer is ${p.map((v, i) => `${CLASSES[i]} ${pct(v)}`).join(", ")}: ${entropy(p).toFixed(2)} bits of information.` : "Step 3: the hard label just says “cat”. That the photo also looks like a fox is thrown away.",
    `Step 4: trained on ${n.toLocaleString("en-US")} ${target} labels, the student reaches ${pct(acc)}.`,
    `Step 5: ${pct(acc)} against the teacher's ${pct(TEACHER.accuracy)}, at $${student.price} instead of $${TEACHER.price} per million tokens.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${student.label}, ${n.toLocaleString("en-US")} ${target} labels${target === "soft" ? ` at T = ${T}` : ""}: ${pct(acc)} (teacher ${pct(TEACHER.accuracy)}, ceiling for this size ${pct(student.ceiling)}).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Distillation"
        blurb="A big model is slow and expensive to run. Distillation uses it as a teacher: it labels a pile of inputs, and a small student trains on its answers. Keep the teacher's whole probability distribution rather than its top pick and the student learns far more from each example."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="Unlabelled inputs go to the teacher, the teacher's answers train the student, and the student serves the app"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "data", label: "Unlabelled inputs", sub: `${n.toLocaleString("en-US")}`, at: [12, 30], mobileAt: [22, 12], state: stage === 1 ? "active" : "idle" },
                  { id: "teacher", label: TEACHER.label, sub: `${pct(TEACHER.accuracy)} · $${TEACHER.price}/M`, at: [42, 30], mobileAt: [75, 12], state: stage === 1 || stage === 2 ? "active" : "idle" },
                  { id: "labels", label: target === "soft" ? "Soft labels" : "Hard labels", sub: target === "soft" ? `T = ${T}` : "top pick only", at: [70, 30], mobileAt: [75, 50], state: stage === 2 || stage === 3 ? "active" : "idle" },
                  { id: "student", label: student.label, sub: `${pct(acc)} · $${student.price}/M`, at: [70, 78], mobileAt: [22, 50], state: stage === 3 || stage === 4 ? "active" : acc >= 0.8 ? "good" : "idle" },
                  { id: "app", label: "Your app", sub: `${student.tps} tok/s`, at: [30, 78], mobileAt: [50, 88], state: stage === 4 ? (acc >= 0.8 ? "good" : "bad") : "idle" },
                ]}
                links={[
                  { from: "data", to: "teacher", label: "inputs" },
                  { from: "teacher", to: "labels", label: "answers" },
                  { from: "labels", to: "student", label: "train" },
                  { from: "student", to: "app", label: "serve" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={1}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The teacher's answer for one photo, as the student sees it">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  one photo of a cat · what the student is told{target === "soft" ? ` · T = ${T}` : ""}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {CLASSES.map((c, i) => (
                    <li key={c} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.25rem] items-center gap-2 text-sm">
                      <span className="font-mono text-xs">{c}</span>
                      <span className="h-3 rounded bg-[var(--track)]">
                        <span className="block h-full rounded transition-[width] duration-300" style={{ width: `${shown[i] * 100}%`, background: i === 0 ? "var(--good)" : ACCENT }} />
                      </span>
                      <span className="text-right font-mono text-xs">{pct(shown[i], 1)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                  {entropy(shown).toFixed(2)} bits of information per example{target === "soft" ? " · fox is far more likely than car: that is the knowledge" : " · nothing but the answer"}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Labels" accent={ACCENT} value={target} onChange={setTarget} options={[{ id: "soft", label: "Whole distribution" }, { id: "hard", label: "Top pick only" }]} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Distilling…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick a student" what="Small enough to be cheap and fast where it will run. Its size caps how good it can get, however well it is taught." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={studentId} onChange={setStudentId} options={STUDENTS.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 font-mono text-xs">
                  ceiling {pct(student.ceiling)} · ${student.price}/M tokens · {student.tps} tok/s
                </p>
              </FlowStep>
              <FlowArrow label="a student" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Let the teacher label the data" what="The inputs need no human labels; the teacher's answers are the labels. For an LLM, that means the teacher writes the answers the student will imitate." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  teacher&rsquo;s scores for the cat photo: {CLASSES.map((c, i) => `${c} ${LOGITS[i].toFixed(1)}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="scores" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Keep the whole distribution" what="Softmax turns the scores into probabilities. Dividing the scores by a temperature first spreads probability onto the similar classes, so the student also learns what a cat is like. Too hot and everything flattens." accent={ACCENT} active={at(2)}>
                <Choices label="Temperature" accent={ACCENT} value={String(T)} onChange={(v) => setT(Number(v))} options={TEMPERATURES.map((t) => ({ id: String(t), label: String(t) }))} />
                <p className="mt-2 font-mono text-xs">
                  softmax(scores ÷ {T}) → {p.map((v) => pct(v)).join(" / ")} · teaches {gain(T).toFixed(1)}× more per example than a hard label
                </p>
                {target === "hard" && <p className="mt-1 text-xs text-[var(--muted)]">Switch the labels to the whole distribution to use this.</p>}
              </FlowStep>
              <FlowArrow label="labels" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Train the student on them" what="The student learns to match the teacher's distribution (or its top pick). Soft labels carry more information, so the student needs fewer examples to get close to its ceiling." accent={ACCENT} active={at(3)}>
                <Choices label="Labelled examples" accent={ACCENT} value={String(n)} onChange={(v) => setN(Number(v))} options={EXAMPLE_COUNTS.map((c) => ({ id: String(c), label: c.toLocaleString("en-US") }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">top pick</span>
                  <span className="text-right text-[var(--faint)]">distribution</span>
                  {EXAMPLE_COUNTS.map((c) => (
                    <Row key={c} n={c} hard={pct(accuracy(student, c, "hard", T))} soft={pct(accuracy(student, c, "soft", T))} bold={c === n} />
                  ))}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">labelling {n.toLocaleString("en-US")} examples with the teacher: about ${labelCost(n).toFixed(0)}</p>
              </FlowStep>
              <FlowArrow label="a trained student" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Serve the student" what="Nearly the teacher's quality at a fraction of the price and latency. Hosted LLMs are usually distilled from their outputs only (hard labels), because the logits aren't exposed; open-weight teachers allow the full distribution." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">accuracy</span>
                  <span className="text-right text-[var(--faint)]">$/M tokens</span>
                  <span className="text-right text-[var(--faint)]">tok/s</span>
                  <span className="font-sans">{TEACHER.label}</span>
                  <span className="text-right">{pct(TEACHER.accuracy)}</span>
                  <span className="text-right">${TEACHER.price}</span>
                  <span className="text-right">{TEACHER.tps}</span>
                  <span className="font-sans font-semibold">{student.label}</span>
                  <span className="text-right font-semibold">{pct(acc)}</span>
                  <span className="text-right font-semibold">${student.price}</span>
                  <span className="text-right font-semibold">{student.tps}</span>
                </div>
                <p className="mt-2 text-xs text-[var(--faint)]">The softmax and its temperature are real (Hinton et al. 2015). The accuracy curves are a teaching model.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ n, hard, soft, bold }: { n: number; hard: string; soft: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span style={{ fontWeight: w }}>{n.toLocaleString("en-US")}</span>
      <span className="text-right" style={{ fontWeight: w }}>
        {hard}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {soft}
      </span>
    </>
  );
}
