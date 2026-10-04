import { useState } from 'react';
import { useApp } from '../app-context';
import { Card, Scale, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { SURVEY } from '../content';
import { db } from '../db/db';
import { scoreSurvey } from '../lib/logic';
import { navigate } from '../router';

export function SurveyPage() {
  const { today, status } = useApp();
  const [answers, setAnswers] = useState<(number | null)[]>(SURVEY.items.map(() => null));
  const done = answers.every((a) => a != null);

  const save = async () => {
    if (!done) return;
    const a = answers as number[];
    await db.survey.add({ date: today, answers: a, ...scoreSurvey(a) });
    navigate('/', true);
  };

  return (
    <>
      <TopBar title={status.surveyDue.baselineNeeded ? '기저 설문' : '4주 설문'} backTo="/" />
      <div className="page">
        <p className="muted small" style={{ margin: 0 }}>
          지난 4주 동안을 떠올리며 답해 주세요. {SURVEY.scaleNote}
        </p>
        {SURVEY.items.map((it, i) => (
          <Card key={i} title={`${i + 1}. ${it.text}`}>
            <Scale
              min={0}
              max={PROGRAM.survey.max}
              value={answers[i]}
              onChange={(v) => setAnswers(answers.map((x, k) => (k === i ? v : x)))}
              lowLabel={it.low}
              highLabel={it.high}
              columns={6}
              label={it.text}
            />
          </Card>
        ))}
        <button className="btn primary lg block" disabled={!done} onClick={() => void save()}>
          저장
        </button>
      </div>
    </>
  );
}
