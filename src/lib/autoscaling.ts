// Autoscaling a fleet against a traffic spike. Each instance serves 100 req/s and takes 3 minutes to boot.
export type Policy = "fixed" | "reactive" | "tuned";
export const POLICIES: { id: Policy; label: string }[] = [
  { id: "fixed", label: "Fixed 3 instances" },
  { id: "reactive", label: "Follow CPU every minute" },
  { id: "tuned", label: "Target 70%, cooldown, warm-up" },
];
export const CAP = 100;
const BOOT = 3;
const NOISE = [40, -30, 55, -45, 20, -50, 35, -20, 60, -40];
export const load = (m: number) => Math.max(60, (m >= 20 && m < 38 ? 650 : 180) + NOISE[m % NOISE.length]);

export function simulate(p: Policy) {
  let ready = 3;
  const booting: number[] = [];
  let lowFor = 0;
  let events = 0;
  const minutes = Array.from({ length: 60 }, (_, m) => {
    for (let i = booting.length - 1; i >= 0; i--) if (--booting[i] <= 0) { booting.splice(i, 1); ready++; }
    const l = load(m);
    const served = Math.min(l, ready * CAP);
    if (p !== "fixed") {
      const target = p === "tuned" ? 0.7 : 1;
      const desired = Math.max(p === "tuned" ? 2 : 1, Math.ceil(l / (CAP * target)));
      const have = ready + booting.length;
      if (desired > have) { for (let i = 0; i < desired - have; i++) booting.push(BOOT); events++; lowFor = 0; }
      else if (desired < ready) {
        lowFor++;
        if (p === "reactive" || lowFor >= 5) { ready = desired; events++; lowFor = 0; }
      } else lowFor = 0;
    }
    return { m, load: l, ready, booting: booting.length, dropped: l - served };
  });
  const dropped = minutes.reduce((a, x) => a + x.dropped, 0) * 60;
  const cost = minutes.reduce((a, x) => a + x.ready + x.booting, 0);
  return { minutes, dropped, cost, events };
}
