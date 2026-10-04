import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PROGRAM } from './config/program';
import type { AppSettings } from './db/db';
import type { Profile } from './db/types';
import { verifyPin } from './lib/pin';
import type { AllData, Status } from './lib/status';
import { Modal } from './components/ui';

export interface AppCtx {
  data: AllData & { profile: Profile };
  status: Status;
  settings: AppSettings;
  today: string;
  clinician: {
    unlocked: boolean;
    /** 원장 PIN 확인. 이미 잠금 해제 상태면 바로 true. */
    require: (reason?: string) => Promise<boolean>;
    lock: () => void;
  };
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppCtx missing');
  return c;
}

export function AppProvider({ value, children }: { value: Omit<AppCtx, 'clinician'>; children: ReactNode }) {
  const [unlockedUntil, setUnlockedUntil] = useState(0);
  const [prompt, setPrompt] = useState<{ reason?: string; resolve: (ok: boolean) => void } | null>(null);
  const [, force] = useState(0);
  const unlocked = unlockedUntil > Date.now();

  // 자동 잠금
  useEffect(() => {
    if (!unlockedUntil) return;
    const id = window.setTimeout(() => force((x) => x + 1), Math.max(0, unlockedUntil - Date.now()) + 50);
    return () => window.clearTimeout(id);
  }, [unlockedUntil]);

  const require = useCallback(
    (reason?: string) =>
      unlockedUntil > Date.now() ? Promise.resolve(true) : new Promise<boolean>((resolve) => setPrompt({ reason, resolve })),
    [unlockedUntil],
  );

  const onResult = (ok: boolean) => {
    if (ok) setUnlockedUntil(Date.now() + PROGRAM.clinicianAutoLockMin * 60_000);
    prompt?.resolve(ok);
    setPrompt(null);
  };

  return (
    <Ctx.Provider value={{ ...value, clinician: { unlocked, require, lock: () => setUnlockedUntil(0) } }}>
      {children}
      {prompt && <PinPrompt profile={value.data.profile} reason={prompt.reason} onResult={onResult} />}
    </Ctx.Provider>
  );
}

function PinPrompt({ profile, reason, onResult }: { profile: Profile; reason?: string; onResult: (ok: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);

  const submit = async (p: string) => {
    if (busy.current) return;
    busy.current = true;
    const ok = await verifyPin(p, profile.pinSalt, profile.pinHash);
    busy.current = false;
    if (ok) onResult(true);
    else {
      setError('PIN이 맞지 않습니다.');
      setPin('');
    }
  };

  const press = (d: string) => {
    setError('');
    const next = (pin + d).slice(0, PROGRAM.pin.maxLength);
    setPin(next);
    if (next.length === PROGRAM.pin.maxLength) void submit(next);
  };

  return (
    <Modal open onClose={() => onResult(false)} label="원장 PIN">
      <h2 className="center">원장 확인</h2>
      <p className="muted center small">{reason ?? '원장 PIN을 입력하세요.'}</p>
      <div className="pin-dots" aria-label={`${pin.length}자리 입력됨`}>
        {Array.from({ length: PROGRAM.pin.maxLength }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {error && <p className="center" style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="지우기">
          ⌫
        </button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => void submit(pin)} disabled={pin.length < PROGRAM.pin.minLength} aria-label="확인" style={{ fontSize: '1rem' }}>
          확인
        </button>
      </div>
      <button className="btn ghost" onClick={() => onResult(false)}>
        취소
      </button>
    </Modal>
  );
}
