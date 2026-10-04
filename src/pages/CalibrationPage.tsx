import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Badge, BlobAudio, Card, Empty, Scale, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { db } from '../db/db';
import type { Calibration, Recording } from '../db/types';
import { formatKDate } from '../lib/date';
import { navigate } from '../router';

/** SR·NAT 보정 (외래, 원장 PIN). 원장 입력 전까지 환자 점수는 숨긴다. */
export function CalibrationPage() {
  const { clinician } = useApp();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!clinician.unlocked && !asked) {
      setAsked(true);
      void clinician.require('보정 판정은 원장 PIN이 필요합니다.').then((ok) => !ok && navigate('/', true));
    }
  }, [clinician, asked]);
  if (!clinician.unlocked) return <TopBar title="SR·NAT 보정" backTo="/" />;
  return <Calib />;
}

function Calib() {
  const { data, status } = useApp();
  const recs = new Map(data.recording.map((r) => [r.id, r]));
  const rows = [...data.calibration].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const pending = rows.filter((c) => c.clinicianSR == null);
  const rated = rows.filter((c) => c.clinicianSR != null);
  const { pass, diffs } = status.calibration;
  const C = PROGRAM.calibration;

  return (
    <>
      <TopBar title="SR·NAT 보정" backTo="/report" />
      <div className="page">
        <Card tone={pass ? 'primary' : 'soft'}>
          <div className="row">
            <b className="grow">보정 결과</b>
            <Badge tone={pass ? 'ok' : 'warn'}>{pass ? '통과' : '미통과'}</Badge>
          </div>
          <span className="small muted">
            기준: 최근 {C.count}건 모두 |SR 차이| ≤ {C.srDiffMax}, |NAT 차이| ≤ {C.natDiffMax}
          </span>
          {!pass && rated.length >= C.count && (
            <p className="small" style={{ margin: 0 }}>
              차이가 큰 녹음이 있습니다. 차이를 함께 확인한 뒤 환자가 기저·보정 녹음을 추가로 만들어 다시 평가하세요.
            </p>
          )}
        </Card>

        <h2>평가 대기 ({pending.length})</h2>
        {pending.length === 0 && <Empty>평가할 녹음이 없습니다. 환자가 녹음 › 기저·보정으로 녹음을 만들어야 합니다.</Empty>}
        {pending.map((c) => (
          <RateCard key={c.id} cal={c} rec={recs.get(c.recordingId)} />
        ))}

        <h2>평가 완료 ({rated.length})</h2>
        {rated.map((c) => {
          const d = diffs.find((x) => x.recordingId === c.recordingId);
          const r = recs.get(c.recordingId);
          return (
            <Card key={c.id} title={`${r ? formatKDate(r.date) : ''} 녹음 #${c.recordingId}`} right={<Badge tone={d?.ok ? 'ok' : 'danger'}>{d?.ok ? '일치' : '차이 큼'}</Badge>}>
              <table className="simple">
                <thead>
                  <tr>
                    <th />
                    <th className="num">환자</th>
                    <th className="num">원장</th>
                    <th className="num">차이</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>SR</td>
                    <td className="num">{c.patientSR}</td>
                    <td className="num">{c.clinicianSR}</td>
                    <td className="num">{d?.srDiff}</td>
                  </tr>
                  <tr>
                    <td>NAT</td>
                    <td className="num">{c.patientNAT}</td>
                    <td className="num">{c.clinicianNAT}</td>
                    <td className="num">{d?.natDiff}</td>
                  </tr>
                </tbody>
              </table>
              <BlobAudio blob={r?.blob} />
            </Card>
          );
        })}
      </div>
    </>
  );
}

function RateCard({ cal, rec }: { cal: Calibration; rec?: Recording }) {
  const { today } = useApp();
  const [sr, setSr] = useState<number | null>(null);
  const [nat, setNat] = useState<number | null>(null);
  const save = async () => {
    if (sr == null || nat == null) return;
    await db.calibration.update(cal.id!, { clinicianSR: sr, clinicianNAT: nat, ratedAt: today });
  };
  return (
    <Card title={`${rec ? formatKDate(rec.date) : ''} 녹음 #${cal.recordingId}`}>
      <p className="small muted" style={{ margin: 0 }}>
        환자 점수는 원장 평가를 저장한 뒤에 공개됩니다.
      </p>
      <BlobAudio blob={rec?.blob} />
      <b>SR (1 = 없음, 10 = 극심)</b>
      <Scale min={PROGRAM.sr.min} max={PROGRAM.sr.max} value={sr} onChange={setSr} />
      <b>NAT (1 = 매우 자연스러움, 9 = 매우 부자연스러움)</b>
      <Scale min={PROGRAM.nat.min} max={PROGRAM.nat.max} value={nat} onChange={setNat} columns={9} />
      <button className="btn primary" disabled={sr == null || nat == null} onClick={() => void save()}>
        원장 평가 저장
      </button>
    </Card>
  );
}
