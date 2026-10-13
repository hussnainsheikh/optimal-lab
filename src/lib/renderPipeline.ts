// The browser's rendering pipeline. After JavaScript changes something, the browser may need
// to recalculate styles, lay out boxes again, repaint pixels, and composite layers. Which
// stages run depends on what changed.

export const STAGES = ["JavaScript", "Style", "Layout", "Paint", "Composite"] as const;
export type Stage = (typeof STAGES)[number];

export const CHANGES: { id: string; label: string; code: string; runs: Stage[]; ms: number; note: string }[] = [
  { id: "width", label: "Change width", code: "el.style.width = '300px'", runs: ["JavaScript", "Style", "Layout", "Paint", "Composite"], ms: 9, note: "Size changes move other boxes, so layout runs for the whole affected area, then everything repaints." },
  { id: "top", label: "Change top (position)", code: "el.style.top = '40px'", runs: ["JavaScript", "Style", "Layout", "Paint", "Composite"], ms: 8, note: "Moving with top/left is a layout change too." },
  { id: "color", label: "Change color", code: "el.style.color = 'red'", runs: ["JavaScript", "Style", "Paint", "Composite"], ms: 4, note: "No geometry changed: layout is skipped, but pixels must be repainted." },
  { id: "transform", label: "Change transform", code: "el.style.transform = 'translateX(40px)'", runs: ["JavaScript", "Style", "Composite"], ms: 1, note: "On its own layer, a transform is applied by the compositor (often on the GPU). No layout, no paint: ideal for animation." },
  { id: "opacity", label: "Change opacity", code: "el.style.opacity = '0.5'", runs: ["JavaScript", "Style", "Composite"], ms: 1, note: "Like transform, opacity can be done by the compositor alone." },
  { id: "thrash", label: "Read then write in a loop", code: "for (el of items) el.style.width = el.offsetWidth + 10 + 'px'", runs: ["JavaScript", "Style", "Layout", "Paint", "Composite"], ms: 120, note: "Reading offsetWidth forces layout now; writing invalidates it; the next read forces it again. Layout thrashing: 100 elements, 100 layouts." },
];

export const FRAME_BUDGET = 16.7; // ms per frame at 60 fps
