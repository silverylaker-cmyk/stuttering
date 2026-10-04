import { describe, expect, it } from 'vitest';
import type { Calibration, DafTest, DailyLog, ExposureAttempt, ExposureItem, Recording, Survey, TrainingSession } from '../db/types';
import { addDays, weekKey } from './date';
import {
  adherence,
  baselines,
  calibrationPass,
  consecutiveProbeWeeks,
  dafResponder,
  pctSS,
  promotionSuggested,
  referralFlag,
  scoreSurvey,
  spm,
  streak,
  surveyDue,
} from './logic';

const T = '2026-10-04'; // 일요일
const sess = (date: string, min: number, type: TrainingSession['type'] = 'prolonged'): TrainingSession => ({
  date,
  type,
  durationSec: min * 60,
});
let rid = 1;
const probe = (date: string, pct: number, nat = 3): Recording => ({
  id: rid++,
  date,
  kind: 'probe',
  weekKey: weekKey(date),
  durationSec: 120,
  syllables: 300,
  stutters: 0,
  pctSS: pct,
  spm: 150,
  nat,
  blobDeleted: true,
});
const log = (date: string, sr: number): DailyLog => ({ date, sr, situations: [], avoidance: 'none' });
const survey = (date: string, avoid: number, id: number): Survey => ({
  id,
  date,
  answers: [],
  avoidanceSum: avoid,
  emotionSum: 20,
  total: avoid + 20,
});

describe('pctSS · SPM', () => {
  it('계산', () => {
    expect(pctSS(3, 300)).toBe(1);
    expect(pctSS(0, 300)).toBe(0);
    expect(pctSS(5, 0)).toBe(0);
    expect(spm(300, 120)).toBe(150);
    expect(spm(10, 0)).toBe(0);
  });
});

describe('adherence', () => {
  it('훈련 기록이 있는 날 ÷ 기간 일수, DAF 제외', () => {
    const r = adherence({ from: '2026-09-28', to: T }, [
      sess('2026-09-28', 10),
      sess('2026-09-28', 5),
      sess('2026-09-30', 20),
      sess('2026-10-01', 30, 'daf'),
      sess('2026-09-27', 10), // 기간 밖
    ]);
    expect(r.totalDays).toBe(7);
    expect(r.activeDays).toBe(2);
    expect(r.pct).toBeCloseTo(28.6, 1);
    expect(r.avgSecPerDay).toBe(Math.round((35 * 60) / 7));
  });
  it('빈 기간', () => {
    expect(adherence({ from: T, to: addDays(T, -1) }, []).pct).toBe(0);
  });
});

