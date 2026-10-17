// Four system calls, followed from the program down to the device and back.
// Syscall numbers are the x86-64 Linux ones (see man 2 syscall and the kernel's syscall table).

export type CallId = "write" | "open" | "missing" | "getpid";

export type Call = {
  id: CallId;
  label: string;
  code: string; // what the program writes
  libc: string; // what the C library turns it into
  name: string; // syscall name
  nr: number; // x86-64 syscall number, goes in rax
  args: { reg: string; value: string; means: string }[];
  check: string; // what the kernel checks
  device: string | null; // which device does the work, null when none
  work: string;
  ret: string; // value back in rax
  result: string; // what the program sees
  strace: string;
  ok: boolean;
};

export const CALLS: Call[] = [
  {
    id: "write", label: "Print a line", code: 'printf("hi\\n");', libc: 'write(1, "hi\\n", 3)', name: "write", nr: 1,
    args: [{ reg: "rdi", value: "1", means: "file descriptor 1 = standard output" }, { reg: "rsi", value: "0x5581a0", means: "address of the bytes" }, { reg: "rdx", value: "3", means: "how many bytes" }],
    check: "Is fd 1 open for writing in this process? Is the buffer address inside the process's memory?",
    device: "Terminal", work: "The kernel copies the 3 bytes out of the program's memory and hands them to the terminal driver.",
    ret: "3", result: "3 bytes written", strace: 'write(1, "hi\\n", 3) = 3', ok: true,
  },
  {
    id: "open", label: "Open a file", code: 'fd = open("notes.txt", O_RDONLY);', libc: 'openat(AT_FDCWD, "notes.txt", O_RDONLY)', name: "openat", nr: 257,
    args: [{ reg: "rdi", value: "-100", means: "AT_FDCWD: look in the current directory" }, { reg: "rsi", value: "0x7ffd10", means: "address of the file name" }, { reg: "rdx", value: "0", means: "O_RDONLY: read only" }],
    check: "Does notes.txt exist? May this user read it? Is there a free slot in the open-file table?",
    device: "Disk", work: "The file system reads the directory and the file's inode (from the page cache, or the disk if it isn't cached).",
    ret: "3", result: "fd = 3, the lowest free number (0, 1, 2 are already open)", strace: 'openat(AT_FDCWD, "notes.txt", O_RDONLY) = 3', ok: true,
  },
  {
    id: "missing", label: "Open a missing file", code: 'fd = open("missing.txt", O_RDONLY);', libc: 'openat(AT_FDCWD, "missing.txt", O_RDONLY)', name: "openat", nr: 257,
    args: [{ reg: "rdi", value: "-100", means: "AT_FDCWD: look in the current directory" }, { reg: "rsi", value: "0x7ffd10", means: "address of the file name" }, { reg: "rdx", value: "0", means: "O_RDONLY: read only" }],
    check: "Does missing.txt exist? The directory lookup finds no such name, so the kernel stops here.",
    device: null, work: "Nothing to do: the check already failed.",
    ret: "-2", result: "open() returns -1 and libc sets errno = ENOENT (2)", strace: 'openat(AT_FDCWD, "missing.txt", O_RDONLY) = -1 ENOENT (No such file or directory)', ok: false,
  },
  {
    id: "getpid", label: "Ask for my PID", code: "pid = getpid();", libc: "getpid()", name: "getpid", nr: 39,
    args: [],
    check: "Nothing to check: every process may ask for its own ID.",
    device: null, work: "No device: the kernel reads the number from its record of the current process.",
    ret: "4120", result: "pid = 4120", strace: "getpid() = 4120", ok: true,
  },
];

/** Rough cost of one trip into the kernel and back on a modern x86 CPU, in ns. */
export const SYSCALL_NS = 100;
export const TOTAL_BYTES = 10_000;
export const BUFFERS = [1, 64, 4096];

/** Printing 10,000 bytes with a libc buffer of `buffer` bytes: one write() per full buffer. */
export function buffering(buffer: number) {
  const calls = Math.ceil(TOTAL_BYTES / buffer);
  return { calls, overheadUs: (calls * SYSCALL_NS) / 1000 };
}
