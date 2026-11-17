import { useEffect, useRef, useState } from 'react';
import { WEEKDAYS, type Timetable, type Weekday } from '../../shared/data';
import { nextPeriod, periodRanks, sortByStart } from '../../shared/period-edit';
import { validatePeriods, type Period } from '../../shared/timetable-validation';
import type { ToastApi } from './Toasts';
import { Dial } from './Dial';
import { ActionIcon } from './icons';
import { Modal } from './Modal';
import { TimeField } from './TimeField';
import { TimetablePicker } from './TimetablePicker';
import { todayWeekday, WEEKDAY_SHORT, weekdayName } from './weekdays';

/**
 * 저장하지 않고 떠나려는 길을 막는 손잡이. 깨끗하면 바로 `proceed`를 부르고,
 * 저장하지 않은 편집이 있으면 모달로 묻고 사용자가 허락한 뒤에 부른다.
 */
export type LeaveGuard = (proceed: () => void) => void;

type Props = {
  timetables: Timetable[];
  weekdays: Record<Weekday, string | null>;
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
  /** 화면을 떠나기 전에 묻는 손잡이를 앱에 등록하고, 화면이 사라지면 null로 거둔다. */
  registerGuard(guard: LeaveGuard | null): void;
  /** 저장하지 않은 편집이 생기거나 사라질 때 앱에 알린다. */
  onDirtyChange(dirty: boolean): void;
  /** 시계판 가운데 강아지의 테마 id. */
  dogTheme: string;
};

/** 편집 중인 수업 시간 한 줄. `key`는 줄을 구별하는 값이라 시각을 고치거나 줄이 정렬돼도 그대로다. */
type Row = Period & { key: number };

/** 저장하지 않은 편집. 어느 시간표를 고치는지와 고치는 중인 줄이다. */
type Draft = { id: string; rows: Row[] };

/** 저장된 수업 시간을 편집 줄로. 줄의 key는 순번이다. */
function toRows(periods: readonly Period[]): Row[] {
  return periods.map((p, key) => ({ key, start: p.start, end: p.end }));
}

/** 새로 더하는 줄의 key가 시작하는 값. 저장된 줄의 순번과 겹치지 않게 크게 잡는다. */
const FIRST_NEW_KEY = 1000;

/**
 * 시간표 화면. 왼쪽 카드에 시간표 선택 입력기, 요일 동그라미 일곱 개, 12시간 시계판이 있고
 * 오른쪽 카드에서 교시별 시작 · 끝 시각을 더하고 고치고 지운다. 고친 내용은 "저장"을 눌러야 저장된다.
 */
