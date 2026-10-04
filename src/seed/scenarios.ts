/**
 * 12주 시드 시나리오 4종. 테스트와 앱의 "데모 데이터 불러오기"에서 함께 쓴다.
 *  1. improving   — 호전형(정상 승급)
 *  2. plateau     — 정체형(연계 플래그)
 *  3. relapse     — 재발형(Phase 4에서 SR 상승)
 *  4. calibration — 보정 실패 후 통과형
 */
import { APP_ID, SCHEMA_VERSION, type PhaseId } from '../config/program';
import { EXPOSURE_TEMPLATES } from '../content';
import { addDays, weekKey, weekStart, type DateStr } from '../lib/date';
import { pctSS, scoreSurvey, spm } from '../lib/logic';
import type {
  Calibration,
  ClinicVisit,
  DailyLog,
  ExposureAttempt,
  ExposureItem,
  PhaseHistory,
  Profile,
  Recording,
  Setting,
  Survey,
  ThoughtRecord,
  TrainingSession,
} from '../db/types';
import type { BackupData } from '../db/backup';

export type ScenarioName = 'improving' | 'plateau' | 'relapse' | 'calibration';

export const SCENARIOS: { name: ScenarioName; label: string }[] = [
  { name: 'improving', label: '호전형 (정상 승급)' },
  { name: 'plateau', label: '정체형 (연계 플래그)' },
  { name: 'relapse', label: '재발형 (Phase 4 SR 상승)' },
  { name: 'calibration', label: '보정 실패 후 통과형' },
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

interface Plan {
  /** [phase, 시작 day] */
  phases: [PhaseId, number, number | null][];
  /** day → 일일 SR */
  sr: (day: number) => number;
  /** week index(0 = 시작 주) → probe %SS, NAT. null이면 해당 주 probe 없음 */
  probe: (week: number) => { pct: number; nat: number } | null;
  baselinePct: number;
  /** 설문 회피 소계 목표 (day 0, 28, 56, 84…) */
  avoidance: number[];
  /** 보정 평가: [patientSR, patientNAT, clinicianSR, clinicianNAT, day] */
  calibrations: [number, number, number, number, number][];
  /** 훈련을 쉬는 확률 */
  skip: number;
  exposureMax: number;
}

const PLANS: Record<ScenarioName, Plan> = {
  improving: {
    phases: [
      [0, 0, null],
      [1, 14, 70],
      [2, 42, 150],
    ],
    sr: (d) => lerp(7, 3, (d - 7) / 70),
    probe: (w) => (w < 2 ? null : { pct: w < 9 ? lerp(5, 0.6, (w - 2) / 4) : 0.7, nat: w < 9 ? 5 : 3 }),
    baselinePct: 8,
    avoidance: [28, 21, 13],
    calibrations: [
      [7, 4, 6, 5, 4],
      [6, 5, 7, 4, 7],
      [7, 4, 7, 5, 10],
    ],
    skip: 0.12,
    exposureMax: 5,
  },
  plateau: {
    phases: [
      [0, 0, null],
      [1, 14, 70],
    ],
    sr: () => 7,
    probe: (w) => (w < 2 ? null : { pct: 6.5, nat: 6 }),
    baselinePct: 8,
    avoidance: [28, 27, 27],
    calibrations: [
      [7, 5, 7, 5, 5],
      [7, 6, 6, 6, 8],
      [8, 5, 7, 5, 11],
    ],
    skip: 0.35,
    exposureMax: 3,
  },
  relapse: {
    phases: [
      [0, 0, null],
      [1, 14, 70],
      [2, 35, 120],
      [3, 56, null],
      [4, 70, null],
    ],
    sr: (d) => (d < 60 ? lerp(7, 2, (d - 7) / 50) : lerp(2, 6.5, (d - 60) / 12)),
    probe: (w) => (w < 2 ? null : w < 10 ? { pct: lerp(5, 0.4, (w - 2) / 3), nat: 3 } : { pct: 2.4, nat: 5 }),
    baselinePct: 8,
    avoidance: [28, 18, 10],
    calibrations: [
      [7, 4, 7, 4, 4],
      [6, 4, 6, 5, 7],
      [7, 5, 6, 5, 10],
    ],
    skip: 0.15,
    exposureMax: 8,
  },
  calibration: {
    phases: [
      [0, 0, null],
      [1, 28, 70],
    ],
    sr: (d) => lerp(7, 4, (d - 7) / 70),
    probe: (w) => (w < 4 ? null : { pct: w < 10 ? lerp(5, 1.2, (w - 4) / 5) : 0.8, nat: 5 }),
    baselinePct: 8,
    avoidance: [28, 23, 19],
    calibrations: [
      // 1차: 3건 중 2건 차이 초과 → 미통과
      [3, 2, 7, 6, 5],
      [6, 4, 7, 5, 8],
      [4, 2, 8, 5, 11],
      // 2차: 재시도 3건 모두 통과
      [6, 4, 7, 5, 18],
      [7, 5, 7, 4, 21],
      [6, 5, 6, 6, 24],
    ],
    skip: 0.2,
    exposureMax: 4,
  },
};

export const SCENARIO_DAYS = 12 * 7;

export function buildScenario(name: ScenarioName, today: DateStr): BackupData {
  const plan = PLANS[name];
  const rand = rng([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const start = addDays(today, -(SCENARIO_DAYS - 1));
  const day = (n: number) => addDays(start, n);
  const lastDay = SCENARIO_DAYS - 1;

  const profile: Profile = {
    id: 1,
    nickname: `데모-${SCENARIOS.find((s) => s.name === name)!.label.split(' ')[0]}`,
    birthYear: 1998,
    startDate: start,
    // PIN 0000
    pinSalt: 'demo',
    pinHash: 'f735de5c668a3ac3d297e32cef3e0a897034d65c24fcdb309a6315760c96274a',
    schemaVersion: SCHEMA_VERSION,
  };

  const phaseHistory: PhaseHistory[] = plan.phases.map(([phase, s, spmTarget], i) => ({
    id: i + 1,
    phase,
    startDate: day(s),
    endDate: plan.phases[i + 1] ? day(plan.phases[i + 1][1]) : undefined,
    targetSpm: spmTarget,
  }));

  const dailyLog: DailyLog[] = [];
  const trainingSession: TrainingSession[] = [];
  const recording: Recording[] = [];
  const calibration: Calibration[] = [];
  let recId = 1;

  const phaseOn = (d: number) => [...plan.phases].reverse().find(([, s]) => d >= s)!;

  for (let d = 0; d <= lastDay; d++) {
    const date = day(d);
    if (rand() > 0.08) {
      const sr = clamp(Math.round(plan.sr(d) + (rand() - 0.5) * 1.6), 1, 10);
      const situations = ['전화', '자기소개', '주문', '발표', '낯선 사람', '가족'].filter(() => rand() < 0.25);
      dailyLog.push({
        date,
        sr,
        situations,
        avoidance: sr >= 6 ? (rand() < 0.5 ? 'word' : 'situation') : sr >= 4 && rand() < 0.4 ? 'word' : 'none',
      });
    }
    const [phase, , target] = phaseOn(d);
    if (phase > 0 && rand() > plan.skip) {
      trainingSession.push({
        date,
        type: phase >= 3 ? 'metronome' : 'prolonged',
        durationSec: Math.round((8 + rand() * 14) * 60),
        targetSpm: target ?? undefined,
        sentenceLevel: phase === 1 ? 1 : 2,
      });
    }
  }

  // 보정·기저 녹음
  for (const [pSR, pNAT, cSR, cNAT, d] of plan.calibrations) {
    const syl = 300 + Math.round(rand() * 60);
    const st = Math.round((syl * (plan.baselinePct + (rand() - 0.5))) / 100);
    const dur = 90;
    const id = recId++;
    recording.push({
      id,
      date: day(d),
      kind: 'calibration',
      durationSec: dur,
      syllables: syl,
      stutters: st,
      pctSS: pctSS(st, syl),
      spm: spm(syl, dur),
      nat: pNAT,
      blobDeleted: true,
    });
    calibration.push({
      id: calibration.length + 1,
      recordingId: id,
      patientSR: pSR,
      patientNAT: pNAT,
      clinicianSR: cSR,
      clinicianNAT: cNAT,
      ratedAt: day(Math.min(lastDay, d + 3)),
    });
  }

  // 주간 평가 녹음: 각 주 수요일(또는 마지막 날)
  for (let w = 0; w * 7 <= lastDay; w++) {
    const p = plan.probe(w);
    if (!p) continue;
    const ws = weekStart(day(w * 7));
    const date = addDays(ws, 2) > today ? today : addDays(ws, 2);
    if (date < start) continue;
    const syl = 330 + Math.round(rand() * 60);
    const st = Math.round((syl * p.pct) / 100);
    recording.push({
      id: recId++,
      date,
      kind: 'probe',
      weekKey: weekKey(date),
      durationSec: 120,
      syllables: syl,
      stutters: st,
      pctSS: pctSS(st, syl),
      spm: spm(syl, 120),
      nat: p.nat,
      topic: '시드 주제',
      blobDeleted: true,
    });
  }

  // 설문: 0, 28, 56일
  const survey: Survey[] = plan.avoidance.map((avoid, i) => {
    const per = Math.round(avoid / 4);
    const answers = [per, per, per, avoid - per * 3, 6 - i, 6 - i, 3 + i, 5 - i].map((x) => clamp(x, 0, 10));
    return { id: i + 1, date: day(i * 28), answers, ...scoreSurvey(answers) };
  });

  // 노출 사다리
  const exposureItem: ExposureItem[] = EXPOSURE_TEMPLATES.map((t, i) => ({
    id: i + 1,
    title: t.title,
    difficulty: t.difficulty,
    order: i,
    archived: false,
  }));
  const exposureAttempt: ExposureAttempt[] = [];
  for (let d = 20; d <= lastDay; d += 4) {
    const maxD = Math.max(1, Math.round(lerp(1, plan.exposureMax, (d - 20) / 50)));
    const item = exposureItem[clamp(maxD - 1 - Math.floor(rand() * 2), 0, 9)];
    const anticipated = clamp(Math.round(item.difficulty * 0.8 + 2), 0, 10);
    exposureAttempt.push({
      id: exposureAttempt.length + 1,
      itemId: item.id!,
      date: day(d),
      anticipated,
      actual: clamp(anticipated - 1 - Math.round(rand() * 2), 0, 10),
      sr: clamp(Math.round(plan.sr(d)), 1, 10),
      usedTechnique: rand() < 0.7,
    });
  }

  const thoughtRecord: ThoughtRecord[] = [];
  for (let d = 16; d <= lastDay; d += 9) {
    const before = 60 + Math.round(rand() * 30);
    thoughtRecord.push({
      id: thoughtRecord.length + 1,
      date: day(d),
      situation: '카페에서 주문',
      thought: '막히면 상대가 답답해할 것이다.',
      presetId: 't02',
      beliefBefore: before,
      evidenceFor: '지난번에 점원이 다시 물어봤다.',
      evidenceAgainst: '대부분은 끝까지 기다려 주었다.',
      alternative: '조금 막혀도 주문은 끝까지 할 수 있고, 점원은 대개 신경 쓰지 않는다.',
      beliefAfter: before - 20 - Math.round(rand() * 20),
    });
  }

  const clinicVisit: ClinicVisit[] = [];
  for (let d = 14; d < lastDay; d += 14) {
    clinicVisit.push({
      id: clinicVisit.length + 1,
      date: day(d),
      phaseAtVisit: phaseOn(d)[0],
      memo: '시드 외래 메모',
      viewedAt: `${day(d)}T10:00:00+09:00`,
    });
  }

  const settings: Setting[] = [
    { key: 'onboardingDone', value: true },
    { key: 'cbtIntroSeen', value: true },
    { key: 'installDismissed', value: true },
    { key: 'lastBackupAt', value: `${day(lastDay - 10)}T09:00:00+09:00` },
    { key: 'modificationEnabled', value: name === 'relapse' },
  ];

  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    includesAudio: false,
    tables: {
      profile: [profile],
      phaseHistory,
      trainingSession,
      recording,
      calibration,
      dailyLog,
      exposureItem,
      exposureAttempt,
      thoughtRecord,
      survey,
      dafTest: [],
      clinicVisit,
      settings,
    },
  };
}
