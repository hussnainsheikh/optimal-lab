// AI regulation, taken from the EU AI Act as the European Commission describes it on
// its "Regulatory framework for AI" page, checked on 18 October 2026. The Act sorts AI
// systems into four risk levels by what they are used for, and puts separate duties on
// providers of general-purpose models. Dates reflect the AI Omnibus amendments of 2026.
// This is a teaching summary, not legal advice; the page links to the official text.

export const CHECKED = "18 October 2026";

export type Tier = "prohibited" | "high" | "transparency" | "minimal";

export const TIERS: Record<Tier, { label: string; color: string; from: string; what: string }> = {
  prohibited: { label: "Unacceptable risk: banned", color: "var(--bad)", from: "2 February 2025 (the ninth practice from December 2026)", what: "The practice may not be put on the EU market or used there at all." },
  high: {
    label: "High risk",
    color: "var(--c4)",
    from: "2 December 2027 for the listed use cases (Annex III); 2 August 2028 for AI inside regulated products (Annex I)",
    what: "Allowed, with obligations before it goes on the market and while it is in use.",
  },
  transparency: { label: "Transparency risk", color: "var(--c3)", from: "August 2026", what: "Allowed, but people must be told they are dealing with AI, and generated content must be identifiable." },
  minimal: { label: "Minimal or no risk", color: "var(--good)", from: "no new rules", what: "The Act adds no obligations. Most AI systems in use are here." },
};

export const DUTIES: Record<Tier, string[]> = {
  prohibited: ["Do not build it, sell it or use it in the EU."],
  high: [
    "A risk assessment and mitigation system",
    "High-quality datasets, to limit discriminatory outcomes",
    "Logging of activity, so results can be traced",
    "Detailed documentation for the authorities",
    "Clear information to the deployer",
    "Appropriate human oversight",
    "Robustness, cybersecurity and accuracy",
    "After launch: post-market monitoring and reporting of serious incidents",
  ],
  transparency: ["Tell people when they are interacting with a machine (chatbots)", "Make AI-generated content identifiable", "Label deepfakes, and AI text published to inform the public, clearly and visibly"],
  minimal: ["None from the AI Act. Other law (GDPR, consumer protection, product safety) still applies."],
};

export type UseCase = { id: string; label: string; tier: Tier; why: string };

export const USE_CASES: UseCase[] = [
  { id: "social", label: "Score citizens' trustworthiness from their behaviour", tier: "prohibited", why: "Social scoring is one of the nine prohibited practices." },
  { id: "emotion", label: "Detect employees' emotions from their webcam", tier: "prohibited", why: "Emotion recognition in workplaces and schools is prohibited." },
  { id: "scrape", label: "Build a face database by scraping the web", tier: "prohibited", why: "Untargeted scraping of faces to build recognition databases is prohibited." },
  { id: "hiring", label: "Rank job applicants' CVs", tier: "high", why: "Employment and access to self-employment are listed high-risk areas (Annex III)." },
  { id: "credit", label: "Decide who gets a loan", tier: "high", why: "Access to essential private services, such as credit scoring, is a listed high-risk area." },
  { id: "exam", label: "Grade exams that decide admission", tier: "high", why: "Education, where the system can determine access to it, is a listed high-risk area." },
  { id: "surgery", label: "Guide a surgical robot", tier: "high", why: "A safety component of a regulated product (Annex I): the product rules and the AI Act both apply." },
  { id: "visa", label: "Examine visa applications automatically", tier: "high", why: "Migration, asylum and border control are listed high-risk areas." },
  { id: "chatbot", label: "Answer customer-support questions", tier: "transparency", why: "People must be told they are talking to a machine. Nothing more, unless it also decides on credit, jobs or similar." },
  { id: "deepfake", label: "Generate realistic images and video of people", tier: "transparency", why: "Deepfakes must be labelled clearly and visibly; generated content must be identifiable." },
  { id: "news", label: "Write news articles for the public", tier: "transparency", why: "AI text published to inform the public on matters of public interest must be labelled." },
  { id: "spam", label: "Filter spam", tier: "minimal", why: "The Commission's own example of minimal risk." },
  { id: "game", label: "Drive characters in a video game", tier: "minimal", why: "The Commission's own example of minimal risk." },
  { id: "code", label: "Autocomplete code for developers", tier: "minimal", why: "Not in any listed area; no new duties." },
];

export type Role = "provider" | "deployer";
export const ROLES: { id: Role; label: string; what: string }[] = [
  { id: "provider", label: "We build it", what: "The provider puts the system on the market and carries most of the high-risk duties: risk management, data, documentation, conformity." },
  { id: "deployer", label: "We use someone's system", what: "The deployer uses it under its own authority: human oversight, using it as intended, monitoring, and informing people affected." },
];

export const GPAI = {
  from: "2 August 2025",
  duties: ["Technical documentation for the authorities and for downstream providers", "A policy to respect EU copyright law", "A public summary of the training data"],
  systemic: ["For the most capable models (systemic risk): assess and mitigate those risks, report serious incidents, and ensure cybersecurity"],
};

export const classify = (id: string) => USE_CASES.find((u) => u.id === id)!;

// Which duties fall on this role for this tier. Deployers of high-risk systems carry
// the use-side duties; providers carry the build-side ones.
export function dutiesFor(tier: Tier, role: Role): string[] {
  if (tier !== "high") return DUTIES[tier];
  return role === "provider" ? DUTIES.high : ["Use it as the provider's instructions say", "Assign human oversight to trained people", "Keep the logs it produces", "Monitor it and report serious incidents", "Inform the people affected by its decisions"];
}