export function TimetableScreen({ timetables, weekdays, toasts, registerGuard, onDirtyChange, dogTheme }: Props) {
  /** 고른 요일. 화면을 열면 오늘이다. */
  const [day, setDay] = useState<Weekday>(todayWeekday);
  /** 시간표 선택 창이 열려 있는지. */
  const [picking, setPicking] = useState(false);
  /** 저장하지 않은 편집. 없으면 null. */
  const [draft, setDraft] = useState<Draft | null>(null);
  /** 떠나려다 멈춘 길. "저장"이나 "저장 안 함" 뒤에 이어 간다. */
  const [pendingLeave, setPendingLeave] = useState<{ proceed: () => void } | null>(null);
  /** 저장하는 중인지. 두 번 누르지 않게 한다. */
  const [saving, setSaving] = useState(false);
  /** 새로 더한 줄의 key. 그 줄이 그려지면 시작 시각 칸으로 초점을 보내고 비운다. */
  const focusKey = useRef<number | null>(null);
  /** 다음에 더할 줄의 key. */
  const nextKey = useRef(FIRST_NEW_KEY);

  /** 요일에 배정된 시간표. 배정이 없으면 undefined. */
  const timetableOf = (d: Weekday): Timetable | undefined => timetables.find((t) => t.id === weekdays[d]);
  /** 고른 요일의 시간표. */
  const selected = timetableOf(day);
  /** 고른 시간표를 고치는 중인지. */
  const editing = draft !== null && draft.id === selected?.id;
  /** 화면에 보이는 줄: 편집 중이면 고치는 중인 줄, 아니면 저장된 수업 시간. */
  const rows: Row[] = editing ? draft.rows : toRows(selected?.periods ?? []);
  /** 줄마다의 교시 번호. */
  const ranks = periodRanks(rows);
  /** 잘못된 줄의 오류. 줄 번호 순이고 같은 줄에서는 규칙 순서라 줄마다 첫 오류를 쓴다. */
  const errors = validatePeriods(rows);
  /** 줄 번호(0부터)로 찾는 그 줄의 첫 오류. */
  const errorOf = new Map<number, string>();
  for (const e of errors) if (!errorOf.has(e.index)) errorOf.set(e.index, e.message);

  /** 줄들을 바꿔 편집 상태로 만든다. 처음 고치는 것이면 저장된 수업 시간에서 시작한다. */
  function edit(change: (rows: Row[]) => Row[]): void {
    if (!selected) return;
    toasts.dismissUndo();
    setDraft({ id: selected.id, rows: change(rows) });
  }

  /** 줄 하나의 시각을 바꾼다. */
  function setTime(key: number, patch: Partial<Period>): void {
    edit((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** 수업 시간 한 줄을 더하고 그 줄의 시작 시각 칸으로 초점을 보낸다. */
  function addRow(): void {
    const key = nextKey.current++;
    edit((all) => [...all, { key, ...nextPeriod(all) }]);
    focusKey.current = key;
  }

  /** 마지막 저장 상태로 돌린다. */
  function revert(): void {
    setDraft(null);
  }

  /** 편집을 저장한다. 저장했으면 true. 실패하면 편집 상태를 그대로 두고, 실패 알림은 앱이 띄운다. */
  async function save(): Promise<boolean> {
    if (!editing || errors.length > 0 || saving) return false;
    setSaving(true);
    try {
      const periods = sortByStart(draft.rows).map(({ start, end }) => ({ start, end }));
      const result = await window.dingdong.command({ type: 'set-periods', id: draft.id, periods });
      if (!result.ok) return false;
      setDraft(null);
      toasts.notify({ key: 'periods-saved', kind: 'success', text: '수업 시간을 저장했어요' });
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // 새로 더한 줄이 그려지면 그 줄의 시작 시각 칸으로 초점을 보낸다
  useEffect(
    function focusAddedRow() {
      if (focusKey.current === null) return;
      document.querySelector<HTMLInputElement>(`[data-row-key="${focusKey.current}"] input`)?.focus();
      focusKey.current = null;
    },
    [draft],
  );

  /** 떠나기 전에 묻는다. 편집이 없으면 바로 간다. */
  const requestLeave: LeaveGuard = (proceed) => {
    if (editing) setPendingLeave({ proceed });
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

  // 저장하지 않은 편집이 있는지 앱(과 메인의 창 닫기)에 알린다
  useEffect(
    function reportDirty() {
      onDirtyChange(editing);
    },
    [editing, onDirtyChange],
  );
  useEffect(
    function clearDirtyOnLeave() {
      return () => onDirtyChange(false);
    },
    [onDirtyChange],
  );

  /** 모달의 "저장": 저장하고 가려던 길로 간다. 저장하지 못하면 모달만 닫고 편집을 이어 간다. */
  async function saveAndLeave(): Promise<void> {
    const leave = pendingLeave;
    setPendingLeave(null);
    if (leave && (await save())) leave.proceed();
  }

  /** 모달의 "저장 안 함": 편집을 버리고 가려던 길로 간다. */
  function discardAndLeave(): void {
    const leave = pendingLeave;
    setPendingLeave(null);
    setDraft(null);
    leave?.proceed();
  }

  /** 줄을 벗어난 초점이 목록 밖으로 나가면 줄을 시작 시각 순으로 정렬한다. 고치는 도중에는 줄이 움직이지 않는다. */
  function sortOnLeave(event: React.FocusEvent<HTMLDivElement>): void {
    if (!editing || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDraft({ id: draft.id, rows: sortByStart(draft.rows) });
  }

  return (
    <>
      <div className="card card--dial">
        <div className="timetable-head">
          <button
            type="button"
            className="timetable-select"
            aria-haspopup="dialog"
            aria-label={`${weekdayName(day)} 시간표 고르기: ${selected?.name ?? '없음'}`}
            onClick={() => requestLeave(() => setPicking(true))}
          >
            <i
              className={`dot${selected ? '' : ' dot--none'}`}
              aria-hidden="true"
              style={selected ? { background: `var(--timetable-${selected.color})` } : undefined}
            />
            <span className="timetable-select__name">{selected?.name ?? '없음'}</span>
            <ActionIcon name="down" />
          </button>
          <div className="days" role="group" aria-label="요일">
            {WEEKDAYS.map((d) => {
              const t = timetableOf(d);
              /** 마우스를 올리면 뜨는 이름이자 화면 읽기 이름. 색만으로 시간표를 알리지 않는다. */
              const label = `${weekdayName(d)} · ${t?.name ?? '시간표 없음'}`;
              return (
                <button
                  key={d}
                  type="button"
                  className={`day${t ? '' : ' day--none'}${d === day ? ' day--selected' : ''}`}
                  style={t ? { background: `var(--timetable-${t.color})` } : undefined}
                  title={label}
                  aria-label={label}
                  aria-pressed={d === day}
                  onClick={() => {
                    if (d !== day) requestLeave(() => setDay(d));
                  }}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>
        </div>
        <Dial periods={rows} color={selected?.color ?? null} dogTheme={dogTheme} />
      </div>

      <div className="card card--periods">
        <div className="period-list" onBlur={sortOnLeave}>
          {rows.map((row, index) => {
            const rank = ranks[index]!;
            const error = errorOf.get(index);
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
                    onClick={() => edit((all) => all.filter((r) => r.key !== row.key))}
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
        {selected && (
          <button type="button" className="button button--ghost button--sm period-add" onClick={addRow}>
            <ActionIcon name="plus" />
            수업 시간
          </button>
        )}
        {editing && (
          <div className="period-foot">
            <button type="button" className="button button--ghost" onClick={revert}>
              되돌리기
            </button>
            <button type="button" className="button" disabled={errors.length > 0 || saving} onClick={() => void save()}>
              저장
            </button>
          </div>
        )}
      </div>

      {picking && (
        <TimetablePicker day={day} timetables={timetables} weekdays={weekdays} toasts={toasts} onClose={() => setPicking(false)} />
      )}
      {pendingLeave && selected && (
        <Modal title="바꾼 내용을 저장할까요?" width={440} onClose={() => setPendingLeave(null)}>
          <p>'{selected.name}' 시간표의 수업 시간을 바꿨어요.</p>
          {errors[0] && (
            <p className="field-error field-error--center" role="alert">
              <ActionIcon name="bang" />
              {ranks[errors[0].index]}교시: {errors[0].message}
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
    </>
  );
}
