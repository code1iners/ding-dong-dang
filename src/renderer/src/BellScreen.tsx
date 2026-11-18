import { useEffect, useRef, useState } from 'react';
import type { AppState, Command, CommandResult } from '../../shared/bridge';
import { BUILTIN_SOUNDS } from '../../shared/builtin-sounds';
import { ActionIcon } from './icons';
import { Slider } from './Slider';
import type { ToastApi } from './Toasts';

type Props = {
  state: Pick<AppState, 'sounds' | 'soundVolumes' | 'startBell' | 'endBell' | 'masterVolume' | 'previewingSound'>;
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
};

/** 지운 종소리의 "되돌리기" 알림 키 앞부분. 알림이 사라지면 앱이 이 키로 지운 파일을 정리하라고 메인에 알린다. */
export const UNDO_SOUND_PREFIX = 'undo-sound-';

/** 목록의 한 줄. 내장 음원과 등록 음원이 같은 모양이고, 등록 음원에만 이름 바꾸기와 지우기가 있다. */
type Row = { id: string; name: string; registered: boolean };

/** 메인에 명령을 보낸다. 거절되면 콘솔에만 남긴다. */
function send(command: Command): Promise<CommandResult> {
  return window.dingdong.command(command).catch((error: unknown) => {
    console.error(error);
    return { ok: false };
  });
}

/**
 * 종 화면. 위에 전체 음량과 "종소리 등록", 아래 목록의 줄마다 미리 듣기, 이름, 음량,
 * 시작종 · 끝종 선택이 있다. 바꾸는 즉시 저장된다.
 */
