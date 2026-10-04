import { Modal } from './ui';

/** DAF 사용 전 유선 이어폰 확인 (하울링 방지) */
export function EarphoneCheck({ open, onOk, onCancel }: { open: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} label="유선 이어폰 확인">
      <h2>유선 이어폰을 연결했나요?</h2>
      <p>
        내 목소리를 지연시켜 이어폰으로 들려줍니다. <b>스피커나 블루투스 이어폰</b>으로 들으면 하울링(삐— 소리)이 나거나 지연이 너무 길어집니다.
      </p>
      <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>
        <li>유선 이어폰을 귀에 꽂은 뒤 시작하세요.</li>
        <li>처음에는 기기 볼륨을 낮게 두고 조금씩 올리세요.</li>
      </ul>
      <div className="row">
        <button className="btn" onClick={onCancel}>
          취소
        </button>
        <button className="btn primary grow" onClick={onOk}>
          유선 이어폰 연결함
        </button>
      </div>
    </Modal>
  );
}
