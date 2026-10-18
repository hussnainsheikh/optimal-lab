// A voice agent: you speak, it waits for you to finish, transcribes, thinks, and talks back.
// Word error rate (WER) is computed for real: the word-level edit distance between what
// was said and the transcript, divided by the number of words said. The transcripts
// themselves are written to show typical errors, and the latencies are typical figures
// for each stage, not one vendor's measurements.

export const SAID = "Restart the PgBouncer pool on staging and page Priya if checkout errors pass two percent";

export type NoiseId = "quiet" | "cafe" | "street";
export const NOISES: { id: NoiseId; label: string }[] = [
  { id: "quiet", label: "Quiet room" },
  { id: "cafe", label: "Busy café" },
  { id: "street", label: "Phone call on a street" },
];

// What the recognizer wrote, without and with a list of expected words (names, products).
const HEARD: Record<NoiseId, { plain: string; hinted: string }> = {
  quiet: {
    plain: "Restart the pg bouncer pool on staging and page Pria if checkout errors pass two percent",
    hinted: "Restart the PgBouncer pool on staging and page Priya if checkout errors pass two percent",
  },
  cafe: {
    plain: "Restart the pig bouncer pool on staging and page Maria if check out errors past two percent",
    hinted: "Restart the PgBouncer pool on staging and page Priya if check out errors past two percent",
  },
  street: {
    plain: "Restart a big bouncer pool on stage and page Maria if checkout errors past to",
    hinted: "Restart the PgBouncer pool on stage and page Priya if checkout errors past to",
  },
};

export const heard = (noise: NoiseId, hints: boolean) => (hints ? HEARD[noise].hinted : HEARD[noise].plain);

export const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

export type Edit = { op: "ok" | "sub" | "del" | "ins"; said?: string; got?: string };

// Levenshtein over words, with the alignment, so each error can be shown.
export function align(ref: string, hyp: string): Edit[] {
  const a = words(ref);
  const b = words(hyp);
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const out: Edit[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      out.unshift(a[i - 1] === b[j - 1] ? { op: "ok", said: a[i - 1], got: b[j - 1] } : { op: "sub", said: a[i - 1], got: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      out.unshift({ op: "del", said: a[i - 1] });
      i--;
    } else {
      out.unshift({ op: "ins", got: b[j - 1] });
      j--;
    }
  }
  return out;
}

export function wer(ref: string, hyp: string) {
  const edits = align(ref, hyp);
  const errors = edits.filter((e) => e.op !== "ok").length;
  return { edits, errors, n: words(ref).length, rate: errors / words(ref).length };
}

// The latency budget for one reply, in milliseconds.
export const SILENCE_CHOICES = [300, 600, 1000];
// Share of turns where a pause mid-sentence is taken for the end, and the agent talks over you.
export const CUT_OFF: Record<number, number> = { 300: 0.18, 600: 0.06, 1000: 0.02 };

export const STT_STREAMING = 150; // final words after you stop, when audio is transcribed as it arrives
export const STT_BATCH = 500; // transcribing the whole recording after you stop
export const LLM_FIRST_TOKEN = 450;
export const LLM_FULL = 1800; // the whole reply, about 100 tokens
export const TTS_FIRST_AUDIO = 200; // first sentence synthesized
export const TTS_FULL = 700; // the whole reply synthesized before playing

export type Budget = { silence: number; stt: number; llm: number; tts: number; total: number };

export function budget(silence: number, streamingStt: boolean, streamingReply: boolean): Budget {
  const stt = streamingStt ? STT_STREAMING : STT_BATCH;
  const llm = streamingReply ? LLM_FIRST_TOKEN : LLM_FULL;
  const tts = streamingReply ? TTS_FIRST_AUDIO : TTS_FULL;
  return { silence, stt, llm, tts, total: silence + stt + llm + tts };
}

// People usually start replying within about 200 ms of the other person finishing
// (Stivers et al. 2009, across ten languages).
export const HUMAN_GAP = 200;

export const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${x} ms`);
