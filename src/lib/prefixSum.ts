// Range sums in O(1) after one O(n) pass.
export const NUMS = [3, -1, 4, 1, 5, -9, 2, 6, 5, 3];
export const PREFIX = NUMS.reduce<number[]>((p, x) => [...p, p[p.length - 1] + x], [0]);
export const rangeSum = (l: number, r: number) => PREFIX[r + 1] - PREFIX[l];
