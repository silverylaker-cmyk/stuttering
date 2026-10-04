import { useEffect, useState } from 'react';
import { canPromptInstall, isStandalone, onInstallAvailable, platform, promptInstall } from '../lib/install';

export function InstallGuide() {
  const p = platform();
  const [can, setCan] = useState(canPromptInstall());
  useEffect(() => {
    const off = onInstallAvailable(() => setCan(true));
    return () => {
      off();
    };
  }, []);
  if (isStandalone()) return <p className="badge ok">✓ 홈 화면 앱으로 실행 중입니다.</p>;
  return (
    <div className="stack">
      {p === 'ios' && (
        <>
          <p>
            <b>iPhone·iPad (Safari)</b>
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
            <li>Safari 하단의 공유 버튼(□↑)을 누르세요.</li>
            <li>「홈 화면에 추가」를 누르세요.</li>
            <li>홈 화면에 생긴 「말하기 훈련」 아이콘으로 실행하세요.</li>
          </ol>
          <p className="card warn small" style={{ margin: 0 }}>
            iOS는 홈 화면에 설치하지 않고 브라우저에서만 쓰면, 7일간 사용하지 않을 때 기록이 삭제될 수 있습니다.
          </p>
        </>
      )}
      {p === 'android' && (
        <>
          <p>
            <b>Android (Chrome)</b>
          </p>
          {can ? (
            <button className="btn primary" onClick={() => void promptInstall()}>
              앱 설치하기
            </button>
          ) : (
            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>Chrome 오른쪽 위 ⋮ 메뉴를 누르세요.</li>
              <li>「앱 설치」 또는 「홈 화면에 추가」를 누르세요.</li>
            </ol>
          )}
        </>
      )}
      {p === 'other' && (
        <>
          <p>휴대폰에서 이 주소를 열어 홈 화면에 추가하세요. PC에서는 주소창의 설치 아이콘을 누르면 됩니다.</p>
          {can && (
            <button className="btn primary" onClick={() => void promptInstall()}>
              앱 설치하기
            </button>
          )}
        </>
      )}
    </div>
  );
}
