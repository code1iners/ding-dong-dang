import { useEffect, useRef, useState } from 'react';
import type { Command, CommandResult } from '../../shared/bridge';
import type { Timetable } from '../../shared/data';
import { ActionIcon } from './icons';

/** 메인에 명령을 보낸다. 실패는 메인이 저장 실패 알림으로 알리므로 여기서는 기록만 한다. */
function send(command: Command): Promise<CommandResult> {
  return window.dingdong.command(command).catch((error: unknown) => {
    console.error(error);
    return { ok: false };
  });
}

/** 만들고 상세에 들어왔을 때 초점을 받는 요소. 요일 동그라미가 생기기 전까지는 상세의 첫 조작 요소인 ✎다. */
export const DETAIL_START_SELECTOR = '[data-detail-start]';
/** 위 줄의 "← 시간표 목록". 목록의 카드로 상세에 들어오면 이 단추에 초점을 둔다. */
export const DETAIL_BACK_SELECTOR = '.back-button';

/**
 * 왼쪽 카드 맨 위의 색 점 · 이름 · ✎. ✎를 누르면 그 자리에서 입력으로 바뀌고 ✓ · ×가 나온다.
 * ✓와 Enter는 바로 저장하고 빈 이름은 받지 않는다. ×와 Esc는 취소한다. 끝나면 초점이 ✎로 돌아온다.
 */
function TimetableName({ timetable }: { timetable: Timetable }) {
  /** 바꾸는 중인 이름. 바꾸는 중이 아니면 null이다. */
  const [draft, setDraft] = useState<string | null>(null);
  /** 이름 바꾸기를 막 끝냈는지. 다시 그려진 ✎로 초점을 돌려준다. */
  const ended = useRef(false);
  /** ✎ 단추. */
  const penRef = useRef<HTMLButtonElement>(null);

  useEffect(
    function returnFocusToPen() {
      if (draft !== null || !ended.current) return;
      penRef.current?.focus();
      ended.current = false;
    },
    [draft],
  );

  /** 입력을 접는다. */
  function end(): void {
    ended.current = true;
    setDraft(null);
  }

  /** 바꾼 이름을 저장한다. 비어 있으면 아무것도 하지 않는다(✓도 잠겨 있다). */
  function commit(): void {
    if (draft === null || draft.trim() === '') return;
    void send({ type: 'rename-timetable', id: timetable.id, name: draft });
    end();
  }

  /** 시간표 색 점. 이름 줄의 보조 단서다. */
  const dot = <i className="dot" aria-hidden="true" style={{ background: `var(--timetable-${timetable.color})` }} />;

  if (draft !== null) {
    /** 비어서 저장할 수 없는 이름인지. */
    const empty = draft.trim() === '';
    return (
      <div className="timetable-name timetable-name--editing">
        <div className="timetable-name__row">
          {dot}
          <input
            className="input timetable-name__input"
            aria-label={`'${timetable.name}' 새 이름`}
            aria-invalid={empty}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter는 ✓, Esc는 ×와 같다
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                end();
              }
            }}
          />
          <span className="icon-buttons">
            <button
              type="button"
              className="icon-button"
              title="이름 저장"
              aria-label="이름 저장"
              disabled={empty}
              onClick={commit}
            >
              <ActionIcon name="ok" />
            </button>
            <button type="button" className="icon-button" title="이름 바꾸기 취소" aria-label="이름 바꾸기 취소" onClick={end}>
              <ActionIcon name="x" />
            </button>
          </span>
        </div>
        {empty && (
          <p className="field-error" role="alert">
            <ActionIcon name="bang" />
            이름을 비울 수 없어요. 이름을 입력해 주세요.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="timetable-name">
      <div className="timetable-name__row">
        {dot}
        <h2 className="timetable-name__text" title={timetable.name}>
          {timetable.name}
        </h2>
        <span className="icon-buttons">
          <button
            ref={penRef}
            type="button"
            className="icon-button"
            title={`'${timetable.name}' 이름 바꾸기`}
            aria-label={`'${timetable.name}' 이름 바꾸기`}
            data-detail-start
            onClick={() => setDraft(timetable.name)}
          >
            <ActionIcon name="pen" />
          </button>
        </span>
      </div>
    </div>
  );
}

type Props = {
  timetable: Timetable;
  /** "← 시간표 목록"을 눌렀을 때. */
  onBack(): void;
};

/**
 * 시간표 화면의 상세. 카드 밖 위 줄의 "← 시간표 목록"과, 아래 왼쪽 카드(이름 · 시간대 · 요일 · 시계판)로 된다.
 * 시간대 · 요일 · 시계판과 오른쪽 수업 시간 카드는 05 티켓이 채운다.
 */
export function TimetableDetail({ timetable, onBack }: Props) {
  return (
    <div className="timetable-detail">
      <div className="timetable-detail__bar">
        <button type="button" className="back-button" onClick={onBack}>
          <ActionIcon name="left" />
          시간표 목록
        </button>
      </div>
      <div className="timetable-detail__cols">
        <section className="card card--dial" aria-label={`'${timetable.name}' 이름과 요일`}>
          <TimetableName key={timetable.id} timetable={timetable} />
        </section>
      </div>
    </div>
  );
}
