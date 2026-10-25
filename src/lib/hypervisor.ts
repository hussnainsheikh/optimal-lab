// Where a virtual machine loses time. With hardware virtualization (Intel VT-x, AMD-V) the
// guest's ordinary instructions run directly on the CPU. Privileged operations and device I/O
// cause a VM exit: the CPU saves the guest, jumps to the hypervisor (KVM), which handles it and
// re-enters the guest. How many exits an I/O costs depends on the device model:
// - emulated hardware (an e1000 NIC, IDE disk): the guest pokes device registers, each poke
//   exits, and a user-space emulator (QEMU) acts it out;
// - virtio: a paravirtual device; the guest batches requests in a shared ring and exits once
//   per batch to notify ("kick");
// - passthrough (SR-IOV, VFIO): the guest drives real hardware directly; no exits for I/O.
// Memory: with nested paging (EPT/NPT) a TLB miss walks the guest's page table, and every
// guest table entry is itself a guest-physical address that needs the host's table:
// (guest levels + 1) × (host levels + 1) − 1 memory reads instead of 4.
// Exit and emulation costs are illustrative orders of magnitude; the walk formula is exact.

export type Device = "emulated" | "virtio" | "passthrough";
export const DEVICES: Device[] = ["emulated", "virtio", "passthrough"];
export const DEVICE: Record<Device, { label: string; exitsPerIo: number; usPerExit: number; note: string }> = {
  emulated: { label: "Emulated device", exitsPerIo: 6, usPerExit: 12, note: "each register access traps; QEMU emulates the hardware in user space" },
  virtio: { label: "virtio", exitsPerIo: 1 / 16, usPerExit: 2, note: "requests batched in a shared ring; one notify per batch" },
  passthrough: { label: "Passthrough (SR-IOV)", exitsPerIo: 0, usPerExit: 0, note: "the guest talks to a slice of the real device" },
};

export type Workload = "compute" | "web" | "storage";
export const WORKLOADS: Workload[] = ["compute", "web", "storage"];
export const WORKLOAD: Record<Workload, { label: string; ioPerSec: number; otherExits: number; tlbMissPerSec: number; blurb: string }> = {
  compute: { label: "Number crunching", ioPerSec: 50, otherExits: 2_000, tlbMissPerSec: 2_000_000, blurb: "A batch job: all CPU and memory, almost no I/O." },
  web: { label: "Web server", ioPerSec: 60_000, otherExits: 20_000, tlbMissPerSec: 5_000_000, blurb: "Tens of thousands of packets a second, plus timers and interrupts." },
  storage: { label: "Database", ioPerSec: 25_000, otherExits: 10_000, tlbMissPerSec: 8_000_000, blurb: "Random disk reads and writes, and a big working set in memory." },
};

export const NS_PER_MEMREF = 0.5; // a page-walk read mostly hits the CPU caches
export const SWITCH_US = 0.5; // the exit and re-entry themselves, before any handling

export const walkRefs = (guestLevels: number, hostLevels: number) => (guestLevels + 1) * (hostLevels + 1) - 1;

export function overhead(w: Workload, d: Device, hugePages: boolean) {
  const W = WORKLOAD[w], D = DEVICE[d];
  const ioExits = W.ioPerSec * D.exitsPerIo;
  const exits = ioExits + W.otherExits;
  const exitUs = ioExits * (SWITCH_US + D.usPerExit) + W.otherExits * SWITCH_US * 2;
  const levels = hugePages ? 3 : 4; // 2 MB pages skip the last level
  const native = levels;
  const nested = walkRefs(levels, levels);
  const extraWalkUs = (W.tlbMissPerSec * (nested - native) * NS_PER_MEMREF) / 1000;
  const totalUs = exitUs + extraWalkUs;
  return { exits, ioExits, exitShare: exitUs / 1e6, walkShare: extraWalkUs / 1e6, share: totalUs / 1e6, native, nested };
}
