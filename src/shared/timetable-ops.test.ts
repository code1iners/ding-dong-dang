import { describe, expect, it } from 'vitest';
import { emptyData, type Data } from './data';
import {
  assignWeekday,
  createTimetable,
  daysUsing,
  deleteTimetable,
  renameTimetable,
  restoreTimetable,
  setPeriods,
} from './timetable-ops';

/** 이름만 다른 시간표를 n개 만든 데이터. */
function withTimetables(n: number): Data {
  let data = emptyData();
  for (let i = 0; i < n; i += 1) data = createTimetable(data, `t${i}`);
  return data;
}

describe('createTimetable', () => {
  it('이름 "새 시간표"로 만들고 색을 만든 순서대로 배정한다', () => {
    const data = withTimetables(3);
    expect(data.timetables.map((t) => [t.id, t.name, t.color, t.periods])).toEqual([
      ['t0', '새 시간표', 0, []],
      ['t1', '새 시간표', 1, []],
      ['t2', '새 시간표', 2, []],
    ]);
    expect(data.nextColor).toBe(3);
  });

  it('아홉 번째부터 처음 색을 다시 쓴다', () => {
    const data = withTimetables(9);
    expect(data.timetables.map((t) => t.color)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(data.nextColor).toBe(1);
  });

  it('요일을 주면 그 요일에 배정한다', () => {
    const data = createTimetable(emptyData(), 'a', 'wed');
    expect(data.weekdays.wed).toBe('a');
    expect(data.weekdays.mon).toBeNull();
  });
});

describe('deleteTimetable', () => {
  it('지워도 남은 시간표의 색은 바뀌지 않고, 다음 색도 이어진다', () => {
    let data = withTimetables(3);
    data = deleteTimetable(data, 't1').data;
    expect(data.timetables.map((t) => [t.id, t.color])).toEqual([
      ['t0', 0],
      ['t2', 2],
    ]);
    data = createTimetable(data, 't3');
    expect(data.timetables.at(-1)?.color).toBe(3);
  });

  it('배정된 요일은 없음이 된다', () => {
    let data = withTimetables(2);
    data = assignWeekday(data, 'sat', 't1');
    data = assignWeekday(data, 'sun', 't1');
    data = assignWeekday(data, 'mon', 't0');
    const result = deleteTimetable(data, 't1').data;
    expect(result.weekdays).toMatchObject({ mon: 't0', sat: null, sun: null });
  });

  it('없는 id는 아무것도 바꾸지 않는다', () => {
    const data = withTimetables(1);
    const result = deleteTimetable(data, 'nope');
    expect(result.data).toBe(data);
    expect(result.removed).toBeNull();
  });
});

describe('restoreTimetable', () => {
  it('지우기 전의 자리와 내용 그대로 되돌린다', () => {
    const before = renameTimetable(withTimetables(3), 't1', '오전반');
    const { data, removed } = deleteTimetable(before, 't1');
    expect(restoreTimetable(data, removed!)).toEqual(before);
  });

  it('이미 있는 id는 두 번 되돌리지 않는다', () => {
    const before = withTimetables(2);
    const { data, removed } = deleteTimetable(before, 't0');
    const once = restoreTimetable(data, removed!);
    expect(restoreTimetable(once, removed!)).toBe(once);
  });

  it('자리가 목록 길이를 넘으면 맨 끝에 되돌린다', () => {
    const before = withTimetables(3);
    const { data, removed } = deleteTimetable(before, 't2');
    const smaller = deleteTimetable(data, 't0').data;
    expect(restoreTimetable(smaller, removed!).timetables.map((t) => t.id)).toEqual(['t1', 't2']);
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

  it('같은 이름을 여러 시간표가 쓸 수 있다', () => {
    const data = renameTimetable(renameTimetable(withTimetables(2), 't0', '반'), 't1', '반');
    expect(data.timetables.map((t) => t.name)).toEqual(['반', '반']);
  });
});

describe('assignWeekday', () => {
  it('요일마다 시간표 하나 또는 없음을 배정한다', () => {
    let data = assignWeekday(withTimetables(2), 'mon', 't1');
    expect(data.weekdays.mon).toBe('t1');
    data = assignWeekday(data, 'mon', null);
    expect(data.weekdays.mon).toBeNull();
  });

  it('없는 시간표는 배정하지 않는다', () => {
    const data = withTimetables(1);
    expect(assignWeekday(data, 'mon', 'nope')).toBe(data);
  });
});

describe('daysUsing', () => {
  it('시간표를 쓰는 요일을 월요일부터 순서대로 돌려준다', () => {
    let data = withTimetables(2);
    data = assignWeekday(data, 'sun', 't0');
    data = assignWeekday(data, 'tue', 't0');
    data = assignWeekday(data, 'wed', 't1');
    expect(daysUsing(data.weekdays, 't0')).toEqual(['tue', 'sun']);
    expect(daysUsing(data.weekdays, 'none')).toEqual([]);
  });
});

describe('setPeriods', () => {
  it('시작 시각 순으로 정렬해 그 시간표의 수업 시간을 바꾼다', () => {
    const data = withTimetables(2);
    const next = setPeriods(data, 't1', [{ start: 600, end: 650 }, { start: 540, end: 590 }]);
    expect(next.timetables[1]?.periods).toEqual([{ start: 540, end: 590 }, { start: 600, end: 650 }]);
    expect(next.timetables[0]).toBe(data.timetables[0]);
  });

  it('그 시간표를 쓰는 모든 요일이 같은 시간표 id를 가리키므로 함께 바뀐다', () => {
    let data = createTimetable(emptyData(), 'a', 'mon');
    data = assignWeekday(data, 'wed', 'a');
    const next = setPeriods(data, 'a', [{ start: 540, end: 590 }]);
    const used = (['mon', 'wed'] as const).map((d) => next.timetables.find((t) => t.id === next.weekdays[d])?.periods);
    expect(used).toEqual([[{ start: 540, end: 590 }], [{ start: 540, end: 590 }]]);
  });

  it('없는 시간표는 무시한다', () => {
    const data = withTimetables(1);
    expect(setPeriods(data, 'nope', [{ start: 1, end: 2 }])).toBe(data);
  });

  it('받은 목록을 고치지 않고 복사해 저장한다', () => {
    const periods = [{ start: 540, end: 590 }];
    const next = setPeriods(withTimetables(1), 't0', periods);
    periods[0]!.start = 1;
    expect(next.timetables[0]?.periods[0]?.start).toBe(540);
  });
});
