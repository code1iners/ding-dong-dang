import { useState, type FormEvent } from 'react';
import { ActionIcon } from './icons';
import { Modal } from './Modal';

type Props = {
  /** 받은 이름(앞뒤 공백을 뗀 것)으로 시간표를 만든다. 만드는 동안 단추를 잠근다. */
  onCreate(name: string): Promise<void>;
  /** 아무것도 하지 않고 닫는다. ×, "취소", Esc가 부른다. */
  onClose(): void;
};

/** "새 시간표" 이름을 받는 창. 이름이 비면(공백뿐이어도) "만들기"가 잠기고, Enter는 만들기, Esc는 닫기다. */
export function CreateTimetableModal({ onCreate, onClose }: Props) {
  /** 입력 중인 이름. */
  const [name, setName] = useState('');
  /** 만드는 중인지. 두 번 눌러 둘이 생기지 않게 한다. */
  const [busy, setBusy] = useState(false);
  /** 만들 수 있는 이름. 비면 만들지 않는다. */
  const trimmed = name.trim();

  /** Enter와 "만들기"가 함께 쓰는 제출. */
  function submit(event: FormEvent): void {
    event.preventDefault();
    // 빈 이름이거나 이미 만드는 중이면 Enter를 눌러도 아무 일도 없다
    if (trimmed === '' || busy) return;
    setBusy(true);
    onCreate(trimmed).finally(() => setBusy(false));
  }

  return (
    <Modal
      title="새 시간표"
      form
      onClose={onClose}
      titleAction={
        <button type="button" className="icon-button modal__close" title="새 시간표 창 닫기" aria-label="새 시간표 창 닫기" onClick={onClose}>
          <ActionIcon name="x" />
        </button>
      }
    >
      <form className="modal__form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">이름</span>
          <input
            className="input"
            placeholder="예: 평일반"
            value={name}
            data-autofocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="button" disabled={trimmed === '' || busy}>
            만들기
          </button>
        </div>
      </form>
    </Modal>
  );
}
