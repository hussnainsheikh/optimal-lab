// Defences along the path from source to production, and the attacks each one stops.
export const DEFENSES = [
  { id: "lock", label: "Lockfile + pinned versions", stage: "Dependencies" },
  { id: "scan", label: "Dependency and image scanning", stage: "Dependencies" },
  { id: "ci", label: "Builds only in CI, with provenance", stage: "Build" },
  { id: "sign", label: "Sign images (cosign)", stage: "Artifact" },
  { id: "verify", label: "Cluster verifies signatures on deploy", stage: "Deploy" },
] as const;
export type Def = (typeof DEFENSES)[number]["id"];
export const ATTACKS = [
  { name: "Typosquatted package (reqeusts)", needs: [["scan"]] as Def[][], note: "Scanners and registries flag known-malicious packages." },
  { name: "Malicious new version of a real dependency", needs: [["lock"]] as Def[][], note: "Pinned versions mean a new release isn't pulled in silently." },
  { name: "Known CVE in a base image", needs: [["scan"]] as Def[][], note: "Image scanning finds published vulnerabilities before deploy." },
  { name: "Image built on a laptop and pushed", needs: [["ci", "verify"], ["sign", "verify"]] as Def[][], note: "Only CI holds signing keys; unsigned images are refused." },
  { name: "Image swapped in the registry", needs: [["sign", "verify"]] as Def[][], note: "The digest no longer matches a valid signature." },
];
export const caught = (on: Set<Def>, a: (typeof ATTACKS)[number]) => a.needs.some((combo) => combo.every((d) => on.has(d)));
