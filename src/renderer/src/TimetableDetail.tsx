import { useEffect, useRef, useState } from 'react';
import type { Period, Timetable, Weekday } from '../../shared/data';
import { nextPeriod, periodRanks, sortByStart } from '../../shared/period-edit';
import { addSlot, daysShownFor, hasUnassignedDay, removeSlot, sameSlots, toggleDay, toSavedSlots } from '../../shared/slot-edit';
import { validateSlots, type SlotError } from '../../shared/timetable-validation';
import { sendCommand } from './command';
import { Dial } from './Dial';
import { ActionIcon } from './icons';
import { Modal } from './Modal';
import { TimeField } from './TimeField';
import type { ToastApi } from './Toasts';
import { daysSummary, WEEKDAY_SHORT, weekdayName } from './weekdays';

/** 만들고 상세에 들어왔을 때 초점을 받는 요소. 고른 시간대의 첫 요일 동그라미이고, 보일 요일이 없으면 ✎다. */
export const DETAIL_START_SELECTOR = '[data-detail-start]';
/** 위 줄의 "← 시간표 목록". 목록의 카드로 상세에 들어오면 이 단추에 초점을 둔다. */
export const DETAIL_BACK_SELECTOR = '.back-button';
/** 위 줄의 "쓰는 중" 표시. "이 시간표 쓰기"를 누르면 이 표시로 초점을 옮긴다. */
const ACTIVE_BADGE_SELECTOR = '[data-active-badge]';
/** 위 줄의 "시간표 지우기". 하나뿐인 시간표에서 "이 시간표 쓰기"를 누르면 표시가 없어 이 단추로 초점을 옮긴다. */
const DELETE_BUTTON_SELECTOR = '[data-delete-timetable]';

/**
 * 왼쪽 카드 맨 위의 색 점 · 이름 · ✎. ✎를 누르면 그 자리에서 입력으로 바뀌고 ✓ · ×가 나온다.
 * ✓와 Enter는 바로 저장하고 빈 이름은 받지 않는다. ×와 Esc는 취소한다. 끝나면 초점이 ✎로 돌아온다.
 */
function TimetableName({ timetable, start }: { timetable: Timetable; start: boolean }) {
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
    void sendCommand({ type: 'rename-timetable', id: timetable.id, name: draft });
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
            data-detail-start={start || undefined}
            onClick={() => setDraft(timetable.name)}
          >
            <ActionIcon name="pen" />
          </button>
        </span>
      </div>
    </div>
  );
}

/** "🔔 쓰는 중" 표시. 시간표가 둘 이상일 때만 쓰는 시간표의 카드와 상세 위 줄에 단다. */
export function ActiveBadge({ focusTarget = false }: { focusTarget?: boolean }) {
  // 상세에서 "이 시간표 쓰기"를 누르면 단추가 이 표시로 바뀌므로, 초점을 받아 둘 수 있게 한다(Tab 순서에는 들지 않는다)
  return (
    <span className="badge" tabIndex={focusTarget ? -1 : undefined} data-active-badge={focusTarget || undefined}>
      <ActionIcon name="bell" />
      쓰는 중
    </span>
  );
}

/**
 * 저장하지 않고 떠나려는 길을 막는 손잡이. 바꾼 것이 없으면 바로 `proceed`를 부르고,
 * 초안이 있으면 확인 창으로 묻고 사용자가 허락한 뒤에 부른다.
 */
export type LeaveGuard = (proceed: () => void) => void;

/** 편집 중인 수업 시간 한 줄. `key`는 줄을 구별하는 값이라 시각을 고치거나 줄이 정렬돼도 그대로다. */
type Row = Period & { key: number };

/** 초안의 시간대 하나. */
type DraftSlot = { days: readonly Weekday[]; periods: readonly Row[] };

/** 저장된 시간대를 초안 모양으로. 줄의 key는 시간대 안의 순번이다. */
function toDraft(slots: Timetable['slots']): DraftSlot[] {
  return slots.map((slot) => ({ days: slot.days, periods: slot.periods.map((p, key) => ({ key, start: p.start, end: p.end })) }));
}

/** 새로 더하는 줄의 key가 시작하는 값. 저장된 줄의 순번과 겹치지 않게 크게 잡는다. */
const FIRST_NEW_KEY = 1000;

