import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { StutterDB, TABLES, pruneBlobs, saveRecording } from './db';
import { exportBackup, parseBackup, restoreBackup, BackupError } from './backup';
import { buildScenario } from '../seed/scenarios';
import type { Recording } from './types';

const rec = (over: Partial<Recording>): Recording => ({
  date: '2026-10-01',
  kind: 'reading',
  durationSec: 60,
  syllables: 200,
  stutters: 2,
  pctSS: 1,
  spm: 200,
  nat: 3,
  blobDeleted: false,
  ...over,
});

async function snapshot(d: StutterDB) {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await d.table(t).toArray();
  return out;
}

describe('백업/복원 (M7)', () => {
  it('내보내기 → 데이터 삭제 → 가져오기 완전 복원 (녹음 포함 zip)', async () => {
    const d = new StutterDB('backup-test-1');
    await restoreBackup({ data: buildScenario('improving', '2026-10-04'), audio: {} }, d);
    const id = await saveRecording(rec({ blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), mimeType: 'audio/webm' }), d);
    const before = await snapshot(d);

    const { file, filename } = await exportBackup(true, d);
    expect(filename).toMatch(/^stutter-backup-\d{8}\.zip$/);
    for (const t of TABLES) await d.table(t).clear();
    expect(await d.recording.count()).toBe(0);

    await restoreBackup(await parseBackup(file), d);
    const after = await snapshot(d);
    for (const t of TABLES) {
      if (t === 'recording') continue;
      expect(after[t], t).toEqual(before[t]);
    }
    const strip = (rs: unknown[]) => (rs as Recording[]).map(({ blob: _b, ...r }) => r);
    expect(strip(after.recording)).toEqual(strip(before.recording));
    const restored = await d.recording.get(id);
    expect(restored?.blob).toBeTruthy();
    expect([...new Uint8Array(await restored!.blob!.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('녹음 미포함 json: 수치는 유지, Blob 은 삭제 표시', async () => {
    const d = new StutterDB('backup-test-2');
    const id = await saveRecording(rec({ blob: new Blob([new Uint8Array([9])]) }), d);
    const { file, filename } = await exportBackup(false, d);
    expect(filename).toMatch(/\.json$/);
    await restoreBackup(await parseBackup(file), d);
    const r = await d.recording.get(id);
    expect(r).toMatchObject({ syllables: 200, blobDeleted: true });
    expect(r?.blob).toBeUndefined();
  });

  it('다른 앱 파일·최신 버전 거부', async () => {
    await expect(parseBackup(new Blob(['{"app":"x"}']))).rejects.toBeInstanceOf(BackupError);
    await expect(parseBackup(new Blob(['not json']))).rejects.toBeInstanceOf(BackupError);
    const future = JSON.stringify({ app: 'stutter-trainer', schemaVersion: 999, tables: {} });
    await expect(parseBackup(new Blob([future]))).rejects.toThrow(/최신 버전/);
  });
});

describe('녹음 저장 규칙 (M4)', () => {
  it('probe 는 주당 1건: 재지정 시 이전 건은 일반 녹음으로 전환', async () => {
    const d = new StutterDB('probe-test');
    const a = await saveRecording(rec({ kind: 'probe', weekKey: '2026-W40' }), d);
    const b = await saveRecording(rec({ kind: 'probe', weekKey: '2026-W40' }), d);
    expect((await d.recording.get(a))?.kind).toBe('conversation');
    expect((await d.recording.get(b))?.kind).toBe('probe');
    expect(await d.recording.where('kind').equals('probe').count()).toBe(1);
  });

  it('Blob 보관 개수 초과분만 삭제, probe·보정 녹음은 영구 보관', async () => {
    const d = new StutterDB('prune-test');
    const blob = () => new Blob([new Uint8Array([1])]);
    const probeId = await saveRecording(rec({ kind: 'probe', weekKey: '2026-W01', blob: blob() }), d);
    const calId = await saveRecording(rec({ kind: 'calibration', blob: blob() }), d);
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push(await saveRecording(rec({ blob: blob() }), d));
    expect(await pruneBlobs(3, d)).toBe(2);
    const all = await d.recording.toArray();
    const kept = all.filter((r) => r.blob).map((r) => r.id);
    expect(kept).toEqual(expect.arrayContaining([probeId, calId, ids[2], ids[3], ids[4]]));
    const pruned = await d.recording.get(ids[0]);
    expect(pruned).toMatchObject({ blobDeleted: true, syllables: 200 });
    expect(pruned?.blob).toBeUndefined();
  });
});
