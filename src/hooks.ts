import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, DEFAULT_SETTINGS, getSettings, type AppSettings } from './db/db';
import { today as getToday } from './lib/date';
import { computeStatus, type AllData } from './lib/status';

export function useToday() {
  const [t, setT] = useState(getToday);
  useEffect(() => {
    const id = window.setInterval(() => setT(getToday()), 60_000);
    const vis = () => setT(getToday());
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return t;
}

export function useAllData(): AllData | undefined {
  return useLiveQuery(async () => {
    const [profile, phaseHistory, trainingSession, recording, calibration, dailyLog, exposureItem, exposureAttempt, thoughtRecord, survey, dafTest, clinicVisit] =
      await Promise.all([
        db.profile.get(1),
        db.phaseHistory.toArray(),
        db.trainingSession.toArray(),
        db.recording.toArray(),
        db.calibration.toArray(),
        db.dailyLog.toArray(),
        db.exposureItem.toArray(),
        db.exposureAttempt.toArray(),
        db.thoughtRecord.toArray(),
        db.survey.toArray(),
        db.dafTest.toArray(),
        db.clinicVisit.toArray(),
      ]);
    return { profile, phaseHistory, trainingSession, recording, calibration, dailyLog, exposureItem, exposureAttempt, thoughtRecord, survey, dafTest, clinicVisit };
  });
}

export function useStatus(data: AllData | undefined, today: string) {
  return useMemo(() => (data ? computeStatus(data, today) : null), [data, today]);
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), [], undefined) ?? undefined;
}

export { DEFAULT_SETTINGS };

/** Blob → object URL (언마운트 시 해제) */
export function useObjectUrl(blob?: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export function useInterval(fn: () => void, ms: number | null) {
  useEffect(() => {
    if (ms == null) return;
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }, [fn, ms]);
}
