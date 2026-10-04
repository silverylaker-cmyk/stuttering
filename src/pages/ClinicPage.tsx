import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Badge, Card, Chips, TopBar } from '../components/ui';
import { PHASES, PROGRAM, type PhaseId } from '../config/program';
import { changePhase, db, setSetting } from '../db/db';
import { formatKDate } from '../lib/date';
import { navigate } from '../router';

export function ClinicPage() {
  const { clinician } = useApp();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!clinician.unlocked && !asked) {
      setAsked(true);
      void clinician.require('원장 설정은 PIN이 필요합니다.').then((ok) => !ok && navigate('/', true));
    }
  }, [clinician, asked]);
  if (!clinician.unlocked) return <TopBar title="원장 설정" backTo="/" />;
  return <Clinic />;
}

function spmOptions(phase: PhaseId): { value: string; label: string }[] {
  if (phase === 1) {
    const out = [];
    for (let s = PROGRAM.phase1Spm.min; s <= PROGRAM.phase1Spm.max; s += 5) out.push({ value: String(s), label: `${s}` });
    return out;
  }
  if (phase === 2) return PROGRAM.phase2SpmSteps.map((s) => ({ value: s == null ? 'natural' : String(s), label: s == null ? '자연' : `${s}` }));
  return [];
}

function Clinic() {
  const { data, status, settings, today } = useApp();
  const cur = status.phase;
  const [phase, setPhase] = useState<PhaseId>(cur.phase);
  const [spm, setSpm] = useState<string>(cur.targetSpm == null ? 'natural' : String(cur.targetSpm));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const history = [...data.phaseHistory].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  const opts = spmOptions(phase);
  const spmValue = opts.length ? (spm === 'natural' ? null : Number(spm)) : null;

  const pickPhase = (p: PhaseId) => {
    setPhase(p);
    const d = PHASES[p].defaultTargetSpm;
    setSpm(d == null ? 'natural' : String(d));
  };

  const apply = async () => {
    if (phase === cur.phase) {
      await db.phaseHistory.update(cur.id!, { targetSpm: spmValue, note: note.trim() || cur.note });
      setMsg('목표를 변경했습니다.');
    } else {
      await changePhase({ phase, startDate: today, targetSpm: spmValue, note: note.trim() || undefined }, today);
      setMsg(`Phase ${phase}(${PHASES[phase].name})로 변경했습니다.`);
    }
    setNote('');
  };

  return (
    <>
      <TopBar title="원장 설정" backTo="/report" />
      <div className="page">
        <Card title="승급 제안" right={status.promotion.suggested ? <Badge tone="ok">제안</Badge> : <Badge>미충족</Badge>}>
          {status.promotion.criteria.map((c) => (
            <div key={c.label} className="row small">
              <span>{c.met ? '✓' : '✗'}</span>
              <span className="grow">{c.label}</span>
              <span className="muted">{c.detail}</span>
            </div>
          ))}
          {!status.promotion.criteria.length && <span className="small muted">유지기에는 승급 기준이 없습니다.</span>}
          <p className="small muted" style={{ margin: 0 }}>
            승급은 원장님만 확정합니다. 앱은 제안만 표시합니다.
          </p>
        </Card>

        <Card title="단계·목표 처방">
          <span className="small muted">단계</span>
          <Chips options={PHASES.map((p) => ({ value: String(p.id), label: `${p.id} ${p.name}` }))} value={String(phase)} onChange={(v) => pickPhase(Number(v) as PhaseId)} />
          {opts.length > 0 && (
            <>
              <span className="small muted">목표 SPM {phase === 2 ? '(하위 단계)' : `(${PROGRAM.phase1Spm.min}–${PROGRAM.phase1Spm.max})`}</span>
              <Chips options={opts} value={spm} onChange={(v) => setSpm(v as string)} />
            </>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="처방 메모 (선택)" />
          <button className="btn primary" onClick={() => void apply()} disabled={phase === cur.phase && spmValue === (cur.targetSpm ?? null) && !note.trim()}>
            {phase === cur.phase ? '목표 변경' : `Phase ${phase}로 변경`}
          </button>
          {msg && <span className="badge ok">{msg}</span>}
        </Card>

        <Card title="기능 활성화">
          <Toggle
            label="DAF 반응 테스트"
            sub={status.daf.responder ? '반응자로 판정됨' : `완료 세션 ${status.daf.sessions.length}/${PROGRAM.daf.sessions}`}
            checked={settings.dafTestEnabled}
            onChange={(v) => setSetting('dafTestEnabled', v)}
          />
          <Toggle
            label="DAF 상황 보조 도구"
            sub={status.daf.responder ? '반응 테스트 통과 — 사용 가능' : '반응 테스트 통과 시에만 사용 가능'}
            checked={settings.dafToolEnabled}
            disabled={!status.daf.responder}
            onChange={(v) => setSetting('dafToolEnabled', v)}
          />
          <Toggle
            label="말더듬 수정법 (cancellation · pull-out)"
            sub={cur.phase >= 3 ? 'Phase 3 이상' : 'Phase 3 이상에서만 환자에게 보입니다'}
            checked={settings.modificationEnabled}
            onChange={(v) => setSetting('modificationEnabled', v)}
          />
        </Card>

        <Card title="단계 기록">
          <table className="simple">
            <thead>
              <tr>
                <th>Phase</th>
                <th>기간</th>
                <th className="num">SPM</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>
                    {h.phase} {PHASES[h.phase].name}
                    {h.note && <div className="muted">{h.note}</div>}
                  </td>
                  <td>
                    {formatKDate(h.startDate)} – {h.endDate ? formatKDate(h.endDate) : '진행 중'}
                  </td>
                  <td className="num">{h.targetSpm ?? '자연'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

function Toggle({ label, sub, checked, onChange, disabled }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="row" style={{ minHeight: 48, opacity: disabled ? 0.5 : 1 }}>
      <span className="grow">
        {label}
        {sub && (
          <>
            <br />
            <span className="small muted">{sub}</span>
          </>
        )}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 26, height: 26 }} />
    </label>
  );
}
