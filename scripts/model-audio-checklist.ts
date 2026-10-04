/**
 * 모델 음성 녹음 체크리스트 생성: docs/model-audio-checklist.csv
 *   npm run audio:checklist
 * 각 파일의 목표 길이(초) = 음절 수 ÷ SPM × 60
 */
import { writeFileSync } from 'node:fs';
import sentences from '../content/sentences.json';
import { PROGRAM } from '../src/config/program';

/** 난이도별로 앞에서 몇 문장까지 모델 음성을 만들지 */
export const MODEL_SENTENCES_PER_LEVEL = 10;

export function modelTargets() {
  const picked = [1, 2, 3].flatMap((lv) => sentences.filter((s) => s.level === lv).slice(0, MODEL_SENTENCES_PER_LEVEL));
  return PROGRAM.modelAudioSpm.flatMap((spm) =>
    picked.map((s) => ({
      spm,
      id: s.id,
      file: `public/audio/model/${spm}/${s.id}.m4a`,
      text: s.text,
      syllables: s.syllables,
      targetSec: Math.round((s.syllables / spm) * 60 * 10) / 10,
    })),
  );
}

if (process.argv[1]?.endsWith('model-audio-checklist.ts')) {
  const rows = modelTargets();
  const csv = [
    'spm,id,file,syllables,targetSec,text,done',
    ...rows.map((r) => `${r.spm},${r.id},${r.file},${r.syllables},${r.targetSec},"${r.text}",`),
  ].join('\n');
  writeFileSync(new URL('../docs/model-audio-checklist.csv', import.meta.url), '﻿' + csv + '\n');
  console.log(`${rows.length}개 파일 → docs/model-audio-checklist.csv`);
}
