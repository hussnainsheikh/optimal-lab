// What `this` is depends on how a function is called, not where it was written.
export type Case = "method" | "detached" | "callback" | "arrow" | "bind";
export const CASES: { id: Case; label: string; code: string[]; result: string; ok: boolean; why: string }[] = [
  { id: "method", label: "obj.greet()", code: ["const user = {", '  name: "Ada",', "  greet() { return `Hi ${this.name}`; },", "};", "user.greet();"], result: '"Hi Ada"', ok: true, why: "Called as user.greet(), so this is the object before the dot: user." },
  { id: "detached", label: "const f = obj.greet; f()", code: ["const greet = user.greet;", "greet();"], result: "TypeError: Cannot read properties of undefined (reading 'name')", ok: false, why: "Called as a plain function, with nothing before the dot. In strict mode and modules, this is undefined." },
  { id: "callback", label: "setTimeout(obj.greet)", code: ["setTimeout(user.greet, 0);", "button.addEventListener(\"click\", user.greet);"], result: '"Hi undefined" (or the button)', ok: false, why: "Passing user.greet hands over just the function. Whoever calls it later decides this: the timer gives undefined, an event listener gives the element." },
  { id: "arrow", label: "arrow function", code: ["setTimeout(() => user.greet(), 0);"], result: '"Hi Ada"', ok: true, why: "The arrow function calls user.greet() itself, so the dot is back. Arrow functions also have no this of their own; they use the surrounding one." },
  { id: "bind", label: "obj.greet.bind(obj)", code: ["const greet = user.greet.bind(user);", "setTimeout(greet, 0);"], result: '"Hi Ada"', ok: true, why: "bind returns a new function with this permanently set to user, however it's called later." },
];
