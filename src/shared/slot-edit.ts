// 상세 편집의 초안에 쓰는 시간대 조작. 시간대 목록을 받아 새 목록을 돌려주는 순수 함수다.
// 수업 시간 줄의 모양(화면의 줄 key 같은 것)은 건드리지 않도록 수업 시간 타입을 열어 둔다.

import { WEEKDAYS, type Period, type TimetableSlot, type Weekday } from './data';
import { sortByStart } from './period-edit';

/** 조작하는 시간대. 수업 시간 줄은 화면이 쓰는 모양 그대로 둔다. */
type Slot<P> = { days: readonly Weekday[]; periods: readonly P[] };

/** 시간대 `index`의 요일 줄에 보일 요일. 그 시간대의 요일과 어느 시간대에도 들지 않은 요일이고, 월요일부터다. */
export function daysShownFor(slots: readonly Pick<Slot<unknown>, 'days'>[], index: number): Weekday[] {
  /** 다른 시간대가 쓰는 요일. */
  const taken = new Set(slots.flatMap((slot, i) => (i === index ? [] : slot.days)));
  return WEEKDAYS.filter((d) => !taken.has(d));
}

/**
 * 시간대 `index`의 요일 하나를 켜거나 끈다. 요일은 월요일부터의 순서로 둔다.
 * 다른 시간대가 쓰는 요일이면 받은 목록을 그대로 돌려준다. 한 요일은 시간대 하나에만 든다.
 */
export function toggleDay<S extends Slot<unknown>>(slots: readonly S[], index: number, day: Weekday): readonly S[] {
  /** 바꿀 시간대. */
  const slot = slots[index];
  // 없는 시간대이거나 다른 시간대가 쓰는 요일이면 받지 않는다
  if (!slot || !daysShownFor(slots, index).includes(day)) return slots;
  /** 바뀐 뒤의 요일. */
  const days = slot.days.includes(day) ? slot.days.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || slot.days.includes(d));
  return slots.map((s, i) => (i === index ? { ...s, days } : s));
}

/** 어느 시간대에도 들지 않은 요일이 있는지. 있을 때만 "+ 다른 시간대"를 보여 준다. */
export function hasUnassignedDay(slots: readonly Pick<Slot<unknown>, 'days'>[]): boolean {
  return new Set(slots.flatMap((slot) => slot.days)).size < WEEKDAYS.length;
}

/** 요일도 수업 시간도 없는 시간대를 맨 끝에 더한다. 남은 요일이 없으면 받은 목록을 그대로 돌려준다. */
export function addSlot<P>(slots: readonly Slot<P>[]): readonly Slot<P>[] {
  if (!hasUnassignedDay(slots)) return slots;
  return [...slots, { days: [], periods: [] }];
}

/** 시간대 `index`를 지운다. 시간표에는 시간대가 한 개 이상 있어야 하므로 하나뿐이면 받은 목록을 그대로 돌려준다. */
export function removeSlot<S>(slots: readonly S[], index: number): readonly S[] {
  if (slots.length <= 1 || index < 0 || index >= slots.length) return slots;
  return slots.filter((_, i) => i !== index);
}

/** 두 시간대 목록이 저장했을 때 같은지. 초안이 저장된 값으로 돌아왔는지 볼 때 쓴다. */
export function sameSlots(a: readonly Slot<Period>[], b: readonly Slot<Period>[]): boolean {
  return JSON.stringify(toSavedSlots(a)) === JSON.stringify(toSavedSlots(b));
}

/** 초안을 저장할 모양으로. 요일은 월요일부터, 수업 시간은 시작 시각 순이고 시각만 담는다(화면의 줄 key는 뗀다). */
export function toSavedSlots(slots: readonly Slot<Period>[]): TimetableSlot[] {
  return slots.map((slot) => ({
    days: WEEKDAYS.filter((d) => slot.days.includes(d)),
    periods: sortByStart(slot.periods).map(({ start, end }) => ({ start, end })),
  }));
}
