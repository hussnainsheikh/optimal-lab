// The same 6-second AI answer presented four ways. What does the user see at time t?
export type Pattern = "spinner" | "steps" | "stream" | "optimistic";
export const PATTERNS: { id: Pattern; label: string }[] = [
  { id: "spinner", label: "Spinner" },
  { id: "steps", label: "Progress steps" },
  { id: "stream", label: "Skeleton + streaming" },
  { id: "optimistic", label: "Optimistic + background" },
];
export const DONE = 6;
export const ANSWER = "Your trip is booked: 3 nights in Lisbon, 12–15 May, hotel near the river. Total €540.";
export const STEPS = [{ at: 0.3, text: "Reading your request" }, { at: 1.5, text: "Searching 214 hotels" }, { at: 3.5, text: "Comparing prices" }, { at: 5.2, text: "Booking" }];
export function firstFeedback(p: Pattern) { return p === "spinner" ? DONE : p === "steps" ? 0.3 : p === "stream" ? 0.8 : 0.1; }
export function view(p: Pattern, t: number) {
  const done = t >= DONE;
  if (p === "spinner") return { kind: done ? "answer" : "spinner", text: done ? ANSWER : "", steps: [] as string[] };
  if (p === "steps") return { kind: done ? "answer" : "steps", text: done ? ANSWER : "", steps: STEPS.filter((s) => s.at <= t).map((s) => s.text) };
  if (p === "stream") {
    const words = ANSWER.split(" ");
    const n = t < 0.8 ? 0 : Math.min(words.length, Math.ceil(((t - 0.8) / (DONE - 0.8)) * words.length));
    return { kind: n ? "stream" : "skeleton", text: words.slice(0, n).join(" "), steps: [] };
  }
  return { kind: done ? "answer" : "optimistic", text: done ? ANSWER : "Booking Lisbon, 12–15 May… we'll notify you when it's confirmed.", steps: [] };
}
