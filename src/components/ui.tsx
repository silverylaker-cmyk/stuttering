import { useEffect, useRef, useState, type ReactNode } from 'react';
import { videoUrl } from '../content';
import { useObjectUrl } from '../hooks';
import { back } from '../router';
import { Icon } from './design';

export function TopBar({ title, backTo, right }: { title: string; backTo?: string | true; right?: ReactNode }) {
  return (
    <header className="topbar">
      {backTo ? (
        <button className="icon-btn" aria-label="뒤로" onClick={() => back(typeof backTo === 'string' ? backTo : '/')}>
          <Icon name="back" />
        </button>
      ) : (
        <span style={{ width: 8 }} />
      )}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function Card({ title, right, tone, children, className = '' }: { title?: ReactNode; right?: ReactNode; tone?: 'soft' | 'warn' | 'danger' | 'primary'; children?: ReactNode; className?: string }) {
  return (
    <section className={`card ${tone ?? ''} ${className}`}>
      {(title || right) && (
        <div className="card-title">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

/** 숫자 척도 선택 (SR 1–10, NAT 1–9, 불안 0–10 등) */
export function Scale({
  min,
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
  columns,
  label,
}: {
  min: number;
  max: number;
  value: number | null | undefined;
  onChange: (v: number) => void;
  lowLabel?: string;
  highLabel?: string;
  columns?: number;
  label?: string;
}) {
  const n = max - min + 1;
  const cols = columns ?? (n > 6 ? Math.ceil(n / 2) : n);
  return (
    <div className="stack" role="radiogroup" aria-label={label}>
      <div className="scale" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: n }, (_, i) => min + i).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="scale-ends">
          <span>
            {min} = {lowLabel}
          </span>
          <span>
            {max} = {highLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, multi }: { options: readonly { value: T; label: string }[] | readonly T[]; value: T[] | T | null; onChange: (v: T[] | T) => void; multi?: boolean }) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = Array.isArray(value) ? value : value == null ? [] : [value];
  return (
    <div className="chips">
      {opts.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={`chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => (multi ? onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value]) : onChange(o.value))}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, children, label }: { open: boolean; onClose?: () => void; children: ReactNode; label?: string }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="l">{sub}</div>}
    </div>
  );
}

/** 오프라인 영상 슬롯 (v1.1). 파일이 없으면 "영상 준비 중". */
export function VideoSlot({ k, title }: { k: string; title: string }) {
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div className="video-slot">
      {!open ? (
        <button className="btn ghost block" onClick={() => setOpen(true)}>
          ▶ {title} 설명 영상
        </button>
      ) : missing ? (
        <div className="ph">「{title}」 설명 영상은 준비 중입니다.</div>
      ) : (
        <video src={videoUrl(k)} controls playsInline autoPlay preload="none" onError={() => setMissing(true)} />
      )}
    </div>
  );
}

export function BlobAudio({ blob, label }: { blob?: Blob | null; label?: string }) {
  const url = useObjectUrl(blob);
  if (!url) return <span className="muted small">녹음 파일 없음 (보관 개수 초과로 삭제)</span>;
  return <audio src={url} controls preload="metadata" style={{ width: '100%' }} aria-label={label} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted center small" style={{ padding: '12px 0' }}>{children}</p>;
}

export function useConfirmTimer(ms = 3000) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => () => {
    if (t.current) window.clearTimeout(t.current);
  }, []);
  return {
    armed,
    arm() {
      setArmed(true);
      t.current = window.setTimeout(() => setArmed(false), ms);
    },
  };
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(var(--nav-h) + 24px)', zIndex: 60, display: 'flex', justifyContent: 'center' }}>
      <div className="badge ok" style={{ fontSize: '0.95rem', padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
        {msg}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number | null>(null);
  return {
    msg,
    show(m: string) {
      setMsg(m);
      if (t.current) window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setMsg(null), 2200);
    },
  };
}

export function fmtSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtMin(sec: number): string {
  return `${Math.round(sec / 60)}분`;
}
