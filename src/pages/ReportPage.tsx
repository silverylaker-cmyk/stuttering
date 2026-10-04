import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Badge, BlobAudio, Card, Stat, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { db } from '../db/db';
import { addDays, diffDays, formatKDate } from '../lib/date';
import { exposureStats, probesByWeek, thoughtStats } from '../lib/logic';
import { Link, navigate } from '../router';
import { Trends } from './HistoryPage';

/** 외래 리포트 모드 (PIN 진입). 단일 스크롤, 인쇄용 CSS 지원. */
export function ReportPage() {
  const { clinician } = useApp();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!clinician.unlocked && !asked) {
      setAsked(true);
      void clinician.require('외래 리포트는 원장 PIN으로 엽니다.').then((ok) => !ok && navigate('/', true));
    }
  }, [clinician, asked]);
  if (!clinician.unlocked) return <TopBar title="외래 리포트" backTo="/" />;
  return <Report />;
}

function Report() {
  const { data, status, today, clinician } = useApp();
  const defaultFrom = status.lastVisit ? addDays(status.lastVisit.date, 1) > today ? status.lastVisit.date : addDays(status.lastVisit.date, 1) : data.profile.startDate;
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [memo, setMemo] = useState('');
  const [saved, setSaved] = useState(false);

  const inRange = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date >= from && x.date <= to);
  const ex = exposureStats(data.exposureItem, inRange(data.exposureAttempt));
  const th = thoughtStats(inRange(data.thoughtRecord));
  const recentProbes = probesByWeek(data.recording).slice(0, 3);
  const visits = [...data.clinicVisit].sort((a, b) => b.date.localeCompare(a.date));
  const cal = status.calibration;

  const saveVisit = async () => {
    await db.clinicVisit.add({ date: today, phaseAtVisit: status.phase.phase, memo: memo.trim(), viewedAt: new Date().toISOString() });
    setSaved(true);
    setMemo('');
  };

  return (
    <>
      <TopBar
        title="외래 리포트"
        backTo="/"
        right={
          <button className="icon-btn no-print" aria-label="잠그고 나가기" onClick={() => { clinician.lock(); navigate('/', true); }}>
            🔒
          </button>
        }
      />
      <div className="page">
        <Card tone="primary">
          <div className="row">
            <b className="grow">
              {data.profile.nickname} {data.profile.birthYear ? `(${data.profile.birthYear}년생)` : ''}
            </b>
            <Badge tone="ok">Phase {status.phase.phase}</Badge>
          </div>
          <span className="small">
            {status.phaseDef.name} · 단계 {status.daysInPhase}일째 · 시작 {formatKDate(data.profile.startDate)} ({status.weekIndex}주 경과)
            {status.phase.targetSpm ? ` · 목표 ${status.phase.targetSpm} SPM` : ''}
          </span>
          <div className="row no-print">
            <label className="field grow small">
              시작
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field grow small">
              끝
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <span className="small muted">
            기간 {formatKDate(from)} – {formatKDate(to)} ({diffDays(from, to) + 1}일){status.lastVisit ? ` · 직전 외래 ${formatKDate(status.lastVisit.date)}` : ''}
          </span>
        </Card>

        <Card title="플래그" tone={status.referral.flagged ? 'danger' : status.promotion.suggested ? 'warn' : undefined}>
          <div className="row">
            <b className="grow">승급 제안</b>
            {status.promotion.suggested ? <Badge tone="ok">제안</Badge> : <Badge>{status.promotion.criteria.length ? '미충족' : '해당 없음'}</Badge>}
          </div>
          {status.promotion.criteria.map((c) => (
            <div key={c.label} className="row small">
              <span>{c.met ? '✓' : '✗'}</span>
              <span className="grow">{c.label}</span>
              <span className="muted">{c.detail}</span>
            </div>
          ))}
          <hr />
          <div className="row">
            <b className="grow">연계 검토</b>
            {status.referral.flagged ? (
              <Badge tone="danger">검토 필요</Badge>
            ) : (
              <Badge>{status.referral.eligible ? '해당 없음' : `${PROGRAM.referral.minWeeks}주 경과 후 판정 (${status.referral.weeks}주)`}</Badge>
            )}
          </div>
          {status.referral.reasons.map((r) => (
            <p key={r} className="small" style={{ margin: 0 }}>
              • {r}
            </p>
          ))}
          <Link to="/clinic" className="btn block no-print">
            단계·목표 변경 (원장 설정)
          </Link>
        </Card>

        <Trends from={from} to={to} baselineSr={status.baseline.sr} compact />

        <Card title="마음 훈련">
          <div className="stats">
            <Stat label="노출 완료" value={ex.completed} />
            <Stat label="최고 난이도" value={ex.maxDifficulty || '–'} />
            <Stat label="과대예측 평균" value={ex.overprediction ?? '–'} />
            <Stat label="사고 기록" value={th.count} />
            <Stat label="확신도 감소" value={th.beliefDropAvg ?? '–'} />
          </div>
        </Card>

        <Card title="SR·NAT 보정" right={<Badge tone={cal.pass ? 'ok' : 'warn'}>{cal.pass ? '통과' : '미통과'}</Badge>}>
          {cal.diffs.length ? (
            <table className="simple">
              <thead>
                <tr>
                  <th>녹음</th>
                  <th className="num">SR 차</th>
                  <th className="num">NAT 차</th>
                  <th className="num">판정</th>
                </tr>
              </thead>
              <tbody>
                {cal.diffs.map((d) => (
                  <tr key={d.recordingId}>
                    <td>#{d.recordingId}</td>
                    <td className="num">{d.srDiff}</td>
                    <td className="num">{d.natDiff}</td>
                    <td className="num">{d.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>원장 평가 기록이 없습니다.</p>
          )}
          <Link to="/calibration" className="btn block no-print">
            보정 평가하기
          </Link>
        </Card>

        {status.daf.sessions.length > 0 && (
          <Card title="DAF 반응 테스트" right={<Badge tone={status.daf.responder ? 'ok' : undefined}>{status.daf.responder ? `반응자 (${status.daf.condition === 'daf' ? 'DAF' : 'DAF+FAF'})` : '비반응/진행 중'}</Badge>}>
            <table className="simple">
              <thead>
                <tr>
                  <th>세션</th>
                  <th className="num">NAF 평균</th>
                  <th className="num">DAF 감소</th>
                  <th className="num">DAF+FAF 감소</th>
                </tr>
              </thead>
              <tbody>
                {status.daf.sessions.map((s, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="num">{s.nafMean}%</td>
                    <td className="num">{Math.round(s.dafReduction * 100)}%</td>
                    <td className="num">{s.dafFafReduction == null ? '–' : `${Math.round(s.dafFafReduction * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card title="최근 주간 평가 녹음">
          {recentProbes.length === 0 && <p className="small muted">없음</p>}
          {recentProbes.map((p) => (
            <div key={p.id} className="stack">
              <span className="small">
                <b>{formatKDate(p.date)}</b> · %SS {p.pctSS} · {p.spm} SPM · NAT {p.nat}
              </span>
              <div className="no-print">
                <BlobAudio blob={p.blob} />
              </div>
            </div>
          ))}
        </Card>

        <Card title="원장 메모 (이번 외래)" className="no-print">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="처방, 관찰 내용 등" />
          <button className="btn primary" onClick={() => void saveVisit()}>
            외래 기록 저장
          </button>
          {saved && <span className="badge ok">저장했습니다. 다음 리포트 기간은 오늘 이후부터입니다.</span>}
        </Card>

        {visits.length > 0 && (
          <Card title="이전 외래 메모">
            {visits.slice(0, 8).map((v) => (
              <div key={v.id} className="small">
                <b>{formatKDate(v.date)}</b> · Phase {v.phaseAtVisit}
                <div className="muted">{v.memo || '–'}</div>
              </div>
            ))}
          </Card>
        )}

        <button className="btn block no-print" onClick={() => window.print()}>
          인쇄
        </button>
      </div>
    </>
  );
}
