// A scripted ReAct trace: thought, action, observation until a final answer.
export type Step = { kind: "question" | "thought" | "action" | "observation" | "answer"; text: string; tool?: string };
export const QUESTION = "What's the temperature right now, in °F, in the city where the Eiffel Tower is?";

export const REACT: Step[] = [
  { kind: "question", text: QUESTION },
  { kind: "thought", text: "I need the city first, then its weather, then convert to Fahrenheit." },
  { kind: "action", tool: "search", text: 'search("Eiffel Tower location")' },
  { kind: "observation", text: "The Eiffel Tower is in Paris, France." },
  { kind: "thought", text: "The city is Paris. Now get the current weather there." },
  { kind: "action", tool: "weather", text: 'weather("Paris")' },
  { kind: "observation", text: "Paris: 18 °C, light cloud." },
  { kind: "thought", text: "Convert 18 °C to °F. Use the calculator instead of guessing." },
  { kind: "action", tool: "calculator", text: "calculator(18 * 9 / 5 + 32)" },
  { kind: "observation", text: "64.4" },
  { kind: "answer", text: "It's about 64 °F (18 °C) in Paris right now." },
];

export const DIRECT: Step[] = [
  { kind: "question", text: QUESTION },
  { kind: "answer", text: "It's about 72 °F in Paris right now." },
];

export const TOOLS = ["search", "weather", "calculator"];
