import type { PortfolioSystemBand } from "@/lib/khpos/benchmarking";

const systemLabels: Record<string, string> = {
  identity_direction: "Identity & Direction",
  learning_mastery: "Learning & Mastery",
  capability_development: "Capability Development",
  value_creation_application: "Value Creation & Application",
  human_development_ecosystem: "Human Development Ecosystem",
  institutional_excellence: "Institutional Excellence",
  intelligence_continuous_improvement: "Intelligence & Continuous Improvement",
};
const scale = ["Critical Gap", "Weak", "Partial", "Strong", "Excellent"];
const validScore = (score: number) => Number.isFinite(score) && score >= 1 && score <= 5;
const scoreText = (score: number) => validScore(score) ? score.toFixed(2) : "—";
function interpretation(score: number) {
  if (!validScore(score)) return "No valid middle score recorded.";
  if (Number.isInteger(score)) return `${scale[score - 1]} (${score}/5) on the KSHC scale.`;
  const lower = Math.floor(score);
  return `Between ${scale[lower - 1]} (${lower}) and ${scale[lower]} (${lower + 1}) on the KSHC scale.`;
}
function nextStep(score: number) {
  if (!validScore(score)) return "Confirm completed assessments before planning support.";
  if (score < 3) return "Review the underlying indicators with each School Custodian. Agree the basic practices that need establishing first.";
  if (score < 4) return "Check where practice is inconsistent. Agree one focused improvement with each School Custodian and a date to review evidence.";
  return "Verify the strong practices in each school. Document what works, share a reusable example across the network and check that it is sustained.";
}

export function PortfolioSystemHealth({systems}: {systems: PortfolioSystemBand[]}) {
  const recorded = systems.filter(system => system.institutionCount > 0 && validScore(system.median));
  const focus = [...recorded].sort((a,b) => a.median - b.median).slice(0,2);
  return <section aria-labelledby="portfolio-system-health" className="space-y-5">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Network school health</p><h2 id="portfolio-system-health" className="mt-2 text-2xl font-black">How schools are doing across the seven systems</h2><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">Each system summarises the latest completed assessment for each contributing institution. Higher scores indicate stronger assessed practice. Schools without completed scores do not contribute.</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="font-bold">Scoring scale: 1 to 5</h3><ol className="mt-3 grid gap-2 text-sm sm:grid-cols-5">{scale.map((label,i)=><li key={label} className="rounded-xl bg-slate-100 p-3"><strong>{i+1}</strong> · {label}</li>)}</ol><p className="mt-3 text-xs leading-5 text-slate-600">Decimal scores sit between these reference levels. A network middle score does not mean every school is at that level.</p></div>
    {recorded.some(system => system.institutionCount < 5) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Small sample · early signals.</strong> Some systems have fewer than five contributing institutions. With only a few schools, one assessment can move these figures substantially. Use each school’s evidence to decide support; these figures are not a reliable basis for ranking schools.</div>}
    {focus.length>0 && <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 sm:p-5"><h3 className="font-bold text-brand-950">Where should KAEC review first?</h3><p className="mt-2 text-sm leading-6 text-brand-950">Start the support discussion with {focus.map(system=>systemLabels[system.systemId] ?? system.systemId).join(" and ")}. These have the lowest recorded middle scores in this view; that is a starting point for review, not a finding that every school is weak.</p><p className="mt-2 text-sm leading-6 text-brand-900"><strong>Owner:</strong> Authorised KAEC administration, working with each School Custodian. Agree an action, an accountable school leader, completion evidence and a review date. Verify results at reassessment, then reuse practices that work across the network.</p><a href="#portfolio-institutions" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-bold text-brand-800">Review schools and their priorities</a></div>}
    {systems.length===0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No completed system scores are available yet. Complete the existing KSHC assessment to establish a baseline.</p>}
    <div className="grid gap-4 lg:grid-cols-2">{systems.map(system=><article key={system.systemId} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 font-black">{systemLabels[system.systemId] ?? system.systemId}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{system.institutionCount} {system.institutionCount===1 ? "school" : "schools"} assessed</span></div>
      <div className="mt-4 rounded-2xl bg-brand-50 p-4"><p className="text-sm font-bold text-brand-800">Middle score across schools <span className="font-normal">(median)</span></p><p className="mt-1 text-3xl font-black text-brand-950">{scoreText(system.median)}<span className="text-base font-semibold text-brand-700"> / 5</span></p><p className="mt-2 text-sm leading-6 text-brand-900">{system.institutionCount>0 ? interpretation(system.median) : "No completed assessment scores recorded."}</p></div>
      <dl className="mt-3 grid gap-3 min-[360px]:grid-cols-2"><div className="min-w-0 rounded-2xl bg-slate-100 p-4"><dt className="text-xs font-bold text-slate-600">Lower-quarter point (P25)</dt><dd className="mt-1 text-xl font-black">{scoreText(system.p25)} <span className="text-sm font-normal">/ 5</span></dd></div><div className="min-w-0 rounded-2xl bg-slate-100 p-4"><dt className="text-xs font-bold text-slate-600">Upper-quarter point (P75)</dt><dd className="mt-1 text-xl font-black">{scoreText(system.p75)} <span className="text-sm font-normal">/ 5</span></dd></div></dl>
      <details className="mt-3 rounded-xl border border-slate-200 p-3 text-sm"><summary className="min-h-8 cursor-pointer font-semibold text-slate-700">What do these figures mean?</summary><div className="mt-2 space-y-2 leading-6 text-slate-600"><p><strong>Middle score:</strong> Order the school scores from lowest to highest. The median is the middle value; with an even number of schools, it is halfway between the two middle scores.</p><p><strong>Quarter points:</strong> P25 and P75 mark the 25% and 75% positions in that ordered set. The calculation can place these points between two recorded scores. They are not the lowest and highest school scores.</p><p>These figures describe participating schools only. They do not establish national performance or show improvement over time.</p></div></details>
      <div className="mt-4 border-t border-slate-200 pt-3"><h4 className="text-sm font-bold">Suggested next step</h4><p className="mt-1 text-sm leading-6 text-slate-600">{system.institutionCount>0 ? nextStep(system.median) : "Confirm completed assessments before planning support."}</p><p className="mt-2 text-xs leading-5 text-slate-500">Guidance for discussion; confirm the school-level diagnosis before assigning action.</p></div>
    </article>)}</div>
  </section>;
}
