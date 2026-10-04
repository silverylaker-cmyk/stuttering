import { useApp } from '../app-context';
import { ExCard, Illust } from '../components/design';
import { Card, Stat, TopBar } from '../components/ui';
import { exposureStats, thoughtStats } from '../lib/logic';

export function MindMenu() {
  const { data } = useApp();
  const ex = exposureStats(data.exposureItem, data.exposureAttempt);
  const th = thoughtStats(data.thoughtRecord);
  return (
    <>
      <TopBar title="마음 훈련" />
      <div className="page">
        <div className="ex-grid">
          <ExCard to="/mind/ladder" art={<Illust name="mind-ladder" />} color={1} title="노출 사다리" sub={`쉬운 상황부터 한 칸씩 · ${ex.completed}회 도전`} />
          <ExCard to="/mind/thought" art={<Illust name="mind-thought" />} color={3} title="사고 기록" sub={`불안한 생각 살펴보기 · ${th.count}건`} />
        </div>
        <Card title={<h3>나의 기록</h3>}>
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
