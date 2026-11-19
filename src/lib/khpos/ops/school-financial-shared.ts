import { z } from "zod";
const amount = z.number().int().nonnegative().max(1_000_000_000_000_000);
const count = z.number().int().nonnegative().max(1_000_000);
export const financialInputSchema=z.object({
  periodStart:z.iso.date(),periodEnd:z.iso.date(),
  feeIncome:amount,otherIncome:amount,operatingExpenses:amount,
  cashAvailable:amount,outstandingFees:amount,
  learnerCount:count,schoolCapacity:count,
  breakEvenTarget:count.nullable(),
  sourceNote:z.string().trim().min(10).max(2500),
  managementNote:z.string().trim().max(3000),
}).strict().refine(v=>v.periodStart<=v.periodEnd,{message:"The period end must be on or after the start date."});
export type FinancialInput=z.infer<typeof financialInputSchema>;
export type FinancialPeriod= {
  id:string;school_id:string;period_start:string;period_end:string;
  fee_income:number;other_income:number;operating_expenses:number;
  cash_available:number;outstanding_fees:number;
  learner_count:number;school_capacity:number;break_even_target:number|null;
  source_note:string;management_note:string;
  status:"draft"|"submitted"|"returned"|"approved";
  review_note:string;created_by:string;updated_by:string;approved_by:string|null;
  approved_at:string|null;created_at:string;updated_at:string;
};
export type FinancialSummary = {
  complete:boolean;periodStart:string;periodEnd:string;periods:number;
  approvedIds:string[];missing:string[];
  feeIncome:number;otherIncome:number;operatingExpenses:number;
  cashAvailable:number|null;outstandingFees:number|null;
  learnerCount:number|null;schoolCapacity:number|null;breakEvenTarget:number|null;
  income:number;operatingResult:number;operatingMargin:number|null;
};
export const moneyFormat=(v:number)=>"₦"+new Intl.NumberFormat("en-NG",{maximumFractionDigits:0}).format(v);
export function deriveFinancialHealth(
  periods:FinancialPeriod[],start:string,end:string,
):FinancialSummary{
  const eligible=periods.filter(p=>p.status==="approved"&&p.period_start>=start&&p.period_end<=end)
    .sort((a,b)=>a.period_start.localeCompare(b.period_start));
  let cursor=start;
  const missing:string[]=[];
  const nextDay=(day:string)=>new Date(Date.parse(day+"T00:00:00Z")+86400000).toISOString().slice(0,10);
  const beforeDay=(day:string)=>new Date(Date.parse(day+"T00:00:00Z")-86400000).toISOString().slice(0,10);
  for(const p of eligible){
    if(p.period_start>cursor)missing.push(cursor+" to "+beforeDay(p.period_start));
    if(p.period_start<cursor)missing.push("Overlapping period starting "+p.period_start);
    if(p.period_end>=cursor)cursor=nextDay(p.period_end);
  }
  if(cursor<=end)missing.push(cursor+" to "+end);
  const last=eligible[eligible.length-1];
  const feeIncome=eligible.reduce((total,p)=>total+p.fee_income,0);
  const otherIncome=eligible.reduce((total,p)=>total+p.other_income,0);
  const operatingExpenses=eligible.reduce((total,p)=>total+p.operating_expenses,0);
  const income=feeIncome+otherIncome;
  const operatingResult=income-operatingExpenses;
  return {
    complete:missing.length===0 && eligible.length>0,
    periodStart:start,periodEnd:end,periods:eligible.length,
    approvedIds:eligible.map(p=>p.id),missing,
    feeIncome,otherIncome,operatingExpenses,
    cashAvailable:last?.cash_available??null,
    outstandingFees:last?.outstanding_fees??null,
    learnerCount:last?.learner_count??null,schoolCapacity:last?.school_capacity??null,
    breakEvenTarget:last?.break_even_target??null,
    income,operatingResult,operatingMargin:income>0?Math.round(1000*operatingResult/income)/10:null,
  };
}
