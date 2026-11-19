import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type TimetableSlot } from './data';
import { createTimetable, daysOverlap, deleteTimetable, renameTimetable, setActiveTimetable, setSlots } from './timetable-ops';

/** 이름이 '반0', '반1'…인 시간표를 n개 만든 데이터. id는 `t0`, `t1`…이다. */
function withTimetables(n: number): Data {
  let data = emptyData();
  for (let i = 0; i < n; i += 1) data = createTimetable(data, `t${i}`, `반${i}`);
  return data;
}

describe('createTimetable', () => {
  it('받은 이름의 앞뒤 공백을 떼고, 요일도 수업 시간도 없는 시간대 하나로 만든다', () => {
    const data = createTimetable(emptyData(), 'a', '  평일반 ');
    expect(data.timetables).toEqual([{ id: 'a', name: '평일반', color: 0, slots: [{ days: [], periods: [] }] }]);
  });

  it('빈 이름은 받지 않는다', () => {
    const data = emptyData();
    expect(createTimetable(data, 'a', '   ')).toBe(data);
  });

  it('첫 시간표는 쓰는 시간표가 되고, 그 뒤의 시간표는 쓰는 시간표를 바꾸지 않는다', () => {
    const first = createTimetable(emptyData(), 'a', '평일반');
    expect(first.activeTimetable).toBe('a');
    expect(createTimetable(first, 'b', '토요반').activeTimetable).toBe('a');
  });

  it('시간표는 있는데 쓰는 시간표가 없으면 새 시간표가 쓰는 시간표가 되지 않는다', () => {
    const data = { ...withTimetables(1), activeTimetable: null };
    expect(createTimetable(data, 'b', '토요반').activeTimetable).toBeNull();
  });

  it('색을 만든 순서대로 배정한다', () => {
    const data = withTimetables(3);
    expect(data.timetables.map((t) => [t.id, t.color])).toEqual([
      ['t0', 0],
      ['t1', 1],
      ['t2', 2],
    ]);
    expect(data.nextColor).toBe(3);
  });

  it('아홉 번째부터 처음 색을 다시 쓴다', () => {
    const data = withTimetables(9);
    expect(data.timetables.map((t) => t.color)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(data.nextColor).toBe(1);
  });
});

describe('renameTimetable', () => {
  it('앞뒤 공백을 떼고 이름을 바꾼다', () => {
    expect(renameTimetable(withTimetables(1), 't0', '  토요반 ').timetables[0]?.name).toBe('토요반');
  });

  it('빈 이름으로는 바꾸지 않는다', () => {
    const data = withTimetables(1);
    expect(renameTimetable(data, 't0', '   ')).toBe(data);
  });

  it('없는 id는 무시한다', () => {
    const data = withTimetables(1);
    expect(renameTimetable(data, 'nope', '토요반')).toBe(data);
  });

  it('같은 이름을 여러 시간표가 쓸 수 있다', () => {
    const data = renameTimetable(renameTimetable(withTimetables(2), 't0', '반'), 't1', '반');
    expect(data.timetables.map((t) => t.name)).toEqual(['반', '반']);
  });
});

describe('setSlots', () => {
  it('그 시간표의 시간대 목록을 통째로 바꾸고, 수업 시간은 시작 시각 순으로 정렬한다', () => {
    const data = withTimetables(2);
    const next = setSlots(data, 't1', [
      { days: ['mon', 'tue'], periods: [{ start: 600, end: 650 }, { start: 540, end: 590 }] },
      { days: ['sat'], periods: [] },
    ]);
    expect(next.timetables[1]?.slots).toEqual([
      { days: ['mon', 'tue'], periods: [{ start: 540, end: 590 }, { start: 600, end: 650 }] },
      { days: ['sat'], periods: [] },
    ]);
    expect(next.timetables[0]).toBe(data.timetables[0]);
  });

  it('요일은 월요일부터 순서대로 저장한다', () => {
    const next = setSlots(withTimetables(1), 't0', [{ days: ['sun', 'mon', 'wed'], periods: [] }]);
    expect(next.timetables[0]?.slots[0]?.days).toEqual(['mon', 'wed', 'sun']);
  });

  it('같은 요일이 두 시간대에 있으면 받지 않는다', () => {
    const data = withTimetables(1);
    const slots: TimetableSlot[] = [
      { days: ['mon', 'tue'], periods: [] },
      { days: ['tue'], periods: [] },
    ];
    expect(setSlots(data, 't0', slots)).toBe(data);
  });

  it('시간대가 하나도 없으면 받지 않는다', () => {
    const data = withTimetables(1);
    expect(setSlots(data, 't0', [])).toBe(data);
  });

  it('요일이 없는 시간대와 수업 시간이 없는 시간대도 받는다', () => {
    const next = setSlots(withTimetables(1), 't0', [{ days: [], periods: [{ start: 540, end: 590 }] }]);
    expect(next.timetables[0]?.slots).toEqual([{ days: [], periods: [{ start: 540, end: 590 }] }]);
  });

  it('없는 시간표는 무시한다', () => {
    const data = withTimetables(1);
    expect(setSlots(data, 'nope', [{ days: ['mon'], periods: [] }])).toBe(data);
  });

  it('받은 목록을 고치지 않고 복사해 저장한다', () => {
    const slots: TimetableSlot[] = [{ days: ['mon'], periods: [{ start: 540, end: 590 }] }];
    const next = setSlots(withTimetables(1), 't0', slots);
    slots[0]!.periods[0]!.start = 1;
    slots[0]!.days.push('tue');
    expect(next.timetables[0]?.slots).toEqual([{ days: ['mon'], periods: [{ start: 540, end: 590 }] }]);
  });
});

describe('daysOverlap', () => {
  it('한 요일이 두 시간대에 들어 있는지 본다', () => {
    expect(daysOverlap([{ days: ['mon'] }, { days: ['tue'] }])).toBe(false);
    expect(daysOverlap([{ days: ['mon', 'tue'] }, { days: ['sat', 'tue'] }])).toBe(true);
  });

  it('한 시간대 안에 같은 요일이 두 번 있어도 겹침이다', () => {
    expect(daysOverlap([{ days: ['mon', 'mon'] }])).toBe(true);
  });
});

describe('setActiveTimetable', () => {
  it('목록에 있는 시간표를 쓰는 시간표로 정한다', () => {
    expect(setActiveTimetable(withTimetables(2), 't1').activeTimetable).toBe('t1');
  });

  it('없는 id는 받지 않는다', () => {
    const data = withTimetables(2);
    expect(setActiveTimetable(data, 'nope')).toBe(data);
  });

  it('이미 쓰는 시간표면 그대로 돌려준다', () => {
    const data = withTimetables(2);
    expect(setActiveTimetable(data, 't0')).toBe(data);
  });
});

describe('deleteTimetable', () => {
  it('지워도 남은 시간표의 색은 바뀌지 않고, 다음 색도 이어진다', () => {
    let data = withTimetables(3);
    data = deleteTimetable(data, 't1');
    expect(data.timetables.map((t) => [t.id, t.color])).toEqual([
      ['t0', 0],
      ['t2', 2],
    ]);
    data = createTimetable(data, 't3', '반3');
    expect(data.timetables.at(-1)?.color).toBe(3);
  });

  it('쓰는 시간표를 지우면 쓰는 시간표가 없어지고 다른 시간표로 넘기지 않는다', () => {
    const data = deleteTimetable(withTimetables(2), 't0');
    expect(data.timetables.map((t) => t.id)).toEqual(['t1']);
    expect(data.activeTimetable).toBeNull();
  });

  it('쓰는 시간표가 아닌 시간표를 지우면 쓰는 시간표는 그대로다', () => {
    expect(deleteTimetable(withTimetables(2), 't1').activeTimetable).toBe('t0');
  });

  it('없는 id는 아무것도 바꾸지 않는다', () => {
    const data = withTimetables(1);
    expect(deleteTimetable(data, 'nope')).toBe(data);
  });
});
