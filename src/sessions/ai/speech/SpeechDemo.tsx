"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CUT_OFF, HUMAN_GAP, NOISES, SAID, SILENCE_CHOICES, budget, heard, ms, wer, type NoiseId } from "@/lib/speech";

const ACCENT = "var(--ai)";
const SEG = [
  { key: "silence", label: "waiting for silence", color: "var(--ghost)" },
  { key: "stt", label: "speech to text", color: "var(--c1)" },
  { key: "llm", label: "LLM", color: "var(--ai)" },
  { key: "tts", label: "text to speech", color: "var(--c4)" },
] as const;

export default function SpeechDemo() {
  const [silence, setSilence] = useState(600);
  const [noise, setNoise] = useState<NoiseId>("cafe");
  const [hints, setHints] = useState(false);
  const [streamStt, setStreamStt] = useState(false);
  const [streamReply, setStreamReply] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const hyp = heard(noise, hints);
  const w = wer(SAID, hyp);
  const b = budget(silence, streamStt, streamReply);
  const at = (i: number) => stage === i;
  const scale = 4200;

  const path = ["user", "vad", "stt", "llm", "tts", "user"];
  const labels = ["audio", "audio", "text", "reply", "voice"];
  const packets: Packet[] = stage === null ? [] : hops(`s${stage}`, [path[stage], path[stage + 1]], { label: labels[stage], tone: stage === 4 ? (b.total <= 1500 ? "good" : "bad") : "accent" });

  const captions = [
    `Step 1: you stop talking. The agent waits ${ms(silence)} of silence to be sure you've finished.`,
    `Step 2: the transcript has ${w.errors} ${w.errors === 1 ? "error" : "errors"} in ${w.n} words (${Math.round(w.rate * 100)}% WER).`,
    `Step 3: the LLM ${streamReply ? "starts its reply" : "writes its whole reply"} in ${ms(b.llm)}.`,
    `Step 4: the voice ${streamReply ? "starts on the first sentence" : "is made for the whole reply"} in ${ms(b.tts)}.`,
    `Step 5: ${ms(b.total)} from the end of your sentence to the first sound back. People reply in about ${HUMAN_GAP} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : `${ms(b.total)} until you hear a reply, and the agent heard “${hyp}”.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Speech to text and text to speech"
        blurb="A voice agent chains three models: speech to text, an LLM, and text to speech. Every stage adds delay, and the first stage can mishear names and numbers. Talk to it in a quiet room and a busy café, and get the reply time from four seconds down to about one."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="Your voice goes through end-of-turn detection, speech to text, an LLM and text to speech, and back to you"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "user", label: "You", sub: stage === 4 ? "hear the reply" : "speak", at: [50, 84], mobileAt: [20, 88], state: stage === 0 || stage === 4 ? "active" : "idle" },
                  { id: "vad", label: "End of turn", sub: `${ms(silence)} silence`, at: [13, 26], mobileAt: [20, 14], state: stage === 0 ? "active" : "idle" },
                  { id: "stt", label: "Speech to text", sub: `${Math.round(w.rate * 100)}% WER`, at: [38, 26], mobileAt: [80, 14], state: stage === 1 ? (w.rate > 0.2 ? "bad" : "active") : "idle" },
                  { id: "llm", label: "LLM", sub: ms(b.llm), at: [63, 26], mobileAt: [80, 52], state: stage === 2 ? "active" : "idle" },
                  { id: "tts", label: "Text to speech", sub: ms(b.tts), at: [87, 26], mobileAt: [45, 56], state: stage === 3 ? "active" : "idle" },
                ]}
                links={[
                  { from: "user", to: "vad", label: "audio" },
                  { from: "vad", to: "stt", label: "audio" },
                  { from: "stt", to: "llm", label: "text" },
                  { from: "llm", to: "tts", label: "reply" },
                  { from: "tts", to: "user", label: "voice" },
                ]}
                packets={packets}
                aspect={2.3}
                mobileAspect={1.05}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Time from the end of your sentence to the first sound of the reply">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">until you hear a reply</p>
                  <p className="font-mono text-sm" style={{ color: b.total <= 1500 ? "var(--good)" : "var(--bad)" }}>
                    {ms(b.total)}
                  </p>
                </div>
                <div className="relative mt-2 flex h-6 overflow-hidden rounded bg-[var(--track)]">
                  {SEG.map((s) => (
                    <span key={s.key} className="h-full transition-[width] duration-300" style={{ width: `${(b[s.key] / scale) * 100}%`, background: s.color }} title={`${s.label}: ${ms(b[s.key])}`} />
                  ))}
                  <span className="absolute inset-y-0 border-r-2 border-dashed border-[var(--good)]" style={{ left: `${(HUMAN_GAP / scale) * 100}%` }} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  {SEG.map((s) => (
                    <li key={s.key} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      {s.label} {ms(b[s.key])}
                    </li>
                  ))}
                  <li style={{ color: "var(--good)" }}>┊ a person: ~{HUMAN_GAP} ms</li>
                </ul>
                <p className="mt-4 text-sm leading-relaxed">
                  {w.edits.map((e, k) =>
                    e.op === "ok" ? (
                      <span key={k}>{e.got} </span>
                    ) : e.op === "del" ? (
                      <span key={k} className="line-through" style={{ color: "var(--bad)" }}>
                        {e.said}{" "}
                      </span>
                    ) : (
                      <span key={k} className="rounded px-0.5" style={{ background: "color-mix(in srgb, var(--bad) 22%, transparent)" }} title={e.said ? `said: ${e.said}` : "extra word"}>
                        {e.got}{" "}
                      </span>
                    ),
                  )}
                </p>
                <p className="mt-1 text-[11px] text-[var(--faint)]">Marked: misheard or extra words. Struck through: words it missed.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Listening…">
                Say it
              </RunButton>
              <p className="w-full text-xs text-[var(--muted)]">You say: “{SAID}”</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Detect the end of your turn" what="A voice-activity detector waits for a stretch of silence. Too short and it talks over you when you pause to think; too long and every reply feels slow." accent={ACCENT} active={at(0)}>
                <Choices label="Silence before replying" accent={ACCENT} value={String(silence)} onChange={(v) => setSilence(Number(v))} options={SILENCE_CHOICES.map((s) => ({ id: String(s), label: ms(s) }))} />
                <p className="mt-2 font-mono text-xs">cuts you off on ~{Math.round(CUT_OFF[silence] * 100)}% of turns</p>
              </FlowStep>
              <FlowArrow label="your audio" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Transcribe it" what="Speech-to-text turns audio into words. Noise, names and product terms cause most errors. Word error rate counts substitutions, missing and extra words against what was said." accent={ACCENT} active={at(1)}>
                <Choices label="Where you are" accent={ACCENT} value={noise} onChange={setNoise} options={NOISES} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Give it a list of names and terms
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={streamStt} onChange={(e) => setStreamStt(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Transcribe while you speak
                </label>
                <p className="font-mono text-xs">
                  WER = {w.errors} / {w.n} = {Math.round(w.rate * 100)}% · {ms(b.stt)} after you stop
                </p>
              </FlowStep>
              <FlowArrow label="text" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Think of a reply" what="The LLM reads the transcript. If you wait for its whole answer before speaking, the user waits too. Stream it: hand each finished sentence to the voice as soon as it's written." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={streamReply} onChange={(e) => setStreamReply(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Stream the reply, sentence by sentence
                </label>
                <p className="font-mono text-xs">{streamReply ? `first sentence ready in ${ms(b.llm)}` : `whole reply in ${ms(b.llm)}`}</p>
              </FlowStep>
              <FlowArrow label="reply text" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Speak it" what="Text-to-speech turns the reply into audio. A streaming voice starts playing the first sentence while the rest is still being made." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-sm">{ms(b.tts)} to the first sound</p>
              </FlowStep>
              <FlowArrow label="voice, back to you" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Add it up" what="What the user feels is the gap between finishing a sentence and hearing a reply. People in conversation usually leave about 200 ms. Speech-to-speech models skip the text hops altogether." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-sm">
                  {ms(b.silence)} + {ms(b.stt)} + {ms(b.llm)} + {ms(b.tts)} = {ms(b.total)}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">Stage times are typical figures, not one vendor&rsquo;s. The ~200 ms human gap is from Stivers et al. (2009), across ten languages.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
