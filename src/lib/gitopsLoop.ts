// A GitOps controller keeps the cluster matching Git.
export type Frame = { git: number; cluster: number; text: string; actor: "dev" | "controller" | "human" | "none"; synced: boolean };
export function frames(selfHeal: boolean): Frame[] {
  const out: Frame[] = [];
  let git = 3, cl = 3;
  const snap = (actor: Frame["actor"], text: string) => out.push({ git, cluster: cl, text, actor, synced: git === cl });
  snap("none", "Git says replicas: 3, and the cluster runs 3. In sync.");
  git = 5; snap("dev", "A developer merges a pull request changing replicas to 5. Reviewed, recorded, revertable.");
  snap("controller", "The controller (Argo CD, Flux) notices the repo changed and diffs it against the cluster: out of sync.");
  cl = 5; snap("controller", "It applies the change. The cluster now runs 5. Nobody ran kubectl or held cluster credentials.");
  cl = 10; snap("human", "During an incident, someone runs kubectl scale --replicas=10 by hand.");
  if (selfHeal) { snap("controller", "The controller sees the cluster drifted from Git…"); cl = 5; snap("controller", "…and puts it back to 5. To change it for real, change Git."); }
  else { snap("controller", "Self-heal is off: the controller reports OutOfSync but leaves it. Git no longer describes reality."); }
  return out;
}
