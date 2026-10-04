import { useState } from 'react';
import { useApp } from '../app-context';
import { Card, Empty, Stat, TopBar, VideoSlot } from '../components/ui';
import { PROGRAM } from '../config/program';
import { GUIDES, THOUGHT_PRESETS } from '../content';
import { db, setSetting } from '../db/db';
import type { ThoughtRecord } from '../db/types';
import { formatKDate } from '../lib/date';
import { thoughtStats } from '../lib/logic';

export function ThoughtPage() {
  const { data, settings } = useApp();
  const [mode, setMode] = useState<'list' | 'new' | 'intro'>(settings.cbtIntroSeen ? 'list' : 'intro');
  const [open, setOpen] = useState<number | null>(null);
  const stats = thoughtStats(data.thoughtRecord);
  const list = [...data.thoughtRecord].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));

  if (mode === 'intro') return <Intro onDone={() => setMode(settings.cbtIntroSeen ? 'list' : 'new')} />;
  if (mode === 'new') return <NewRecord onDone={() => setMode('list')} />;

  return (
    <>
      <TopBar title="사고 기록" backTo="/mind" />
      <div className="page">
        <div className="stats">
          <Stat label="기록 수" value={stats.count} />
          <Stat label="확신도 감소 평균" value={stats.beliefDropAvg ?? '–'} sub="0–100 점" />
        </div>
        <button className="btn primary lg block" onClick={() => setMode('new')}>
          + 새 사고 기록
        </button>
        <Card>
          {list.length === 0 && <Empty>아직 기록이 없어요.</Empty>}
          <div className="list">
            {list.map((r) => (
              <div key={r.id}>
                <button className="list-item" onClick={() => setOpen(open === r.id ? null : r.id!)} aria-expanded={open === r.id}>
                  <span className="grow">
                    <b>{formatKDate(r.date)}</b> · {r.situation}
                    <br />
                    <span className="small muted">
                      확신도 {r.beliefBefore} → {r.beliefAfter}
                    </span>
                  </span>
                  <span className="chev">{open === r.id ? '▴' : '▾'}</span>
                </button>
                {open === r.id && <Detail r={r} />}
              </div>
            ))}
          </div>
        </Card>
        <button className="btn ghost" onClick={() => setMode('intro')}>
          인지 재구성 안내 다시 보기
        </button>
        <VideoSlot k="thought-record" title="사고 기록" />
      </div>
    </>
  );
}

function Detail({ r }: { r: ThoughtRecord }) {
  const rows: [string, string][] = [
    ['자동적 사고', r.thought],
    ['지지 증거', r.evidenceFor],
    ['반대 증거', r.evidenceAgainst],
    ['대안적 사고', r.alternative],
  ];
  return (
    <div className="stack small" style={{ padding: '4px 0 12px' }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <b>{k}</b>
          <div className="muted">{v || '–'}</div>
        </div>
      ))}
    </div>
  );
}

function Intro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const cards = GUIDES.cbtCards;
  const last = i === cards.length - 1;
  return (
    <>
      <TopBar title="사고 기록 안내" backTo="/mind" />
      <div className="page">
        <div className="steps" aria-hidden>
          {cards.map((_, k) => (
            <span key={k} className={k <= i ? 'on' : ''} />
          ))}
        </div>
        <Card tone="primary">
          <h2>{cards[i].title}</h2>
          <p style={{ margin: 0 }}>{cards[i].text}</p>
        </Card>
        <div className="row">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
            이전
          </button>
          <button
            className="btn primary grow"
            onClick={async () => {
              if (!last) return setI(i + 1);
              await setSetting('cbtIntroSeen', true);
              onDone();
            }}
          >
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </>
  );
}

