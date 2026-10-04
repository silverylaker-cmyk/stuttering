import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { measureLatencyMs } from '../audio/context';
import { InstallGuide } from '../components/InstallGuide';
import { Card, Chips, Modal, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { BackupError, downloadBlob, exportBackup, parseBackup, restoreBackup, type BackupData } from '../db/backup';
import { db, pruneBlobs, setSetting, wipeAll } from '../db/db';
import { diffDays, toSeoulDate, today } from '../lib/date';
import { hashPin, isValidPin, newSalt } from '../lib/pin';
import { navigate, useRoute } from '../router';
import { SCENARIOS, buildScenario, type ScenarioName } from '../seed/scenarios';

export function SettingsPage() {
  const { settings, clinician, data } = useApp();
  const { params } = useRoute();
  const [msg, setMsg] = useState('');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ data: BackupData; audio: Record<string, Uint8Array> } | null>(null);
  const [latency, setLatency] = useState<ReturnType<typeof measureLatencyMs> | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [storage, setStorage] = useState<{ used: number; persisted: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const installRef = useRef<HTMLDivElement>(null);
  const backupDays = settings.lastBackupAt ? diffDays(toSeoulDate(new Date(settings.lastBackupAt)), today()) : null;

  useEffect(() => {
    if (params.get('install')) installRef.current?.scrollIntoView({ behavior: 'smooth' });
    void (async () => {
      const est = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      setStorage({ used: est?.usage ?? 0, persisted });
    })();
  }, [params]);

  const doExport = async () => {
    setBusy(true);
    try {
      const { file, filename } = await exportBackup(includeAudio);
      downloadBlob(file, filename);
      await setSetting('lastBackupAt', new Date().toISOString());
      setMsg(`${filename} 파일을 만들었습니다. 안전한 곳(클라우드·PC)에 보관하세요.`);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (fileRef.current) fileRef.current.value = '';
    if (!(await clinician.require('백업 가져오기는 원장 PIN이 필요합니다.'))) return;
    try {
      setPending(await parseBackup(f));
    } catch (e) {
      setMsg(e instanceof BackupError ? e.message : '백업 파일을 읽지 못했습니다.');
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    setBusy(true);
    await restoreBackup(pending);
    setPending(null);
    setBusy(false);
    navigate('/', true);
  };

  const loadDemo = async (name: ScenarioName) => {
    if (!(await clinician.require('데모 데이터를 불러오면 현재 기록이 모두 지워집니다.'))) return;
    if (!window.confirm('현재 기록을 모두 지우고 데모 데이터로 바꿀까요? (데모 PIN: 0000)')) return;
    await restoreBackup({ data: buildScenario(name, today()), audio: {} });
    clinician.lock();
    navigate('/', true);
  };

  const wipe = async () => {
    if (!(await clinician.require('모든 기록을 삭제하려면 원장 PIN이 필요합니다.'))) return;
    if (!window.confirm('정말 모든 기록과 녹음을 삭제할까요? 되돌릴 수 없습니다.')) return;
    await wipeAll();
    navigate('/', true);
  };

  return (
    <>
      <TopBar title="설정" backTo="/" />
      <div className="page">
        <Card title="백업" tone={backupDays == null || backupDays > PROGRAM.backup.warnDays ? 'warn' : undefined}>
          <span className="small">{backupDays == null ? '아직 백업한 적이 없습니다.' : `마지막 백업 ${backupDays}일 전`}</span>
          <label className="row">
            <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} style={{ width: 22, height: 22 }} />
            녹음 파일 포함 (zip)
          </label>
          <button className="btn primary" disabled={busy} onClick={() => void doExport()}>
            내보내기
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            가져오기 (원장 PIN · 전체 교체)
          </button>
          <input ref={fileRef} type="file" accept=".json,.zip,application/json,application/zip" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}
        </Card>

        <Card title="화면">
          <span className="small muted">글자 크기</span>
          <Chips
            options={[
              { value: '0', label: '작게' },
              { value: '1', label: '보통' },
              { value: '2', label: '크게' },
            ]}
            value={String(settings.fontScale)}
            onChange={(v) => setSetting('fontScale', Number(v) as 0 | 1 | 2)}
          />
          <span className="small muted">테마</span>
          <Chips
            options={[
              { value: 'system', label: '기기 설정' },
              { value: 'light', label: '밝게' },
              { value: 'dark', label: '어둡게' },
            ]}
            value={settings.theme}
            onChange={(v) => setSetting('theme', v as 'system' | 'light' | 'dark')}
          />
        </Card>

        <Card title="녹음 보관">
          <label className="field">
            일반 녹음 파일 보관 개수
            <span className="hint">주간 평가·보정 녹음은 개수와 관계없이 계속 보관합니다. 초과분은 파일만 지우고 수치는 남깁니다.</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={settings.keepBlobs}
              onChange={async (e) => {
                const n = Math.max(1, Math.min(200, Number(e.target.value) || PROGRAM.recording.keepBlobs));
                await setSetting('keepBlobs', n);
                await pruneBlobs(n);
              }}
            />
          </label>
        </Card>

        <Card title="오디오 지연 테스트">
          <span className="small muted">DAF 사용 전 이어폰을 연결한 상태에서 측정하세요.</span>
          <button className="btn" onClick={() => setLatency(measureLatencyMs())}>
            측정
          </button>
          {latency && (
            <p className={`small card ${latency.total > PROGRAM.daf.latencyWarnMs ? 'warn' : 'primary'}`} style={{ margin: 0 }}>
              기본 {latency.base}ms + 출력 {latency.output}ms = <b>{latency.total}ms</b>
              {latency.total > PROGRAM.daf.latencyWarnMs ? ` — ${PROGRAM.daf.latencyWarnMs}ms를 넘어 DAF 지연이 실제보다 길게 들릴 수 있어요. 블루투스 대신 유선 이어폰을 쓰세요.` : ' — 양호'}
            </p>
          )}
        </Card>

        <Card title="원장 PIN">
          <button className="btn" onClick={async () => (await clinician.require('현재 PIN을 확인합니다.')) && setPinOpen(true)}>
            PIN 변경
          </button>
          {clinician.unlocked && (
            <>
              <button className="btn" onClick={() => navigate('/clinic')}>
                원장 설정 열기
              </button>
              <button className="btn ghost" onClick={clinician.lock}>
                원장 모드 잠그기
              </button>
            </>
          )}
        </Card>

        <div ref={installRef}>
          <Card title="홈 화면 설치">
            <InstallGuide />
            {!settings.installDismissed && (
              <button className="btn ghost" onClick={() => setSetting('installDismissed', true)}>
                안내 배너 숨기기 (Android·PC)
              </button>
            )}
          </Card>
        </div>

        <Card title="저장소" tone="soft">
          <span className="small">
            사용량 {storage ? `${(storage.used / 1024 / 1024).toFixed(1)}MB` : '…'} · 영구 저장 {storage?.persisted ? '허용됨' : '미허용'}
          </span>
          <span className="small muted">모든 데이터는 이 기기에만 저장되며 외부로 전송되지 않습니다.</span>
        </Card>

        <Card title="데모·초기화" tone="soft">
          <span className="small muted">12주 시드 시나리오로 화면을 확인할 수 있습니다 (원장 PIN, 현재 데이터 삭제됨).</span>
          {SCENARIOS.map((s) => (
            <button key={s.name} className="btn" onClick={() => void loadDemo(s.name)}>
              {s.label}
            </button>
          ))}
          <button className="btn danger" onClick={() => void wipe()}>
            모든 기록 삭제
          </button>
        </Card>

        <p className="small muted center">
          말하기 훈련 v{__APP_VERSION__} · 외래 치료 보조 훈련 도구
          <br />
          시작일 {data.profile.startDate}
        </p>
      </div>

      <Modal open={!!pending} onClose={() => setPending(null)} label="백업 가져오기">
        <h2>백업 가져오기</h2>
        {pending && (
          <p>
            {new Date(pending.data.exportedAt).toLocaleString('ko-KR')}에 만든 백업입니다 (일일기록 {pending.data.tables.dailyLog?.length ?? 0}일, 녹음{' '}
            {pending.data.tables.recording?.length ?? 0}건{pending.data.includesAudio ? ', 녹음 파일 포함' : ''}).
          </p>
        )}
        <p className="card warn small" style={{ margin: 0 }}>
          현재 기기의 모든 기록이 백업 내용으로 <b>교체</b>됩니다.
        </p>
        <div className="row">
          <button className="btn" onClick={() => setPending(null)}>
            취소
          </button>
          <button className="btn danger grow" disabled={busy} onClick={() => void doRestore()}>
            교체하기
          </button>
        </div>
      </Modal>

      {pinOpen && <PinChange onClose={() => setPinOpen(false)} />}
    </>
  );
}

function PinChange({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const ok = isValidPin(pin) && pin === pin2;
  const save = async () => {
    const salt = newSalt();
    await db.profile.update(1, { pinSalt: salt, pinHash: await hashPin(pin, salt) });
    onClose();
  };
  const clean = (v: string) => v.replace(/\D/g, '').slice(0, PROGRAM.pin.maxLength);
  return (
    <Modal open onClose={onClose} label="PIN 변경">
      <h2>새 원장 PIN</h2>
      <label className="field">
        새 PIN ({PROGRAM.pin.minLength}–{PROGRAM.pin.maxLength}자리)
        <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(clean(e.target.value))} />
      </label>
      <label className="field">
        PIN 확인
        <input type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(clean(e.target.value))} />
      </label>
      <div className="row">
        <button className="btn" onClick={onClose}>
          취소
        </button>
        <button className="btn primary grow" disabled={!ok} onClick={() => void save()}>
          변경
        </button>
      </div>
    </Modal>
  );
}
