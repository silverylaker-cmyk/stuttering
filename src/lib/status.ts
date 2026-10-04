/** 전체 테이블 → 화면에 필요한 파생 상태. 순수 함수. */
import { PHASES, type PhaseDef } from '../config/program';
import type {
  Calibration,
  ClinicVisit,
  DafTest,
  DailyLog,
  ExposureAttempt,
  ExposureItem,
  PhaseHistory,
  Profile,
  Recording,
  Survey,
  ThoughtRecord,
  TrainingSession,
} from '../db/types';
import { diffDays, weekKey, type DateStr } from './date';
import {
  baselines,
  calibrationPass,
  dafResponder,
  promotionSuggested,
  referralFlag,
  streak,
  surveyDue,
  type Baselines,
  type CalibrationResult,
  type DafResult,
  type PromotionResult,
  type ReferralResult,
  type StreakResult,
  type SurveyDue,
} from './logic';

export interface AllData {
  profile?: Profile;
  phaseHistory: PhaseHistory[];
  trainingSession: TrainingSession[];
  recording: Recording[];
  calibration: Calibration[];
  dailyLog: DailyLog[];
  exposureItem: ExposureItem[];
  exposureAttempt: ExposureAttempt[];
  thoughtRecord: ThoughtRecord[];
  survey: Survey[];
  dafTest: DafTest[];
  clinicVisit: ClinicVisit[];
}

export interface Status {
  phase: PhaseHistory;
  phaseDef: PhaseDef;
  daysInPhase: number;
  daysInProgram: number;
  weekIndex: number;
  thisWeekKey: string;
  thisWeekProbe: Recording | undefined;
  todayLog: DailyLog | undefined;
  todayTrainingSec: number;
  streak: StreakResult;
  promotion: PromotionResult;
  referral: ReferralResult;
  baseline: Baselines;
  calibration: CalibrationResult;
  surveyDue: SurveyDue;
  daf: DafResult;
  lastVisit: ClinicVisit | undefined;
}

export function computeStatus(data: AllData, today: DateStr): Status | null {
  if (!data.profile) return null;
  const startDate = data.profile.startDate;
  const sortedPhases = [...data.phaseHistory].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const phase = sortedPhases.filter((p) => !p.endDate).pop() ??
    sortedPhases.pop() ?? { phase: 0 as const, startDate };
  const thisWeekKey = weekKey(today);
  const probeDates = data.recording.filter((r) => r.kind === 'probe').map((r) => r.date);
  const baseline = baselines({ startDate, dailyLogs: data.dailyLog, recordings: data.recording, surveys: data.survey });

  return {
    phase,
    phaseDef: PHASES[phase.phase],
    daysInPhase: diffDays(phase.startDate, today) + 1,
    daysInProgram: diffDays(startDate, today) + 1,
    weekIndex: Math.floor(diffDays(startDate, today) / 7),
    thisWeekKey,
    thisWeekProbe: data.recording.find((r) => r.kind === 'probe' && r.weekKey === thisWeekKey),
    todayLog: data.dailyLog.find((l) => l.date === today),
    todayTrainingSec: data.trainingSession
      .filter((s) => s.date === today && s.type !== 'daf')
      .reduce((a, s) => a + s.durationSec, 0),
    streak: streak({ sessions: data.trainingSession, probeDates, today }),
    promotion: promotionSuggested({
      phase: phase.phase,
      phaseStart: phase.startDate,
      today,
      recordings: data.recording,
      dailyLogs: data.dailyLog,
      exposureItems: data.exposureItem,
      exposureAttempts: data.exposureAttempt,
      calibrations: data.calibration,
    }),
    referral: referralFlag({
      startDate,
      today,
      baseline,
      dailyLogs: data.dailyLog,
      recordings: data.recording,
      surveys: data.survey,
    }),
    baseline,
    calibration: calibrationPass(data.calibration),
    surveyDue: surveyDue(data.survey, today),
    daf: dafResponder(data.dafTest),
    lastVisit: [...data.clinicVisit].sort((a, b) => a.date.localeCompare(b.date)).pop(),
  };
}
