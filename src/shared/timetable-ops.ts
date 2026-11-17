// 시간표 만들기 · 이름 바꾸기 · 지우기 · 요일 배정. 저장 데이터를 받아 새 데이터를 돌려주는 순수 함수다.
// 바뀌는 것이 없으면 받은 데이터를 그대로 돌려줘서, 부르는 쪽이 `===`로 변경 여부를 알 수 있다.

import { WEEKDAYS, type Data, type Timetable, type Weekday } from './data';
import { sortByStart } from './period-edit';
import type { Period } from './timetable-validation';

/** 시간표 색의 개수(DESIGN.md의 여덟 색). */
export const TIMETABLE_COLOR_COUNT = 8;
/** 새 시간표의 처음 이름. */
export const NEW_TIMETABLE_NAME = '새 시간표';

/** 지운 시간표와 지우기 전의 자리. 되돌리기에 쓴다. */
export type RemovedTimetable = { timetable: Timetable; index: number };

/**
 * 새 시간표를 목록 맨 끝에 만든다. 색은 `nextColor`를 쓰고 하나 올린다.
 * `assignTo`를 주면 그 요일에 바로 배정한다.
 */
export function createTimetable(data: Data, id: string, assignTo?: Weekday): Data {
  const timetable: Timetable = { id, name: NEW_TIMETABLE_NAME, color: data.nextColor, periods: [] };
  return {
    ...data,
    timetables: [...data.timetables, timetable],
    nextColor: (data.nextColor + 1) % TIMETABLE_COLOR_COUNT,
    weekdays: assignTo ? { ...data.weekdays, [assignTo]: id } : data.weekdays,
  };
}

/** 이름을 바꾼다. 앞뒤 공백은 뗀다. 비게 되는 이름이나 없는 id는 무시한다. */
export function renameTimetable(data: Data, id: string, name: string): Data {
  const trimmed = name.trim();
  if (trimmed === '' || !data.timetables.some((t) => t.id === id)) return data;
  return { ...data, timetables: data.timetables.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) };
}

/** 시간표를 지우고, 그 시간표를 쓰던 요일은 없음으로 만든다. 남은 시간표의 색과 `nextColor`는 그대로다. */
export function deleteTimetable(data: Data, id: string): { data: Data; removed: RemovedTimetable | null } {
  const index = data.timetables.findIndex((t) => t.id === id);
  const timetable = data.timetables[index];
  if (!timetable) return { data, removed: null };
  const weekdays = { ...data.weekdays };
  for (const day of daysUsing(data.weekdays, id)) weekdays[day] = null;
  return {
    data: { ...data, timetables: data.timetables.filter((t) => t.id !== id), weekdays },
    removed: { timetable, index },
  };
}

/** 지운 시간표를 원래 자리에 되돌린다. 이미 있으면 그대로 둔다. 요일 배정은 되돌리지 않는다. */
export function restoreTimetable(data: Data, { timetable, index }: RemovedTimetable): Data {
  if (data.timetables.some((t) => t.id === timetable.id)) return data;
  const timetables = [...data.timetables];
  timetables.splice(Math.min(index, timetables.length), 0, timetable);
  return { ...data, timetables };
}

/** 요일에 시간표 하나 또는 없음(null)을 배정한다. 없는 시간표는 무시한다. */
export function assignWeekday(data: Data, day: Weekday, id: string | null): Data {
  if (id !== null && !data.timetables.some((t) => t.id === id)) return data;
  if (data.weekdays[day] === id) return data;
  return { ...data, weekdays: { ...data.weekdays, [day]: id } };
}

/** 시간표를 쓰는 요일을 월요일부터 순서대로 돌려준다. */
export function daysUsing(weekdays: Data['weekdays'], id: string): Weekday[] {
  return WEEKDAYS.filter((day) => weekdays[day] === id);
}

/** 시간표의 수업 시간을 바꾼다. 시작 시각 순으로 정렬해 저장하고(교시 번호가 이 순서다), 없는 시간표는 무시한다. */
export function setPeriods(data: Data, id: string, periods: readonly Period[]): Data {
  if (!data.timetables.some((t) => t.id === id)) return data;
  const sorted = sortByStart(periods).map(({ start, end }) => ({ start, end }));
  return { ...data, timetables: data.timetables.map((t) => (t.id === id ? { ...t, periods: sorted } : t)) };
}
