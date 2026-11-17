import { useState } from 'react';
import { WEEKDAYS, type Timetable, type Weekday } from '../../shared/data';
import type { ToastApi } from './Toasts';
import { ActionIcon } from './icons';
import { TimetablePicker } from './TimetablePicker';
import { todayWeekday, WEEKDAY_SHORT, weekdayName } from './weekdays';

type Props = {
  timetables: Timetable[];
  weekdays: Record<Weekday, string | null>;
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
};

/**
 * 시간표 화면. 왼쪽 카드에 시간표 선택 입력기와 요일 동그라미 일곱 개가 있다.
 * 교시별 시각과 시계판은 이어지는 티켓에서 더한다.
 */
export function TimetableScreen({ timetables, weekdays, toasts }: Props) {
  /** 고른 요일. 화면을 열면 오늘이다. */
  const [day, setDay] = useState<Weekday>(todayWeekday);
  /** 시간표 선택 창이 열려 있는지. */
  const [picking, setPicking] = useState(false);

  /** 요일에 배정된 시간표. 배정이 없으면 undefined. */
  const timetableOf = (d: Weekday): Timetable | undefined => timetables.find((t) => t.id === weekdays[d]);
  /** 고른 요일의 시간표. */
  const selected = timetableOf(day);

  return (
    <div className="card">
      <div className="timetable-head">
        <button
          type="button"
          className="timetable-select"
          aria-haspopup="dialog"
          aria-label={`${weekdayName(day)} 시간표 고르기: ${selected?.name ?? '없음'}`}
          onClick={() => setPicking(true)}
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
                onClick={() => setDay(d)}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      </div>
      {picking && (
        <TimetablePicker day={day} timetables={timetables} weekdays={weekdays} toasts={toasts} onClose={() => setPicking(false)} />
      )}
    </div>
  );
}
