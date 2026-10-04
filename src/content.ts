import illustrationsJson from '../content/illustrations.json';
import sentencesJson from '../content/sentences.json';
import probeTopicsJson from '../content/probeTopics.json';
import thoughtPresetsJson from '../content/thoughtPresets.json';
import exposureTemplatesJson from '../content/exposureTemplates.json';
import dafPassagesJson from '../content/dafPassages.json';
import surveyJson from '../content/survey.json';
import guidesJson from '../content/guides.json';
import { PROGRAM } from './config/program';

export interface Sentence {
  id: string;
  level: number;
  text: string;
  syllables: number;
}

export const SENTENCES = sentencesJson as Sentence[];
export const PROBE_TOPICS = probeTopicsJson as string[];
export const THOUGHT_PRESETS = thoughtPresetsJson as { id: string; text: string }[];
export const EXPOSURE_TEMPLATES = exposureTemplatesJson as { title: string; difficulty: number }[];
export const DAF_PASSAGES = dafPassagesJson as { id: string; title: string; text: string }[];
export const SURVEY = surveyJson as {
  scaleNote: string;
  items: { text: string; low: string; high: string; reverse?: boolean }[];
};
export const GUIDES = guidesJson;

const base = import.meta.env?.BASE_URL ?? '/';

/** 목표 SPM에 가장 가까운 모델 음성 단계 */
export function nearestModelSpm(spm: number): number {
  return PROGRAM.modelAudioSpm.reduce((best, s) => (Math.abs(s - spm) < Math.abs(best - spm) ? s : best));
}

export function modelAudioUrl(spm: number, sentenceId: string): string {
  return `${base}audio/model/${nearestModelSpm(spm)}/${sentenceId}.m4a`;
}

export function videoUrl(key: string): string {
  return `${base}video/${key}.mp4`;
}

/** 주간 평가 주제: 시작일 기준 주차로 순환 */
export function probeTopicFor(weekIndex: number): string {
  const n = PROBE_TOPICS.length;
  return PROBE_TOPICS[((weekIndex % n) + n) % n];
}


export const ILLUSTRATIONS = Object.fromEntries(illustrationsJson.items.map((i) => [i.name, i])) as Record<
  string,
  (typeof illustrationsJson.items)[number]
>;

/** 일러스트 대체 이모지 */
export function illustFallback(name: string): string {
  return ILLUSTRATIONS[name]?.fallback ?? '•';
}
