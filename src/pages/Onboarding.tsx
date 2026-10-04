import { useState } from 'react';
import { PHASES, PROGRAM, SCHEMA_VERSION } from '../config/program';
import { EXPOSURE_TEMPLATES } from '../content';
import { db, setSetting } from '../db/db';
import { today } from '../lib/date';
import { isStandalone, platform, requestPersist } from '../lib/install';
import { hashPin, isValidPin, newSalt } from '../lib/pin';
import { InstallGuide } from '../components/InstallGuide';
import { navigate } from '../router';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const iosBrowser = platform() === 'ios' && !isStandalone();
  const [iosAck, setIosAck] = useState(false);

  const pinOk = isValidPin(pin) && pin === pin2;

  const finish = async () => {
    setBusy(true);
    const salt = newSalt();
    const start = today();
    await db.transaction('rw', [db.profile, db.phaseHistory, db.exposureItem, db.settings], async () => {
      const existing = await db.profile.get(1);
      if (!existing) {
        await db.profile.put({
          id: 1,
          nickname: nickname.trim() || '나',
          birthYear: birthYear ? Number(birthYear) : undefined,
          startDate: start,
          pinHash: await hashPin(pin, salt),
          pinSalt: salt,
          schemaVersion: SCHEMA_VERSION,
        });
        await db.phaseHistory.add({ phase: 0, startDate: start, targetSpm: PHASES[0].defaultTargetSpm });
        await db.exposureItem.bulkAdd(EXPOSURE_TEMPLATES.map((t, i) => ({ ...t, order: i, archived: false })));
      }
      await setSetting('onboardingDone', true);
    });
    await requestPersist();
    navigate('/', true);
  };

  return (
    <div className="app no-nav">
      <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
        <div className="steps" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {step === 0 && (
          <section className="card">
            <h1>말하기 훈련</h1>
            <p>외래에서 처방받은 단계에 맞춰 집에서 유창성 훈련을 하고 기록하는 보조 도구입니다.</p>
            <h2>먼저 홈 화면에 설치해 주세요</h2>
            <InstallGuide />
            {iosBrowser && (
              <label className="row small">
                <input type="checkbox" checked={iosAck} onChange={(e) => setIosAck(e.target.checked)} />
                <span>지금은 설치하지 않고 계속합니다. 기록이 삭제될 수 있음을 이해했습니다.</span>
              </label>
            )}
            <button className="btn primary block" disabled={iosBrowser && !iosAck} onClick={() => setStep(1)}>
              다음
            </button>
          </section>
        )}

        {step === 1 && (
          <section className="card">
            <h1>개인정보 안내</h1>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }} className="stack">
              <li>모든 기록과 녹음은 <b>이 기기 안에만</b> 저장됩니다. 서버로 전송하거나 분석 도구를 쓰지 않습니다.</li>
              <li>기기를 바꾸거나 앱을 지우면 기록이 사라집니다. <b>백업은 본인 책임</b>이며, 설정 › 백업에서 파일로 내보낼 수 있습니다.</li>
              <li>외래 방문 시 이 기기 화면으로 원장님이 리포트를 확인합니다.</li>
              <li>이 앱은 외래 치료를 돕는 훈련 도구이며 진단이나 치료를 대신하지 않습니다.</li>
            </ul>
            <label className="row">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22 }} />
              <span>내용을 확인했습니다.</span>
            </label>
            <div className="row">
              <button className="btn" onClick={() => setStep(0)}>
                이전
              </button>
              <button className="btn primary grow" disabled={!agree} onClick={() => setStep(2)}>
                다음
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card">
            <h1>프로필과 원장 PIN</h1>
            <label className="field">
              별명
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="예: 민수" maxLength={20} />
            </label>
            <label className="field">
              출생연도 <span className="hint">선택</span>
              <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="예: 2005" min={1920} max={2025} />
            </label>
            <hr />
            <p className="small muted">
              원장 PIN은 <b>외래에서 원장님이 직접</b> 설정합니다. 단계 변경, 목표 수정, 기록 삭제, 백업 가져오기, 보정 판정에 필요합니다.
            </p>
            <label className="field">
              원장 PIN ({PROGRAM.pin.minLength}–{PROGRAM.pin.maxLength}자리 숫자)
              <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PROGRAM.pin.maxLength))} />
            </label>
            <label className="field">
              PIN 확인
              <input type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, PROGRAM.pin.maxLength))} />
            </label>
            {pin2 && !pinOk && <p className="small" style={{ color: 'var(--danger)' }}>PIN이 일치하지 않거나 형식이 맞지 않습니다.</p>}
            <div className="row">
              <button className="btn" onClick={() => setStep(1)}>
                이전
              </button>
              <button className="btn primary grow" disabled={!pinOk || busy} onClick={() => void finish()}>
                시작하기
              </button>
            </div>
            <p className="small muted">
              시작하면 <b>Phase 0 기초평가</b>가 시작됩니다: 기저 녹음 3회 → 4주 설문 1회차 → 외래에서 SR·NAT 보정.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
