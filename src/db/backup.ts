import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { APP_ID, SCHEMA_VERSION } from '../config/program';
import { compactDate, today } from '../lib/date';
import { db, TABLES, type StutterDB, type TableName } from './db';
import type { Recording } from './types';

export interface BackupData {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  includesAudio: boolean;
  tables: Partial<Record<TableName, unknown[]>>;
}

type RecordingRow = Omit<Recording, 'blob'> & { audioFile?: string };

const extFor = (mime?: string) => (mime?.includes('mp4') || mime?.includes('aac') ? 'm4a' : mime?.includes('ogg') ? 'ogg' : 'webm');

export async function buildBackup(includeAudio: boolean, d: StutterDB = db) {
  const tables: BackupData['tables'] = {};
  const audio: Record<string, Uint8Array> = {};
  for (const t of TABLES) {
    const rows = await d.table(t).toArray();
    if (t === 'recording') {
      tables.recording = await Promise.all(
        (rows as Recording[]).map(async (r) => {
          const { blob, ...rest } = r;
          const row: RecordingRow = { ...rest };
          if (blob && includeAudio) {
            const name = `audio/${r.id}.${extFor(r.mimeType)}`;
            audio[name] = new Uint8Array(await blob.arrayBuffer());
            row.audioFile = name;
          } else if (blob) {
            // 녹음 미포함 백업: 복원 시 Blob 은 없으므로 삭제된 것으로 표시
            row.blobDeleted = true;
          }
          return row;
        }),
      );
    } else {
      tables[t] = rows;
    }
  }
  const data: BackupData = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    includesAudio: includeAudio,
    tables,
  };
  return { data, audio };
}

/** 내보내기 파일 생성. 녹음 포함 시 zip, 아니면 json. */
export async function exportBackup(includeAudio: boolean, d: StutterDB = db): Promise<{ file: Blob; filename: string }> {
  const { data, audio } = await buildBackup(includeAudio, d);
  const base = `stutter-backup-${compactDate(today())}`;
  const json = JSON.stringify(data);
  if (!includeAudio) {
    return { file: new Blob([json], { type: 'application/json' }), filename: `${base}.json` };
  }
  const zipped = zipSync({ 'data.json': strToU8(json), ...audio }, { level: 0 });
  return { file: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), filename: `${base}.zip` };
}

export class BackupError extends Error {}

export async function parseBackup(file: Blob): Promise<{ data: BackupData; audio: Record<string, Uint8Array> }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  let data: BackupData;
  let audio: Record<string, Uint8Array> = {};
  try {
    if (isZip) {
      const files = unzipSync(buf);
      if (!files['data.json']) throw new BackupError('백업 파일에 data.json 이 없습니다.');
      data = JSON.parse(strFromU8(files['data.json']));
      audio = files;
    } else {
      data = JSON.parse(strFromU8(buf));
    }
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError('백업 파일을 읽을 수 없습니다.');
  }
  validate(data);
  return { data, audio };
}

function validate(data: BackupData) {
  if (data?.app !== APP_ID || typeof data.schemaVersion !== 'number' || !data.tables)
    throw new BackupError('이 앱의 백업 파일이 아닙니다.');
  if (data.schemaVersion > SCHEMA_VERSION)
    throw new BackupError(`더 최신 버전(v${data.schemaVersion})의 백업입니다. 앱을 업데이트한 뒤 가져오세요.`);
}

/** 전체 교체 방식으로 복원한다. */
export async function restoreBackup(parsed: { data: BackupData; audio: Record<string, Uint8Array> }, d: StutterDB = db) {
  const { data, audio } = parsed;
  // 이전 스키마 버전의 백업은 여기서 변환한다 (현재 v1 뿐).
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) await d.table(t).clear();
    for (const t of TABLES) {
      const rows = (data.tables[t] ?? []) as Record<string, unknown>[];
      if (t === 'recording') {
        const recs = rows.map((row) => {
          const { audioFile, ...rest } = row as RecordingRow;
          const r = rest as Recording;
          const bytes = audioFile ? audio[audioFile] : undefined;
          if (bytes) {
            r.blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: r.mimeType || 'audio/webm' });
            r.blobDeleted = false;
          } else {
            r.blobDeleted = true;
          }
          return r;
        });
        await d.recording.bulkAdd(recs);
      } else if (rows.length) {
        await d.table(t).bulkAdd(rows);
      }
    }
  });
}

export function downloadBlob(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
