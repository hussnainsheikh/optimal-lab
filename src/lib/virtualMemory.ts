// Address translation with 4 KB pages, a 2-entry TLB and 3 physical frames.
export const PAGE = 4096;
export const ACCESSES = [0x1a2c, 0x1ff0, 0x3004, 0x0100, 0x1234, 0x5008, 0x3abc, 0x0200];
export type Frame = { addr: number; vpn: number; offset: number; tlbHit: boolean; fault: boolean; evicted?: number; frame: number; phys: number; table: Record<number, number>; tlb: number[]; text: string };

export function run(): Frame[] {
  const table: Record<number, number> = { 0: 2, 3: 0 };
  const frameOf: (number | null)[] = [3, null, 0];
  const order = [3, 0]; // load order, for FIFO eviction
  let tlb: number[] = [];
  return ACCESSES.map((addr) => {
    const vpn = Math.floor(addr / PAGE), offset = addr % PAGE;
    const tlbHit = tlb.includes(vpn);
    let fault = false, evicted: number | undefined;
    if (!(vpn in table)) {
      fault = true;
      let f = frameOf.indexOf(null);
      if (f < 0) { evicted = order.shift()!; f = table[evicted]; delete table[evicted]; tlb = tlb.filter((x) => x !== evicted); }
      table[vpn] = f; frameOf[f] = vpn; order.push(vpn);
    }
    if (!tlbHit) tlb = [vpn, ...tlb.filter((x) => x !== vpn)].slice(0, 2);
    const frame = table[vpn];
    const phys = frame * PAGE + offset;
    const hex = (n: number) => "0x" + n.toString(16).padStart(4, "0");
    const text = tlbHit ? `Page ${vpn} is in the TLB: translated without touching the page table.`
      : fault ? `Page ${vpn} isn't in memory: page fault. The OS loads it from disk into frame ${frame}${evicted !== undefined ? `, evicting page ${evicted}` : ""}. Slow: milliseconds.`
      : `TLB miss. Walk the page table: page ${vpn} → frame ${frame}. Cache it in the TLB.`;
    return { addr, vpn, offset, tlbHit, fault, evicted, frame, phys, table: { ...table }, tlb: [...tlb], text: `${hex(addr)} → ${hex(phys)}. ${text}` };
  });
}
