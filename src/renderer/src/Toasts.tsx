import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionIcon } from './icons';

/** 알림 하나. */
export type Toast = {
  /** 같은 키의 알림이 다시 오면 쌓지 않고 바꿔 끼운다. */
  key: string;
  /** success는 초록 원에 체크이고 4초 뒤 사라진다. failure는 빨강 원에 느낌표이고, undo는 체크이고, 둘 다 ×로 닫을 때까지 남는다. */
  kind: 'success' | 'failure' | 'undo';
  /** 알림 문장. */
  text: string;
  /** "되돌리기" 같은 단추. 누르면 알림은 닫힌다. */
  action?: { label: string; run(): void };
};

/** 성공 알림이 사라지기까지의 시간(DESIGN.md "알림"). */
export const SUCCESS_TOAST_MS = 4000;

/** 알림을 띄우고 닫는 손잡이. */
export type ToastApi = {
  /** 지금 떠 있는 알림. 위에서부터 오래된 순서다. */
  toasts: Toast[];
  /** 알림을 띄운다. */
  notify(toast: Toast): void;
  /** 키가 같은 알림을 닫는다. */
  dismiss(key: string): void;
  /** "되돌리기" 알림을 모두 닫는다. 다른 일을 하면 되돌릴 수 있는 기간이 끝난다(DESIGN.md "알림"). */
  dismissUndo(): void;
};

/** 알림 목록과, 성공 알림의 4초 타이머를 관리한다. */
export function useToasts(): ToastApi {
  /** 떠 있는 알림. */
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** 성공 알림의 사라짐 타이머. 키별로 하나다. */
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((key: string) => {
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    setToasts((all) => all.filter((t) => t.key !== key));
  }, []);

  const notify = useCallback(
    (toast: Toast) => {
      window.clearTimeout(timers.current.get(toast.key));
      timers.current.delete(toast.key);
      setToasts((all) => [...all.filter((t) => t.key !== toast.key), toast]);
      if (toast.kind === 'success') {
        timers.current.set(toast.key, window.setTimeout(() => dismiss(toast.key), SUCCESS_TOAST_MS));
      }
    },
    [dismiss],
  );

  const dismissUndo = useCallback(() => setToasts((all) => all.filter((t) => t.kind !== 'undo')), []);

  // 창이 사라질 때 남은 타이머를 거둔다
  useEffect(function clearTimersOnUnmount() {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  return { toasts, notify, dismiss, dismissUndo };
}

/** 창 위쪽 가운데에 알림을 쌓아 보여 준다. 모달 위에 뜨므로 화면 뿌리 밖(body)에 그린다. */
export function ToastStack({ toasts, dismiss }: Pick<ToastApi, 'toasts' | 'dismiss'>) {
  return createPortal(
    <div className="toasts">
      {toasts.map(({ key, kind, text, action }) => (
        <div key={key} className="toast" role={kind === 'failure' ? 'alert' : 'status'}>
          <span className={`toast__mark${kind === 'failure' ? ' toast__mark--bad' : ''}`}>
            <ActionIcon name={kind === 'failure' ? 'bang' : 'ok'} />
          </span>
          <span className="toast__text">{text}</span>
          {action && (
            <button
              type="button"
              className="button button--ghost button--sm"
              onClick={() => {
                dismiss(key);
                action.run();
              }}
            >
              {action.label}
            </button>
          )}
          {kind !== 'success' && (
            <button
              type="button"
              className="toast__close"
              title="알림 닫기"
              aria-label="알림 닫기"
              onClick={() => dismiss(key)}
            >
              <ActionIcon name="x" />
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
