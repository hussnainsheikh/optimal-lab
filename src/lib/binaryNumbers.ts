// 8-bit integers (unsigned and two's complement) and 64-bit IEEE 754 doubles.
// The double's bits come from a DataView, and its exact decimal value is computed
// with BigInt, so nothing here is typed in by hand.

export const WIDTH = 8;
/** Place value of each bit, most significant first: 128, 64, … 1. */
export const PLACES = Array.from({ length: WIDTH }, (_, i) => 2 ** (WIDTH - 1 - i));

export const toBits = (u: number) => PLACES.map((p) => (Math.floor(u / p) % 2 === 1 ? 1 : 0));
export const unsigned = (bits: number[]) => bits.reduce((s, b, i) => s + b * PLACES[i], 0);
/** Two's complement: the top bit is worth −128 instead of +128. */
export const signed = (bits: number[]) => unsigned(bits) - (bits[0] ? 256 : 0);

/** Add k (±1) to an 8-bit register. Reports the carry out and signed overflow. */
export function add(u: number, k: number) {
  const raw = u + k;
  const result = ((raw % 256) + 256) % 256;
  const carry = raw > 255 || raw < 0; // unsigned wrap
  const before = signed(toBits(u));
  const after = signed(toBits(result));
  const overflow = before + k !== after; // signed wrap
  return { result, carry, overflow };
}

export type Double = {
  value: number;
  sign: number;
  exponentBits: string; // 11 bits
  mantissaBits: string; // 52 bits
  exponent: number; // unbiased
  hex: string;
  exact: string; // exact decimal value stored
};

export function double(x: number): Double {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const bits = hi.toString(2).padStart(32, "0") + lo.toString(2).padStart(32, "0");
  const rawExp = parseInt(bits.slice(1, 12), 2);
  return {
    value: x,
    sign: Number(bits[0]),
    exponentBits: bits.slice(1, 12),
    mantissaBits: bits.slice(12),
    exponent: rawExp === 0 ? -1022 : rawExp - 1023,
    hex: "0x" + hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0"),
    exact: exactDecimal(x),
  };
}

/** The exact decimal expansion of a finite double (every double is a finite binary fraction). */
export function exactDecimal(x: number): string {
  if (x === 0) return "0";
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(x));
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const rawExp = hi >>> 20;
  const two = BigInt(2);
  let mant = (BigInt(hi & 0xfffff) << BigInt(32)) | BigInt(lo);
  if (rawExp !== 0) mant += two ** BigInt(52);
  const e = (rawExp === 0 ? 1 : rawExp) - 1075; // value = mant × 2^e
  let out: string;
  if (e >= 0) out = (mant * two ** BigInt(e)).toString();
  else {
    const k = -e; // mant / 2^k = mant × 5^k / 10^k
    const digits = (mant * BigInt(5) ** BigInt(k)).toString().padStart(k + 1, "0");
    const int = digits.slice(0, digits.length - k);
    const frac = digits.slice(digits.length - k).replace(/0+$/, "");
    out = frac ? `${int}.${frac}` : int;
  }
  return x < 0 ? "-" + out : out;
}

export type FloatId = "0.1" | "0.2" | "0.3" | "sum" | "0.5" | "0.75";
export const FLOATS: { id: FloatId; label: string; value: number }[] = [
  { id: "0.1", label: "0.1", value: 0.1 },
  { id: "0.2", label: "0.2", value: 0.2 },
  { id: "0.3", label: "0.3", value: 0.3 },
  { id: "sum", label: "0.1 + 0.2", value: 0.1 + 0.2 },
  { id: "0.5", label: "0.5", value: 0.5 },
  { id: "0.75", label: "0.75", value: 0.75 },
];

/** 0.1 + 0.2 versus 0.3, both exactly. */
export function sumVersusPoint3() {
  const sum = 0.1 + 0.2;
  return {
    sum,
    shown: String(sum),
    equal: sum === 0.3,
    sumExact: exactDecimal(sum),
    point3Exact: exactDecimal(0.3),
    gap: sum - 0.3, // one step between neighbouring doubles here: 2^-54
  };
}
