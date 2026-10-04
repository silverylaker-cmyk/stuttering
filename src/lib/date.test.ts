import { describe, expect, it } from 'vitest';
import { addDays, diffDays, toSeoulDate, weekKey, weekStart } from './date';

describe('date', () => {
  it('Asia/Seoul 기준 날짜', () => {
    // UTC 15:00 = 서울 다음날 00:00
    expect(toSeoulDate(new Date('2026-03-01T14:59:59Z'))).toBe('2026-03-01');
    expect(toSeoulDate(new Date('2026-03-01T15:00:00Z'))).toBe('2026-03-02');
  });

  it('ISO 주차', () => {
    expect(weekKey('2026-01-01')).toBe('2026-W01'); // 목요일
    expect(weekKey('2025-12-29')).toBe('2026-W01'); // 월요일
    expect(weekKey('2025-12-28')).toBe('2025-W52'); // 일요일
    expect(weekKey('2027-01-01')).toBe('2026-W53'); // 금요일, 53주 해
    expect(weekKey('2026-10-04')).toBe('2026-W40'); // 일요일
    expect(weekKey('2026-10-05')).toBe('2026-W41'); // 월요일
  });

  it('주 시작(월요일)과 날짜 산술', () => {
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });
});