describe('streak', () => {
  it('5분 경계: 4분 59초는 불인정, 5분은 인정', () => {
    expect(streak({ sessions: [{ date: T, type: 'prolonged', durationSec: 299 }], probeDates: [], today: T }).days).toBe(0);
    expect(streak({ sessions: [sess(T, 5)], probeDates: [], today: T }).days).toBe(1);
  });
  it('같은 날 여러 세션 합산, DAF 제외', () => {
    expect(streak({ sessions: [sess(T, 3), sess(T, 2)], probeDates: [], today: T }).days).toBe(1);
    expect(streak({ sessions: [sess(T, 30, 'daf')], probeDates: [], today: T }).days).toBe(0);
  });
  it('주간 평가 녹음만 있어도 인정', () => {
    expect(streak({ sessions: [], probeDates: [T], today: T }).days).toBe(1);
  });
  it('오늘 미완료면 어제부터 센다', () => {
    const r = streak({ sessions: [sess(addDays(T, -1), 10), sess(addDays(T, -2), 10)], probeDates: [], today: T });
    expect(r).toMatchObject({ days: 2, todayDone: false });
  });
  it('주 1회 휴식일 인정, 같은 주 2회 누락은 끊김', () => {
    // 2026-09-28(월) ~ 10-04(일): 10-01 누락 1회 → 유지
    const week = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-02', '2026-10-03', '2026-10-04'];
    const r = streak({ sessions: week.map((d) => sess(d, 10)), probeDates: [], today: T });
    expect(r.days).toBe(6);
    expect(r.restDays).toEqual(['2026-10-01']);
    // 같은 주에 두 번 누락(10-01, 09-29) → 09-29 에서 끊김: 10-04·03·02·09-30 = 4일
    const week2 = ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-03', '2026-10-04'];
    expect(streak({ sessions: week2.map((d) => sess(d, 10)), probeDates: [], today: T }).days).toBe(4);
  });
  it('서로 다른 주의 휴식일은 각각 인정', () => {
    const days = ['2026-09-26', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-04'];
    // 09-27(일, W39) 누락, 10-03(토, W40) 누락
    const r = streak({ sessions: days.map((d) => sess(d, 10)), probeDates: [], today: T });
    expect(r.days).toBe(7);
    expect(r.restDays.sort()).toEqual(['2026-09-27', '2026-10-03']);
  });
});

describe('calibrationPass', () => {
  const cal = (id: number, p: [number, number], c?: [number, number], ratedAt = `2026-09-${10 + id}`): Calibration => ({
    id,
    recordingId: id,
    patientSR: p[0],
    patientNAT: p[1],
    clinicianSR: c?.[0],
    clinicianNAT: c?.[1],
    ratedAt: c ? ratedAt : undefined,
  });
  it('차이 2는 통과, 3은 실패', () => {
    expect(calibrationPass([cal(1, [5, 5], [7, 3]), cal(2, [5, 5], [3, 7]), cal(3, [5, 5], [5, 5])]).pass).toBe(true);
    const r = calibrationPass([cal(1, [5, 5], [8, 5]), cal(2, [5, 5], [5, 5]), cal(3, [5, 5], [5, 5])]);
    expect(r.pass).toBe(false);
    expect(r.diffs[0]).toMatchObject({ srDiff: 3, ok: false });
    expect(calibrationPass([cal(1, [5, 5], [5, 2]), cal(2, [5, 5], [5, 5]), cal(3, [5, 5], [5, 5])]).pass).toBe(false);
  });
  it('원장 평가 3건 미만이면 미통과', () => {
    expect(calibrationPass([cal(1, [5, 5], [5, 5]), cal(2, [5, 5], [5, 5]), cal(3, [5, 5])]).pass).toBe(false);
  });
  it('재시도: 최근 3건 기준', () => {
    const r = calibrationPass([
      cal(1, [2, 2], [8, 8]),
      cal(2, [5, 5], [5, 5]),
      cal(3, [5, 5], [5, 5]),
      cal(4, [5, 5], [6, 6]),
    ]);
    expect(r.pass).toBe(true);
    expect(r.rated).toBe(4);
  });
});

describe('consecutiveProbeWeeks', () => {
  it('최근 주부터 빈 주 없이 이어지는 주 수', () => {
    const ps = [probe('2026-09-16', 0.5), probe('2026-09-23', 0.9), probe('2026-09-30', 0.2)];
    expect(consecutiveProbeWeeks(ps, (p) => p.pctSS < 1)).toBe(3);
  });
  it('중간 주 누락 시 끊김', () => {
    const ps = [probe('2026-09-09', 0.5), probe('2026-09-23', 0.9), probe('2026-09-30', 0.2)];
    expect(consecutiveProbeWeeks(ps, (p) => p.pctSS < 1)).toBe(2);
  });
  it('%SS 1.0은 <1 조건 불충족', () => {
    const ps = [probe('2026-09-16', 0.5), probe('2026-09-23', 1.0), probe('2026-09-30', 0.2)];
    expect(consecutiveProbeWeeks(ps, (p) => p.pctSS < 1)).toBe(1);
  });
  it('같은 주 중복이면 최신(id 큰) 건만 사용', () => {
    const ps = [probe('2026-09-28', 0.2), probe('2026-09-29', 3)];
    expect(consecutiveProbeWeeks(ps, (p) => p.pctSS < 1)).toBe(0);
  });
});

describe('promotionSuggested', () => {
  const base = {
    today: T,
    recordings: [] as Recording[],
    dailyLogs: [] as DailyLog[],
    exposureItems: [] as ExposureItem[],
    exposureAttempts: [] as ExposureAttempt[],
    calibrations: [] as Calibration[],
  };
  const calRec = (id: number, date: string): Recording => ({ ...probe(date, 5), id, kind: 'calibration', weekKey: undefined });

  it('Phase 0: 기저 녹음 3 + 일일기록 5 + 보정 통과', () => {
    const start = '2026-09-25';
    const recs = [calRec(901, '2026-09-26'), calRec(902, '2026-09-27'), calRec(903, '2026-09-28')];
    const cals: Calibration[] = recs.map((r, i) => ({
      recordingId: r.id!,
      patientSR: 5,
      patientNAT: 5,
      clinicianSR: 6,
      clinicianNAT: 4,
      ratedAt: `2026-10-0${i + 1}`,
    }));
    const logs = [0, 1, 2, 3].map((i) => log(addDays(start, i), 6));
    const input = { ...base, phase: 0 as const, phaseStart: start, recordings: recs, calibrations: cals, dailyLogs: logs };
    expect(promotionSuggested(input).suggested).toBe(false); // 일일기록 4일
    expect(promotionSuggested({ ...input, dailyLogs: [...logs, log(addDays(start, 4), 6)] }).suggested).toBe(true);
    expect(promotionSuggested({ ...input, dailyLogs: [...logs, log(addDays(start, 4), 6)], recordings: recs.slice(0, 2) }).suggested).toBe(false);
  });

  it('Phase 1: %SS <1% 3주 연속', () => {
    const recs = [probe('2026-09-16', 0.9), probe('2026-09-23', 0.5), probe('2026-09-30', 0.99)];
    const input = { ...base, phase: 1 as const, phaseStart: '2026-09-01', recordings: recs };
    expect(promotionSuggested(input).suggested).toBe(true);
    expect(promotionSuggested({ ...input, recordings: recs.slice(1) }).suggested).toBe(false);
    // 단계 시작 전 probe 는 제외
    expect(promotionSuggested({ ...input, phaseStart: '2026-09-20' }).suggested).toBe(false);
  });

  it('Phase 2: %SS <1% 그리고 NAT ≤3, 3주 연속', () => {
    const recs = [probe('2026-09-16', 0.5, 3), probe('2026-09-23', 0.5, 3), probe('2026-09-30', 0.5, 3)];
    const input = { ...base, phase: 2 as const, phaseStart: '2026-09-01', recordings: recs };
    expect(promotionSuggested(input).suggested).toBe(true);
    const bad = [recs[0], recs[1], probe('2026-09-30', 0.5, 4)];
    expect(promotionSuggested({ ...input, recordings: bad }).suggested).toBe(false);
  });

  it('Phase 3: SR ≤3이 14일 중 10일 이상 + 노출 난이도 6 이상', () => {
    const logs = Array.from({ length: 14 }, (_, i) => log(addDays(T, -i), i < 10 ? 3 : 4));
    const items: ExposureItem[] = [
      { id: 1, title: 'a', difficulty: 5, order: 0, archived: false },
      { id: 2, title: 'b', difficulty: 6, order: 1, archived: false },
    ];
    const att = (itemId: number): ExposureAttempt => ({ itemId, date: T, anticipated: 5, actual: 3, sr: 3, usedTechnique: true });
    const input = { ...base, phase: 3 as const, phaseStart: '2026-08-01', dailyLogs: logs, exposureItems: items, exposureAttempts: [att(2)] };
    expect(promotionSuggested(input).suggested).toBe(true);
    expect(promotionSuggested({ ...input, exposureAttempts: [att(1)] }).suggested).toBe(false);
    const nine = logs.map((l, i) => (i === 9 ? { ...l, sr: 4 } : l));
    expect(promotionSuggested({ ...input, dailyLogs: nine }).suggested).toBe(false);
  });

  it('Phase 4: 제안 없음', () => {
    expect(promotionSuggested({ ...base, phase: 4, phaseStart: '2026-01-01' }).suggested).toBe(false);
  });
});

describe('referralFlag', () => {
  const start = '2026-08-09'; // T 기준 8주 전
  const mk = (over: Partial<Parameters<typeof referralFlag>[0]> = {}) => ({
    startDate: start,
    today: T,
    baseline: { sr: 7, pctSS: 8, survey: survey(start, 20, 1) },
    dailyLogs: Array.from({ length: 14 }, (_, i) => log(addDays(T, -i), 5)),
    recordings: [probe('2026-09-16', 4), probe('2026-09-23', 4), probe('2026-09-30', 4)],
    surveys: [survey(start, 20, 1), survey('2026-10-01', 16, 2)],
    ...over,
  });

  it('8주 미만이면 플래그 없음', () => {
    const r = referralFlag(mk({ today: addDays(start, 55), dailyLogs: [log(addDays(start, 55), 7)] }));
    expect(r.eligible).toBe(false);
    expect(r.flagged).toBe(false);
  });

  it('경계: SR 감소 정확히 2점, %SS 개선 정확히 50%, 회피 감소 정확히 20% → 플래그 없음', () => {
    const r = referralFlag(mk());
    expect(r.eligible).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.flagged).toBe(false);
  });

  it('각 조건 하나만 미달해도 플래그', () => {
    const sr = referralFlag(mk({ dailyLogs: [log(T, 5), log(addDays(T, -1), 6)] })); // 평균 5.5 → 감소 1.5
    expect(sr.flagged).toBe(true);
    expect(sr.reasons).toHaveLength(1);
    expect(sr.reasons[0]).toContain('SR');

    const pr = referralFlag(mk({ recordings: [probe('2026-09-30', 4.1)] }));
    expect(pr.flagged).toBe(true);
    expect(pr.reasons[0]).toContain('%SS');

    const sv = referralFlag(mk({ surveys: [survey(start, 20, 1), survey('2026-10-01', 17, 2)] }));
    expect(sv.flagged).toBe(true);
    expect(sv.reasons[0]).toContain('회피');
  });

  it('최근 probe 3건 평균 사용', () => {
    const r = referralFlag(mk({ recordings: [probe('2026-09-09', 9), probe('2026-09-16', 3), probe('2026-09-23', 3), probe('2026-09-30', 6)] }));
    // 최근 3건 (6+3+3)/3 = 4 → 개선 50%로 통과. 4건 모두 쓰면 5.25 → 미달이 되므로 오래된 건은 제외돼야 한다.
    expect(r.reasons.some((x) => x.includes('%SS'))).toBe(false);
  });
});

