import { describe, expect, it } from 'vitest';
import sentences from '../../content/sentences.json';
import { countSyllables, splitGlyphs, syllableIndexAt, syllableMs } from './syllables';

describe('음절 분할', () => {
  it('한글 음절만 센다', () => {
    expect(countSyllables('아침에 물을 마셔요.')).toBe(8);
    expect(splitGlyphs('가 나').map((g) => g.syllable)).toEqual([0, -1, 1]);
  });

  it('문장 세트의 사전 계산 음절 수가 일치한다', () => {
    for (const s of sentences) expect(countSyllables(s.text), s.id).toBe(s.syllables);
  });

  it('난이도별 30문장, 총 90문장', () => {
    for (const lv of [1, 2, 3]) expect(sentences.filter((s) => s.level === lv)).toHaveLength(30);
    expect(new Set(sentences.map((s) => s.id)).size).toBe(90);
  });
});

describe('하이라이트 타이밍 (M3: SPM 60–240 오차 <5%)', () => {
  for (const target of [60, 70, 80, 120, 150, 180, 240]) {
    it(`SPM ${target}`, () => {
      const total = 30;
      // 1ms 해상도로 각 음절이 시작되는 시각을 찾는다
      const onsets: number[] = [];
      let prev = -1;
      for (let t = 0; t <= (total * 60000) / target + 5; t++) {
        const i = syllableIndexAt(t, target, total);
        if (i !== prev && i < total) onsets.push(t);
        prev = i;
      }
      expect(onsets).toHaveLength(total);
      const durationMs = onsets[total - 1] - onsets[0] + syllableMs(target);
      const measured = (total / durationMs) * 60000;
      expect(Math.abs(measured - target) / target).toBeLessThan(0.05);
      // 개별 음절 간격도 5% 이내
      for (let i = 1; i < total; i++) {
        const gap = onsets[i] - onsets[i - 1];
        expect(Math.abs(gap - syllableMs(target)) / syllableMs(target)).toBeLessThan(0.05);
      }
    });
  }
});
