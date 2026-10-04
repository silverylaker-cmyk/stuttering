/**
 * 모든 임상 수치는 이 파일에서만 관리한다. 화면·로직 코드에 숫자를 하드코딩하지 않는다.
 */

export type PhaseId = 0 | 1 | 2 | 3 | 4;

export interface PhaseDef {
  id: PhaseId;
  name: string;
  /** 기본 기간(주). 유지기는 개월 단위지만 주로 환산해 둔다. */
  weeks: [number, number];
  /** 훈련 목표 SPM 설명 */
  spmLabel: string;
  /** 단계 시작 시 기본 목표 SPM (null = 자연 속도) */
  defaultTargetSpm: number | null;
}

export const PHASES: PhaseDef[] = [
  { id: 0, name: '기초평가·보정', weeks: [1, 2], spmLabel: '—', defaultTargetSpm: null },
  { id: 1, name: '연장발화 습득', weeks: [3, 4], spmLabel: '60–80', defaultTargetSpm: 70 },
  { id: 2, name: '속도·자연도 회복', weeks: [3, 6], spmLabel: '120 → 150 → 180 → 자연', defaultTargetSpm: 120 },
  { id: 3, name: '일상 전이', weeks: [4, 8], spmLabel: '자연', defaultTargetSpm: null },
  { id: 4, name: '유지', weeks: [13, 26], spmLabel: '자연', defaultTargetSpm: null },
];

export const PROGRAM = {
  /** 훈련기 SPM 허용 범위 */
  spmRange: { min: 60, max: 240 },
  /** Phase 1 목표 SPM 범위 */
  phase1Spm: { min: 60, max: 80 },
  /** Phase 2 하위 단계 (원장이 수동 조정). null = 자연 속도 */
  phase2SpmSteps: [120, 150, 180, null] as (number | null)[],
  /** 모델 음성이 준비된 SPM 단계 */
  modelAudioSpm: [70, 120, 150, 180],

  promotion: {
    phase0: { baselineRecordings: 3, dailyLogs: 5 },
    phase1: { pctSSMax: 1, consecutiveWeeks: 3 },
    phase2: { pctSSMax: 1, natMax: 3, consecutiveWeeks: 3 },
    phase3: { srMax: 3, windowDays: 14, minDays: 10, exposureDifficulty: 6 },
  },

  referral: {
    /** 시작 후 이 주수 이상 경과 시 판정 */
    minWeeks: 8,
    /** 일일 SR 평균 비교 구간 */
    srWindowDays: 14,
    /** 기저 대비 SR 감소가 이 값 미만이면 플래그 */
    srDropMin: 2,
    /** probe %SS 기저 대비 개선율이 이 값 미만이면 플래그 */
    probeImprovementMin: 0.5,
    /** 최근 probe 몇 건의 평균을 쓸지 */
    probeRecentCount: 3,
    /** 설문 회피 소계 기저 대비 감소율이 이 값 미만이면 플래그 */
    surveyAvoidanceImprovementMin: 0.2,
    /** 기저 SR: 시작 후 이 일수 안의 일일기록 평균 */
    baselineSrDays: 14,
  },

  calibration: { count: 3, srDiffMax: 2, natDiffMax: 2, minSec: 60, maxSec: 120 },

  streak: { minSessionSec: 5 * 60, restDaysPerWeek: 1 },
  /** 홈 체크리스트의 하루 훈련 목표(분) */
  dailyTrainingGoalMin: 15,

  survey: { intervalDays: 28, displayDays: 7, reverseItems: [6], avoidanceItems: [0, 1, 2, 3], emotionItems: [4, 5, 6, 7], max: 10 },

  recording: { maxSec: 180, keepBlobs: 20, probeSec: 120 },

  daf: {
    defaultDelayMs: 75,
    delayRangeMs: [50, 200] as [number, number],
    fafShifts: [-0.5, -0.25, 0, 0.25, 0.5],
    testFafShift: 0.5,
    responderReduction: 0.3,
    latencyWarnMs: 40,
    sessions: 2,
  },

  /** 말더듬 수정법: cancellation 정지 시간(초) */
  modification: { pauseSec: 1.5, pauseRangeSec: [1, 2] as [number, number] },

  backup: { warnDays: 30 },
  pin: { minLength: 4, maxLength: 6 },
  clinicianAutoLockMin: 15,

  sr: { min: 1, max: 10 },
  nat: { min: 1, max: 9 },
  anxiety: { min: 0, max: 10 },
  belief: { min: 0, max: 100 },
  exposureDifficulty: { min: 1, max: 10 },
} as const;

export const SITUATION_TAGS = ['전화', '자기소개', '주문', '발표', '낯선 사람', '가족', '기타'] as const;

export const AVOIDANCE_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'word', label: '단어 바꿈' },
  { value: 'situation', label: '상황 회피' },
] as const;

export const RECORDING_KINDS = [
  { value: 'probe', label: '주간 평가' },
  { value: 'reading', label: '낭독' },
  { value: 'conversation', label: '대화' },
  { value: 'phone', label: '전화' },
  { value: 'other', label: '기타' },
] as const;

export const SCHEMA_VERSION = 1;
export const APP_ID = 'stutter-trainer';