/** 한 오류를 시간대와 교시로 밝힌 글. 시간대가 둘 이상이면 어느 시간대인지 앞에 붙인다. */
function errorText(slots: readonly DraftSlot[], error: SlotError): string {
  /** 오류가 든 시간대. */
  const slot = slots[error.slot]!;
  /** 오류가 든 줄의 교시 번호. */
  const rank = periodRanks(slot.periods)[error.index];
  /** 어느 교시인지 밝히는 앞말. */
  const where = slots.length > 1 ? `${daysSummary(slot.days)} ${rank}교시` : `${rank}교시`;
  return `${where}: ${error.message}`;
}

type Props = {
  timetable: Timetable;
  /** 이 시간표가 쓰는 시간표인지. */
  isActive: boolean;
  /**
   * 쓰는 시간표 동작("쓰는 중" 표시나 "이 시간표 쓰기")을 보여 줄지. 시간표가 둘 이상일 때와,
   * 하나뿐인데 쓰는 시간표가 없을 때(쓰는 시간표를 지워 하나만 남았을 때)다.
   */
  showActive: boolean;
  /** 하나뿐인 시간표인지. 지우면 종이 멈춘다고 알린다. */
  isOnly: boolean;
  /** 시계판 가운데 강아지의 테마 id. */
  dogTheme: string;
  /** "저장했어요" 알림을 띄우고, 고치기 시작하면 종소리 되돌리기 알림을 거둔다. */
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
  /** "← 시간표 목록"으로 떠날 때. 초안이 있으면 확인 창을 거친 뒤에 부른다. */
  onBack(): void;
  /** 다른 화면으로 가거나 창을 닫기 전에 묻는 손잡이를 앱에 등록하고, 상세가 사라지면 null로 거둔다. */
  registerGuard(guard: LeaveGuard | null): void;
  /** 초안이 생기거나 사라질 때 앱에 알린다. */
  onDirtyChange(dirty: boolean): void;
  /** 시간표를 지운 뒤. 초안은 묻지 않고 버린다. 받은 이름으로 알리고 목록으로 돌아간다. */
  onDeleted(name: string): void;
};

/**
 * 시간표 화면의 상세. 카드 밖 위 줄의 "← 시간표 목록"과 아래 두 카드로 된다.
 * 왼쪽 카드는 이름, 시간대 탭, 고른 시간대의 요일 동그라미, 시계판이고, 오른쪽 카드는 고른 시간대의 수업 시간과 "되돌리기" · "저장"이다.
 * 요일 켜고 끄기, 시간대 더하기 · 지우기, 수업 시간 고치기는 초안에 쌓였다가 "저장" 한 번으로 시간대 저장에 반영된다.
 */
