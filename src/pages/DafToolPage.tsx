import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { DafChain } from '../audio/daf';
import { measureLatencyMs } from '../audio/context';
import { EarphoneCheck } from '../components/Earphone';
import { Card, Chips, TopBar, fmtSec } from '../components/ui';
import { PROGRAM } from '../config/program';
import { navigate } from '../router';
import { useTrainingSession } from '../useSession';

const D = PROGRAM.daf;

/** 반응자 전용 DAF 상황 보조 도구. 일일 훈련 시간 집계에서 제외된다(type 'daf'). */
export function DafToolPage() {
  const { status, settings } = useApp();
  const allowed = status.daf.responder && settings.dafToolEnabled;
  const [earOk, setEarOk] = useState(false);
  const [delayMs, setDelayMs] = useState<number>(D.defaultDelayMs);
  const [shift, setShift] = useState<number>(status.daf.condition === 'dafFaf' ? D.testFafShift : 0);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState(false);
  const chain = useRef<DafChain | null>(null);
  const session = useTrainingSession('daf', () => ({ dafDelayMs: delayMs, fafShift: shift }));
  const latency = useRef<number | null>(null);

  useEffect(() => () => chain.current?.stop(), []);
  useEffect(() => {
    if (on) void chain.current?.apply({ delayMs, shift });
  }, [delayMs, shift, on]);

  if (!allowed) {
    return (
      <>
        <TopBar title="DAF 상황 보조" backTo="/train" />
        <div className="page">
          <Card>DAF 반응 테스트에서 반응자로 판정되고 원장님이 허용한 경우에만 사용할 수 있습니다.</Card>
        </div>
      </>
    );
  }

  const start = async () => {
    setErr(false);
    try {
      latency.current = measureLatencyMs().total;
      chain.current = new DafChain();
      await chain.current.start({ delayMs, shift });
      session.start();
      setOn(true);
    } catch {
      setErr(true);
    }
  };
  const stop = async () => {
    chain.current?.stop();
    chain.current = null;
    setOn(false);
    await session.save();
  };

  return (
    <>
      <TopBar title="DAF 상황 보조" backTo="/train" right={<span className="badge tabnum">{fmtSec(session.elapsedSec)}</span>} />
      <div className="page">
        <Card tone="soft">
          <p className="small" style={{ margin: 0 }}>
            발표·전화 <b>직전</b>에 잠깐 쓰는 보조 도구입니다. 일일 훈련을 대신하지 않으며 훈련 시간에도 포함되지 않습니다.
          </p>
        </Card>
        <Card title="지연 (DAF)">
          <div className="big-num center">{delayMs}ms</div>
          <input type="range" aria-label="지연 시간" min={D.delayRangeMs[0]} max={D.delayRangeMs[1]} step={5} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} />
        </Card>
        <Card title="음높이 (FAF)">
          <Chips
            options={D.fafShifts.map((s) => ({ value: String(s), label: s === 0 ? '끔' : `${s > 0 ? '+' : ''}${s}옥타브` }))}
            value={String(shift)}
            onChange={(v) => setShift(Number(v))}
          />
        </Card>
        <button className={`btn lg block ${on ? 'danger' : 'primary'}`} onClick={() => (on ? void stop() : earOk ? void start() : setEarOk(false))}>
          {on ? '■ 끄기' : '▶ 켜기'}
        </button>
        {latency.current != null && latency.current > D.latencyWarnMs && (
          <p className="card warn small" style={{ margin: 0 }}>
            기기 출력 지연이 {latency.current}ms로 커서 실제 지연이 설정보다 길게 들립니다. 유선 이어폰을 쓰세요.
          </p>
        )}
        {err && <p className="card danger small">마이크를 열지 못했습니다. 마이크 권한을 확인하세요.</p>}
      </div>
      <EarphoneCheck open={!earOk} onOk={() => setEarOk(true)} onCancel={() => navigate('/train', true)} />
    </>
  );
}
