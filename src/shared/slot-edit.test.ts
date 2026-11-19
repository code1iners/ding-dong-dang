import { describe, expect, it } from 'vitest';
import type { TimetableSlot } from './data';
import { addSlot, daysShownFor, hasUnassignedDay, removeSlot, sameSlots, toggleDay, toSavedSlots } from './slot-edit';

/** 평일 시간대와 토요일 시간대. */
const WEEK_AND_SAT: readonly TimetableSlot[] = [
  { days: ['mon', 'tue', 'wed', 'thu', 'fri'], periods: [] },
  { days: ['sat'], periods: [] },
];

describe('daysShownFor', () => {
  it('고른 시간대의 요일과 어느 시간대에도 들지 않은 요일을 월요일부터 보여 주고, 다른 시간대의 요일은 뺀다', () => {
    expect(daysShownFor(WEEK_AND_SAT, 1)).toEqual(['sat', 'sun']);
    expect(daysShownFor(WEEK_AND_SAT, 0)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sun']);
  });
});

describe('toggleDay', () => {
  it('꺼진 요일을 켜면 월요일부터의 순서로 들어가고, 켠 요일을 다시 누르면 빠진다', () => {
    const on = toggleDay(WEEK_AND_SAT, 1, 'sun');
    expect(on[1]!.days).toEqual(['sat', 'sun']);
    expect(toggleDay(on, 1, 'sat')[1]!.days).toEqual(['sun']);
  });

  it('다른 시간대가 쓰는 요일은 켜지 않는다', () => {
    expect(toggleDay(WEEK_AND_SAT, 1, 'mon')).toBe(WEEK_AND_SAT);
  });

  it('다른 시간대와 수업 시간은 그대로다', () => {
    const periods = [{ start: 540, end: 590 }];
    const slots = [{ days: ['mon' as const], periods }, { days: [], periods: [] }];
    const next = toggleDay(slots, 0, 'tue');
    expect(next[0]!.periods).toBe(periods);
    expect(next[1]).toBe(slots[1]);
  });
});

describe('hasUnassignedDay', () => {
  it('어느 시간대에도 들지 않은 요일이 있는지', () => {
    expect(hasUnassignedDay(WEEK_AND_SAT)).toBe(true);
    expect(hasUnassignedDay(toggleDay(WEEK_AND_SAT, 1, 'sun'))).toBe(false);
  });
});

describe('addSlot', () => {
  it('요일도 수업 시간도 없는 시간대를 맨 끝에 더한다', () => {
    expect(addSlot(WEEK_AND_SAT)).toEqual([...WEEK_AND_SAT, { days: [], periods: [] }]);
  });

  it('모든 요일이 이미 시간대에 들어 있으면 더하지 않는다', () => {
    const full = toggleDay(WEEK_AND_SAT, 1, 'sun');
    expect(addSlot(full)).toBe(full);
  });
});

describe('removeSlot', () => {
  it('고른 시간대를 지운다', () => {
    expect(removeSlot(WEEK_AND_SAT, 0)).toEqual([{ days: ['sat'], periods: [] }]);
  });

  it('시간대가 하나뿐이면 지우지 않는다', () => {
    const one = [{ days: [], periods: [] }];
    expect(removeSlot(one, 0)).toBe(one);
  });
});

describe('sameSlots', () => {
  /** 저장된 평일 시간대. */
  const saved = [{ days: ['mon', 'tue'] as const, periods: [{ start: 540, end: 590 }, { start: 600, end: 650 }] }];

  it('줄의 다른 값이나 수업 시간의 순서가 달라도 요일과 시각이 같으면 같다', () => {
    const draft = [{ days: ['mon', 'tue'] as const, periods: [{ key: 7, start: 600, end: 650 }, { key: 1, start: 540, end: 590 }] }];
    expect(sameSlots(draft, saved)).toBe(true);
  });

  it('요일 · 시각 · 시간대 수 가운데 하나라도 다르면 다르다', () => {
    expect(sameSlots([{ ...saved[0]!, days: ['mon'] }], saved)).toBe(false);
    expect(sameSlots([{ ...saved[0]!, periods: [{ start: 540, end: 595 }, { start: 600, end: 650 }] }], saved)).toBe(false);
    expect(sameSlots([{ ...saved[0]!, periods: [{ start: 540, end: 590 }] }], saved)).toBe(false);
    expect(sameSlots([...saved, { days: [], periods: [] }], saved)).toBe(false);
  });
});

describe('toSavedSlots', () => {
  it('요일은 월요일부터, 수업 시간은 시작 시각 순으로 두고 시각 밖의 값은 뗀다', () => {
    const draft = [{ days: ['fri', 'mon'] as const, periods: [{ key: 7, start: 600, end: 650 }, { key: 1, start: 540, end: 590 }] }];
    expect(toSavedSlots(draft)).toEqual([{ days: ['mon', 'fri'], periods: [{ start: 540, end: 590 }, { start: 600, end: 650 }] }]);
  });
});
