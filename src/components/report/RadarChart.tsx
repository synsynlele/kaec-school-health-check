import { ratingFor } from "@/lib/scoring";

interface RadarDatum {
  label: string;
  value: number; // 0–100
}

export function RadarChart({ data }: { data: RadarDatum[] }) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const R = 108;
  const n = data.length;
  const angleOf = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, radius: number): [number, number] => [
    cx + radius * Math.cos(angleOf(i)),
    cy + radius * Math.sin(angleOf(i)),
  ];

  const polygon = (frac: number) =>
    data
      .map((_, i) => point(i, R * frac).map((v) => v.toFixed(1)).join(","))
      .join(" ");

  const valuePolygon = data
    .map((d, i) => point(i, R * (d.value / 100)).map((v) => v.toFixed(1)).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[360px]" role="img" aria-label="Radar chart of department scores">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={polygon(f)} fill="none" stroke="#e2e8f0" strokeWidth={f === 1 ? 1.4 : 1} />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      <polygon points={valuePolygon} fill="rgba(15,79,216,0.14)" stroke="#0f4fd8" strokeWidth="2.4" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = point(i, R * (d.value / 100));
        return <circle key={d.label} cx={x} cy={y} r="3.4" fill={ratingFor(d.value).hex} stroke="#fff" strokeWidth="1.4" />;
      })}
      {data.map((d, i) => {
        const [x, y] = point(i, R + 24);
        const angle = angleOf(i);
        const anchor = Math.abs(Math.cos(angle)) < 0.3 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        return (
          <text
            key={`${d.label}-label`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="10.5"
            fontWeight={600}
            fill="#64748b"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
