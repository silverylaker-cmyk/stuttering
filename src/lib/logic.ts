/**
 * 판정 로직. 순수 함수만 두고 Vitest로 경계값을 검증한다.
 * 모든 임상 수치는 config/program.ts 에서 가져온다.
 */
import { PROGRAM, type PhaseId } from '../config/program';
import type {
  Calibration,
  DafTest,
  DailyLog,
  ExposureAttempt,
  ExposureItem,
  Recording,
  Survey,
  ThoughtRecord,
  TrainingSession,
} from '../db/types';
import { addDays, dateRange, diffDays, weekKey, weekStart, type DateStr } from './date';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

// ───────────────────────── 기본 계산 ─────────────────────────

export function pctSS(stutters: number, syllables: number): number {
  if (syllables <= 0) return 0;
  return round((stutters / syllables) * 100);
}

export function spm(syllables: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return round((syllables / durationSec) * 60, 1);
}

// ───────────────────────── 순응도 ─────────────────────────

/** 일일 훈련 집계에서 제외하는 유형 (DAF는 상황 보조 도구) */
export const EXCLUDED_FROM_TRAINING: TrainingSession['type'][] = ['daf'];

export function countedSessions(sessions: TrainingSession[]): TrainingSession[] {
  return sessions.filter((s) => !EXCLUDED_FROM_TRAINING.includes(s.type));
}

export interface AdherenceResult {
  pct: number;
  activeDays: number;
  totalDays: number;
  avgSecPerDay: number;
}

/** 훈련 순응도(%) = 훈련 기록이 있는 날 ÷ 기간 일수 */
export function adherence(period: { from: DateStr; to: DateStr }, sessions: TrainingSession[]): AdherenceResult {
  const totalDays = Math.max(0, diffDays(period.from, period.to) + 1);
  if (totalDays === 0) return { pct: 0, activeDays: 0, totalDays: 0, avgSecPerDay: 0 };
  const inRange = countedSessions(sessions).filter((s) => s.date >= period.from && s.date <= period.to);
  const days = new Set(inRange.map((s) => s.date));
  const totalSec = inRange.reduce((a, s) => a + s.durationSec, 0);
  return {
    pct: round((days.size / totalDays) * 100, 1),
    activeDays: days.size,
    totalDays,
    avgSecPerDay: round(totalSec / totalDays, 0),
  };
}

// ───────────────────────── 스트릭 ─────────────────────────

/** 스트릭으로 인정되는 날: 훈련 합계 ≥ 최소 시간 또는 주간 평가 녹음 */
export function streakActiveDays(sessions: TrainingSession[], probeDates: DateStr[]): Set<DateStr> {
  const perDay = new Map<DateStr, number>();
  for (const s of countedSessions(sessions)) perDay.set(s.date, (perDay.get(s.date) ?? 0) + s.durationSec);
  const active = new Set<DateStr>(probeDates);
  for (const [d, sec] of perDay) if (sec >= PROGRAM.streak.minSessionSec) active.add(d);
  return active;
}

export interface StreakResult {
  days: number;
  todayDone: boolean;
  restDays: DateStr[];
}

/**
 * 연속 훈련 일수. 하루 누락은 ISO 주(월–일)당 1회까지 "휴식일"로 인정한다.
 * 오늘 아직 훈련하지 않았으면 오늘은 판정에서 빼고 어제부터 센다.
 */
export function streak(input: { sessions: TrainingSession[]; probeDates: DateStr[]; today: DateStr }): StreakResult {
  const active = streakActiveDays(input.sessions, input.probeDates);
  const todayDone = active.has(input.today);
  if (active.size === 0) return { days: 0, todayDone, restDays: [] };
  const earliest = [...active].sort()[0];
  const restUsed = new Map<string, number>();
  const restDays: DateStr[] = [];
  let pending: DateStr[] = [];
  let days = 0;
  let d = todayDone ? input.today : addDays(input.today, -1);
  while (d >= earliest) {
    if (active.has(d)) {
      days++;
      restDays.push(...pending);
      pending = [];
    } else {
      const wk = weekKey(d);
      const used = restUsed.get(wk) ?? 0;
      if (used >= PROGRAM.streak.restDaysPerWeek) break;
      restUsed.set(wk, used + 1);
      pending.push(d);
    }
    d = addDays(d, -1);
  }
  return { days, todayDone, restDays };
}

// ───────────────────────── 보정 ─────────────────────────

export interface CalibrationDiff {
  recordingId: number;
  srDiff: number;
  natDiff: number;
  ok: boolean;
}

export interface CalibrationResult {
  pass: boolean;
  rated: number;
  diffs: CalibrationDiff[];
}

