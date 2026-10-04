import type { PhaseId } from '../config/program';
import type { DateStr } from '../lib/date';

export interface Profile {
  id: 1;
  nickname: string;
  birthYear?: number;
  startDate: DateStr;
  pinHash: string;
  pinSalt: string;
  schemaVersion: number;
}

export interface PhaseHistory {
  id?: number;
  phase: PhaseId;
  startDate: DateStr;
  endDate?: DateStr;
  targetSpm?: number | null;
  note?: string;
}

export type TrainingType = 'prolonged' | 'metronome' | 'daf' | 'modification';

export interface TrainingSession {
  id?: number;
  date: DateStr;
  type: TrainingType;
  durationSec: number;
  targetSpm?: number;
  sentenceLevel?: number;
  dafDelayMs?: number;
  fafShift?: number;
}

export type RecordingKind = 'probe' | 'reading' | 'conversation' | 'phone' | 'calibration' | 'dafTest' | 'other';

export interface Recording {
  id?: number;
  date: DateStr;
  kind: RecordingKind;
  weekKey?: string;
  durationSec: number;
  syllables: number;
  stutters: number;
  pctSS: number;
  spm: number;
  nat: number;
  topic?: string;
  mimeType?: string;
  blob?: Blob;
  blobDeleted: boolean;
}

export interface Calibration {
  id?: number;
  recordingId: number;
  patientSR: number;
  patientNAT: number;
  clinicianSR?: number;
  clinicianNAT?: number;
  ratedAt?: DateStr;
}

export type Avoidance = 'none' | 'word' | 'situation';

export interface DailyLog {
  date: DateStr;
  sr: number;
  situations: string[];
  avoidance: Avoidance;
  memo?: string;
}

export interface ExposureItem {
  id?: number;
  title: string;
  difficulty: number;
  order: number;
  archived: boolean;
}

export interface ExposureAttempt {
  id?: number;
  itemId: number;
  date: DateStr;
  anticipated: number;
  actual: number;
  sr: number;
  usedTechnique: boolean;
  usedModification?: boolean;
  memo?: string;
}

export interface ThoughtRecord {
  id?: number;
  date: DateStr;
  situation: string;
  thought: string;
  presetId?: string;
  beliefBefore: number;
  evidenceFor: string;
  evidenceAgainst: string;
  alternative: string;
  beliefAfter: number;
}

export interface Survey {
  id?: number;
  date: DateStr;
  answers: number[];
  avoidanceSum: number;
  emotionSum: number;
  total: number;
}

export interface DafTest {
  id?: number;
  date: DateStr;
  session: 1 | 2;
  nafPctSS: number[];
  dafPctSS: number;
  dafFafPctSS?: number;
  recordingIds: number[];
}

export interface ClinicVisit {
  id?: number;
  date: DateStr;
  phaseAtVisit: PhaseId;
  memo: string;
  viewedAt: string;
}

export interface Setting {
  key: string;
  value: unknown;
}
