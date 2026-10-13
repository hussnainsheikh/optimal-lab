// Route incoming support emails with an LLM classifier. Free text vs a fixed set of labels.
export const QUEUES = ["billing", "bug", "sales", "other"] as const;
export const EMAILS = [
  { subject: "Charged twice this month", free: "Billing issue", enum: "billing" },
  { subject: "Export button does nothing", free: "bug", enum: "bug" },
  { subject: "Pricing for 200 seats?", free: "Sales / pricing inquiry", enum: "sales" },
  { subject: "Invoice shows wrong VAT number", free: "billing", enum: "billing" },
  { subject: "App crashes on login (iOS)", free: "Technical problem - Bug", enum: "bug" },
  { subject: "Love the product!", free: "Feedback", enum: "other" },
  { subject: "Can I get a refund?", free: "Refund request", enum: "billing" },
  { subject: "Partnership idea", free: "sales", enum: "sales" },
];
export type Mode = "free" | "enum";
export function route(mode: Mode) {
  return EMAILS.map((e) => {
    const label = mode === "free" ? e.free : e.enum;
    const queue = (QUEUES as readonly string[]).includes(label) ? label : null;
    return { ...e, label, queue, correct: queue === e.enum };
  });
}
