import { useState } from 'react';

export interface Counts {
  syllables: number;
  stutters: number;
}

/**
 * 큰 버튼 2개 탭 카운터.
 * [말더듬] 탭은 "말더듬이 있는 음절 1개"로, 음절 수에도 함께 더해진다(음절당 버튼 하나만 누르면 됨).
 */
export function TapCounter({ onChange }: { onChange: (c: Counts) => void }) {
  const [events, setEvents] = useState<('s' | 'x')[]>([]);
  const counts = (ev: ('s' | 'x')[]): Counts => ({ syllables: ev.length, stutters: ev.filter((e) => e === 'x').length });
  const push = (e: 's' | 'x' | 'undo' | 'reset') => {
    const next = e === 'undo' ? events.slice(0, -1) : e === 'reset' ? [] : [...events, e];
    setEvents(next);
    onChange(counts(next));
    if (e !== 'undo' && e !== 'reset') navigator.vibrate?.(8);
  };
  const c = counts(events);
  return (
    <div className="stack">
      <div className="counter">
        <button className="syl-btn" onPointerDown={(e) => { e.preventDefault(); push('s'); }} aria-label={`음절, 현재 ${c.syllables - c.stutters}`}>
          음절
          <span className="n">{c.syllables - c.stutters}</span>
        </button>
        <button className="stu-btn" onPointerDown={(e) => { e.preventDefault(); push('x'); }} aria-label={`말더듬, 현재 ${c.stutters}`}>
          말더듬
          <span className="n">{c.stutters}</span>
        </button>
      </div>
      <div className="row">
        <button className="btn grow" onClick={() => push('undo')} disabled={!events.length}>
          ↶ 되돌리기
        </button>
        <button className="btn" onClick={() => push('reset')} disabled={!events.length}>
          처음부터
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        재생하며 음절마다 한 번씩 누르세요. 더듬은 음절은 <b>[말더듬]</b>만 누릅니다. 총 음절 {c.syllables}
      </p>
    </div>
  );
}