function NewRecord({ onDone }: { onDone: () => void }) {
  const { today } = useApp();
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState('');
  const [thought, setThought] = useState('');
  const [presetId, setPresetId] = useState<string | undefined>();
  const [beliefBefore, setBefore] = useState(70);
  const [evidenceFor, setFor] = useState('');
  const [evidenceAgainst, setAgainst] = useState('');
  const [alternative, setAlternative] = useState('');
  const [beliefAfter, setAfter] = useState(50);

  const steps = [
    { title: '어떤 상황이었나요?', ok: !!situation.trim() },
    { title: '떠오른 생각은?', ok: !!thought.trim() },
    { title: '증거 살펴보기', ok: !!evidenceAgainst.trim() },
    { title: '대안적 생각', ok: !!alternative.trim() },
    { title: '다시 매겨 보기', ok: true },
  ];

  const save = async () => {
    await db.thoughtRecord.add({
      date: today,
      situation: situation.trim(),
      thought: thought.trim(),
      presetId,
      beliefBefore,
      evidenceFor: evidenceFor.trim(),
      evidenceAgainst: evidenceAgainst.trim(),
      alternative: alternative.trim(),
      beliefAfter,
    });
    onDone();
  };

  const B = PROGRAM.belief;
  return (
    <>
      <TopBar title="새 사고 기록" backTo="/mind/thought" />
      <div className="page">
        <div className="steps" aria-hidden>
          {steps.map((_, k) => (
            <span key={k} className={k <= step ? 'on' : ''} />
          ))}
        </div>
        <Card title={`${step + 1}. ${steps[step].title}`}>
          {step === 0 && (
            <textarea autoFocus value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="예: 카페에서 주문하려고 줄을 서 있을 때" />
          )}
          {step === 1 && (
            <>
              <span className="small muted">자주 떠오르는 생각에서 고르거나 직접 적어 보세요.</span>
              <div className="stack">
                {THOUGHT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${presetId === p.id ? 'on' : ''}`}
                    style={{ textAlign: 'left', borderRadius: 12, padding: '8px 12px' }}
                    onClick={() => {
                      setPresetId(p.id);
                      setThought(p.text);
                    }}
                  >
                    {p.text}
                  </button>
                ))}
              </div>
              <textarea
                value={thought}
                onChange={(e) => {
                  setThought(e.target.value);
                  setPresetId(undefined);
                }}
                placeholder="직접 적기"
              />
              <label className="field">
                이 생각을 얼마나 믿나요? <span className="big-num" style={{ fontSize: '1.4rem' }}>{beliefBefore}</span>
                <input type="range" min={B.min} max={B.max} step={5} value={beliefBefore} onChange={(e) => setBefore(Number(e.target.value))} />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <p className="small muted" style={{ margin: 0 }}>“{thought}”</p>
              <label className="field">
                이 생각을 지지하는 증거
                <textarea value={evidenceFor} onChange={(e) => setFor(e.target.value)} placeholder="실제로 있었던 일만 적어요" />
              </label>
              <label className="field">
                이 생각에 반대되는 증거
                <textarea value={evidenceAgainst} onChange={(e) => setAgainst(e.target.value)} placeholder="예: 대부분은 끝까지 기다려 주었다" />
              </label>
            </>
          )}
          {step === 3 && (
            <label className="field">
              모든 증거를 고려하면, 더 균형 잡힌 생각은?
              <textarea value={alternative} onChange={(e) => setAlternative(e.target.value)} placeholder="예: 조금 막혀도 주문은 끝까지 할 수 있다" />
            </label>
          )}
          {step === 4 && (
            <>
              <p className="small muted" style={{ margin: 0 }}>처음 생각: “{thought}”</p>
              <label className="field">
                지금은 이 생각을 얼마나 믿나요? <span className="big-num" style={{ fontSize: '1.4rem' }}>{beliefAfter}</span>
                <input type="range" min={B.min} max={B.max} step={5} value={beliefAfter} onChange={(e) => setAfter(Number(e.target.value))} />
              </label>
              <p className="small">
                처음 {beliefBefore} → 지금 {beliefAfter} ({beliefBefore - beliefAfter >= 0 ? `${beliefBefore - beliefAfter}점 감소` : `${beliefAfter - beliefBefore}점 증가`})
              </p>
            </>
          )}
        </Card>
        <div className="row">
          <button className="btn" onClick={() => (step === 0 ? onDone() : setStep(step - 1))}>
            {step === 0 ? '취소' : '이전'}
          </button>
          <button className="btn primary grow" disabled={!steps[step].ok} onClick={() => (step === steps.length - 1 ? void save() : setStep(step + 1))}>
            {step === steps.length - 1 ? '저장' : '다음'}
          </button>
        </div>
      </div>
    </>
  );
}
