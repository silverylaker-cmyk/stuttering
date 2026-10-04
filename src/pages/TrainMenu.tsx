import { useApp } from '../app-context';
import { ExCard, Illust } from '../components/design';
import { TopBar, VideoSlot } from '../components/ui';

export function TrainMenu() {
  const { status, settings } = useApp();
  const phase = status.phase.phase;
  const modOn = phase >= 3 && settings.modificationEnabled;
  const target = status.phase.targetSpm;
  return (
    <>
      <TopBar title="훈련" />
      <div className="page">
        <div className="ex-grid">
          <ExCard
            wide
            to="/train/prolonged"
            art={<Illust name="ex-prolonged" />}
            color={1}
            title="연장발화 훈련기"
            sub={<>모델 듣기 → 따라 하기 → 비교{target ? <><br />목표 {target} SPM</> : null}</>}
          />
          <ExCard to="/train/metronome" art={<Illust name="ex-metronome" />} color={2} title="메트로놈 연습" sub="원하는 속도로 박자 맞추기" />
          <ExCard
            to="/train/modification"
            art={<Illust name="ex-modification" />}
            color={3}
            title="말더듬 수정법"
            sub={modOn ? 'Cancellation · Pull-out' : 'Phase 3 이상, 원장 활성화 후'}
            locked={!modOn}
          />
          {settings.dafToolEnabled && status.daf.responder && (
            <ExCard to="/train/daf" art={<Illust name="ex-daf" />} color={5} title="DAF 상황 보조" sub="발표·전화 직전 (훈련 시간 제외)" />
          )}
          {settings.dafTestEnabled && !status.daf.responder && (
            <ExCard
              to="/daf-test"
              art={<Illust name="ex-daf-test" />}
              color={4}
              title="DAF 반응 테스트"
              sub={`${Math.min(2, status.daf.sessions.length)}/2 세션`}
            />
          )}
        </div>
        <h2 style={{ marginTop: 8, marginBottom: 0 }}>기법 설명</h2>
        <VideoSlot k="prolonged" title="연장발화" />
        <VideoSlot k="gentle-onset" title="부드러운 시작" />
        <VideoSlot k="light-contact" title="가벼운 접촉" />
      </div>
    </>
  );
}