describe('dafResponder', () => {
  const t = (session: 1 | 2, naf: number[], daf: number, dafFaf?: number): DafTest => ({
    session,
    date: `2026-09-0${session}`,
    nafPctSS: naf,
    dafPctSS: daf,
    dafFafPctSS: dafFaf,
    recordingIds: [],
  });
  it('두 세션 모두 30% 이상 감소 → 반응자 (경계 30% 포함)', () => {
    expect(dafResponder([t(1, [10, 10], 7), t(2, [10, 10], 7)])).toMatchObject({ responder: true, condition: 'daf' });
    expect(dafResponder([t(1, [10, 10], 7.1), t(2, [10, 10], 5)]).responder).toBe(false);
  });
  it('DAF+FAF 조건으로 판정', () => {
    expect(dafResponder([t(1, [10, 6], 8, 5), t(2, [8, 8], 7, 5)])).toMatchObject({ responder: true, condition: 'dafFaf' });
  });
  it('세션 1개면 판정 불가', () => {
    expect(dafResponder([t(1, [10, 10], 1)]).responder).toBe(false);
  });
  it('NAF 0%면 반응자 아님', () => {
    expect(dafResponder([t(1, [0, 0], 0), t(2, [0, 0], 0)]).responder).toBe(false);
  });
});

