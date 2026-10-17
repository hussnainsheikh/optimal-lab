// How a shell runs a command: fork, (redirect), exec, wait.

export type CmdId = "ls" | "redirect" | "background" | "typo";
export type Cmd = {
  id: CmdId;
  label: string;
  line: string; // what the user types
  program: string | null; // path exec loads, null when not found
  redirect: boolean;
  background: boolean;
  status: number; // exit status the shell sees ($?)
  output: string;
};

export const CMDS: Cmd[] = [
  { id: "ls", label: "ls", line: "ls", program: "/usr/bin/ls", redirect: false, background: false, status: 0, output: "notes.txt  photo.png" },
  { id: "redirect", label: "ls > out.txt", line: "ls > out.txt", program: "/usr/bin/ls", redirect: true, background: false, status: 0, output: "(nothing on screen: it went to out.txt)" },
  { id: "background", label: "sleep 5 &", line: "sleep 5 &", program: "/usr/bin/sleep", redirect: false, background: true, status: 0, output: "(sleep prints nothing; the shell later shows [1]+ Done)" },
  { id: "typo", label: "lss (typo)", line: "lss", program: null, redirect: false, background: false, status: 127, output: "lss: command not found" },
];

export const SHELL_PID = 4120;
export const CHILD_PID = 4121;
/** A shell's resident memory, in 4 KB pages (about 4 MB). */
export const SHELL_PAGES = 1000;
export const PAGE_KB = 4;

/** Copy-on-write: fork shares every page; a page is copied only when one side writes to it. */
export function cow(pagesWritten: number) {
  const copied = Math.min(SHELL_PAGES, pagesWritten);
  return { shared: SHELL_PAGES - copied, copied, copiedKb: copied * PAGE_KB, eagerKb: SHELL_PAGES * PAGE_KB };
}

/** The shell's code. `steps` lists the flow steps (0-based) that light the line up. */
export const CODE: { text: string; steps: number[]; when?: (c: Cmd) => boolean }[] = [
  { text: "pid = fork();", steps: [0] },
  { text: "if (pid == 0) {          // child", steps: [1, 2] },
  { text: '  fd = open("out.txt", O_WRONLY|O_CREAT);', steps: [1], when: (c) => c.redirect },
  { text: "  dup2(fd, 1);   // stdout = out.txt", steps: [1], when: (c) => c.redirect },
  { text: "  execvp(cmd, argv);", steps: [2] },
  { text: "  _exit(127);    // only runs if exec failed", steps: [2, 4], when: (c) => c.program === null },
  { text: "}", steps: [] },
  { text: "waitpid(pid, &status, 0);  // parent", steps: [3, 5], when: (c) => !c.background },
];