export function BellScreen({ state, toasts }: Props) {
  /** 이름을 바꾸는 중인 등록 음원 id. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  /** 바꾸는 중인 이름. */
  const [draft, setDraft] = useState('');
  /** 등록하는 중인지. 파일 고르기 창이 떠 있는 동안 또 누르지 않게 한다. */
  const [registering, setRegistering] = useState(false);
  /** 방금 등록했는지. 새 줄이 목록 끝에 그려지면 그 줄이 보이게 스크롤하고 비운다. */
  const justAdded = useRef(false);
  /** 이름 바꾸기를 끝낸 줄의 id. 그 줄의 이름 바꾸기 단추로 초점을 돌려준다. */
  const renamedRef = useRef<string | null>(null);

  /** 목록에 나오는 줄: 내장 열두 개 다음에 등록한 순서대로. */
  const rows: Row[] = [
    ...BUILTIN_SOUNDS.map((s) => ({ id: s.id, name: s.name, registered: false })),
    ...state.sounds.map((s) => ({ id: s.id, name: s.name, registered: true })),
  ];

  useEffect(
    function revealAddedRow() {
      if (!justAdded.current) return;
      document.querySelector('.sound-row:last-child')?.scrollIntoView({ block: 'nearest' });
      justAdded.current = false;
    },
    [state.sounds],
  );
  useEffect(
    function returnFocusAfterRename() {
      if (renamingId !== null || !renamedRef.current) return;
      document.querySelector<HTMLElement>(`[data-rename-for="${renamedRef.current}"]`)?.focus();
      renamedRef.current = null;
    },
    [renamingId],
  );

  /** 파일을 골라 종소리로 등록한다. 거절되면 이유를 알림으로 말하고 목록은 그대로다. */
  async function register(): Promise<void> {
    if (registering) return;
    setRegistering(true);
    toasts.dismissUndo();
    try {
      const result = await send({ type: 'register-sound' });
      if (result.message) {
        toasts.notify({ key: 'register-failed', kind: 'failure', text: result.message });
      } else if (result.name) {
        justAdded.current = true;
        toasts.notify({ key: 'sound-registered', kind: 'success', text: `'${result.name}' 종소리를 등록했어요` });
      }
    } finally {
      setRegistering(false);
    }
  }

  /** 이름 바꾸기를 접고 초점을 그 줄의 단추로 돌려준다. */
  function endRename(id: string): void {
    renamedRef.current = id;
    setRenamingId(null);
  }

  /** 바꾼 이름을 저장한다. 비어 있으면 아무것도 하지 않는다(저장 단추도 잠겨 있다). */
  function commitRename(id: string): void {
    if (draft.trim() === '') return;
    toasts.dismissUndo();
    void send({ type: 'rename-sound', id, name: draft });
    endRename(id);
  }

  /** 등록한 종소리를 바로 지우고 "되돌리기" 알림을 띄운다. */
  function remove(row: Row): void {
    toasts.dismissUndo();
    void send({ type: 'delete-sound', id: row.id });
    toasts.notify({
      key: `${UNDO_SOUND_PREFIX}${row.id}`,
      kind: 'undo',
      text: `'${row.name}' 종소리를 지웠어요`,
      action: {
        label: '되돌리기',
        run: () => {
          void send({ type: 'restore-sound', id: row.id });
          toasts.notify({ key: `restored-sound-${row.id}`, kind: 'success', text: `'${row.name}' 종소리를 되돌렸어요` });
        },
      },
    });
  }

  return (
    <div className="card card--bells">
      <div className="bell-head">
        <span>전체 음량</span>
        <Slider
          label="전체 음량"
          value={state.masterVolume}
          onChange={(volume) => {
            toasts.dismissUndo();
            void send({ type: 'set-master-volume', volume });
          }}
        />
        <button type="button" className="button button--ghost button--sm bell-head__add" disabled={registering} onClick={() => void register()}>
          <ActionIcon name="plus" />
          종소리 등록
        </button>
      </div>
      <div className="sound-grid sound-grid--head" aria-hidden="true">
        <span />
        <span />
        <span>음량</span>
        <span>시작종</span>
        <span>끝종</span>
        <span />
      </div>
      <ul className="sound-list" aria-label="종소리 목록">
        {rows.map((row) => {
          /** 이 줄을 미리 듣는 중인지. */
          const previewing = state.previewingSound === row.id;
          /** 이 줄의 이름을 바꾸는 중인지. */
          const renaming = renamingId === row.id;
          return (
            <li key={row.id} className="sound-grid sound-row" data-sound-id={row.id}>
              <button
                type="button"
                className="play-button"
                title={`${row.name} ${previewing ? '미리 듣기 멈추기' : '미리 듣기'}`}
                aria-label={`${row.name} ${previewing ? '미리 듣기 멈추기' : '미리 듣기'}`}
                aria-pressed={previewing}
                onClick={() => void send({ type: 'toggle-preview', id: row.id })}
              >
                <ActionIcon name={previewing ? 'stop' : 'play'} />
              </button>
              {renaming ? (
                <span className="sound-row__rename">
                  <input
                    className="input"
                    aria-label={`'${row.name}' 새 이름`}
                    aria-invalid={draft.trim() === ''}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename(row.id);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        endRename(row.id);
                      }
                    }}
                  />
                  {draft.trim() === '' && (
                    <span className="field-error" role="alert">
                      <ActionIcon name="bang" />
                      이름을 비울 수 없어요. 이름을 입력해 주세요.
                    </span>
                  )}
                </span>
              ) : (
                <span className="sound-row__name">{row.name}</span>
              )}
              <Slider
                short
                label={`${row.name} 음량`}
                value={state.soundVolumes[row.id] ?? 100}
                onChange={(volume) => {
                  toasts.dismissUndo();
                  void send({ type: 'set-sound-volume', id: row.id, volume });
                }}
              />
              {(['start', 'end'] as const).map((kind) => {
                /** 이 줄이 그 자리(시작종 또는 끝종)로 골라져 있는지. */
                const chosen = (kind === 'start' ? state.startBell : state.endBell) === row.id;
                /** 화면 읽기와 안내 글에 쓰는 자리 이름. */
                const word = kind === 'start' ? '시작종' : '끝종';
                return (
                  <button
                    key={kind}
                    type="button"
                    className="pick"
                    title={`${row.name} ${word}으로 쓰기`}
                    aria-label={`${row.name} ${word}으로 쓰기`}
                    aria-pressed={chosen}
                    onClick={() => {
                      toasts.dismissUndo();
                      void send({ type: 'set-bell', kind, id: row.id });
                    }}
                  >
                    <ActionIcon name="ok" />
                  </button>
                );
              })}
              <span className="icon-buttons sound-row__actions">
                {row.registered && renaming && (
                  <button
                    type="button"
                    className="icon-button"
                    title={`'${row.name}' 이름 저장`}
                    aria-label={`'${row.name}' 이름 저장`}
                    disabled={draft.trim() === ''}
                    onClick={() => commitRename(row.id)}
                  >
                    <ActionIcon name="ok" />
                  </button>
                )}
                {row.registered && !renaming && (
                  <button
                    type="button"
                    className="icon-button"
                    data-rename-for={row.id}
                    title={`'${row.name}' 이름 바꾸기`}
                    aria-label={`'${row.name}' 이름 바꾸기`}
                    onClick={() => {
                      setRenamingId(row.id);
                      setDraft(row.name);
                    }}
                  >
                    <ActionIcon name="pen" />
                  </button>
                )}
                {row.registered && (
                  <button
                    type="button"
                    className="icon-button"
                    title={`'${row.name}' 지우기`}
                    aria-label={`'${row.name}' 지우기`}
                    onClick={() => remove(row)}
                  >
                    <ActionIcon name="bin" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
