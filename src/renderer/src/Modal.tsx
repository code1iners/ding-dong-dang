import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** 모달 제목. 확인 모달은 행동과 대상을 말한다(DESIGN.md "글"). */
  title: string;
  /** 제목 줄 오른쪽 끝에 놓을 것. 이름 받는 창의 × 닫기가 들어간다. 제목 밖에 놓아 모달 이름에 섞이지 않는다. */
  titleAction?: ReactNode;
  /** 모달 폭. 기본 380, 단추가 셋이면 440(DESIGN.md "모달"). */
  width?: number;
  /** 제목 위에 놓는 그림. 처음 닫을 때 안내의 강아지가 들어간다. */
  illustration?: ReactNode;
  /** 목록이 든 모달의 모양. 안쪽 여백이 좁고 내용이 왼쪽 정렬이다. */
  sheet?: boolean;
  /** 입력 칸이 든 모달의 모양. 내용이 왼쪽 정렬이고 칸이 폭을 다 쓴다. */
  form?: boolean;
  /** Esc로 닫을 때 부른다. 아무것도 하지 않고 닫는 동작이어야 한다. */
  onClose(): void;
  children: ReactNode;
};

/** 열려 있는 모달의 뒷판. 맨 뒤가 가장 위에 뜬 모달이다. */
const open: HTMLElement[] = [];

/** 키보드 초점이 갈 수 있는 요소를 고르는 선택자. */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** 알림 영역의 단추. 모달이 떠 있어도 "되돌리기"와 닫기에 키보드로 닿아야 한다. */
const TOAST_BUTTONS = '.toasts button';

/**
 * DESIGN.md의 모달. 화면 가운데에 뜨고 뒤를 덮는다.
 * 뜨면 초점이 안으로 들어와 Tab이 모달 안(과 알림)에서만 돌고, Esc로 닫으며, 닫히면 초점이 있던 곳으로 돌아간다.
 * 처음 초점은 `data-autofocus`를 단 요소에 간다. 되돌릴 수 없는 일의 확인에서는 "취소"에 단다.
 * 모달 위에 모달이 뜨면 아래 것은 비활성(inert)이 된다.
 */
export function Modal({ title, titleAction, illustration, width = 380, sheet = false, form = false, onClose, children }: Props) {
  /** 제목 요소의 id. 모달의 이름으로 쓴다. */
  const titleId = useId();
  /** 뒷판 요소. */
  const backdropRef = useRef<HTMLDivElement>(null);
  /** 가장 최근의 onClose. 매번 다시 듣지 않도록 ref로 쥔다. */
  const closeRef = useRef(onClose);
  // 렌더 중이 아니라 효과에서 최신 onClose를 담아 둔다
  useEffect(function keepLatestOnClose() {
    closeRef.current = onClose;
  });

  useEffect(function trapFocusAndEscape() {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    /** 모달이 뜨기 전에 초점이 있던 요소. */
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /** 앱 화면의 뿌리. 모달이 떠 있는 동안 비활성이다. */
    const root = document.getElementById('root');

    open.at(-1)?.setAttribute('inert', '');
    open.push(backdrop);
    root?.setAttribute('inert', '');

    (backdrop.querySelector<HTMLElement>('[data-autofocus]') ?? backdrop.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      // 맨 위 모달만 키를 받는다
      if (open.at(-1) !== backdrop || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      /** Tab으로 돌 수 있는 요소: 모달 안과 알림의 단추. */
      const stops = [
        ...backdrop.querySelectorAll<HTMLElement>(FOCUSABLE),
        ...document.querySelectorAll<HTMLElement>(TOAST_BUTTONS),
      ];
      const first = stops[0];
      const last = stops.at(-1);
      if (!first || !last) return;
      const index = stops.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (index === -1 || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      open.splice(open.indexOf(backdrop), 1);
      open.at(-1)?.removeAttribute('inert');
      if (open.length === 0) root?.removeAttribute('inert');
      // 초점이 있던 곳이 아직 화면에 있으면 돌려준다
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  /** 모달 제목. 모달의 이름이 된다. */
  const heading = (
    <h2 id={titleId} className="modal__title">
      {title}
    </h2>
  );

  return createPortal(
    <div className="modal-backdrop" ref={backdropRef}>
      <div
        className={`modal${sheet ? ' modal--sheet' : ''}${form ? ' modal--form' : ''}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {illustration}
        {titleAction ? (
          <div className="modal__head">
            {heading}
            {titleAction}
          </div>
        ) : (
          heading
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
