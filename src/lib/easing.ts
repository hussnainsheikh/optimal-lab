// Easing curves as cubic-bezier control points, and sampled positions.
export const EASINGS = [
  { id: "linear", css: "linear", p: [0, 0, 1, 1] },
  { id: "ease", css: "ease", p: [0.25, 0.1, 0.25, 1] },
  { id: "ease-in", css: "ease-in", p: [0.42, 0, 1, 1] },
  { id: "ease-out", css: "ease-out", p: [0, 0, 0.58, 1] },
  { id: "spring-ish", css: "cubic-bezier(0.34, 1.56, 0.64, 1)", p: [0.34, 1.56, 0.64, 1] },
];
const bez = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
export function curve(p: number[]) { return Array.from({ length: 41 }, (_, i) => { const t = i / 40; return { x: bez(t, p[0], p[2]), y: bez(t, p[1], p[3]) }; }); }
export const PROPS = [
  { id: "transform", label: "transform: translateX()", stages: ["composite"], note: "Handled by the compositor on the GPU. Smooth even if the main thread is busy." },
  { id: "left", label: "left", stages: ["layout", "paint", "composite"], note: "Changes layout every frame: the browser recalculates geometry and repaints 60 times a second." },
  { id: "width", label: "width", stages: ["layout", "paint", "composite"], note: "Also layout: and it can push surrounding content around." },
];
