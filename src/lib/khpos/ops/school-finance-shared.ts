export function financeDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  return ["year","month","day"].map(name=>parts.find(part=>part.type===name)?.value).join("-");
}

export function toKobo(text: string, signed = false) {
  const value = text.trim();
  const match = /^(-?)(\d{1,13})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || (!signed && match[1])) throw new Error("Enter a naira amount with up to two decimal places.");
  const kobo = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (kobo > BigInt("100000000000000") || (!signed && kobo === BigInt(0))) throw new Error("Enter an amount within the permitted range.");
  return (match[1] ? -kobo : kobo).toString();
}

export function currency(value: unknown) {
  const kobo = BigInt(typeof value === "bigint" || typeof value === "number" || typeof value === "string" ? value : 0);
  const abs = kobo < BigInt(0) ? -kobo : kobo;
  return (kobo < BigInt(0) ? "−" : "") + "₦" + new Intl.NumberFormat("en-NG").format(abs / BigInt(100)) + "." + (abs % BigInt(100)).toString().padStart(2, "0");
}

export function financeWarnings(summary: Record<string, unknown>) {
  const messages: string[] = [];
  const field = (key: string) => Number(summary[key] ?? 0);
  const due = field("due");
  const prior = summary.prior as Record<string, number> | null;
  if (!field("entries")) messages.push("There are no cash or bank transactions for these dates. Check that all records have been entered.");
  if (!due) messages.push("No current charges were due by the reporting date. A collection rate is unavailable.");
  if (due > 0) messages.push("The school has collected " + Math.round(100 * field("collected") / due) + "% of fees due for this period.");
  if (field("overdueLearners")) messages.push(field("overdueLearners") + " learner accounts have overdue balances.");
  if (field("unreconciled")) messages.push(field("unreconciled") + " cash or bank transactions still need reconciliation.");
  if (field("pending")) messages.push(field("pending") + " financial requests are waiting for School Custodian review.");
  if (field("potentialDuplicates")) messages.push("Review " + field("potentialDuplicates") + " groups of similar entries for possible duplicates.");
  if (field("payables")) messages.push(field("payables") + " school obligations are due within 14 days or already overdue.");
  if (field("upcoming")) messages.push(field("upcoming") + " unpaid invoices fall due within 14 days of the reporting date.");
  if (field("entries") > 0 && field("cash") <= 0) messages.push("Available cash and bank balances are zero or below.");
  for (const row of (summary.byBudget ?? []) as { spent: number; amount: number; category: string; department: string }[]) {
    const label = row.category + (row.department ? " · " + row.department : "");
    if (row.spent > row.amount) messages.push(label + " expenses are above budget.");
    else if (row.spent >= row.amount * 0.85) messages.push(label + " expenses have reached at least 85% of budget.");
  }
  if (prior?.reconciliationComplete && summary.reconciliationComplete) {
    if (due > 0 && prior.due > 0 && field("collected") / due + 0.1 <= prior.collected / prior.due) messages.push("The collection rate fell by at least 10 percentage points since the previous period.");
    if (prior.expenses > 0 && field("expenses") > prior.expenses * 1.25) messages.push("Expenses rose by more than 25% since the previous period.");
    if (field("overdue") > prior.overdue) messages.push("Overdue fees increased since the previous period.");
  }
  return messages;
}

export const financeCategories = {
  income: ["Admission and registration", "Uniforms and books", "Transportation", "Feeding", "School activities", "Grants and donations", "Other income"],
  expense: ["Staff salaries", "Rent", "Electricity and utilities", "Repairs and maintenance", "Teaching materials", "Facilities", "Transportation", "Technology", "Training", "Other operating costs"],
};

export const financeKinds: Record<string, string> = {
  payment: "Fee payment", income: "Other income", expense: "Expense", transfer: "Account transfer",
  credit: "Opening learner credit", openingDebt: "Opening fee balance", refund: "Fee refund",
  reverse: "Transaction reversal", discount: "Discount", scholarship: "Scholarship", waiver: "Fee waiver", apply: "Apply existing credit",
};
