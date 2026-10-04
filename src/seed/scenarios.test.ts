import { describe, expect, it } from 'vitest';
import { computeStatus, type AllData } from '../lib/status';
import { calibrationPass } from '../lib/logic';
import { buildScenario, type ScenarioName } from './scenarios';

const T = '2026-10-04';
const load = (name: ScenarioName) => {
  const t = buildScenario(name, T).tables as unknown as AllData & { profile: AllData['profile'][] };
  const data = { ...t, profile: (t.profile as unknown as AllData['profile'][])[0] } as AllData;
  return { data, status: computeStatus(data, T)! };
};

describe('시드 시나리오 판정', () => {
  it('1. 호전형: Phase 2 승급 제안, 연계 플래그 없음', () => {
    const { status } = load('improving');
    expect(status.phase.phase).toBe(2);
    expect(status.promotion.suggested).toBe(true);
    expect(status.referral.eligible).toBe(true);
    expect(status.referral.flagged).toBe(false);
    expect(status.calibration.pass).toBe(true);
  });

  it('2. 정체형: 연계 플래그 (SR·%SS·설문 모두 미달)', () => {
    const { status } = load('plateau');
    expect(status.phase.phase).toBe(1);
    expect(status.promotion.suggested).toBe(false);
    expect(status.referral.flagged).toBe(true);
    expect(status.referral.reasons).toHaveLength(3);
  });

  it('3. 재발형: Phase 4, SR 상승으로 연계 플래그(SR 근거)', () => {
    const { status } = load('relapse');
    expect(status.phase.phase).toBe(4);
    expect(status.promotion.suggested).toBe(false);
    expect(status.promotion.criteria).toHaveLength(0);
    expect(status.referral.flagged).toBe(true);
    expect(status.referral.reasons.some((r) => r.includes('SR'))).toBe(true);
    expect(status.referral.reasons.some((r) => r.includes('회피'))).toBe(false);
  });

  it('4. 보정 실패 후 통과형: 1차 미통과, 재시도 후 통과', () => {
    const { data, status } = load('calibration');
    const first = calibrationPass(data.calibration.slice(0, 3));
    expect(first.pass).toBe(false);
    expect(first.diffs.filter((d) => !d.ok)).toHaveLength(2);
    expect(status.calibration.pass).toBe(true);
    expect(status.calibration.rated).toBe(6);
    expect(status.phase.phase).toBe(1);
  });

  it('모든 시나리오: 주당 probe 1건, 12주 데이터', () => {
    for (const name of ['improving', 'plateau', 'relapse', 'calibration'] as const) {
      const { data, status } = load(name);
      const keys = data.recording.filter((r) => r.kind === 'probe').map((r) => r.weekKey);
      expect(new Set(keys).size).toBe(keys.length);
      expect(status.daysInProgram).toBe(84);
      expect(status.streak.days).toBeGreaterThanOrEqual(0);
    }
  });
});
