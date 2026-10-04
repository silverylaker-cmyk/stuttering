import { useState } from 'react';
import { useApp } from '../app-context';
import { Badge, Card, Empty, Modal, Scale, Stat, TopBar } from '../components/ui';
import { PROGRAM } from '../config/program';
import { db } from '../db/db';
import type { ExposureItem } from '../db/types';
import { formatKDate } from '../lib/date';
import { exposureStats } from '../lib/logic';

export function LadderPage() {
  const { data } = useApp();
  const [attemptFor, setAttemptFor] = useState<ExposureItem | null>(null);
  const [editing, setEditing] = useState<ExposureItem | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const items = [...data.exposureItem]
    .filter((i) => showArchived || !i.archived)
    .sort((a, b) => b.difficulty - a.difficulty || a.order - b.order);
  const stats = exposureStats(data.exposureItem, data.exposureAttempt);
  const attempts = [...data.exposureAttempt].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
  const byId = new Map(data.exposureItem.map((i) => [i.id, i]));

  return (
    <>
      <TopBar title="노출 사다리" backTo="/mind" />
      <div className="page">
        <div className="stats">
          <Stat label="완료" value={stats.completed} />
          <Stat label="최고 난이도" value={stats.maxDifficulty || '–'} />
          <Stat label="과대예측" value={stats.overprediction ?? '–'} sub="예상−실제" />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          아래쪽(쉬운 단계)부터 도전하고, 해 본 뒤 실제 불안을 기록하세요. 예상보다 덜 불안했던 경험이 쌓이는 것이 목표예요.
        </p>
        <Card>
          <div className="list">
            {items.map((it) => {
              const n = data.exposureAttempt.filter((a) => a.itemId === it.id).length;
              return (
                <div key={it.id} className="list-item" style={{ cursor: 'default' }}>
                  <span className="badge ok tabnum" style={{ minWidth: 36, justifyContent: 'center' }}>
                    {it.difficulty}
                  </span>
                  <span className="grow">
                    {it.title} {it.archived && <Badge>보관</Badge>}
                    <br />
                    <span className="small muted">{n ? `${n}회 완료` : '아직 안 해 봄'}</span>
                  </span>
                  <button className="btn" style={{ minHeight: 40, padding: '0 10px' }} onClick={() => setEditing(it)} aria-label={`${it.title} 편집`}>
                    ✎
                  </button>
                  <button className="btn primary" style={{ minHeight: 40, padding: '0 12px' }} onClick={() => setAttemptFor(it)}>
                    기록
                  </button>
                </div>
              );
            })}
          </div>
          <div className="row">
            <button className="btn grow" onClick={() => setEditing('new')}>
              + 항목 추가
            </button>
            <button className="btn ghost" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? '보관 숨기기' : '보관 보기'}
            </button>
          </div>
        </Card>

        <Card title="최근 시도">
          {attempts.length === 0 && <Empty>아직 기록이 없어요.</Empty>}
          <table className="simple">
            <tbody>
              {attempts.slice(0, 20).map((a) => (
                <tr key={a.id}>
                  <td>{formatKDate(a.date)}</td>
                  <td>{byId.get(a.itemId)?.title ?? '삭제된 항목'}</td>
                  <td className="num">
                    {a.anticipated}→{a.actual}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {attemptFor && <AttemptModal item={attemptFor} onClose={() => setAttemptFor(null)} />}
      {editing && <ItemModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} nextOrder={data.exposureItem.length} />}
    </>
  );
}

function AttemptModal({ item, onClose }: { item: ExposureItem; onClose: () => void }) {
  const { today, settings, status } = useApp();
  const [anticipated, setAnt] = useState<number | null>(null);
  const [actual, setAct] = useState<number | null>(null);
  const [sr, setSr] = useState<number | null>(null);
  const [usedTechnique, setTech] = useState(false);
  const [usedModification, setMod] = useState(false);
  const [memo, setMemo] = useState('');
  const modOn = settings.modificationEnabled && status.phase.phase >= 3;
  const ok = anticipated != null && actual != null && sr != null;

  const save = async () => {
    if (!ok) return;
    await db.exposureAttempt.add({
      itemId: item.id!,
      date: today,
      anticipated,
      actual,
      sr,
      usedTechnique,
      usedModification: modOn ? usedModification : undefined,
      memo: memo.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} label="노출 시도 기록">
      <h2>{item.title}</h2>
      <b>해 보기 전, 예상 불안</b>
      <Scale min={PROGRAM.anxiety.min} max={PROGRAM.anxiety.max} value={anticipated} onChange={setAnt} lowLabel="전혀" highLabel="극심" columns={6} />
      <b>해 본 뒤, 실제 불안</b>
      <Scale min={PROGRAM.anxiety.min} max={PROGRAM.anxiety.max} value={actual} onChange={setAct} lowLabel="전혀" highLabel="극심" columns={6} />
      <b>그 상황의 말더듬 정도 (SR)</b>
      <Scale min={PROGRAM.sr.min} max={PROGRAM.sr.max} value={sr} onChange={setSr} lowLabel="없음" highLabel="극심" />
      <label className="row">
        <input type="checkbox" checked={usedTechnique} onChange={(e) => setTech(e.target.checked)} style={{ width: 22, height: 22 }} />
        연장발화 기법을 사용했어요
      </label>
      {modOn && (
        <label className="row">
          <input type="checkbox" checked={usedModification} onChange={(e) => setMod(e.target.checked)} style={{ width: 22, height: 22 }} />
          수정법(cancellation·pull-out)을 사용했어요
        </label>
      )}
      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" />
      <div className="row">
        <button className="btn" onClick={onClose}>
          취소
        </button>
        <button className="btn primary grow" disabled={!ok} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  );
}

function ItemModal({ item, onClose, nextOrder }: { item: ExposureItem | null; onClose: () => void; nextOrder: number }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [difficulty, setDifficulty] = useState<number | null>(item?.difficulty ?? null);
  const save = async () => {
    if (!title.trim() || difficulty == null) return;
    if (item) await db.exposureItem.update(item.id!, { title: title.trim(), difficulty });
    else await db.exposureItem.add({ title: title.trim(), difficulty, order: nextOrder, archived: false });
    onClose();
  };
  return (
    <Modal open onClose={onClose} label="사다리 항목">
      <h2>{item ? '항목 편집' : '항목 추가'}</h2>
      <label className="field">
        상황
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="예: 미용실에 전화로 예약하기" />
      </label>
      <b>난이도</b>
      <Scale min={PROGRAM.exposureDifficulty.min} max={PROGRAM.exposureDifficulty.max} value={difficulty} onChange={setDifficulty} lowLabel="쉬움" highLabel="매우 어려움" />
      <div className="row">
        {item && (
          <button
            className="btn"
            onClick={async () => {
              await db.exposureItem.update(item.id!, { archived: !item.archived });
              onClose();
            }}
          >
            {item.archived ? '보관 해제' : '보관'}
          </button>
        )}
        <button className="btn primary grow" disabled={!title.trim() || difficulty == null} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  );
}
