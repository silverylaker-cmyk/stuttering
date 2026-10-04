/** 한국어 음절 분할: 한글 음절(가–힣) 하나 = 1음절. 숫자·영문은 1글자 = 1음절로 근사한다. */

const HANGUL = /[가-힣]/;
const COUNTABLE = /[가-힣0-9A-Za-z]/;

export interface Glyph {
  ch: string;
  /** 음절이면 0부터 시작하는 음절 인덱스, 아니면 -1 */
  syllable: number;
}

export function isHangulSyllable(ch: string): boolean {
  return HANGUL.test(ch);
}

export function splitGlyphs(text: string): Glyph[] {
  let n = 0;
  return Array.from(text).map((ch) => ({ ch, syllable: COUNTABLE.test(ch) ? n++ : -1 }));
}

export function countSyllables(text: string): number {
  return Array.from(text).filter((ch) => COUNTABLE.test(ch)).length;
}

/** 하나의 음절이 차지하는 시간(ms) */
export function syllableMs(spm: number): number {
  return 60000 / spm;
}

/**
 * 경과 시간에서 현재 하이라이트할 음절 인덱스.
 * 끝을 넘으면 total 을 반환한다(완료).
 */
export function syllableIndexAt(elapsedMs: number, spm: number, total: number): number {
  if (elapsedMs < 0) return -1;
  return Math.min(total, Math.floor(elapsedMs / syllableMs(spm)));
}
