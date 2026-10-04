import { useEffect, useRef, useState } from 'react';
import { Metronome } from '../audio/metronome';
import { Card, TopBar, fmtSec } from '../components/ui';
import { PROGRAM } from '../config/program';
import { useApp } from '../app-context';
import { useTrainingSession } from '../useSession';

export function MetronomePage() {
  const { status } = useApp();
  const [spm, setSpm] = useState(status.phase.targetSpm ?? 120);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);
  const met = useRef<Metronome | null>(null);
  const raf = useRef<number | null>(null);
  const session = useTrainingSession('metronome', () => ({ targetSpm: spm }));

  const stop = () => {
    met.current?.stop();
    met.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    setOn(false);
  };

  const start = () => {
    session.start();
    setSaved(null);
    const m = new Metronome(spm);
    m.start();
    met.current = m;
    setOn(true);
    const frame = () => {
      setBeat(Math.floor(m.elapsedMs() / (60000 / spm)));
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  useEffect(() => stop, []);
  useEffect(() => {
    if (on) {
      stop();
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spm]);

  return (
    <>
      <TopBar title="메트로놈 자유 연습" backTo="/train" right={<span className="badge tabnum">{fmtSec(session.elapsedSec)}</span>} />
      <div className="page">
        <Card>
          <div className="center">
            <div className="big-num">{spm}</div>
            <div className="muted small">음절/분 (SPM)</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <div
              aria-hidden
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                background: on && beat >= 0 && beat % 2 === 0 ? 'var(--primary)' : 'var(--primary-soft)',
                transition: 'background 60ms',
              }}
            />
          </div>
          <input
            type="range"
            aria-label="속도"
            min={PROGRAM.spmRange.min}
            max={PROGRAM.spmRange.max}
            step={5}
            value={spm}
            onChange={(e) => setSpm(Number(e.target.value))}
          />
          <div className="grid3">
            {[70, 120, 150].map((v) => (
              <button key={v} className="btn" onClick={() => setSpm(v)}>
                {v}
              </button>
            ))}
          </div>
          <button className={`btn lg block ${on ? '' : 'primary'}`} onClick={on ? stop : start}>
            {on ? '■ 멈춤' : '▶ 시작'}
          </button>
        </Card>
        <p className="small muted">박 하나에 음절 하나씩, 소리를 이어서 말해 보세요. 낭독 문장이나 오늘 있었던 일을 말해도 좋아요.</p>
        <button
          className="btn primary block"
          disabled={session.elapsedSec < 1}
          onClick={async () => {
            stop();
            setSaved(await session.save());
          }}
        >
          세션 종료하고 기록하기
        </button>
        {saved != null && <p className="center badge ok" style={{ alignSelf: 'center' }}>{saved > 0 ? `${fmtSec(saved)} 기록했어요` : '10초 미만 세션은 기록하지 않아요'}</p>}
      </div>
    </>
  );
}
