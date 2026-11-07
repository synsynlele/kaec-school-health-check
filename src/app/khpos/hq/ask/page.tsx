import type { Metadata } from "next";
import Link from "next/link";
import { TrainingAcademy } from "@/components/khpos/ops/TrainingAcademy";
export const metadata:Metadata={title:"Ask KHP-OS | KAEC HQ Training",robots:{index:false,follow:false}};
export default function HqTrainingPage(){
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
  <div className="mx-auto max-w-6xl space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">KAEC HQ • Ask KHP-OS</p>
      <h1 className="mt-1 text-3xl font-black">Training Academy</h1>
      <p className="mt-2 text-sm text-slate-600">One learning centre for HQ, school leaders and staff.</p></div>
    <Link href="/khpos/hq" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">Back to KAEC HQ</Link>
   </div>
   <TrainingAcademy/>
  </div>
 </main>;
}
