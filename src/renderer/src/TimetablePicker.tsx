import { useEffect, useRef, useState } from 'react';
import type { Timetable, Weekday } from '../../shared/data';
import { daysUsing } from '../../shared/timetable-ops';
import type { ToastApi } from './Toasts';
import { ActionIcon } from './icons';
import { Modal } from './Modal';
import { weekdayName } from './weekdays';

type Props = {
  /** 배정을 바꿀 요일. */
  day: Weekday;
  timetables: Timetable[];
  weekdays: Record<Weekday, string | null>;
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
  /** 닫을 때 부른다. */
  onClose(): void;
};

/** 시간표 색 하나를 나타내는 점. 색은 보조 단서라 화면 읽기에서는 숨긴다. */
function Dot({ color }: { color: number | null }) {
  return <i className="dot" aria-hidden="true" style={color === null ? undefined : { background: `var(--timetable-${color})` }} />;
}

/** 명령을 보낸다. 메인이 거절하면 개발자가 알 수 있게 콘솔에 남긴다. */
function send(command: Parameters<typeof window.dingdong.command>[0]): void {
  window.dingdong.command(command).catch((error: unknown) => console.error(error));
}

/**
 * 시간표 선택 창. 고르면 선택한 요일의 배정이 바뀌고 즉시 저장된다.
 * "없음"과 "새 시간표"는 목록 밖 맨 아래에 있어 목록이 스크롤돼도 항상 보인다.
 * "편집"을 누를 때만 줄마다 이름 바꾸기와 지우기가 나타난다.
 */
