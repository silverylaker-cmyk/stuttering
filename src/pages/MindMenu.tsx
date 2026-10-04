import { useApp } from '../app-context';
import { Card, Stat, TopBar } from '../components/ui';
import { exposureStats, thoughtStats } from '../lib/logic';
import { Link } from '../router';

export function MindMenu() {
  const { data } = useApp();
  const ex = exposureStats(data.exposureItem, data.exposureAttempt);
  const th = thoughtStats(data.thoughtRecord);
  return (
    <>
      <TopBar title="마음 훈련" />
      <div className="page">
        <Link to="/mind/ladder" className="menu-tile">
          <span className="ico">▦</span>
          <span className="grow">
            <b>노출 사다리</b>
            <br />
            <span className="small muted">쉬운 상황부터 한 칸씩 도전하기</span>
          </span>
          <span className="chev">›</span>
        </Link>
        <Link to="/mind/thought" className="menu-tile">
          <span className="ico">✎</span>
          <span className="grow">
            <b>사고 기록</b>
            <br />
            <span className="small muted">불안한 생각을 살펴보고 균형 잡기</span>
          </span>
          <span className="chev">›</span>
        </Link>
        <Card title="나의 기록" tone="soft">
          <div className="stats">
            <Stat label="노출 완료" value={ex.completed} />
            <Stat label="최고 난이도" value={ex.maxDifficulty || '–'} />
            <Stat label="과대예측 평균" value={ex.overprediction ?? '–'} sub="예상−실제 불안" />
            <Stat label="사고 기록" value={th.count} />
            <Stat label="확신도 감소" value={th.beliefDropAvg != null ? `${th.beliefDropAvg}` : '–'} sub="평균(점)" />
          </div>
        </Card>
      </div>
    </>
  );
}
