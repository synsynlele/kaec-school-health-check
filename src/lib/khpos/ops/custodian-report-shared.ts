import { z } from "zod";

const money = z.number().int().nonnegative().max(1_000_000_000_000_000);
const note = z.string().trim().min(10).max(5000);
export const custodianReportDataSchema = z.object({
  feeIncome: money,
  otherIncome: money,
  operatingExpenses: money,
  cashAvailable: money,
  outstandingFees: money,
  learnerCount: z.number().int().nonnegative().max(1000000),
  schoolCapacity: z.number().int().nonnegative().max(1000000),
  operationalHighlights: note,
  learningHighlights: note,
  managementRisks: note,
  nextTermPriorities: note,
  financialSourceNotes: note,
}).strict();
export type CustodianReportData = z.infer<typeof custodianReportDataSchema>;
export type CustodianReport = {
  id: string;
  school_id: string;
  term_label: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved";
  data: CustodianReportData;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};
export const saveCustodianReportSchema = z.object({
  mode: z.literal("save"),
  id: z.string().uuid().optional(),
  termLabel: z.string().trim().min(4).max(120),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  data: custodianReportDataSchema,
}).strict().refine(v => v.periodStart <= v.periodEnd, { message: "The reporting end date must not precede the start date." });
export const approveCustodianReportSchema = z.object({
  mode: z.literal("approve"),
  id: z.string().uuid(),
}).strict();

export function custodianReportTotals(data: CustodianReportData) {
  const income = data.feeIncome + data.otherIncome;
  const operatingResult = income - data.operatingExpenses;
  const occupancy = data.schoolCapacity > 0 ? Math.round(data.learnerCount / data.schoolCapacity * 1000) / 10 : null;
  return { income, operatingResult, occupancy };
}
