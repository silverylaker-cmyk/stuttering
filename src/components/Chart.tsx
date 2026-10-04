import { diffDays, formatKDate, type DateStr } from '../lib/date';

export interface Series {
  label: string;
  color: string;
  points: { date: DateStr; value: number | null }[];
  /** 점만 찍기 (주간 데이터 등) */
  dots?: boolean;
  dashed?: boolean;
}

interface Props {
  series: Series[];
  from: DateStr;
  to: DateStr;
  yMin?: number;
  yMax?: number;
  /** 기준선 (예: %SS 1%) */
  refLine?: { value: number; label: string };
  height?: number;
  yTicks?: number[];
  ariaLabel: string;
}

const W = 340;
const PAD = { l: 28, r: 8, t: 10, b: 20 };

export function LineChart({ series, from, to, yMin, yMax, refLine, height = 160, yTicks, ariaLabel }: Props) {
  const values = series.flatMap((s) => s.points.map((p) => p.value).filter((v): v is number => v != null));
  const lo = yMin ?? Math.min(0, ...values);
  const hi = yMax ?? Math.max(1, ...values, refLine?.value ?? 0) * 1.1;
  const days = Math.max(1, diffDays(from, to));
  const x = (d: DateStr) => PAD.l + (diffDays(from, d) / days) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (height - PAD.t - PAD.b);
  const ticks = yTicks ?? niceTicks(lo, hi);
  const xLabels = [from, to];
  if (days > 20) xLabels.splice(1, 0, addMid(from, days));

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {refLine && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--danger)" strokeDasharray="4 3" strokeWidth={1} />
            <text x={W - PAD.r} y={y(refLine.value) - 3} textAnchor="end" style={{ fill: 'var(--danger)' }}>
              {refLine.label}
            </text>
          </g>
        )}
        {xLabels.map((d, i) => (
          <text key={d} x={x(d)} y={height - 4} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>
            {formatKDate(d)}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.points.filter((p) => p.value != null && p.date >= from && p.date <= to);
          const segs: string[] = [];
          let cur = '';
          // 값이 없는 날은 선을 끊는다
          for (const p of s.points) {
            if (p.date < from || p.date > to) continue;
            if (p.value == null) {
              if (cur) segs.push(cur);
              cur = '';
            } else cur += `${cur ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`;
          }
          if (cur) segs.push(cur);
          return (
            <g key={s.label}>
              {!s.dots &&
                segs.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '4 3' : undefined} strokeLinejoin="round" strokeLinecap="round" />
                ))}
              {(s.dots || pts.length < 15) &&
                pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value!)} r={s.dots ? 3.5 : 2.5} fill={s.color} />)}
              {s.dots && pts.length > 1 && (
                <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date)},${y(p.value!)}`).join('')} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.6} />
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <figcaption className="legend">
          {series.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

function addMid(from: DateStr, days: number): DateStr {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days / 2));
  return d.toISOString().slice(0, 10);
}

function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  const step = span <= 5 ? 1 : span <= 12 ? 2 : span <= 30 ? 5 : span <= 60 ? 10 : 50;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** 홈용 미니 막대 그래프 (최근 7일 SR) */
export function MiniBars({ points, max, ariaLabel }: { points: { date: DateStr; value: number | null }[]; max: number; ariaLabel: string }) {
  const W2 = 280;
  const H = 72;
  const bw = W2 / points.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W2} ${H + 16}`} role="img" aria-label={ariaLabel}>
      {points.map((p, i) => {
        const h = p.value == null ? 0 : (p.value / max) * H;
        return (
          <g key={p.date}>
            {p.value == null ? (
              <rect x={i * bw + bw * 0.2} y={H - 2} width={bw * 0.6} height={2} fill="var(--line)" />
            ) : (
              <rect x={i * bw + bw * 0.2} y={H - h} width={bw * 0.6} height={h} rx={4} fill="var(--chart-1)" />
            )}
            {p.value != null && (
              <text x={i * bw + bw / 2} y={H - h - 3} textAnchor="middle">
                {p.value}
              </text>
            )}
            <text x={i * bw + bw / 2} y={H + 13} textAnchor="middle">
              {'월화수목금토일'[(new Date(`${p.date}T00:00:00Z`).getUTCDay() + 6) % 7]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
