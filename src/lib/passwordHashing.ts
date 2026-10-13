// Storing passwords, and what an attacker can do after stealing the table. Hashes shown are
// illustrative. Guess rates are rough single-GPU figures, to show orders of magnitude.

export type Storage = "plain" | "sha256" | "salted" | "bcrypt";

export const STORAGES: { id: Storage; label: string; perSecond: number; note: string }[] = [
  { id: "plain", label: "Plain text", perSecond: Infinity, note: "The attacker just reads them." },
  { id: "sha256", label: "SHA-256", perSecond: 1e10, note: "Fast hash: about 10 billion guesses a second on one GPU. Same password, same hash." },
  { id: "salted", label: "SHA-256 + salt", perSecond: 1e10, note: "A random salt per user: identical passwords look different and precomputed tables are useless. Still fast to guess." },
  { id: "bcrypt", label: "bcrypt (cost 12)", perSecond: 2e3, note: "Deliberately slow and salted: thousands of guesses a second instead of billions." },
];

export const PASSWORDS = [
  { id: "common", label: "password1", space: 1e4, note: "In every leaked-password list" },
  { id: "lower8", label: "8 random lowercase letters", space: 26 ** 8, note: "26⁸ ≈ 2×10¹¹ options" },
  { id: "mixed12", label: "12 random letters and digits", space: 62 ** 12, note: "62¹² ≈ 3×10²¹ options" },
];

export const USERS = [
  { user: "alice", password: "password1", salt: "9f2c", sha: "0b14d5…e1f7", salted: "7c41a9…02bd", bcrypt: "$2b$12$9f2c…Qx1" },
  { user: "bob", password: "password1", salt: "a71e", sha: "0b14d5…e1f7", salted: "e5d830…9a4c", bcrypt: "$2b$12$a71e…Lm8" },
  { user: "carol", password: "tr0ub4dor", salt: "3b90", sha: "5f2e88…41c0", salted: "11ad6f…c7e2", bcrypt: "$2b$12$3b90…Vp3" },
];

export function crackSeconds(storage: Storage, space: number) {
  const s = STORAGES.find((x) => x.id === storage)!;
  return s.perSecond === Infinity ? 0 : space / s.perSecond;
}

export function human(seconds: number) {
  if (seconds === 0) return "instantly";
  if (seconds < 1) return "under a second";
  const units: [number, string][] = [[31536000, "years"], [86400, "days"], [3600, "hours"], [60, "minutes"], [1, "seconds"]];
  for (const [u, name] of units) if (seconds >= u) {
    const v = seconds / u;
    if (name === "years" && v > 1e6) return `${v.toExponential(0).replace("e+", "×10^")} years`;
    return `${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()} ${name}`;
  }
  return "seconds";
}