export function TimetableDetail({
  timetable,
  isActive,
  showActive,
  isOnly,
  dogTheme,
  toasts,
  onBack,
  registerGuard,
  onDirtyChange,
  onDeleted,
}: Props) {
  /** 저장하지 않은 시간대 목록. 바꾼 것이 없으면 null이다. */
  const [draft, setDraft] = useState<readonly DraftSlot[] | null>(null);
  /** 고른 시간대의 번호. 시간대가 줄면 마지막 시간대로 당겨 쓴다. */
  const [slotIndex, setSlotIndex] = useState(0);
  /** 떠나려다 멈춘 길. "저장"이나 "저장 안 함" 뒤에 이어 간다. */
  const [pendingLeave, setPendingLeave] = useState<{ proceed: () => void } | null>(null);
  /** 저장하는 중인지. 두 번 누르지 않게 한다. */
  const [saving, setSaving] = useState(false);
  /** 지우기 확인 창이 떠 있는지. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** 지우는 중인지. 두 번 누르지 않게 한다. */
  const [deleting, setDeleting] = useState(false);
  /** 쓰는 시간표로 정하는 중인지. 두 번 눌러 알림이 겹치지 않게 한다. */
  const [activating, setActivating] = useState(false);
  /** 새로 더한 줄의 key. 그 줄이 그려지면 시작 시각 칸으로 초점을 보내고 비운다. */
  const focusKey = useRef<number | null>(null);
  /** 시간대를 더하거나 지운 뒤 초점을 둘 요소의 선택자. 그려지면 초점을 주고 비운다. */
  const focusAfter = useRef<string | null>(null);
  /** 다음에 더할 줄의 key. */
  const nextKey = useRef(FIRST_NEW_KEY);

  /** 화면에 보이는 시간대: 초안이 있으면 초안, 없으면 저장된 값. */
  const slots: readonly DraftSlot[] = draft ?? toDraft(timetable.slots);
  /** 고른 시간대의 번호. */
  const index = Math.min(slotIndex, slots.length - 1);
  /** 고른 시간대. */
  const slot = slots[index]!;
  /** 고른 시간대의 줄. */
  const rows = slot.periods;
  /** 줄마다의 교시 번호. */
  const ranks = periodRanks(rows);
  /** 모든 시간대의 잘못된 줄. 하나라도 있으면 "저장"이 잠긴다. */
  const errors = validateSlots(slots);
  /** 고른 시간대에서 줄 번호(0부터)로 찾는 그 줄의 첫 오류. 같은 줄에서는 규칙 순서라 첫 것을 쓴다. */
  const errorOf = new Map<number, string>();
  for (const e of errors) if (e.slot === index && !errorOf.has(e.index)) errorOf.set(e.index, e.message);
  /** 잘못된 시각이 든 시간대 번호. 탭에 느낌표를 단다. */
  const badSlots = new Set(errors.map((e) => e.slot));
  /** 잘못된 시각이 고른 시간대에는 없고 다른 시간대에만 있으면 그 첫 시간대 번호. */
  const hiddenBadSlot = badSlots.has(index) ? undefined : errors[0]?.slot;
  /** 고른 시간대의 요일 줄에 보일 요일. */
  const shownDays = daysShownFor(slots, index);
  /** 고른 시간대의 이름. 탭과 오른쪽 카드 제목에 쓴다. */
  const slotName = daysSummary(slot.days);

  /** 시간대 목록을 바꿔 초안에 쌓는다. 바꾼 결과가 저장된 값과 같아지면 초안을 비운다. */
  function edit(change: (all: readonly DraftSlot[]) => readonly DraftSlot[]): void {
    /** 바꾼 뒤의 시간대 목록. */
    const next = change(slots);
    // 받지 않는 조작이라 그대로면 아무것도 하지 않는다
    if (next === slots) return;
    toasts.dismissUndo();
    setDraft(sameSlots(next, timetable.slots) ? null : next);
  }

  /** 고른 시간대의 줄들을 바꾼다. */
  function editRows(change: (all: readonly Row[]) => readonly Row[]): void {
    edit((all) => all.map((s, i) => (i === index ? { ...s, periods: change(s.periods) } : s)));
  }

  /** 줄 하나의 시각을 바꾼다. */
  function setTime(key: number, patch: Partial<Period>): void {
    editRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** 수업 시간 한 줄을 더하고 그 줄의 시작 시각 칸으로 초점을 보낸다. */
  function addRow(): void {
    /** 새 줄의 key. */
    const key = nextKey.current++;
    editRows((all) => [...all, { key, ...nextPeriod(all) }]);
    focusKey.current = key;
  }

  /** 요일 없는 시간대를 더해 고르고, 그 시간대의 첫 요일 동그라미로 초점을 보낸다. */
  function addSlotAndSelect(): void {
    edit(addSlot);
    setSlotIndex(slots.length);
    focusAfter.current = '.slot-day';
  }

  /** 고른 시간대를 지우고 앞 시간대를 고른다. 초점은 고른 탭으로 간다. */
  function removeSelectedSlot(): void {
    edit((all) => removeSlot(all, index));
    setSlotIndex(Math.max(0, index - 1));
    focusAfter.current = '.slot-tab[aria-pressed="true"]';
  }

  /** 초안을 버린다. */
  function revert(): void {
    setDraft(null);
    setSlotIndex((i) => Math.min(i, timetable.slots.length - 1));
  }

  /** 초안을 저장한다. 저장했으면 true. 실패하면 초안을 그대로 두고, 실패 알림은 앱이 띄운다. */
  async function save(): Promise<boolean> {
    if (draft === null || errors.length > 0 || saving) return false;
    setSaving(true);
    try {
      /** 메인의 저장 결과. */
      const result = await sendCommand({ type: 'set-slots', id: timetable.id, slots: toSavedSlots(draft) });
      if (!result.ok) return false;
      setDraft(null);
      toasts.notify({ key: 'slots-saved', kind: 'success', text: '저장했어요' });
      return true;
    } finally {
      setSaving(false);
    }
  }

  // 새로 더한 줄이 그려지면 그 줄의 시작 시각 칸으로, 시간대를 더하거나 지웠거나 쓰는 시간표가 됐으면 정한 요소로 초점을 보낸다
  useEffect(
    function focusAfterEdit() {
      if (focusKey.current !== null) {
        document.querySelector<HTMLInputElement>(`[data-row-key="${focusKey.current}"] input`)?.focus();
        focusKey.current = null;
      }
      if (focusAfter.current !== null) {
        /** 초점을 받을 요소. "쓰는 중" 표시는 메인의 새 상태가 와야 그려지므로, 없으면 다음 그리기에서 다시 찾는다. */
        const target = document.querySelector<HTMLElement>(focusAfter.current);
        if (target) {
          target.focus();
          focusAfter.current = null;
        }
      }
    },
    [draft, slotIndex, isActive],
  );

  /**
   * 이 시간표를 쓰는 시간표로 바로 저장한다. 초안은 건드리지 않고 그대로 남는다.
   * 단추가 "쓰는 중" 표시로 바뀌므로 초점을 그 표시로 옮긴다. 하나뿐인 시간표는 표시도 숨으므로 그다음 자리의 "시간표 지우기"로 옮긴다.
   */
  async function activate(): Promise<void> {
    if (activating) return;
    setActivating(true);
    // 새 상태가 명령의 답보다 먼저 올 수 있어 보내기 전에 정해 둔다
    focusAfter.current = isOnly ? DELETE_BUTTON_SELECTOR : ACTIVE_BADGE_SELECTOR;
    /** 메인의 저장 결과. */
    const result = await sendCommand({ type: 'set-active-timetable', id: timetable.id });
    setActivating(false);
    if (!result.ok) {
      focusAfter.current = null;
      return;
    }
    toasts.notify({ key: 'timetable-activated', kind: 'success', text: `이제 '${timetable.name}' 시간표로 종이 울려요` });
  }

  /** 확인 창의 "시간표 지우기": 바로 지우고 목록으로 돌아간다. 초안은 시간표와 함께 버린다. 실패하면 창만 닫고 남는다. */
  async function confirmDelete(): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    /** 메인의 저장 결과. */
    const result = await sendCommand({ type: 'delete-timetable', id: timetable.id });
    setDeleting(false);
    setConfirmingDelete(false);
    if (result.ok) onDeleted(timetable.name);
  }

  /** 떠나기 전에 묻는다. 바꾼 것이 없으면 바로 간다. */
  const requestLeave: LeaveGuard = (proceed) => {
    if (draft !== null) setPendingLeave({ proceed });
    else proceed();
  };
  /** 가장 최근의 requestLeave. 앱에는 바뀌지 않는 함수만 등록한다. */
  const leaveRef = useRef(requestLeave);
  useEffect(function keepLatestGuard() {
    leaveRef.current = requestLeave;
  });
  useEffect(
    function registerLeaveGuard() {
      registerGuard((proceed) => leaveRef.current(proceed));
      return () => registerGuard(null);
    },
    [registerGuard],
  );

  /** 저장하지 않은 초안이 있는지. */
  const dirty = draft !== null;
  /** "저장"을 누를 수 있는지. 바꾼 것이 있고 잘못된 시각이 없어야 한다. */
  const canSave = dirty && errors.length === 0 && !saving;
  // 초안이 있는지 앱(과 메인의 창 닫기)에 알리고, 상세가 사라지면 거둔다
  useEffect(
    function reportDirty() {
      onDirtyChange(dirty);
    },
    [dirty, onDirtyChange],
  );
  useEffect(
    function clearDirtyOnLeave() {
      return () => onDirtyChange(false);
    },
    [onDirtyChange],
  );

  /** 확인 창의 "저장": 저장하고 가려던 길로 간다. 저장하지 못하면 창만 닫고 편집을 이어 간다. */
  async function saveAndLeave(): Promise<void> {
    /** 멈춰 둔 길. */
    const leave = pendingLeave;
    setPendingLeave(null);
    if (leave && (await save())) leave.proceed();
  }

  /** 확인 창의 "저장 안 함": 초안을 버리고 가려던 길로 간다. */
  function discardAndLeave(): void {
    /** 멈춰 둔 길. */
    const leave = pendingLeave;
    setPendingLeave(null);
    setDraft(null);
    leave?.proceed();
  }

  /** 줄을 벗어난 초점이 목록 밖으로 나가면 줄을 시작 시각 순으로 정렬한다. 고치는 도중에는 줄이 움직이지 않는다. */
  function sortOnLeave(event: React.FocusEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    // 같은 blur에서 시각 칸이 막 확정한 값 위에 정렬해야 하므로 그린 때의 초안이 아니라 최신 초안을 받는다.
    // 정렬은 저장될 값을 바꾸지 않으므로 edit을 거치지 않는다
    setDraft((latest) => latest && latest.map((s, i) => (i === index ? { ...s, periods: sortByStart(s.periods) } : s)));
  }

  return (
    <div className="timetable-detail">
      <div className="timetable-detail__bar">
        <button type="button" className="back-button" onClick={() => requestLeave(onBack)}>
          <ActionIcon name="left" />
          시간표 목록
        </button>
        <div className="timetable-detail__actions">
          {showActive &&
            (isActive ? (
              <ActiveBadge focusTarget />
            ) : (
              <button type="button" className="button button--ghost button--sm" onClick={() => void activate()}>
                <ActionIcon name="bell" />이 시간표 쓰기
              </button>
            ))}
          <button
            type="button"
            className="button button--ghost button--sm button--red-text"
            data-delete-timetable
            aria-label={`'${timetable.name}' 시간표 지우기`}
            onClick={() => setConfirmingDelete(true)}
          >
            <ActionIcon name="bin" />
            시간표 지우기
          </button>
        </div>
      </div>
      <div className="timetable-detail__cols">
        <section className="card card--dial timetable-left" aria-label={`'${timetable.name}' 이름과 요일`}>
          <TimetableName key={timetable.id} timetable={timetable} start={shownDays.length === 0} />
          <div className="slot-tabs" role="group" aria-label="시간대">
            {slots.map((s, i) => (
              <button
                key={i}
                type="button"
                className="slot-tab"
                aria-pressed={i === index}
                onClick={() => setSlotIndex(i)}
              >
                {daysSummary(s.days)}
                {badSlots.has(i) && (
                  <span className="slot-tab__bad">
                    <ActionIcon name="bang" />
                    <span className="sr-only">(잘못된 시각이 있어요)</span>
                  </span>
                )}
              </button>
            ))}
            {hasUnassignedDay(slots) && (
              <button type="button" className="slot-tab slot-tab--add" onClick={addSlotAndSelect}>
                <ActionIcon name="plus" />
                다른 시간대
              </button>
            )}
          </div>
          <div className="slot-days-row">
            <div className="slot-days" role="group" aria-label="이 시간대를 쓰는 요일">
              {shownDays.map((d, i) => {
                /** 이 시간대가 쓰는 요일인지. */
                const on = slot.days.includes(d);
                // 체크 표시는 단추 밖으로 튀어나오므로 단추 곁에 겹쳐 그린다. 상태는 aria-pressed가 알린다
                return (
                  <span key={d} className="slot-day-wrap">
                    <button
                      type="button"
                      className={`slot-day${on ? ' slot-day--on' : ''}`}
                      style={on ? { background: `var(--timetable-${timetable.color})` } : undefined}
                      title={weekdayName(d)}
                      aria-label={weekdayName(d)}
                      aria-pressed={on}
                      data-detail-start={i === 0 || undefined}
                      onClick={() => edit((all) => toggleDay(all, index, d))}
                    >
                      {WEEKDAY_SHORT[d]}
                    </button>
                    {on && (
                      <span className="slot-day__check" aria-hidden="true">
                        <ActionIcon name="ok" />
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            {slots.length > 1 && (
              <button type="button" className="text-button text-button--red" onClick={removeSelectedSlot}>
                이 시간대 지우기
              </button>
            )}
          </div>
          <Dial periods={rows} color={timetable.color} dogTheme={dogTheme} />
        </section>

        <section className="card card--periods" aria-label={`${slotName} 수업 시간`}>
          <h3 className="periods-head">{slotName} 수업 시간</h3>
          <div className="period-list" onBlur={sortOnLeave}>
            {rows.length === 0 && <p className="period-empty">아직 수업 시간이 없어요</p>}
            {rows.map((row, i) => {
              /** 이 줄의 교시 번호. */
              const rank = ranks[i]!;
              /** 이 줄의 첫 오류. */
              const error = errorOf.get(i);
              return (
                <div key={row.key} className="period-item" data-row-key={row.key}>
                  <div className={`period-row${error ? ' period-row--bad' : ''}`}>
                    <span className="period-row__num">{rank}</span>
                    <TimeField label={`${rank}교시 시작 시각`} value={row.start} onCommit={(start) => setTime(row.key, { start })} />
                    <span aria-hidden="true">~</span>
                    <TimeField label={`${rank}교시 끝 시각`} value={row.end} onCommit={(end) => setTime(row.key, { end })} />
                    <button
                      type="button"
                      className="icon-button period-row__remove"
                      title={`${rank}교시 지우기`}
                      aria-label={`${rank}교시 지우기`}
                      onClick={() => editRows((all) => all.filter((r) => r.key !== row.key))}
                    >
                      <ActionIcon name="x" />
                    </button>
                  </div>
                  {error && (
                    <p className="field-error" role="alert">
                      <ActionIcon name="bang" />
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="button button--ghost button--sm period-add" onClick={addRow}>
            <ActionIcon name="plus" />
            수업 시간
          </button>
          {/* 고른 시간대 밖의 잘못된 시각은 줄이 보이지 않으므로 잠근 이유를 단추 곁에 글로 쓴다 */}
          {hiddenBadSlot !== undefined && (
            <p className="field-error" role="alert">
              <ActionIcon name="bang" />
              {daysSummary(slots[hiddenBadSlot]!.days)} 시간대에 잘못된 시각이 있어요. 고친 뒤 저장해 주세요.
            </p>
          )}
          {/* 바꾼 것이 없어도 늘 같은 자리에 두고 잠근다. 잘못된 시각이 있으면 "저장"만 잠근다.
              disabled 대신 aria-disabled로 잠가, 누른 뒤 꺼져도 키보드 초점이 그 자리에 남게 한다 */}
          <div className="period-foot">
            <button type="button" className="button button--ghost" aria-disabled={!dirty} onClick={() => dirty && revert()}>
              되돌리기
            </button>
            <button type="button" className="button" aria-disabled={!canSave} onClick={() => canSave && void save()}>
              저장
            </button>
          </div>
        </section>
      </div>

      {confirmingDelete && (
        <Modal title={`'${timetable.name}' 시간표를 지울까요?`} onClose={() => setConfirmingDelete(false)}>
          <p>
            {isActive || isOnly
              ? '지금 종이 울리는 시간표예요. 지우면 다른 시간표를 쓰기 전까지 종이 울리지 않아요.'
              : '지운 시간표는 되돌릴 수 없어요.'}
          </p>
          <div className="modal__actions">
            {/* 되돌릴 수 없는 일이라 처음 초점은 "취소"다 */}
            <button type="button" className="button button--ghost" data-autofocus onClick={() => setConfirmingDelete(false)}>
              취소
            </button>
            <button type="button" className="button button--red" disabled={deleting} onClick={() => void confirmDelete()}>
              시간표 지우기
            </button>
          </div>
        </Modal>
      )}

      {pendingLeave && (
        <Modal title="바꾼 내용을 저장할까요?" width={440} onClose={() => setPendingLeave(null)}>
          <p>'{timetable.name}' 시간표의 요일이나 수업 시간을 바꿨어요.</p>
          {errors[0] && (
            <p className="field-error field-error--center" role="alert">
              <ActionIcon name="bang" />
              {errorText(slots, errors[0])}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setPendingLeave(null)}>
              계속 편집
            </button>
            <button type="button" className="button button--ghost" onClick={discardAndLeave}>
              저장 안 함
            </button>
            {/* 오류가 없으면 저장에 처음 초점을 둔다. 오류가 있어 잠기면 맨 앞의 "계속 편집"으로 간다 */}
            <button
              type="button"
              className="button"
              data-autofocus={errors.length === 0 ? '' : undefined}
              disabled={errors.length > 0 || saving}
              onClick={() => void saveAndLeave()}
            >
              저장
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
