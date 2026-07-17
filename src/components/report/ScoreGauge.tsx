import { ratingFor } from "@/lib/scoring";

export function ScoreGauge({ score, size = 176 }: { score: number; size?: number }) {
  const rating = ratingFor(score);
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" role="img" aria-label={`Overall health score ${score} out of 100, rated ${rating.label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6eaf2" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={rating.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, score)) / 100)}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="block text-5xl font-extrabold tracking-tight text-slate-900">{score}</span>
        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">out of 100</span>
        <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: rating.hex, background: `${rating.hex}1a` }}>
          {rating.label}
        </span>
      </div>
    </div>
  );
}