describe('설문', () => {
  it('7번 문항 역채점, 소계', () => {
    const s = scoreSurvey([1, 2, 3, 4, 5, 6, 10, 8]);
    expect(s.avoidanceSum).toBe(10);
    expect(s.emotionSum).toBe(5 + 6 + 0 + 8);
    expect(s.total).toBe(29);
  });
  it('도래: 기저 없으면 즉시, 28일마다 7일간', () => {
    expect(surveyDue([], T)).toMatchObject({ due: true, baselineNeeded: true });
    const b = survey('2026-09-01', 10, 1);
    expect(surveyDue([b], '2026-09-28').due).toBe(false); // 27일
    expect(surveyDue([b], '2026-09-29')).toMatchObject({ due: true, daysLeft: 7 }); // 28일
    expect(surveyDue([b], '2026-10-05')).toMatchObject({ due: true, daysLeft: 1 }); // 34일
    expect(surveyDue([b], '2026-10-06').due).toBe(false); // 35일: 표시 기간 종료
    expect(surveyDue([b, survey('2026-09-30', 9, 2)], '2026-10-01').due).toBe(false); // 완료
  });
});

describe('baselines', () => {
  it('기저 SR = 시작 후 14일 평균, 기저 %SS = 보정 녹음 평균', () => {
    const start = '2026-09-01';
    const b = baselines({
      startDate: start,
      dailyLogs: [log('2026-09-01', 6), log('2026-09-14', 8), log('2026-09-15', 1)],
      recordings: [
        { ...probe('2026-09-02', 6), kind: 'calibration' },
        { ...probe('2026-09-03', 8), kind: 'calibration' },
        probe('2026-09-20', 1),
      ],
      surveys: [survey('2026-09-30', 5, 2), survey('2026-09-01', 9, 1)],
    });
    expect(b.sr).toBe(7);
    expect(b.pctSS).toBe(7);
    expect(b.survey?.avoidanceSum).toBe(9);
  });
});
