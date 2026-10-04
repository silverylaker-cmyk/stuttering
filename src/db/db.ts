import Dexie, { type Table } from 'dexie';
import { PROGRAM } from '../config/program';
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
  Setting,
  Survey,
  ThoughtRecord,
  TrainingSession,
} from './types';

export class StutterDB extends Dexie {
  profile!: Table<Profile, number>;
  phaseHistory!: Table<PhaseHistory, number>;
  trainingSession!: Table<TrainingSession, number>;
  recording!: Table<Recording, number>;
  calibration!: Table<Calibration, number>;
  dailyLog!: Table<DailyLog, string>;
  exposureItem!: Table<ExposureItem, number>;
  exposureAttempt!: Table<ExposureAttempt, number>;
  thoughtRecord!: Table<ThoughtRecord, number>;
  survey!: Table<Survey, number>;
  dafTest!: Table<DafTest, number>;
  clinicVisit!: Table<ClinicVisit, number>;
  settings!: Table<Setting, string>;

  constructor(name = 'stutter-trainer') {
    super(name);
    // 스키마 변경 시 version(n+1) 을 추가하고 upgrade() 로 마이그레이션한다.
    this.version(1).stores({
      profile: 'id',
      phaseHistory: '++id, phase, startDate',
      trainingSession: '++id, date, type',
      recording: '++id, date, kind, weekKey',
      calibration: '++id, recordingId',
      dailyLog: 'date',
      exposureItem: '++id, order',
      exposureAttempt: '++id, itemId, date',
      thoughtRecord: '++id, date',
      survey: '++id, date',
      dafTest: '++id, date, session',
      clinicVisit: '++id, date',
      settings: 'key',
    });
  }
}

export const db = new StutterDB();

export const TABLES = [
  'profile',
  'phaseHistory',
  'trainingSession',
  'recording',
  'calibration',
  'dailyLog',
  'exposureItem',
  'exposureAttempt',
  'thoughtRecord',
  'survey',
  'dafTest',
  'clinicVisit',
  'settings',
] as const;

export type TableName = (typeof TABLES)[number];

// ───────────────────────── settings ─────────────────────────

export interface AppSettings {
  fontScale: 0 | 1 | 2;
  theme: 'system' | 'light' | 'dark';
  keepBlobs: number;
  lastBackupAt: string | null;
  dafTestEnabled: boolean;
  dafToolEnabled: boolean;
  modificationEnabled: boolean;
  cbtIntroSeen: boolean;
  installDismissed: boolean;
  onboardingDone: boolean;
  persistGranted: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontScale: 1,
  theme: 'system',
  keepBlobs: PROGRAM.recording.keepBlobs,
  lastBackupAt: null,
  dafTestEnabled: false,
  dafToolEnabled: false,
  modificationEnabled: false,
  cbtIntroSeen: false,
  installDismissed: false,
  onboardingDone: false,
  persistGranted: false,
};

export async function getSettings(d: StutterDB = db): Promise<AppSettings> {
  const rows = await d.settings.toArray();
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AppSettings;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K], d: StutterDB = db) {
  await d.settings.put({ key, value });
}

// ───────────────────────── recordings ─────────────────────────

/** 영구 보관 대상: 주간 평가 녹음, 보정 녹음, DAF 테스트 녹음 */
export const PERMANENT_KINDS: Recording['kind'][] = ['probe', 'calibration', 'dafTest'];

/** 보관 개수를 넘는 일반 녹음의 Blob만 삭제한다(수치는 유지). */
export async function pruneBlobs(keep: number, d: StutterDB = db): Promise<number> {
  const all = await d.recording.orderBy('id').reverse().toArray();
  const normal = all.filter((r) => !PERMANENT_KINDS.includes(r.kind) && !r.blobDeleted && r.blob);
  const excess = normal.slice(keep);
  await d.transaction('rw', d.recording, async () => {
    for (const r of excess) await d.recording.update(r.id!, { blob: undefined, blobDeleted: true });
  });
  return excess.length;
}

/**
 * 주간 평가 녹음으로 저장. 같은 주에 이미 probe 가 있으면 이전 건은 일반 대화 녹음으로 전환한다.
 */
export async function saveRecording(rec: Recording, d: StutterDB = db): Promise<number> {
  return d.transaction('rw', d.recording, async () => {
    if (rec.kind === 'probe' && rec.weekKey) {
      const prev = await d.recording.where('weekKey').equals(rec.weekKey).toArray();
      for (const p of prev) if (p.kind === 'probe') await d.recording.update(p.id!, { kind: 'conversation', weekKey: undefined });
    }
    return d.recording.add(rec);
  });
}

// ───────────────────────── phase ─────────────────────────

export async function currentPhase(d: StutterDB = db): Promise<PhaseHistory | undefined> {
  const all = await d.phaseHistory.orderBy('id').toArray();
  return all.filter((p) => !p.endDate).pop() ?? all.pop();
}

export async function changePhase(next: PhaseHistory, today: string, d: StutterDB = db) {
  await d.transaction('rw', d.phaseHistory, async () => {
    const open = await d.phaseHistory.filter((p) => !p.endDate).toArray();
    for (const p of open) await d.phaseHistory.update(p.id!, { endDate: today });
    await d.phaseHistory.add(next);
  });
}

export async function wipeAll(d: StutterDB = db) {
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) await d.table(t).clear();
  });
}
