import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Metronome } from '../audio/metronome';
import { Recorder, type RecordingResult } from '../audio/recorder';
import { BlobAudio, Card, Chips, TopBar, VideoSlot, fmtSec } from '../components/ui';
import { PROGRAM } from '../config/program';
import { GUIDES, SENTENCES, modelAudioUrl, nearestModelSpm } from '../content';
import { splitGlyphs, syllableIndexAt } from '../lib/syllables';
import { useTrainingSession } from '../useSession';

type Mode = 'hl' | 'hlmet' | 'met';
const MODES: { value: Mode; label: string }[] = [
  { value: 'hl', label: '하이라이트' },
  { value: 'hlmet', label: '하이라이트+메트로놈' },
  { value: 'met', label: '메트로놈만' },
];

export function ProlongedTrainer() {
  const { status } = useApp();
  const phase = status.phase.phase;
  const fixedSpm = status.phase.targetSpm ?? null;
  const [freeSpm, setFreeSpm] = useState(phase >= 3 ? 150 : 70);
  const spm = fixedSpm ?? freeSpm;
  const [level, setLevel] = useState(phase <= 1 ? 1 : phase === 2 ? 2 : 3);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('hl');
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [modelMissing, setModelMissing] = useState(false);
  const [rec, setRec] = useState<Recorder | null>(null);
  const [mine, setMine] = useState<RecordingResult | null>(null);
  const [micError, setMicError] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const list = useMemo(() => SENTENCES.filter((s) => s.level === level), [level]);
  const sentence = list[idx % list.length];
  const glyphs = useMemo(() => splitGlyphs(sentence.text), [sentence]);

  const session = useTrainingSession('prolonged', () => ({ targetSpm: spm, sentenceLevel: level }));
  const met = useRef<Metronome | null>(null);
  const raf = useRef<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    met.current?.stop();
    met.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
  };

  useEffect(() => () => {
    stop();
    audio.current?.pause();
  }, []);

  useEffect(() => {
    stop();
    setCurrent(-1);
    setMine(null);
    setModelMissing(false);
  }, [sentence.id, spm]);

  const play = () => {
    session.start();
    stop();
    setSaved(null);
    const total = sentence.syllables;
    // 메트로놈 모드: 오디오 시계 기준으로 하이라이트 동기화
    const m = new Metronome(spm, { silent: mode === 'hl' });
    m.start();
    met.current = m;
    setPlaying(true);
    const frame = () => {
      const i = syllableIndexAt(m.elapsedMs(), spm, total);
      setCurrent(i);
      // 마지막 음절 뒤 한 박 쉬고 종료
      if (i >= total) {
        if (m.elapsedMs() > (total + 1) * (60000 / spm)) return stop();
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const playModel = (then?: () => void) => {
    session.start();
    audio.current?.pause();
    const a = new Audio(modelAudioUrl(spm, sentence.id));
    audio.current = a;
    a.onerror = () => setModelMissing(true);
    a.onended = () => then?.();
    a.play().catch(() => setModelMissing(true));
  };

  const toggleRecord = async () => {
    session.start();
    if (rec) {
      const r = await rec.stop();
      setRec(null);
      setMine(r);
      return;
    }
    try {
      setMicError(false);
      setMine(null);
      setRec(await Recorder.start());
    } catch {
      setMicError(true);
    }
  };

  const compare = () => {
    if (!mine) return;
    const playMine = () => {
      const a = new Audio(URL.createObjectURL(mine.blob));
      audio.current = a;
      void a.play();
    };
    if (modelMissing) playMine();
    else playModel(playMine);
  };

  const next = (d: number) => setIdx((i) => (i + d + list.length) % list.length);

  const end = async () => {
    stop();
    const sec = await session.save();
    setSaved(sec);
  };

  return (
    <>
      <TopBar title="연장발화 훈련기" backTo="/train" right={<span className="badge tabnum">{fmtSec(session.elapsedSec)}</span>} />
      <div className="page">
        {phase <= 1 && (
          <div className="cue-list" aria-label="기법 큐">
            {GUIDES.cues.map((c) => (
              <div className="cue" key={c.title}>
                <b>{c.title}</b>
                {c.text}
              </div>
            ))}
          </div>
        )}

        <Card>
          <div className="row">
            <span className="badge ok">{spm} SPM</span>
            <span className="badge">난이도 {level}</span>
            <span className="small muted grow" style={{ textAlign: 'right' }}>
              {(idx % list.length) + 1} / {list.length}
            </span>
          </div>
          <div className="sentence" aria-live="off">
            {glyphs.map((g, i) => (
              <span
                key={i}
                className={
                  g.syllable < 0 || mode === 'met' ? '' : g.syllable === current ? 'syl now' : g.syllable < current ? 'syl done' : 'syl'
                }
              >
                {g.ch === ' ' ? ' ' : g.ch}
              </span>
            ))}
          </div>
          <div className="grid2">
            <button className="btn" onClick={() => playModel()}>
              🔊 모델 듣기
            </button>
            <button className={`btn ${playing ? '' : 'primary'}`} onClick={playing ? stop : play}>
              {playing ? '■ 멈춤' : '▶ 따라 하기'}
            </button>
          </div>
          {modelMissing && (
            <p className="small muted" style={{ margin: 0 }}>
              이 문장의 {nearestModelSpm(spm)} SPM 모델 음성은 준비 중입니다. 하이라이트를 따라 연습하세요.
            </p>
          )}
          <div className="grid2">
            <button className="btn" onClick={() => next(-1)}>
              ‹ 이전 문장
            </button>
            <button className="btn" onClick={() => next(1)}>
              다음 문장 ›
            </button>
          </div>
        </Card>

        <Card title="내 목소리 비교">
          <div className="grid2">
            <button className={`btn ${rec ? 'danger' : ''}`} onClick={() => void toggleRecord()}>
              {rec ? (
                <>
                  <span className="rec-dot" /> 녹음 중지
                </>
              ) : (
                '● 녹음'
              )}
            </button>
            <button className="btn" disabled={!mine} onClick={compare}>
              모델 → 나 비교
            </button>
          </div>
          {mine && <BlobAudio blob={mine.blob} label="내 녹음" />}
          {micError && <MicHelp />}
        </Card>

        <Card title="설정" tone="soft">
          <span className="small muted">모드</span>
          <Chips options={MODES} value={mode} onChange={(v) => setMode(v as Mode)} />
          <span className="small muted">난이도</span>
          <Chips
            options={[
              { value: '1', label: '1 (짧은 문장)' },
              { value: '2', label: '2' },
              { value: '3', label: '3 (긴 문장)' },
            ]}
            value={String(level)}
            onChange={(v) => {
              setLevel(Number(v));
              setIdx(0);
            }}
          />
          {fixedSpm == null ? (
            <label className="field">
              속도 {freeSpm} SPM
              <input type="range" min={PROGRAM.spmRange.min} max={PROGRAM.spmRange.max} step={5} value={freeSpm} onChange={(e) => setFreeSpm(Number(e.target.value))} />
            </label>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              목표 속도는 원장님이 정합니다 (현재 {fixedSpm} SPM).
            </p>
          )}
        </Card>

        <button className="btn primary lg block" onClick={() => void end()} disabled={session.elapsedSec < 1}>
          세션 종료하고 기록하기
        </button>
        {saved != null && (
          <p className="center badge ok" style={{ alignSelf: 'center' }}>
            {saved > 0 ? `${Math.round(saved / 60)}분 ${saved % 60}초 기록했어요` : '10초 미만 세션은 기록하지 않아요'}
          </p>
        )}
        <VideoSlot k="prolonged" title="연장발화" />
      </div>
    </>
  );
}

export function MicHelp() {
  return (
    <div className="card danger small">
      <b>마이크를 사용할 수 없어요</b>
      <span>
        브라우저 설정에서 이 앱의 마이크 권한을 허용해 주세요. iPhone: 설정 › Safari › 마이크 (또는 앱 설정) / Android: Chrome ⋮ › 설정 › 사이트 설정 › 마이크.
        권한 없이도 하이라이트·메트로놈 훈련과 기록은 계속할 수 있어요.
      </span>
    </div>
  );
}
