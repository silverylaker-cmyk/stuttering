import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Card, Chips, Scale, TopBar } from '../components/ui';
import { AVOIDANCE_OPTIONS, PROGRAM, SITUATION_TAGS } from '../config/program';
import { db } from '../db/db';
import type { Avoidance } from '../db/types';
import { addDays, formatKDate } from '../lib/date';
import { back } from '../router';

export function DailyLogPage() {
  const { data, today } = useApp();
  const [date, setDate] = useState(today);
  const existing = data.dailyLog.find((l) => l.date === date);
  const [sr, setSr] = useState<number | null>(existing?.sr ?? null);
  const [situations, setSituations] = useState<string[]>(existing?.situations ?? []);
  const [avoidance, setAvoidance] = useState<Avoidance>(existing?.avoidance ?? 'none');
  const [memo, setMemo] = useState(existing?.memo ?? '');

  useEffect(() => {
    setSr(existing?.sr ?? null);
    setSituations(existing?.situations ?? []);
    setAvoidance(existing?.avoidance ?? 'none');
    setMemo(existing?.memo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const save = async () => {
    if (sr == null) return;
    // 하루 1건: 같은 날짜로 다시 저장하면 덮어쓴다
    await db.dailyLog.put({ date, sr, situations, avoidance, memo: memo.trim() || undefined });
    back('/');
  };

  return (
    <>
      <TopBar title="일일 기록" backTo="/" />
      <div className="page">
        <div className="row">
          <button className="btn" aria-label="전날" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <b className="grow center">
            {date === today ? '오늘' : ''} {formatKDate(date)}
          </b>
          <button className="btn" aria-label="다음날" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
            ›
          </button>
        </div>
        {existing && <p className="small muted center" style={{ margin: 0 }}>이미 기록한 날이에요. 저장하면 덮어씁니다.</p>}

        <Card title="오늘 말더듬 정도 (SR)">
          <Scale min={PROGRAM.sr.min} max={PROGRAM.sr.max} value={sr} onChange={setSr} lowLabel="말더듬 없음" highLabel="극심" label="SR" />
        </Card>

        <Card title="어려웠던 상황">
          <Chips options={SITUATION_TAGS} value={situations} onChange={(v) => setSituations(v as string[])} multi />
        </Card>

        <Card title="회피">
          <Chips options={AVOIDANCE_OPTIONS} value={avoidance} onChange={(v) => setAvoidance(v as Avoidance)} />
        </Card>

        <Card title="메모">
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택" maxLength={500} />
        </Card>

        <button className="btn primary lg block" disabled={sr == null} onClick={() => void save()}>
          저장
        </button>
      </div>
    </>
  );
}