/** 원장이 평가한 최근 N건이 모두 |SR 차이| ≤ 2, |NAT 차이| ≤ 2 이면 통과 */
export function calibrationPass(cals: Calibration[]): CalibrationResult {
  const { count, srDiffMax, natDiffMax } = PROGRAM.calibration;
  const rated = cals
    .filter((c) => c.clinicianSR != null && c.clinicianNAT != null)
    .sort((a, b) => (a.ratedAt ?? '').localeCompare(b.ratedAt ?? '') || (a.id ?? 0) - (b.id ?? 0));
  const diffs = rated.map((c) => {
    const srDiff = Math.abs(c.patientSR - (c.clinicianSR as number));
    const natDiff = Math.abs(c.patientNAT - (c.clinicianNAT as number));
    return { recordingId: c.recordingId, srDiff, natDiff, ok: srDiff <= srDiffMax && natDiff <= natDiffMax };
  });
  const recent = diffs.slice(-count);
  return { pass: recent.length >= count && recent.every((d) => d.ok), rated: rated.length, diffs };
}

// ───────────────────────── 주간 평가 녹음 ─────────────────────────

/** weekKey 당 1건만 남긴 probe 목록 (가장 최근 주 → 과거 순) */
export function probesByWeek(recordings: Recording[]): Recording[] {
  const map = new Map<string, Recording>();
  for (const r of recordings) {
    if (r.kind !== 'probe') continue;
    const wk = r.weekKey ?? weekKey(r.date);
    const prev = map.get(wk);
    if (!prev || (r.id ?? 0) > (prev.id ?? 0)) map.set(wk, r);
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** 가장 최근 주부터 조건을 만족하며 빈 주 없이 이어지는 주 수 */
export function consecutiveProbeWeeks(probes: Recording[], ok: (r: Recording) => boolean): number {
  const list = probesByWeek(probes);
  let n = 0;
  let prevWeek: DateStr | null = null;
  for (const p of list) {
    const ws = weekStart(p.date);
    if (prevWeek && diffDays(ws, prevWeek) !== 7) break;
    if (!ok(p)) break;
    n++;
    prevWeek = ws;
  }
  return n;
}

// ───────────────────────── 승급 제안 ─────────────────────────

export interface PromotionInput {
  phase: PhaseId;
  phaseStart: DateStr;
  today: DateStr;
  recordings: Recording[];
  dailyLogs: DailyLog[];
  exposureItems: ExposureItem[];
  exposureAttempts: ExposureAttempt[];
  calibrations: Calibration[];
}

export interface Criterion {
  label: string;
  met: boolean;
  detail: string;
}

export interface PromotionResult {
  suggested: boolean;
  criteria: Criterion[];
}

export function promotionSuggested(input: PromotionInput): PromotionResult {
  const { phase, phaseStart, today } = input;
  const inPhase = <T extends { date: DateStr }>(xs: T[]) => xs.filter((x) => x.date >= phaseStart && x.date <= today);
  const criteria: Criterion[] = [];

  if (phase === 0) {
    const c = PROGRAM.promotion.phase0;
    const baseRec = inPhase(input.recordings).filter((r) => r.kind === 'calibration').length;
    const logs = inPhase(input.dailyLogs).length;
    const cal = calibrationPass(input.calibrations);
    criteria.push(
      { label: '기저 녹음', met: baseRec >= c.baselineRecordings, detail: `${baseRec}/${c.baselineRecordings}회` },
      { label: '일일기록', met: logs >= c.dailyLogs, detail: `${logs}/${c.dailyLogs}일` },
      { label: 'SR·NAT 보정', met: cal.pass, detail: cal.pass ? '통과' : `평가 ${cal.rated}건, 미통과` },
    );
  } else if (phase === 1) {
    const c = PROGRAM.promotion.phase1;
    const n = consecutiveProbeWeeks(inPhase(input.recordings), (p) => p.pctSS < c.pctSSMax);
    criteria.push({
      label: `주간 평가 %SS <${c.pctSSMax}%`,
      met: n >= c.consecutiveWeeks,
      detail: `${n}/${c.consecutiveWeeks}주 연속`,
    });
  } else if (phase === 2) {
    const c = PROGRAM.promotion.phase2;
    const n = consecutiveProbeWeeks(inPhase(input.recordings), (p) => p.pctSS < c.pctSSMax && p.nat <= c.natMax);
    criteria.push({
      label: `주간 평가 %SS <${c.pctSSMax}% · NAT ≤${c.natMax}`,
      met: n >= c.consecutiveWeeks,
      detail: `${n}/${c.consecutiveWeeks}주 연속`,
    });
  } else if (phase === 3) {
    const c = PROGRAM.promotion.phase3;
    const from = addDays(today, -(c.windowDays - 1));
    const good = input.dailyLogs.filter((l) => l.date >= from && l.date <= today && l.sr <= c.srMax).length;
    const hardIds = new Set(
      input.exposureItems.filter((i) => i.difficulty >= c.exposureDifficulty).map((i) => i.id),
    );
    const hardDone = input.exposureAttempts.some((a) => hardIds.has(a.itemId));
    criteria.push(
      { label: `일일 SR ≤${c.srMax}`, met: good >= c.minDays, detail: `최근 ${c.windowDays}일 중 ${good}/${c.minDays}일` },
      { label: `노출 난이도 ${c.exposureDifficulty} 이상`, met: hardDone, detail: hardDone ? '완료' : '미완료' },
    );
  }

  return { suggested: criteria.length > 0 && criteria.every((c) => c.met), criteria };
}

// ───────────────────────── 기저값 ─────────────────────────

export interface Baselines {
  sr: number | null;
  pctSS: number | null;
  survey: Survey | null;
}

export function baselines(input: {
  startDate: DateStr;
  dailyLogs: DailyLog[];
  recordings: Recording[];
  surveys: Survey[];
}): Baselines {
  const srTo = addDays(input.startDate, PROGRAM.referral.baselineSrDays - 1);
  const srs = input.dailyLogs.filter((l) => l.date >= input.startDate && l.date <= srTo).map((l) => l.sr);
  const base = input.recordings.filter((r) => r.kind === 'calibration').map((r) => r.pctSS);
  const firstProbe = [...probesByWeek(input.recordings)].pop();
  const surveys = [...input.surveys].sort((a, b) => a.date.localeCompare(b.date));
  return {
    sr: srs.length ? round(mean(srs)) : null,
    pctSS: base.length ? round(mean(base)) : firstProbe ? firstProbe.pctSS : null,
    survey: surveys[0] ?? null,
  };
}

// ───────────────────────── 연계 검토 ─────────────────────────

export interface ReferralInput {
  startDate: DateStr;
  today: DateStr;
  baseline: Baselines;
  dailyLogs: DailyLog[];
  recordings: Recording[];
  surveys: Survey[];
}

export interface ReferralResult {
  flagged: boolean;
  eligible: boolean;
  weeks: number;
  reasons: string[];
}

export function referralFlag(input: ReferralInput): ReferralResult {
  const c = PROGRAM.referral;
  const weeks = Math.floor(diffDays(input.startDate, input.today) / 7);
  const eligible = weeks >= c.minWeeks;
  const reasons: string[] = [];

  // 1. 일일 SR 2주 평균의 기저 대비 감소 < 2점
  const from = addDays(input.today, -(c.srWindowDays - 1));
  const recentSr = input.dailyLogs.filter((l) => l.date >= from && l.date <= input.today).map((l) => l.sr);
  if (input.baseline.sr != null && recentSr.length) {
    const drop = input.baseline.sr - mean(recentSr);
    if (drop < c.srDropMin)
      reasons.push(`일일 SR 감소 ${round(drop, 1)}점 (기준 ${c.srDropMin}점 이상, 기저 ${input.baseline.sr} → 최근 ${round(mean(recentSr), 1)})`);
  }

  // 2. 주간 평가 녹음 %SS의 기저 대비 개선 < 50%
  const recentProbes = probesByWeek(input.recordings).slice(0, c.probeRecentCount);
  if (input.baseline.pctSS != null && input.baseline.pctSS > 0 && recentProbes.length) {
    const recent = mean(recentProbes.map((p) => p.pctSS));
    const improvement = (input.baseline.pctSS - recent) / input.baseline.pctSS;
    if (improvement < c.probeImprovementMin)
      reasons.push(`주간 평가 %SS 개선 ${Math.round(improvement * 100)}% (기준 ${c.probeImprovementMin * 100}% 이상, 기저 ${input.baseline.pctSS}% → 최근 ${round(recent)}%)`);
  }

  // 3. 4주 설문 회피 점수 기저 대비 감소 < 20%
  const surveys = [...input.surveys].sort((a, b) => a.date.localeCompare(b.date));
  const base = input.baseline.survey;
  const latest = surveys[surveys.length - 1];
  if (base && latest && latest.id !== base.id && latest.date !== base.date && base.avoidanceSum > 0) {
    const imp = (base.avoidanceSum - latest.avoidanceSum) / base.avoidanceSum;
    if (imp < c.surveyAvoidanceImprovementMin)
      reasons.push(`설문 회피 점수 감소 ${Math.round(imp * 100)}% (기준 ${c.surveyAvoidanceImprovementMin * 100}% 이상, 기저 ${base.avoidanceSum} → 최근 ${latest.avoidanceSum})`);
  }

  return { flagged: eligible && reasons.length > 0, eligible, weeks, reasons };
}

// ───────────────────────── DAF 반응 ─────────────────────────

export interface DafResult {
  responder: boolean;
  condition: 'daf' | 'dafFaf' | null;
  sessions: { nafMean: number; dafReduction: number; dafFafReduction: number | null }[];
}

/** 두 세션 모두 DAF(또는 DAF+FAF) %SS가 NAF 평균 대비 30% 이상 감소하면 반응자 */
export function dafResponder(tests: DafTest[]): DafResult {
  const need = PROGRAM.daf.sessions;
  const th = PROGRAM.daf.responderReduction;
  const sorted = [...tests].sort((a, b) => a.session - b.session || a.date.localeCompare(b.date)).slice(-need);
  const sessions = sorted.map((t) => {
    const nafMean = mean(t.nafPctSS);
    const red = (x: number) => (nafMean > 0 ? (nafMean - x) / nafMean : 0);
    return {
      nafMean: round(nafMean),
      dafReduction: round(red(t.dafPctSS), 3),
      dafFafReduction: t.dafFafPctSS == null ? null : round(red(t.dafFafPctSS), 3),
    };
  });
  if (sessions.length < need) return { responder: false, condition: null, sessions };
  // 부동소수 오차 없이 경계값(정확히 30%)을 포함하도록 소량의 여유를 둔다
  const eps = 1e-9;
  if (sessions.every((s) => s.dafReduction >= th - eps)) return { responder: true, condition: 'daf', sessions };
  if (sessions.every((s) => s.dafFafReduction != null && s.dafFafReduction >= th - eps))
    return { responder: true, condition: 'dafFaf', sessions };
  return { responder: false, condition: null, sessions };
}

// ───────────────────────── 4주 설문 ─────────────────────────

export function scoreSurvey(answers: number[]): Pick<Survey, 'avoidanceSum' | 'emotionSum' | 'total'> {
  const s = PROGRAM.survey;
  const scored = answers.map((a, i) => ((s.reverseItems as readonly number[]).includes(i) ? s.max - a : a));
  const sum = (idx: readonly number[]) => idx.reduce((acc, i) => acc + (scored[i] ?? 0), 0);
  const avoidanceSum = sum(s.avoidanceItems);
  const emotionSum = sum(s.emotionItems);
  return { avoidanceSum, emotionSum, total: avoidanceSum + emotionSum };
}

export interface SurveyDue {
  due: boolean;
  dueDate: DateStr | null;
  /** 표시 기간이 남은 일수 */
  daysLeft: number;
  baselineNeeded: boolean;
}

/** 기저 설문 이후 28일마다 도래, 7일간 표시 */
export function surveyDue(surveys: Survey[], today: DateStr): SurveyDue {
  const s = PROGRAM.survey;
  const sorted = [...surveys].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { due: true, dueDate: today, daysLeft: s.displayDays, baselineNeeded: true };
  const base = sorted[0].date;
  const k = Math.floor(diffDays(base, today) / s.intervalDays);
  if (k < 1) return { due: false, dueDate: addDays(base, s.intervalDays), daysLeft: 0, baselineNeeded: false };
  const dueDate = addDays(base, k * s.intervalDays);
  const into = diffDays(dueDate, today);
  const done = sorted.some((x) => x.date >= dueDate);
  if (!done && into < s.displayDays) return { due: true, dueDate, daysLeft: s.displayDays - into, baselineNeeded: false };
  return { due: false, dueDate: addDays(base, (k + 1) * s.intervalDays), daysLeft: 0, baselineNeeded: false };
}

// ───────────────────────── CBT 통계 ─────────────────────────

export function exposureStats(items: ExposureItem[], attempts: ExposureAttempt[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const diffs = attempts.map((a) => byId.get(a.itemId)?.difficulty ?? 0);
  return {
    completed: attempts.length,
    maxDifficulty: diffs.length ? Math.max(...diffs) : 0,
    /** 예상 − 실제 불안 평균 (양수 = 과대예측) */
    overprediction: attempts.length ? round(mean(attempts.map((a) => a.anticipated - a.actual)), 1) : null,
  };
}

export function thoughtStats(records: ThoughtRecord[]) {
  return {
    count: records.length,
    beliefDropAvg: records.length ? round(mean(records.map((r) => r.beliefBefore - r.beliefAfter)), 1) : null,
  };
}

// ───────────────────────── 보조 ─────────────────────────

export function daysSince(from: DateStr | null | undefined, to: DateStr): number | null {
  return from ? diffDays(from, to) : null;
}

export function srSeries(logs: DailyLog[], from: DateStr, to: DateStr): { date: DateStr; value: number | null }[] {
  const map = new Map(logs.map((l) => [l.date, l.sr]));
  return dateRange(from, to).map((d) => ({ date: d, value: map.get(d) ?? null }));
}

export { mean, round };
