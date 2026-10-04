import { useApp } from '../app-context';
import { MiniBars } from '../components/Chart';
import { Badge, Card, fmtMin } from '../components/ui';
import { PROGRAM } from '../config/program';
import { addDays, diffDays, toSeoulDate } from '../lib/date';
import { srSeries } from '../lib/logic';
import { Link } from '../router';

export function Home() {
  const { data, status, settings, today, clinician } = useApp();
  const phase = status.phase.phase;
  const last7 = srSeries(data.dailyLog, addDays(today, -6), today);
  const goalSec = PROGRAM.dailyTrainingGoalMin * 60;
  const backupDays = settings.lastBackupAt ? diffDays(toSeoulDate(new Date(settings.lastBackupAt)), today) : null;

  const phase0 = phase === 0 && status.promotion.criteria;
  const calRecs = data.recording.filter((r) => r.kind === 'calibration').length;

  return (
    <>
      <header className="topbar">
        <span style={{ width: 8 }} />
        <h1>{data.profile.nickname}님, 오늘도 천천히</h1>
        <Link to="/settings" className="icon-btn" aria-label="설정">
          ⚙
        </Link>
      </header>
      <div className="page">
        <Card tone="primary">
          <div className="row">
            <Badge tone="ok">Phase {phase}</Badge>
            <b className="grow">{status.phaseDef.name}</b>
          </div>
          <div className="row small muted">
            <span>단계 {status.daysInPhase}일째</span>
            <span>·</span>
            <span>시작 {status.daysInProgram}일째</span>
            {status.phase.targetSpm ? (
              <>
                <span>·</span>
                <span>목표 {status.phase.targetSpm} SPM</span>
              </>
            ) : phase >= 2 ? (
              <>
                <span>·</span>
                <span>자연 속도</span>
              </>
            ) : null}
          </div>
        </Card>

        {clinician.unlocked && (status.promotion.suggested || status.referral.flagged) && (
          <Card tone="warn" title="원장 확인" right={<Link to="/clinic">원장 설정 ›</Link>}>
            {status.promotion.suggested && <Badge tone="ok">승급 제안</Badge>}
            {status.referral.flagged && <Badge tone="danger">연계 검토</Badge>}
          </Card>
        )}

        {status.surveyDue.due && (
          <Link to="/survey" className="menu-tile" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <span className="ico">✎</span>
            <span className="grow">
              <b>{status.surveyDue.baselineNeeded ? '기저 설문' : '4주 설문'}을 작성해 주세요</b>
              <br />
              <span className="small muted">8문항 · 약 2분 {status.surveyDue.baselineNeeded ? '' : `· ${status.surveyDue.daysLeft}일 남음`}</span>
            </span>
            <span className="chev">›</span>
          </Link>
        )}

        <Card title="오늘 할 일">
          <ul className="checklist">
            <CheckItem to="/log" done={!!status.todayLog} title="일일 기록" sub={status.todayLog ? `SR ${status.todayLog.sr}` : '1분이면 충분해요'} />
            {phase === 0 ? (
              <CheckItem
                to="/record?kind=calibration"
                done={calRecs >= PROGRAM.promotion.phase0.baselineRecordings}
                title={`기저 녹음 (${calRecs}/${PROGRAM.promotion.phase0.baselineRecordings})`}
                sub="1–2분 대화하듯 말하기"
              />
            ) : (
              <CheckItem
                to={phase >= 3 ? '/train/metronome' : '/train/prolonged'}
                done={status.todayTrainingSec >= goalSec}
                title="훈련"
                sub={`${fmtMin(status.todayTrainingSec)} / ${PROGRAM.dailyTrainingGoalMin}분`}
              />
            )}
            {phase >= 3 && <CheckItem to="/mind/ladder" done={data.exposureAttempt.some((a) => a.date === today)} title="노출 과제" sub="사다리에서 하나 도전하기" />}
          </ul>
        </Card>

        {phase >= 1 && (
          <Link
            to="/record?kind=probe"
            className="menu-tile"
            style={status.thisWeekProbe ? undefined : { borderColor: 'var(--accent)', borderWidth: 2 }}
          >
            <span className="ico">{status.thisWeekProbe ? '✓' : '!'}</span>
            <span className="grow">
              <b>이번 주 평가 녹음</b>
              <br />
              <span className="small muted">
                {status.thisWeekProbe
                  ? `완료 · %SS ${status.thisWeekProbe.pctSS} · NAT ${status.thisWeekProbe.nat}`
                  : '아직 안 했어요 · 2분 독백'}
              </span>
            </span>
            {!status.thisWeekProbe && <Badge tone="warn">미완료</Badge>}
          </Link>
        )}

        {phase0 && (
          <Card title="기초평가 진행" tone="soft">
            {status.promotion.criteria.map((c) => (
              <div className="row" key={c.label}>
                <span>{c.met ? '✓' : '○'}</span>
                <span className="grow">{c.label}</span>
                <span className="muted small">{c.detail}</span>
              </div>
            ))}
            <p className="small muted" style={{ margin: 0 }}>
              보정은 외래에서 원장님이 녹음을 함께 듣고 평가합니다.
            </p>
          </Card>
        )}

        <div className="grid2">
          <Card>
            <span className="small muted">연속 훈련</span>
            <span className="big-num">{status.streak.days}일</span>
            <span className="small muted">{status.streak.todayDone ? '오늘 완료' : '오늘 5분 이상 훈련하면 +1'}</span>
          </Card>
          <Card>
            <span className="small muted">오늘 훈련</span>
            <span className="big-num">{Math.round(status.todayTrainingSec / 60)}분</span>
            <span className="small muted">목표 {PROGRAM.dailyTrainingGoalMin}분</span>
          </Card>
        </div>

        <Card title="최근 7일 말더듬 정도(SR)" right={<Link to="/history" className="small">기록 ›</Link>}>
          <MiniBars points={last7} max={PROGRAM.sr.max} ariaLabel="최근 7일 SR" />
          <p className="small muted" style={{ margin: 0 }}>
            1 = 말더듬 없음 · 10 = 극심
          </p>
        </Card>

        {(backupDays == null || backupDays > PROGRAM.backup.warnDays) && (
          <Link to="/settings" className="menu-tile" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <span className="ico">⇩</span>
            <span className="grow">
              <b>{backupDays == null ? '아직 백업한 적이 없어요' : `마지막 백업 ${backupDays}일 전`}</b>
              <br />
              <span className="small muted">기록은 이 기기에만 있어요. 백업 파일을 만들어 두세요.</span>
            </span>
          </Link>
        )}
        {backupDays != null && backupDays <= PROGRAM.backup.warnDays && <p className="small muted center">마지막 백업 {backupDays}일 전</p>}

        <Link to="/report" className="btn block">
          외래 리포트 (원장용)
        </Link>
      </div>
    </>
  );
}

function CheckItem({ to, done, title, sub }: { to: string; done: boolean; title: string; sub?: string }) {
  return (
    <li>
      <Link to={to} className={done ? 'done' : ''}>
        <span className="box" aria-hidden>
          {done ? '✓' : ''}
        </span>
        <span className="grow">
          <span className="t">{title}</span>
          {sub && (
            <>
              <br />
              <span className="small muted">{sub}</span>
            </>
          )}
        </span>
        <span className="sr-only">{done ? '완료' : '미완료'}</span>
        <span className="chev">›</span>
      </Link>
    </li>
  );
}
