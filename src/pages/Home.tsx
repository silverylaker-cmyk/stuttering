import { useApp } from '../app-context';
import { MiniBars } from '../components/Chart';
import { Icon, Ring, RowItem, Section } from '../components/design';
import { Badge, Card } from '../components/ui';
import { PROGRAM } from '../config/program';
import { addDays, diffDays, toSeoulDate, weekStart } from '../lib/date';
import { srSeries, streakActiveDays } from '../lib/logic';
import { Link } from '../router';

const WEEKDAYS = '월화수목금토일';

export function Home() {
  const { data, status, settings, today, clinician } = useApp();
  const phase = status.phase.phase;
  const last7 = srSeries(data.dailyLog, addDays(today, -6), today);
  const goalSec = PROGRAM.dailyTrainingGoalMin * 60;
  const todayMin = Math.round(status.todayTrainingSec / 60);
  const backupDays = settings.lastBackupAt ? diffDays(toSeoulDate(new Date(settings.lastBackupAt)), today) : null;
  const calRecs = data.recording.filter((r) => r.kind === 'calibration').length;
  const probe = status.thisWeekProbe;

  // 이번 주(월–일) 훈련 점
  const active = streakActiveDays(data.trainingSession, data.recording.filter((r) => r.kind === 'probe').map((r) => r.date));
  const mon = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  const tasks = [
    { key: 'log', to: '/log', done: !!status.todayLog, title: '일일 기록', sub: status.todayLog ? `SR ${status.todayLog.sr} 기록함` : '1분이면 충분해요' },
    phase === 0
      ? {
          key: 'cal',
          to: '/record?kind=calibration',
          done: calRecs >= PROGRAM.promotion.phase0.baselineRecordings,
          title: `기저 녹음 ${calRecs}/${PROGRAM.promotion.phase0.baselineRecordings}`,
          sub: '1–2분 대화하듯 말하기',
        }
      : {
          key: 'train',
          to: phase >= 3 ? '/train/metronome' : '/train/prolonged',
          done: status.todayTrainingSec >= goalSec,
          title: phase >= 3 ? '메트로놈 연습' : '연장발화 훈련',
          sub: `${todayMin}분 / ${PROGRAM.dailyTrainingGoalMin}분`,
        },
    ...(phase >= 3
      ? [{ key: 'ex', to: '/mind/ladder', done: data.exposureAttempt.some((a) => a.date === today), title: '노출 과제', sub: '사다리에서 하나 도전하기' }]
      : []),
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <div className="grow">
            <div className="sub">오늘도 천천히, 부드럽게</div>
            <h1>{data.profile.nickname}님</h1>
          </div>
          <Link to="/settings" className="icon-btn" aria-label="설정">
            <Icon name="gear" />
          </Link>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="hero-chip">Phase {phase} · {status.phaseDef.name}</span>
          <span className="sub">
            단계 {status.daysInPhase}일째
            {status.phase.targetSpm ? ` · ${status.phase.targetSpm} SPM` : phase >= 2 ? ' · 자연 속도' : ''}
          </span>
        </div>
        <div className="hero-stats">
          <Ring value={status.todayTrainingSec / goalSec} size={92} stroke={9} label={`오늘 훈련 ${todayMin}분, 목표 ${PROGRAM.dailyTrainingGoalMin}분`}>
            <b>{todayMin}분</b>
            <span>/ {PROGRAM.dailyTrainingGoalMin}분</span>
          </Ring>
          <div className="hero-metrics">
            <div className="hero-metric">
              <div className="v">
                <span className="flame">
                  <Icon name="flame" size={22} fill />
                </span>
                {status.streak.days}
              </div>
              <div className="l">연속 훈련일</div>
            </div>
            <div className="hero-metric">
              <div className="v">
                {doneCount}/{tasks.length}
              </div>
              <div className="l">오늘 할 일</div>
            </div>
          </div>
        </div>
      </header>

      <div className="page">
        <Card>
          <div className="card-title">
            <h3>이번 주</h3>
            <span className="small muted">{status.streak.todayDone ? '오늘 완료 🎉' : '5분 이상 훈련하면 오늘 칸이 채워져요'}</span>
          </div>
          <div className="week-dots" role="list" aria-label="이번 주 훈련">
            {week.map((d, i) => {
              const on = active.has(d);
              const rest = status.streak.restDays.includes(d);
              return (
                <div key={d} role="listitem" className={`d ${on ? 'on' : rest ? 'rest' : ''} ${d === today ? 'today' : ''}`} aria-label={`${WEEKDAYS[i]} ${on ? '훈련함' : rest ? '휴식일' : ''}`}>
                  <span className="dot">{on ? <Icon name="check" size={16} /> : rest ? '휴' : ''}</span>
                  {WEEKDAYS[i]}
                </div>
              );
            })}
          </div>
        </Card>

        {status.surveyDue.due && (
          <Section title="알림" count={<span className="pill">1</span>}>
            <RowItem
              to="/survey"
              icon="✎"
              color={4}
              title={status.surveyDue.baselineNeeded ? '기저 설문을 작성해 주세요' : '4주 설문을 작성해 주세요'}
              sub={`8문항 · 약 2분${status.surveyDue.baselineNeeded ? '' : ` · ${status.surveyDue.daysLeft}일 남음`}`}
            />
          </Section>
        )}

        {clinician.unlocked && (status.promotion.suggested || status.referral.flagged) && (
          <Section title="원장 확인">
            {status.promotion.suggested && <RowItem to="/clinic" icon="↑" color={2} title="승급 제안" sub="기준을 충족했습니다" />}
            {status.referral.flagged && <RowItem to="/report" icon="!" color={1} title="연계 검토" sub={status.referral.reasons[0]} />}
          </Section>
        )}

        <Section title="오늘 할 일" count={`${doneCount}/${tasks.length}`}>
          {tasks.map((t) => (
            <RowItem key={t.key} to={t.to} check done={t.done} title={t.title} sub={t.sub} />
          ))}
        </Section>

        {phase >= 1 && (
          <Section title="이번 주 평가 녹음" count={probe ? '완료' : <span className="pill">!</span>}>
            <RowItem
              to="/record?kind=probe"
              icon={<Icon name="mic" size={20} />}
              color={probe ? 2 : 1}
              title={probe ? '이번 주 녹음 완료' : '아직 안 했어요'}
              sub={probe ? `%SS ${probe.pctSS} · ${probe.spm} SPM · NAT ${probe.nat}` : '2분 독백 · 승급 판정에 쓰여요'}
              trailing={probe ? <Badge tone="ok">완료</Badge> : <Badge tone="warn">미완료</Badge>}
            />
          </Section>
        )}

        {phase === 0 && (
          <Section title="기초평가 진행">
            {status.promotion.criteria.map((c) => (
              <RowItem key={c.label} check done={c.met} title={c.label} trailing={<span className="small muted">{c.detail}</span>} />
            ))}
          </Section>
        )}

        <Card title={<h3>최근 7일 말더듬 정도 (SR)</h3>} right={<Link to="/history" className="small">기록 ›</Link>}>
          <MiniBars points={last7} max={PROGRAM.sr.max} ariaLabel="최근 7일 SR" />
          <p className="small muted" style={{ margin: 0 }}>
            1 = 말더듬 없음 · 10 = 극심
          </p>
        </Card>

        <Section title="관리" defaultOpen={backupDays == null || backupDays > PROGRAM.backup.warnDays}>
          <RowItem
            to="/settings"
            icon="⇩"
            color={backupDays == null || backupDays > PROGRAM.backup.warnDays ? 4 : 5}
            title={backupDays == null ? '아직 백업한 적이 없어요' : `마지막 백업 ${backupDays}일 전`}
            sub="기록은 이 기기에만 있어요"
          />
          <RowItem to="/report" icon={<Icon name="lock" size={20} />} color={3} title="외래 리포트" sub="원장님 확인용 (PIN)" />
        </Section>
      </div>
    </>
  );
}
