import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import type { RecordingResult } from '../audio/recorder';
import { Capture } from '../components/Capture';
import { ExCard, Icon, Illust, RowItem, Section } from '../components/design';
import { TapCounter, type Counts } from '../components/TapCounter';
import { BlobAudio, Card, Chips, Empty, Scale, TopBar, VideoSlot, fmtSec } from '../components/ui';
import { PROGRAM, RECORDING_KINDS } from '../config/program';
import { SENTENCES, probeTopicFor } from '../content';
import { db, pruneBlobs, saveRecording } from '../db/db';
import type { Recording, RecordingKind } from '../db/types';
import { formatKDate, weekKey } from '../lib/date';
import { pctSS, spm } from '../lib/logic';
import { navigate, useRoute } from '../router';

const KIND_LABEL: Record<RecordingKind, string> = {
  probe: '주간 평가',
  reading: '낭독',
  conversation: '대화',
  phone: '전화',
  calibration: '기저·보정',
  dafTest: 'DAF 테스트',
  other: '기타',
};

export function RecordPage() {
  const { params } = useRoute();
  const kind = params.get('kind') as RecordingKind | null;
  if (params.get('new') || kind) return <RecordFlow initialKind={kind ?? undefined} />;
  return <RecordList />;
}

function RecordList() {
  const { data, clinician, status } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | RecordingKind>('all');
  const list = useMemo(
    () =>
      [...data.recording]
        .filter((r) => filter === 'all' || r.kind === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)),
    [data.recording, filter],
  );

  const remove = async (r: Recording) => {
    if (!(await clinician.require('녹음을 삭제하려면 원장 PIN이 필요합니다.'))) return;
    await db.transaction('rw', db.recording, db.calibration, async () => {
      await db.recording.delete(r.id!);
      await db.calibration.where('recordingId').equals(r.id!).delete();
    });
  };

  return (
    <>
      <TopBar title="녹음·카운트" />
      <div className="page">
        <ExCard
          wide
          to="/record?new=1"
          art={<Illust name="record-probe" />}
          color={2}
          title="새 녹음"
          sub={status.phase.phase >= 1 ? (status.thisWeekProbe ? '이번 주 평가 녹음 완료 · 다른 녹음 추가' : '이번 주 평가 녹음을 아직 안 했어요') : '기저·보정 녹음부터 시작해요'}
        />
        <Chips
          options={[{ value: 'all', label: '전체' }, ...RECORDING_KINDS, { value: 'calibration', label: '기저·보정' }]}
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
        />
        {list.length === 0 ? (
          <div className="stack center">
            <div className="illust-hero" style={{ maxWidth: 160 }}>
              <Illust name="empty-state" />
            </div>
            <Empty>아직 녹음이 없어요.</Empty>
          </div>
        ) : (
          <Section title="녹음 목록" count={list.length}>
            {list.map((r) => (
              <div key={r.id}>
                <RowItem
                  onClick={() => setOpen(open === r.id ? null : r.id!)}
                  icon={<Icon name="mic" size={20} />}
                  color={r.kind === 'probe' ? 1 : r.kind === 'calibration' ? 3 : 2}
                  title={<>{formatKDate(r.date)} · {KIND_LABEL[r.kind]}</>}
                  sub={`%SS ${r.pctSS} · ${r.spm} SPM · NAT ${r.nat} · ${fmtSec(r.durationSec)}`}
                  trailing={<span className="chev">{open === r.id ? '▴' : '▾'}</span>}
                />
                {open === r.id && (
                  <div className="stack" style={{ padding: '4px 14px 14px' }}>
                    {r.topic && <span className="small muted">주제: {r.topic}</span>}
                    <BlobAudio blob={r.blob} />
                    <span className="small muted tabnum">
                      음절 {r.syllables} · 말더듬 {r.stutters}
                    </span>
                    <button className="btn danger" onClick={() => void remove(r)}>
                      삭제 (원장 PIN)
                    </button>
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}
        <p className="small muted">
          일반 녹음 파일은 최근 {PROGRAM.recording.keepBlobs}개까지 보관하고, 주간 평가·보정 녹음은 계속 보관해요. 오래된 파일이 지워져도 수치는 남아요.
        </p>
      </div>
    </>
  );
}

type Step = 'setup' | 'record' | 'count' | 'rate';

function RecordFlow({ initialKind }: { initialKind?: RecordingKind }) {
  const { status, settings, today, data } = useApp();
  const phase = status.phase.phase;
  const [kind, setKind] = useState<RecordingKind>(initialKind ?? (phase >= 1 && !status.thisWeekProbe ? 'probe' : phase === 0 ? 'calibration' : 'conversation'));
  const [step, setStep] = useState<Step>('setup');
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [counts, setCounts] = useState<Counts>({ syllables: 0, stutters: 0 });
  const [nat, setNat] = useState<number | null>(null);
  const [sr, setSr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const topic = probeTopicFor(status.weekIndex);
  const calTopic = probeTopicFor(status.weekIndex + 7 + data.recording.filter((r) => r.kind === 'calibration').length);
  const readingSet = useMemo(() => {
    const lv = phase <= 1 ? 2 : 3;
    const pool = SENTENCES.filter((s) => s.level === lv);
    const start = (status.daysInProgram * 5) % pool.length;
    return Array.from({ length: 6 }, (_, i) => pool[(start + i) % pool.length]);
  }, [phase, status.daysInProgram]);

  const maxSec = kind === 'probe' ? PROGRAM.recording.probeSec : kind === 'calibration' ? PROGRAM.calibration.maxSec : PROGRAM.recording.maxSec;
  const p = pctSS(counts.stutters, counts.syllables);
  const s = result ? spm(counts.syllables, result.durationSec) : 0;
  const needSr = kind === 'calibration';

  const save = async () => {
    if (!result || nat == null || (needSr && sr == null)) return;
    setSaving(true);
    const rec: Recording = {
      date: today,
      kind,
      weekKey: kind === 'probe' ? weekKey(today) : undefined,
      durationSec: result.durationSec,
      syllables: counts.syllables,
      stutters: counts.stutters,
      pctSS: p,
      spm: s,
      nat,
      topic: kind === 'probe' ? topic : kind === 'calibration' ? calTopic : undefined,
      mimeType: result.mimeType,
      blob: result.blob,
      blobDeleted: false,
    };
    const id = await saveRecording(rec);
    if (kind === 'calibration') await db.calibration.add({ recordingId: id, patientSR: sr!, patientNAT: nat });
    await pruneBlobs(settings.keepBlobs);
    navigate('/record', true);
  };

  const kindOptions = [
    ...RECORDING_KINDS.filter((k) => k.value !== 'probe' || phase >= 1),
    ...(phase === 0 || initialKind === 'calibration' ? [{ value: 'calibration' as const, label: '기저·보정' }] : []),
  ];

  return (
    <>
      <TopBar title="새 녹음" backTo="/record" />
      <div className="page">
        <div className="steps" aria-hidden>
          {(['setup', 'record', 'count', 'rate'] as Step[]).map((x, i, arr) => (
            <span key={x} className={arr.indexOf(step) >= i ? 'on' : ''} />
          ))}
        </div>

        {step === 'setup' && (
          <>
            <Card title="녹음 유형">
              <Chips options={kindOptions} value={kind} onChange={(v) => setKind(v as RecordingKind)} />
            </Card>
            {kind === 'probe' && (
              <Card title="이번 주 평가 녹음" tone="primary">
                <p style={{ margin: 0 }}>
                  <b>주제:</b> {topic}
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  누군가에게 이야기하듯 2분 동안 말하세요. 기법을 의식하지 말고 평소처럼 말합니다. 승급 판정은 이 녹음으로만 합니다.
                </p>
                {status.thisWeekProbe && (
                  <p className="card warn small" style={{ margin: 0 }}>
                    이번 주 평가 녹음이 이미 있어요. 새로 저장하면 이전 녹음은 일반 대화 녹음으로 바뀝니다.
                  </p>
                )}
                <VideoSlot k="probe" title="주간 평가 녹음 방법" />
              </Card>
            )}
            {kind === 'calibration' && (
              <Card title="기저·보정 녹음" tone="primary">
                <p style={{ margin: 0 }}>
                  <b>주제:</b> {calTopic}
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  1–2분 동안 대화하듯 말하세요. 녹음 후 내가 느낀 SR·NAT를 매기면, 외래에서 원장님이 같은 녹음을 따로 평가해 비교합니다.
                </p>
                <VideoSlot k="sr-nat" title="SR·NAT 평가법" />
              </Card>
            )}
            {kind === 'reading' && (
              <Card title="낭독 문장">
                {readingSet.map((x) => (
                  <p key={x.id} style={{ margin: 0 }}>
                    {x.text}
                  </p>
                ))}
              </Card>
            )}
            <button className="btn primary lg block" onClick={() => setStep('record')}>
              다음: 녹음
            </button>
          </>
        )}

        {step === 'record' && (
          <Card>
            {kind === 'probe' && <p className="small muted">주제: {topic}</p>}
            {kind === 'calibration' && <p className="small muted">주제: {calTopic}</p>}
            {kind === 'reading' && readingSet.map((x) => <p key={x.id} style={{ margin: 0 }}>{x.text}</p>)}
            <Capture
              maxSec={maxSec}
              targetSec={kind === 'probe' ? PROGRAM.recording.probeSec : kind === 'calibration' ? PROGRAM.calibration.minSec : undefined}
              onDone={(r) => {
                setResult(r);
                setStep('count');
              }}
            />
          </Card>
        )}

        {step === 'count' && result && (
          <>
            <Card title="재생하며 세기">
              <BlobAudio blob={result.blob} label="방금 녹음" />
              <TapCounter onChange={setCounts} />
            </Card>
            <div className="row">
              <button className="btn" onClick={() => setStep('record')}>
                다시 녹음
              </button>
              <button className="btn primary grow" disabled={counts.syllables === 0} onClick={() => setStep('rate')}>
                다음: 평가
              </button>
            </div>
          </>
        )}

        {step === 'rate' && result && (
          <>
            <Card tone="soft">
              <div className="stats">
                <div className="stat">
                  <div className="v">{p}%</div>
                  <div className="l">%SS</div>
                </div>
                <div className="stat">
                  <div className="v">{s}</div>
                  <div className="l">SPM</div>
                </div>
                <div className="stat">
                  <div className="v">{fmtSec(result.durationSec)}</div>
                  <div className="l">길이</div>
                </div>
              </div>
            </Card>
            <Card title="자연스러움 (NAT)">
              <Scale min={PROGRAM.nat.min} max={PROGRAM.nat.max} value={nat} onChange={setNat} lowLabel="매우 자연스러움" highLabel="매우 부자연스러움" columns={9} label="NAT" />
            </Card>
            {needSr && (
              <Card title="말더듬 정도 (SR)">
                <Scale min={PROGRAM.sr.min} max={PROGRAM.sr.max} value={sr} onChange={setSr} lowLabel="말더듬 없음" highLabel="극심" label="SR" />
              </Card>
            )}
            <div className="row">
              <button className="btn" onClick={() => setStep('count')}>
                이전
              </button>
              <button className="btn primary grow" disabled={nat == null || (needSr && sr == null) || saving} onClick={() => void save()}>
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
