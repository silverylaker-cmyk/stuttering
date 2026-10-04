/**
 * content/sentences.json 의 음절 수(syllables)를 다시 계산한다.
 * 문장을 수정·추가한 뒤 `npm run content:syllables` 로 실행.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { countSyllables } from '../src/lib/syllables';

const path = new URL('../content/sentences.json', import.meta.url);
const data = JSON.parse(readFileSync(path, 'utf8')) as { id: string; level: number; text: string; syllables?: number }[];
for (const s of data) s.syllables = countSyllables(s.text);
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const byLevel = [1, 2, 3].map((l) => data.filter((s) => s.level === l).map((s) => s.syllables!));
byLevel.forEach((xs, i) => console.log(`난이도 ${i + 1}: ${xs.length}문장, 음절 ${Math.min(...xs)}–${Math.max(...xs)}`));
