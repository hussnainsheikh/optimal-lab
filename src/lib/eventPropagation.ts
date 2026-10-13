// Clicking a button inside a card inside a page. Each element has a capture and a bubble listener.
export const PATH = ["page", "card", "button"];
export type Opt = "normal" | "stop" | "delegate";
export const OPTS: { id: Opt; label: string }[] = [
  { id: "normal", label: "All listeners" },
  { id: "stop", label: "card calls stopPropagation()" },
  { id: "delegate", label: "One delegated listener on page" },
];
export type Step = { el: string; phase: "capture" | "target" | "bubble"; ran: boolean; note?: string };
export function run(o: Opt): Step[] {
  if (o === "delegate") {
    return [
      { el: "page", phase: "capture", ran: false }, { el: "card", phase: "capture", ran: false }, { el: "button", phase: "target", ran: false },
      { el: "card", phase: "bubble", ran: false }, { el: "page", phase: "bubble", ran: true, note: "event.target.closest('button') → handle it here" },
    ];
  }
  const steps: Step[] = [
    { el: "page", phase: "capture", ran: true }, { el: "card", phase: "capture", ran: true }, { el: "button", phase: "target", ran: true },
    { el: "card", phase: "bubble", ran: true, note: o === "stop" ? "stopPropagation()" : undefined }, { el: "page", phase: "bubble", ran: o !== "stop" },
  ];
  return steps;
}
