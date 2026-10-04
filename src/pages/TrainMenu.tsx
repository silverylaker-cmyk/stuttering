import { useApp } from '../app-context';
import { TopBar, VideoSlot } from '../components/ui';
import { Link } from '../router';

export function TrainMenu() {
  const { status, settings } = useApp();
  const phase = status.phase.phase;
  const modOn = phase >= 3 && settings.modificationEnabled;
  return (
    <>
      <TopBar title="훈련" />
      <div className="page">
        <Link to="/train/prolonged" className="menu-tile">
          <span className="ico">〰</span>
          <span className="grow">
            <b>연장발화 훈련기</b>
            <br />
            <span className="small muted">모델 음성 듣기 → 따라 하기 {status.phase.targetSpm ? `· ${status.phase.targetSpm} SPM` : ''}</span>
          </span>
          <span className="chev">›</span>
        </Link>
        <Link to="/train/metronome" className="menu-tile">
          <span className="ico">♩</span>
          <span className="grow">
            <b>메트로놈 자유 연습</b>
            <br />
            <span className="small muted">원하는 속도로 박자에 맞춰 말하기</span>
          </span>
          <span className="chev">›</span>
        </Link>
        {modOn ? (
          <Link to="/train/modification" className="menu-tile">
            <span className="ico">↺</span>
            <span className="grow">
              <b>말더듬 수정법</b>
              <br />
              <span className="small muted">Cancellation · Pull-out</span>
            </span>
            <span className="chev">›</span>
          </Link>
        ) : (
          <div className="menu-tile disabled" aria-disabled>
            <span className="ico">↺</span>
            <span className="grow">
              <b>말더듬 수정법</b>
              <br />
              <span className="small muted">Phase 3 이상에서 원장님이 활성화하면 열려요</span>
            </span>
          </div>
        )}
        {settings.dafToolEnabled && status.daf.responder && (
          <Link to="/train/daf" className="menu-tile">
            <span className="ico">◐</span>
            <span className="grow">
              <b>DAF 상황 보조</b>
              <br />
              <span className="small muted">발표·전화 전 보조용 (훈련 시간에 포함되지 않음)</span>
            </span>
            <span className="chev">›</span>
          </Link>
        )}
        {settings.dafTestEnabled && !status.daf.responder && (
          <Link to="/daf-test" className="menu-tile">
            <span className="ico">◑</span>
            <span className="grow">
              <b>DAF 반응 테스트</b>
              <br />
              <span className="small muted">원장님이 활성화한 테스트 ({Math.min(2, status.daf.sessions.length)}/2 세션)</span>
            </span>
            <span className="chev">›</span>
          </Link>
        )}
        <h2 style={{ marginTop: 8 }}>기법 설명</h2>
        <VideoSlot k="prolonged" title="연장발화" />
        <VideoSlot k="gentle-onset" title="부드러운 시작" />
        <VideoSlot k="light-contact" title="가벼운 접촉" />
      </div>
    </>
  );
}
