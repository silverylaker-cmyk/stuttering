/**
 * 12주 시드 시나리오 4종을 백업 파일(json)로 출력한다.
 *   npm run seed            → seed-out/*.json (오늘 기준)
 *   npm run seed 2026-10-04 → 지정 날짜 기준
 * 앱 설정 > 데모 데이터 또는 설정 > 백업 가져오기로 불러올 수 있다. (데모 PIN: 0000)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { today } from '../src/lib/date';
import { SCENARIOS, buildScenario } from '../src/seed/scenarios';
import { computeStatus, type AllData } from '../src/lib/status';

const date = process.argv[2] ?? today();
const out = new URL('../seed-out/', import.meta.url);
mkdirSync(out, { recursive: true });

for (const { name, label } of SCENARIOS) {
  const data = buildScenario(name, date);
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify(data, null, 2));
  const t = data.tables as unknown as AllData;
  const s = computeStatus({ ...t, profile: (data.tables.profile as AllData['profile'][])[0] }, date)!;
  console.log(
    `${label.padEnd(20)} Phase ${s.phase.phase} | 승급 제안 ${s.promotion.suggested ? 'O' : 'X'} | 연계 검토 ${s.referral.flagged ? 'O' : 'X'} | 보정 ${s.calibration.pass ? '통과' : '미통과'} | 스트릭 ${s.streak.days}일`,
  );
}
console.log(`→ ${out.pathname}`);