export function TimetablePicker({ day, timetables, weekdays, toasts, onClose }: Props) {
  /** 편집 중인지. */
  const [editing, setEditing] = useState(false);
  /** 이름을 바꾸는 중인 시간표 id. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  /** 바꾸는 중인 이름. */
  const [draft, setDraft] = useState('');
  /** 지우기 확인을 기다리는 시간표. */
  const [confirming, setConfirming] = useState<Timetable | null>(null);
  /** "완료"/"편집" 단추. 줄이 사라져 초점을 잃으면 여기로 모은다. */
  const toggleRef = useRef<HTMLButtonElement>(null);
  /** 방금 이름을 바꾸다 끝낸 줄의 id. 끝나면 그 줄의 이름 바꾸기 단추로 초점을 돌려준다. */
  const renamedRef = useRef<string | null>(null);

  /** 고른 요일에 지금 배정된 시간표 id. 배정이 없으면 null. */
  const current = weekdays[day];

  // 지금 배정된 시간표가 접힌 자리에 있으면 보이게 한다
  useEffect(function revealCurrent() {
    document.querySelector('.timetable-option[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, []);

  // 시간표가 지워져 초점이 있던 단추가 사라졌으면 "완료"로 모은다
  useEffect(
    function keepFocusAfterRemoval() {
      if (document.activeElement === document.body) toggleRef.current?.focus();
    },
    [timetables],
  );

  // 이름 바꾸기가 끝나면 그 줄의 단추로 초점을 돌려준다
  useEffect(
    function returnFocusAfterRename() {
      if (renamingId !== null || !renamedRef.current) return;
      document.querySelector<HTMLElement>(`[data-rename-for="${renamedRef.current}"]`)?.focus();
      renamedRef.current = null;
    },
    [renamingId],
  );

  /** 이름 바꾸기를 시작한다. 입력 칸에는 지금 이름이 들어 있다. */
  function startRename(t: Timetable): void {
    setRenamingId(t.id);
    setDraft(t.name);
  }

  /** 이름 바꾸기를 접고, 끝난 줄을 기억해 초점을 그 줄의 단추로 돌려준다. */
  function endRename(id: string): void {
    renamedRef.current = id;
    setRenamingId(null);
  }

  /** 바꾼 이름을 저장한다. 비어 있으면 아무것도 하지 않는다(저장 단추도 잠겨 있다). */
  function commitRename(id: string): void {
    if (draft.trim() === '') return;
    toasts.dismissUndo();
    send({ type: 'rename-timetable', id, name: draft });
    endRename(id);
  }

  /** 편집과 완료를 오간다. 이름 바꾸는 중이던 줄은 접는다. */
  function toggleEditing(): void {
    toasts.dismissUndo();
    setEditing((on) => !on);
    setRenamingId(null);
  }

  /** 고른 요일의 배정을 바꾸고 창을 닫는다. null은 없음이다. */
  function pick(id: string | null): void {
    toasts.dismissUndo();
    send({ type: 'assign-weekday', day, timetableId: id });
    onClose();
  }

  /** 새 시간표를 만든다. 선택 모드에서는 고른 요일에 배정하고 닫고, 편집 중에는 열어 둔다. */
  function create(): void {
    toasts.dismissUndo();
    if (editing) {
      // 편집 중에는 목록에 더하기만 하고 열어 둔다. 이름을 바로 바꿀 수 있다
      send({ type: 'create-timetable' });
    } else {
      send({ type: 'create-timetable', assignTo: day });
      onClose();
    }
  }

  /** 지우기. 배정이 없으면 바로 지우고 "되돌리기"를 알리고, 배정이 있으면 확인을 묻는다. */
  function remove(t: Timetable): void {
    if (daysUsing(weekdays, t.id).length > 0) {
      setConfirming(t);
      return;
    }
    toasts.dismissUndo();
    send({ type: 'delete-timetable', id: t.id });
    toasts.notify({
      key: `undo-${t.id}`,
      kind: 'undo',
      text: `'${t.name}' 시간표를 지웠어요`,
      action: {
        label: '되돌리기',
        run: () => {
          send({ type: 'restore-timetable', id: t.id });
          toasts.notify({ key: `restored-${t.id}`, kind: 'success', text: `'${t.name}' 시간표를 되돌렸어요` });
        },
      },
    });
  }

  /** 확인 모달 위에서 "시간표 지우기"를 눌렀을 때. 그 요일은 없음이 된다. */
  function confirmRemove(t: Timetable): void {
    toasts.dismissUndo();
    send({ type: 'delete-timetable', id: t.id });
    setConfirming(null);
  }

  return (
    <>
      <Modal
        title={editing ? '시간표 편집' : `${weekdayName(day)} 시간표`}
        sheet
        onClose={onClose}
        titleAction={
          <button
            type="button"
            ref={toggleRef}
            className="modal__link"
            onClick={toggleEditing}
          >
            {editing ? '완료' : '편집'}
          </button>
        }
      >
        <div className="timetable-list">
          {timetables.map((t) => {
            const renaming = renamingId === t.id;
            if (editing) {
              return (
                <div key={t.id} className="timetable-option timetable-option--editing">
                  <Dot color={t.color} />
                  {renaming ? (
                    <input
                      className="input timetable-option__input"
                      aria-label={`'${t.name}' 새 이름`}
                      aria-invalid={draft.trim() === ''}
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // 같은 Enter가 초점이 옮겨 간 이름 바꾸기 단추까지 누르지 않게 막는다
                          e.preventDefault();
                          commitRename(t.id);
                        }
                        if (e.key === 'Escape') {
                          // 이름 바꾸기만 접고 시간표 선택 창은 닫지 않는다
                          e.preventDefault();
                          endRename(t.id);
                        }
                      }}
                    />
                  ) : (
                    <span className="timetable-option__name">{t.name}</span>
                  )}
                  <span className="icon-buttons">
                    {renaming ? (
                      <button
                        type="button"
                        className="icon-button"
                        title="이름 저장"
                        aria-label={`'${t.name}' 이름 저장`}
                        disabled={draft.trim() === ''}
                        onClick={() => commitRename(t.id)}
                      >
                        <ActionIcon name="ok" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-button"
                        data-rename-for={t.id}
                        title="이름 바꾸기"
                        aria-label={`'${t.name}' 이름 바꾸기`}
                        onClick={() => startRename(t)}
                      >
                        <ActionIcon name="pen" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button"
                      title="지우기"
                      aria-label={`'${t.name}' 지우기`}
                      onClick={() => remove(t)}
                    >
                      <ActionIcon name="bin" />
                    </button>
                  </span>
                  {renaming && draft.trim() === '' && (
                    <span className="field-error" role="alert">
                      <ActionIcon name="bang" />
                      이름을 비울 수 없어요. 이름을 입력해 주세요.
                    </span>
                  )}
                </div>
              );
            }
            return (
              <button
                key={t.id}
                type="button"
                className="timetable-option"
                aria-current={t.id === current ? 'true' : undefined}
                data-autofocus={t.id === current ? '' : undefined}
                onClick={() => pick(t.id)}
              >
                <Dot color={t.color} />
                <span className="timetable-option__name">{t.name}</span>
              </button>
            );
          })}
        </div>
        {!editing && (
          <button
            type="button"
            className="timetable-option"
            aria-current={current === null ? 'true' : undefined}
            data-autofocus={current === null || !timetables.some((t) => t.id === current) ? '' : undefined}
            onClick={() => pick(null)}
          >
            없음
          </button>
        )}
        <button type="button" className="timetable-option timetable-option--new" onClick={create}>
          <ActionIcon name="plus" />새 시간표
        </button>
      </Modal>

      {confirming && (
        <Modal title={`'${confirming.name}' 시간표를 지울까요?`} onClose={() => setConfirming(null)}>
          <DeleteNotice days={daysUsing(weekdays, confirming.id)} />
          <div className="modal__actions">
            {/* 되돌릴 수 없는 일이라 처음 초점은 "취소"다 */}
            <button type="button" className="button button--ghost" data-autofocus onClick={() => setConfirming(null)}>
              취소
            </button>
            <button type="button" className="button button--red" onClick={() => confirmRemove(confirming)}>
              시간표 지우기
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** 지우면 종이 울리지 않게 되는 요일을 알리는 문장. 확인을 묻는 동안 배정이 바뀌어도 그때의 요일을 보여 준다. */
function DeleteNotice({ days }: { days: Weekday[] }) {
  const names = days.map(weekdayName);
  return (
    <p>
      {names.join(', ')}에 쓰는 시간표예요.
      <br />
      지우면 {days.length === 1 ? names[0] : '그 요일'}에는 종이 울리지 않아요.
    </p>
  );
}
