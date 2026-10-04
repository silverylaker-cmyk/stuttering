import { useState } from 'react';
import { useApp } from '../app-context';
import { LineChart } from '../components/Chart';
import { Card, Chips, Stat, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { addDays, dateRange, type DateStr } from '../lib/date';
import { adherence, countedSessions, probesByWeek, srSeries } from '../lib/logic';

const RANGES = [
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
  { value: 'all', label: '전체' },
];

export function HistoryPage() {
  const { data, today, status } = useApp();
  const [range, setRange] = useState('30');
  const from: DateStr = range === 'all' ? data.profile.startDate : addDays(today, -(Number(range) - 1));
  return (
    <>
      <TopBar title="기록" />
      <div className="page">
        <Chips options={RANGES} value={range} onChange={(v) => setRange(v as string)} />
        <Trends from={from} to={today} baselineSr={status.baseline.sr} />
      </div>
    </>
  );
}

/** 기록 화면과 외래 리포트에서 함께 쓰는 추세 그래프 묶음 */
export function Trends({ from, to, baselineSr, compact }: { from: DateStr; to: DateStr; baselineSr: number | null; compact?: boolean }) {
  const { data } = useApp();
  const sr = srSeries(data.dailyLog, from, to);
  const srVals = sr.map((p) => p.value).filter((v): v is number => v != null);
  const probes = probesByWeek(data.recording).filter((p) => p.date >= from && p.date <= to);
  const others = data.recording.filter((r) => r.kind !== 'probe' && r.kind !== 'dafTest' && r.date >= from && r.date <= to);
  const perDay = new Map<DateStr, number>();
  for (const s of countedSessions(data.trainingSession)) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.durationSec / 60);
  const minutes = dateRange(from, to).map((d) => ({ date: d, value: perDay.has(d) ? Math.round(perDay.get(d)!) : 0 }));
  const adh = adherence({ from, to }, data.trainingSession);
  const surveys = [...data.survey].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <Card title="일일 SR">
        <div className="stats">
          <Stat label="기간 평균" value={srVals.length ? (srVals.reduce((a, b) => a + b, 0) / srVals.length).toFixed(1) : '–'} />
          <Stat label="기저" value={baselineSr ?? '–'} />
          <Stat label="기록 일수" value={`${srVals.length}일`} />
        </div>
        <LineChart
          ariaLabel="일일 SR 추세"
          from={from}
          to={to}
          yMin={PROGRAM.sr.min}
          yMax={PROGRAM.sr.max}
          yTicks={[1, 4, 7, 10]}
          series={[{ label: 'SR', color: 'var(--chart-1)', points: sr }]}
          refLine={baselineSr != null ? { value: baselineSr, label: `기저 ${baselineSr}` } : undefined}
        />
      </Card>

      <Card title="주간 평가 녹음" tone={compact ? undefined : 'primary'}>
        <LineChart
          ariaLabel="주간 평가 %SS 추세"
          from={from}
          to={to}
          yMin={0}
          series={[
            { label: '주간 평가 %SS', color: 'var(--chart-1)', points: probes.map((p) => ({ date: p.date, value: p.pctSS })).reverse(), dots: true },
            { label: '기타 녹음 %SS', color: 'var(--chart-2)', points: others.map((p) => ({ date: p.date, value: p.pctSS })), dots: true, dashed: true },
          ]}
          refLine={{ value: PROGRAM.promotion.phase1.pctSSMax, label: `${PROGRAM.promotion.phase1.pctSSMax}%` }}
        />
        <LineChart
          ariaLabel="주간 평가 SPM·NAT"
          from={from}
          to={to}
          yMin={0}
          height={130}
          series={[{ label: '주간 평가 SPM', color: 'var(--chart-3)', points: probes.map((p) => ({ date: p.date, value: p.spm })).reverse(), dots: true }]}
        />
        <LineChart
          ariaLabel="주간 평가 NAT"
          from={from}
          to={to}
          yMin={PROGRAM.nat.min}
          yMax={PROGRAM.nat.max}
          yTicks={[1, 3, 5, 7, 9]}
          height={110}
          series={[{ label: '주간 평가 NAT', color: 'var(--chart-2)', points: probes.map((p) => ({ date: p.date, value: p.nat })).reverse(), dots: true }]}
          refLine={{ value: PROGRAM.promotion.phase2.natMax, label: `NAT ${PROGRAM.promotion.phase2.natMax}` }}
        />
        <p className="small muted" style={{ margin: 0 }}>
          위: %SS · 가운데: SPM · 아래: NAT (1 = 매우 자연스러움)
        </p>
      </Card>

      <Card title="훈련">
        <div className="stats">
          <Stat label="순응도" value={`${adh.pct}%`} sub={`${adh.activeDays}/${adh.totalDays}일`} />
          <Stat label="하루 평균" value={`${Math.round(adh.avgSecPerDay / 60)}분`} />
        </div>
        <LineChart ariaLabel="일별 훈련 시간(분)" from={from} to={to} yMin={0} height={120} series={[{ label: '훈련(분)', color: 'var(--chart-1)', points: minutes }]} />
      </Card>

      {surveys.length > 0 && (
        <Card title="4주 설문">
          <LineChart
            ariaLabel="설문 추세"
            from={surveys[0].date < from ? surveys[0].date : from}
            to={to}
            yMin={0}
            yMax={40}
            yTicks={[0, 10, 20, 30, 40]}
            height={130}
            series={[
              { label: '회피 소계', color: 'var(--chart-1)', points: surveys.map((s) => ({ date: s.date, value: s.avoidanceSum })), dots: true },
              { label: '정서 소계', color: 'var(--chart-2)', points: surveys.map((s) => ({ date: s.date, value: s.emotionSum })), dots: true },
            ]}
          />
          {surveys.length > 1 && (
            <p className="small" style={{ margin: 0 }}>
              기저 대비 회피 {pctChange(surveys[0].avoidanceSum, surveys.at(-1)!.avoidanceSum)}, 정서 {pctChange(surveys[0].emotionSum, surveys.at(-1)!.emotionSum)}, 총점{' '}
              {pctChange(surveys[0].total, surveys.at(-1)!.total)}
            </p>
          )}
        </Card>
      )}
    </>
  );
}

export function pctChange(base: number, now: number): string {
  if (!base) return `${base}→${now}`;
  const c = Math.round(((now - base) / base) * 100);
  return `${base}→${now} (${c > 0 ? '+' : ''}${c}%)`;
}
