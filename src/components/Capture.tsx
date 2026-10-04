import { useEffect, useRef, useState } from 'react';
import { Recorder, micErrorKind, type RecordingResult } from '../audio/recorder';
import { MicHelp } from '../pages/ProlongedTrainer';
import { fmtSec } from './ui';

/** 녹음 버튼 + 타이머. maxSec 에 도달하면 자동 정지. */
export function Capture({
  maxSec,
  targetSec,
  onDone,
  raw = false,
  onStart,
  startLabel = '● 녹음 시작',
}: {
  maxSec: number;
  targetSec?: number;
  onDone: (r: RecordingResult) => void;
  raw?: boolean;
  onStart?: () => void;
  startLabel?: string;
}) {
  const [rec, setRec] = useState<Recorder | null>(null);
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<Recorder | null>(null);

  const stop = async () => {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    setRec(null);
    onDone(await r.stop());
  };

  useEffect(() => {
    if (!rec) return;
    const id = window.setInterval(() => {
      const s = rec.elapsedSec();
      setSec(s);
      if (s >= maxSec) void stop();
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, maxSec]);

  useEffect(() => () => void recRef.current?.stop(), []);

  const start = async () => {
    setErr(null);
    try {
      const r = await Recorder.start(raw);
      recRef.current = r;
      setSec(0);
      setRec(r);
      onStart?.();
    } catch (e) {
      setErr(micErrorKind(e));
    }
  };

  return (
    <div className="stack">
      <div className="timer" aria-live="polite">
        {rec && <span className="rec-dot" style={{ marginRight: 8 }} />}
        {fmtSec(sec)}
        <span className="muted" style={{ fontSize: '1rem' }}>
          {' '}
          / {fmtSec(targetSec ?? maxSec)}
        </span>
      </div>
      {targetSec && rec && sec >= targetSec && <p className="center badge ok" style={{ alignSelf: 'center' }}>목표 시간 도달 — 마무리하고 정지하세요</p>}
      {rec ? (
        <button className="btn danger lg block" onClick={() => void stop()}>
          ■ 정지
        </button>
      ) : (
        <button className="btn primary lg block" onClick={() => void start()}>
          {startLabel}
        </button>
      )}
      {err && <MicHelp />}
    </div>
  );
}
