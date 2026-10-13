// A 1.2 s computation, on the main thread or in a Web Worker, while an animation runs at 60 fps.
export const TASK_START = 400, TASK_MS = 1200, SPAN = 2000, FRAME = 1000 / 60;
export function frames(worker: boolean) {
  const n = Math.floor(SPAN / FRAME);
  return Array.from({ length: n }, (_, i) => {
    const t = i * FRAME;
    const blocked = !worker && t >= TASK_START && t < TASK_START + TASK_MS;
    return { t, dropped: blocked };
  });
}
