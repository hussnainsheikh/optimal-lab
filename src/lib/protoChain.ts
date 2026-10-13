// Looking up properties on rex, walking up the prototype chain.
export const CHAIN = [
  { name: "rex (own properties)", props: ["name", "age"] },
  { name: "Dog.prototype", props: ["bark", "constructor"] },
  { name: "Animal.prototype", props: ["speak", "eat"] },
  { name: "Object.prototype", props: ["toString", "hasOwnProperty"] },
];
export const LOOKUPS = ["name", "bark", "speak", "toString", "fly"];
export function lookup(prop: string) {
  const visited: number[] = [];
  for (let i = 0; i < CHAIN.length; i++) { visited.push(i); if (CHAIN[i].props.includes(prop)) return { visited, foundAt: i }; }
  return { visited, foundAt: -1 };
}
