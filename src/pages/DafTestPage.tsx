import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { DafChain } from '../audio/daf';
import type { RecordingResult } from '../audio/recorder';
import { Capture } from '../components/Capture';
import { EarphoneCheck } from '../components/Earphone';
import { Badge, BlobAudio, Card, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { DAF_PASSAGES } from '../content';
import { db, saveRecording, setSetting } from '../db/db';
import { dafResponder, pctSS, spm } from '../lib/logic';
import { countSyllables } from '../lib/syllables';
import { navigate } from '../router';

interface Condition {
  key: 'naf1' | 'daf' | 'naf2' | 'dafFaf';
  label: string;
  delayMs: number;
  shift: number;
  feedback: boolean;
}

const D = PROGRAM.daf;
const CONDITIONS: Condition[] = [
  { key: 'naf1', label: 'NAF (변형 없음)', delayMs: 0, shift: 0, feedback: false },
  { key: 'daf', label: `DAF ${D.defaultDelayMs}ms`, delayMs: D.defaultDelayMs, shift: 0, feedback: true },
  { key: 'naf2', label: 'NAF (변형 없음)', delayMs: 0, shift: 0, feedback: false },
  { key: 'dafFaf', label: `DAF ${D.defaultDelayMs}ms + FAF +${D.testFafShift}옥타브`, delayMs: D.defaultDelayMs, shift: D.testFafShift, feedback: true },
];

interface Done {
  recordingId: number;
  pct: number;
}

/** DAF/FAF 반응 테스트 (M8). 조건 순서: NAF → DAF → NAF → DAF+FAF, 다른 날 1회 반복. */
export function DafTestPage() {
  const { data, settings, status, today } = useApp();
  const sessionNo = (Math.min(data.dafTest.length, D.sessions - 1) + 1) as 1 | 2;
  const doneToday = data.dafTest.some((t) => t.date === today);
  const finished = data.dafTest.length >= D.sessions;
  const passage = DAF_PASSAGES[(sessionNo - 1) % DAF_PASSAGES.length];
  const syllables = countSyllables(passage.text);

  const [earOk, setEarOk] = useState(false);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'count'>('ready');
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [stutters, setStutters] = useState(0);
  const [done, setDone] = useState<Done[]>([]);
  const chain = useRef<DafChain | null>(null);

  useEffect(() => () => chain.current?.stop(), []);

  if (!settings.dafTestEnabled) {
    return (
      <>
        <TopBar title="DAF 반응 테스트" backTo="/train" />
        <div className="page">
          <Card>원장님이 반응 테스트를 활성화하면 진행할 수 있습니다.</Card>
        </div>
      </>
    );
  }

  if (finished) {
    const r = status.daf;
    return (
      <>
        <TopBar title="DAF 반응 테스트" backTo="/train" />
        <div className="page">
          <Card title="결과" right={<Badge tone={r.responder ? 'ok' : undefined}>{r.responder ? '반응자' : '비반응'}</Badge>}>
            {r.sessions.map((s, i) => (
              <p key={i} className="small" style={{ margin: 0 }}>
                세션 {i + 1}: NAF 평균 {s.nafMean}% · DAF 감소 {Math.round(s.dafReduction * 100)}% · DAF+FAF 감소{' '}
                {s.dafFafReduction == null ? '–' : `${Math.round(s.dafFafReduction * 100)}%`}
              </p>
            ))}
            <p className="small muted" style={{ margin: 0 }}>
              기준: 두 세션 모두 NAF 평균 대비 {D.responderReduction * 100}% 이상 감소.{' '}
              {r.responder ? 'DAF 상황 보조 도구가 열렸습니다.' : 'DAF 도구는 사용하지 않고 기존 훈련을 계속합니다.'}
            </p>
          </Card>
        </div>
      </>
    );
  }

  const cond = CONDITIONS[step];

  const begin = async () => {
    if (cond.feedback) {
      chain.current = new DafChain();
      await chain.current.start({ delayMs: cond.delayMs, shift: cond.shift });
    }
    setPhase('recording');
  };

  const onRecorded = (r: RecordingResult) => {
    chain.current?.stop();
    chain.current = null;
    setResult(r);
    setStutters(0);
    setPhase('count');
  };

  const saveCondition = async () => {
    if (!result) return;
    const p = pctSS(stutters, syllables);
    const id = await saveRecording({
      date: today,
      kind: 'dafTest',
      durationSec: result.durationSec,
      syllables,
      stutters,
      pctSS: p,
      spm: spm(syllables, result.durationSec),
      nat: 0,
      topic: `${passage.title} · ${cond.label}`,
      mimeType: result.mimeType,
      blob: result.blob,
      blobDeleted: false,
    });
    const nextDone = [...done, { recordingId: id, pct: p }];
    setDone(nextDone);
    setResult(null);
    if (step < CONDITIONS.length - 1) {
      setStep(step + 1);
      setPhase('ready');
      return;
    }
    const [naf1, dafR, naf2, dafFaf] = nextDone;
    await db.dafTest.add({
      date: today,
      session: sessionNo,
      nafPctSS: [naf1.pct, naf2.pct],
      dafPctSS: dafR.pct,
      dafFafPctSS: dafFaf.pct,
      recordingIds: nextDone.map((d) => d.recordingId),
    });
    const all = await db.dafTest.toArray();
    if (dafResponder(all).responder) await setSetting('dafToolEnabled', true);
    navigate('/daf-test', true);
  };

  return (
    <>
      <TopBar title={`DAF 반응 테스트 · 세션 ${sessionNo}/${D.sessions}`} backTo="/train" />
      <div className="page">
        {doneToday ? (
          <Card tone="warn">오늘 세션을 마쳤습니다. 2회차는 다른 날 진행하세요.</Card>
        ) : (
          <>
            <div className="steps" aria-hidden>
              {CONDITIONS.map((c, i) => (
                <span key={c.key} className={i <= step ? 'on' : ''} />
              ))}
            </div>
            <Card title={`조건 ${step + 1}/4: ${cond.label}`} tone="primary">
              <p style={{ margin: 0, lineHeight: 1.8 }}>{passage.text}</p>
              <span className="small muted">
                「{passage.title}」 · {syllables}음절 · 평소 속도로 소리 내어 읽으세요. 기법은 쓰지 않습니다.
              </span>
            </Card>

            {phase === 'ready' && (
              <button className="btn primary lg block" onClick={() => (earOk ? void begin() : setEarOk(false))}>
                {earOk ? '조건 시작' : '유선 이어폰 확인 후 시작'}
              </button>
            )}
            {phase === 'recording' && (
              <Card>
                <Capture maxSec={PROGRAM.recording.maxSec} raw onDone={onRecorded} startLabel="● 낭독 녹음 시작" />
              </Card>
            )}
            {phase === 'count' && result && (
              <Card title="말더듬 세기">
                <BlobAudio blob={result.blob} />
                <button className="btn lg" style={{ background: 'var(--accent)', color: 'var(--surface)', minHeight: 110 }} onPointerDown={(e) => { e.preventDefault(); setStutters((s) => s + 1); }}>
                  말더듬 +1 <span className="big-num" style={{ marginLeft: 8 }}>{stutters}</span>
                </button>
                <div className="row">
                  <button className="btn grow" disabled={!stutters} onClick={() => setStutters((s) => Math.max(0, s - 1))}>
                    ↶ 되돌리기
                  </button>
                  <span className="badge tabnum">%SS {pctSS(stutters, syllables)}</span>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  지문 음절 수({syllables})는 정해져 있으므로 말더듬만 세면 됩니다.
                </p>
                <div className="row">
                  <button className="btn" onClick={() => setPhase('ready')}>
                    다시 녹음
                  </button>
                  <button className="btn primary grow" onClick={() => void saveCondition()}>
                    {step < CONDITIONS.length - 1 ? '저장하고 다음 조건' : '저장하고 세션 완료'}
                  </button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
      <EarphoneCheck
        open={phase === 'ready' && !earOk && !doneToday}
        onOk={() => setEarOk(true)}
        onCancel={() => navigate('/train', true)}
      />
    </>
  );
}
