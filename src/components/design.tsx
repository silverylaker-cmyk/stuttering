import { useState, type ReactNode } from 'react';
import { illustFallback } from '../content';
import { Link } from '../router';

// ───────────────────────── 아이콘 (선 아이콘, 24×24) ─────────────────────────

const PATHS: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  wave: <path d="M3 12h2.5M7.5 8v8M11 5v14M14.5 9v6M18 7v10M21 12h-.5" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  chart: <path d="M4 20h16M7 16v-4M11.5 16V8M16 16v-6M20 4l-4.5 4.5-3-2L7 11" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.2 2.2-5.1 3.6-7.2.5 1.4 1.3 2.4 2.4 2.9C11.3 7.4 12.6 4.7 15 3c-.3 2.7.9 4.3 2 5.8 1 1.4 1.5 2.9 1.5 4.6C18.5 18.3 15.9 21 12 21z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
};

export function Icon({ name, size = 24, fill }: { name: keyof typeof PATHS | string; size?: number; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

// ───────────────────────── 일러스트 슬롯 ─────────────────────────

const base = import.meta.env.BASE_URL;
const missing = new Set<string>();

/**
 * `public/illustrations/{name}.webp` 가 있으면 이미지를, 없으면 이모지 대체 표시.
 * 이미지 목록·생성 프롬프트: content/illustrations.json → docs/IMAGE_PROMPTS.html
 */
export function Illust({ name, fallback, alt = '' }: { name: string; fallback?: ReactNode; alt?: string }) {
  const [failed, setFailed] = useState(missing.has(name));
  if (failed) return <>{fallback ?? illustFallback(name)}</>;
  return (
    <img
      src={`${base}illustrations/${name}.webp`}
      alt={alt}
      loading="lazy"
      onError={() => {
        missing.add(name);
        setFailed(true);
      }}
    />
  );
}

// ───────────────────────── 접는 구역 ─────────────────────────

export function Section({ title, count, children, defaultOpen = true }: { title: string; count?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <button className="section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="caret" aria-hidden>
          ▾
        </span>
        {title}
        {count != null && <span className="count">{count}</span>}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

// ───────────────────────── 목록 행 ─────────────────────────

export type TileColor = 1 | 2 | 3 | 4 | 5;

export function RowItem({
  to,
  onClick,
  icon,
  color = 1,
  title,
  sub,
  trailing,
  done,
  check,
  disabled,
}: {
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
  color?: TileColor;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  done?: boolean;
  /** 체크박스형 행 */
  check?: boolean;
  disabled?: boolean;
}) {
  const cls = `row-item ${done ? 'done' : ''} ${disabled ? 'disabled' : ''}`;
  const inner = (
    <>
      {check ? (
        <span className="tile check" aria-hidden>
          ✓
        </span>
      ) : (
        icon != null && (
          <span className={`tile c${color}`} aria-hidden>
            {icon}
          </span>
        )
      )}
      <span className="grow">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      {check && <span className="sr-only">{done ? '완료' : '미완료'}</span>}
      {trailing ?? (!disabled && (to || onClick) ? <span className="chev"><Icon name="chevron" size={18} /></span> : null)}
    </>
  );
  if (disabled) return <div className={cls} aria-disabled>{inner}</div>;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button className={cls} onClick={onClick}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

// ───────────────────────── 연습 카드 ─────────────────────────

export function ExCard({
  to,
  art,
  color = 1,
  title,
  sub,
  wide,
  locked,
}: {
  to?: string;
  art: ReactNode;
  color?: TileColor;
  title: string;
  sub?: ReactNode;
  wide?: boolean;
  locked?: boolean;
}) {
  const body = (
    <>
      <div className={`art c${color}`} aria-hidden>
        {art}
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </div>
      {locked && (
        <span className="lock badge" aria-label="잠김">
          <Icon name="lock" size={14} /> 잠김
        </span>
      )}
    </>
  );
  const cls = `ex-card ${wide ? 'wide' : ''} ${locked ? 'locked' : ''}`;
  return to && !locked ? <Link to={to} className={cls}>{body}</Link> : <div className={cls} aria-disabled={locked}>{body}</div>;
}

// ───────────────────────── 진행 링 ─────────────────────────

export function Ring({ value, size = 84, stroke = 8, children, label }: { value: number; size?: number; stroke?: number; children?: ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <div className="label">{children}</div>
    </div>
  );
}
