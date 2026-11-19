// 시간표 만들기 · 이름 바꾸기 · 시간대 저장 · 쓰는 시간표 정하기 · 지우기. 저장 데이터를 받아 새 데이터를 돌려주는 순수 함수다.
// 바뀌는 것이 없거나 받지 않는 값이면 받은 데이터를 그대로 돌려줘서, 부르는 쪽이 `===`로 변경 여부를 알 수 있다.

import type { Data, Timetable, TimetableSlot } from './data';
import { toSavedSlots } from './slot-edit';

/** 시간표 색의 개수(DESIGN.md의 여덟 색). */
export const TIMETABLE_COLOR_COUNT = 8;

/** 한 요일이 두 시간대(또는 한 시간대에 두 번) 들어 있는지. 한 시간표 안에서 한 요일은 시간대 하나에만 든다. */
export function daysOverlap(slots: readonly Pick<TimetableSlot, 'days'>[]): boolean {
  const days = slots.flatMap((s) => s.days);
  return new Set(days).size !== days.length;
}

/**
 * 받은 이름으로 새 시간표를 목록 맨 끝에 만든다. 이름은 앞뒤 공백을 떼고, 비게 되면 만들지 않는다.
 * 처음 모양은 요일도 수업 시간도 없는 시간대 하나다. 색은 `nextColor`를 쓰고 하나 올린다.
 * 시간표가 하나도 없었으면 새 시간표가 쓰는 시간표가 된다.
 */
export function createTimetable(data: Data, id: string, name: string): Data {
  const trimmed = name.trim();
  if (trimmed === '') return data;
  const timetable: Timetable = { id, name: trimmed, color: data.nextColor, slots: [{ days: [], periods: [] }] };
  return {
    ...data,
    timetables: [...data.timetables, timetable],
    nextColor: (data.nextColor + 1) % TIMETABLE_COLOR_COUNT,
    activeTimetable: data.timetables.length === 0 ? id : data.activeTimetable,
  };
}

/** 이름을 바꾼다. 앞뒤 공백은 뗀다. 비게 되는 이름이나 없는 id는 무시한다. */
export function renameTimetable(data: Data, id: string, name: string): Data {
  const trimmed = name.trim();
  if (trimmed === '' || !data.timetables.some((t) => t.id === id)) return data;
  return { ...data, timetables: data.timetables.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) };
}

/**
 * 시간표 하나의 시간대 목록을 통째로 바꾼다. 상세의 "저장"이 부른다.
 * 요일은 월요일부터, 수업 시간은 시작 시각 순으로 정렬해 저장한다(교시 번호가 이 순서다).
 * 시간대가 없거나, 같은 요일이 두 시간대에 있거나, 없는 시간표면 받지 않는다. 수업 시간 규칙은 `validateSlots`의 몫이다.
 */
export function setSlots(data: Data, id: string, slots: readonly TimetableSlot[]): Data {
  if (slots.length === 0 || daysOverlap(slots) || !data.timetables.some((t) => t.id === id)) return data;
  // 상세가 "바꾼 것 없음"을 판단하는 모양과 같아야 저장 직후 "저장"이 꺼지므로 같은 함수로 정리한다
  /** 정렬하고 받은 목록과 끊어 낸 시간대. */
  const saved = toSavedSlots(slots);
  return { ...data, timetables: data.timetables.map((t) => (t.id === id ? { ...t, slots: saved } : t)) };
}

/** 쓰는 시간표를 정한다. 목록에 있는 id만 받는다. */
export function setActiveTimetable(data: Data, id: string): Data {
  if (data.activeTimetable === id || !data.timetables.some((t) => t.id === id)) return data;
  return { ...data, activeTimetable: id };
}

/**
 * 시간표를 지운다. 남은 시간표의 색과 `nextColor`는 그대로다.
 * 쓰는 시간표를 지우면 쓰는 시간표가 없어진다. 종이 예상 밖의 시간표를 따르지 않게 다른 시간표로 넘기지 않는다.
 */
export function deleteTimetable(data: Data, id: string): Data {
  if (!data.timetables.some((t) => t.id === id)) return data;
  return {
    ...data,
    timetables: data.timetables.filter((t) => t.id !== id),
    activeTimetable: data.activeTimetable === id ? null : data.activeTimetable,
  };
}
