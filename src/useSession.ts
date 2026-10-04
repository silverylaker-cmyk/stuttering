import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from './db/db';
import type { TrainingSession } from './db/types';
import { today } from './lib/date';

/** 이 시간보다 짧은 세션은 저장하지 않는다(실수로 들어온 경우) */
const MIN_SAVE_SEC = 10;

/**
 * 훈련 세션 시간 측정. 첫 start() 부터 end() 또는 화면 이탈까지의 시간을 자동 기록한다.
 * 백그라운드로 간 시간은 제외한다.
 */
export function useTrainingSession(type: TrainingSession['type'], meta: () => Partial<TrainingSession>) {
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const [running, setRunning] = useState(false);
  const [, tick] = useState(0);

  const elapsed = () => accumulated.current + (startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0);

  const start = useCallback(() => {
    if (startedAt.current == null) startedAt.current = performance.now();
    setRunning(true);
  }, []);

  const save = useCallback(async () => {
    const sec = Math.round(elapsed());
    startedAt.current = null;
    accumulated.current = 0;
    setRunning(false);
    if (sec < MIN_SAVE_SEC) return 0;
    await db.trainingSession.add({ ...metaRef.current(), type, date: today(), durationSec: sec });
    return sec;
  }, [type]);

  useEffect(() => {
    const vis = () => {
      if (document.hidden && startedAt.current != null) {
        accumulated.current += (performance.now() - startedAt.current) / 1000;
        startedAt.current = null;
      } else if (!document.hidden && accumulated.current > 0 && startedAt.current == null) {
        startedAt.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', vis);
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.clearInterval(id);
      // 화면을 떠나면 자동 저장
      if (elapsed() >= MIN_SAVE_SEC) void save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, save, running, elapsedSec: elapsed() };
}
