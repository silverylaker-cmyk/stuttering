/** 날짜는 Asia/Seoul 기준 `YYYY-MM-DD` 문자열로 다룬다. */

export type DateStr = string;

const seoulFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toSeoulDate(d: Date = new Date()): DateStr {
  return seoulFmt.format(d);
}

export function today(): DateStr {
  return toSeoulDate(new Date());
}

/** 날짜 문자열을 UTC 자정 Date로 (산술 전용) */
function parse(d: DateStr): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function format(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: DateStr, n: number): DateStr {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return format(x);
}

/** b - a (일) */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

/** 월요일 = 0 … 일요일 = 6 */
export function weekdayMon0(d: DateStr): number {
  return (parse(d).getUTCDay() + 6) % 7;
}

export function weekStart(d: DateStr): DateStr {
  return addDays(d, -weekdayMon0(d));
}

/** ISO 주차 키 `YYYY-Www` */
export function weekKey(d: DateStr): string {
  const x = parse(d);
  // ISO: 목요일이 속한 해가 주의 해
  const thursday = new Date(x);
  thursday.setUTCDate(x.getUTCDate() + 3 - weekdayMon0(d));
  const year = thursday.getUTCFullYear();
  const dayOfYear = Math.round((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function dateRange(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatKDate(d: DateStr): string {
  const [, m, day] = d.split('-').map(Number);
  const wd = '월화수목금토일'[weekdayMon0(d)];
  return `${m}/${day}(${wd})`;
}

export function compactDate(d: DateStr): string {
  return d.replaceAll('-', '');
}
