import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Recorder, type RecordingResult } from '../audio/recorder';
import { BlobAudio, Card, Chips, TopBar, VideoSlot, fmtSec } from '../components/ui';
import { PROGRAM } from '../config/program';
import { GUIDES } from '../content';
import { useTrainingSession } from '../useSession';
import { MicHelp } from './ProlongedTrainer';

type Tab = 'cancellation' | 'pullout';
const base = import.meta.env.BASE_URL;

/** 말더듬 수정법 (v1.1, M9). Phase 3 이상 + 원장 활성화 시에만 열린다. */
export function ModificationPage() {
  const { status, settings } = useApp();
  const [tab, setTab] = useState<Tab>('cancellation');
  const session = useTrainingSession('modification', () => ({}));
  const allowed = status.phase.phase >= 3 && settings.modificationEnabled;

  if (!allowed) {
    return (
      <>
        <TopBar title="말더듬 수정법" backTo="/train" />
        <div className="page">
          <Card>Phase 3 이상에서 원장님이 활성화하면 사용할 수 있습니다.</Card>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="말더듬 수정법" backTo="/train" right={<span className="badge tabnum">{fmtSec(session.elapsedSec)}</span>} />
      <div className="page">
        <Chips
          options={[
            { value: 'cancellation', label: 'Cancellation' },
            { value: 'pullout', label: 'Pull-out' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        {tab === 'cancellation' ? <Cancellation onActivity={session.start} /> : <Pullout onActivity={session.start} />}
        <button className="btn primary block" disabled={session.elapsedSec < 1} onClick={() => void session.save()}>
          세션 종료하고 기록하기
        </button>
      </div>
    </>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: '1.2rem' }} className="stack">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

function Cancellation({ onActivity }: { onActivity: () => void }) {
  const words = GUIDES.modification.words;
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<'say' | 'pause' | 'redo'>('say');
  const [left, setLeft] = useState(0);
  const [reps, setReps] = useState(0);
  const timer = useRef<number | null>(null);
  const pause = PROGRAM.modification.pauseSec;

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  const startPause = () => {
    onActivity();
    setStage('pause');
    const end = performance.now() + pause * 1000;
    setLeft(pause);
    timer.current = window.setInterval(() => {
      const l = (end - performance.now()) / 1000;
      if (l <= 0) {
        window.clearInterval(timer.current!);
        setStage('redo');
        setLeft(0);
      } else setLeft(l);
    }, 50);
  };

  return (
    <>
      <Card title="Cancellation">
        <Steps items={GUIDES.modification.cancellation} />
      </Card>
      <Card tone="primary">
        <div className="center" style={{ fontSize: '2.4rem', fontWeight: 800, padding: '12px 0' }}>
          {words[i % words.length]}
        </div>
        {stage === 'say' && (
          <>
            <p className="center small muted" style={{ margin: 0 }}>
              단어를 말해 보세요. 더듬었다면(또는 연습으로) 끝까지 말한 뒤 아래 버튼을 누르세요.
            </p>
            <button className="btn primary lg" onClick={startPause}>
              단어 끝 → 멈추기
            </button>
          </>
        )}
        {stage === 'pause' && (
          <div className="stack center">
            <div className="big-num">{left.toFixed(1)}초</div>
            <p className="small" style={{ margin: 0 }}>멈추고, 긴장을 알아차리세요.</p>
            <div style={{ height: 8, background: 'var(--line)', borderRadius: 4 }}>
              <div style={{ height: 8, width: `${(1 - left / pause) * 100}%`, background: 'var(--primary)', borderRadius: 4 }} />
            </div>
          </div>
        )}
        {stage === 'redo' && (
          <>
            <p className="center" style={{ margin: 0 }}>
              <b>이제 같은 단어를 연장발화로 부드럽게 다시!</b>
            </p>
            <button
              className="btn primary lg"
              onClick={() => {
                setReps(reps + 1);
                setI(i + 1);
                setStage('say');
              }}
            >
              다시 말했어요 · 다음 단어
            </button>
          </>
        )}
        <span className="small muted center">이번 세션 {reps}회</span>
      </Card>
      <VideoSlot k="cancellation" title="Cancellation" />
    </>
  );
}

function Pullout({ onActivity }: { onActivity: () => void }) {
  const words = GUIDES.modification.words;
  const [i, setI] = useState(0);
  const [rec, setRec] = useState<Recorder | null>(null);
  const [mine, setMine] = useState<RecordingResult | null>(null);
  const [modelMissing, setModelMissing] = useState(false);
  const [micErr, setMicErr] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const playModel = (then?: () => void) => {
    onActivity();
    audio.current?.pause();
    const a = new Audio(`${base}audio/model/pullout.m4a`);
    audio.current = a;
    a.onerror = () => setModelMissing(true);
    a.onended = () => then?.();
    a.play().catch(() => setModelMissing(true));
  };

  const toggle = async () => {
    onActivity();
    if (rec) {
      setMine(await rec.stop());
      setRec(null);
      return;
    }
    try {
      setMicErr(false);
      setRec(await Recorder.start());
    } catch {
      setMicErr(true);
    }
  };

  return (
    <>
      <Card title="Pull-out">
        <Steps items={GUIDES.modification.pullout} />
      </Card>
      <Card tone="primary">
        <div className="center" style={{ fontSize: '2.4rem', fontWeight: 800, padding: '12px 0' }}>
          {words[i % words.length]}
        </div>
        <p className="center small muted" style={{ margin: 0 }}>
          첫소리에서 일부러 살짝 막힌 듯 멈췄다가, 힘을 빼고 길게 늘이며 빠져나와 보세요.
        </p>
        <div className="grid2">
          <button className="btn" onClick={() => playModel()}>
            🔊 시범 듣기
          </button>
          <button className="btn" onClick={() => setI(i + 1)}>
            다음 단어 ›
          </button>
        </div>
        {modelMissing && <span className="small muted">시범 음성은 준비 중입니다.</span>}
      </Card>
      <Card title="녹음 비교">
        <div className="grid2">
          <button className={`btn ${rec ? 'danger' : ''}`} onClick={() => void toggle()}>
            {rec ? '■ 녹음 중지' : '● 녹음'}
          </button>
          <button
            className="btn"
            disabled={!mine}
            onClick={() => {
              const playMine = () => mine && void new Audio(URL.createObjectURL(mine.blob)).play();
              if (modelMissing) playMine();
              else playModel(playMine);
            }}
          >
            시범 → 나 비교
          </button>
        </div>
        {mine && <BlobAudio blob={mine.blob} />}
        {micErr && <MicHelp />}
      </Card>
      <VideoSlot k="pullout" title="Pull-out" />
    </>
  );
}
