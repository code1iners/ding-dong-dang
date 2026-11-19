import { describe, expect, it } from 'vitest';
import type { Timetable, TimetableSlot } from './data';
import { decideBell, type BellDecisionInput } from './bell-decision';

/** 2026-11-16은 월요일이다. 스펙 시나리오 표의 기준 날짜. */
const DAY = { 월: 16, 화: 17, 수: 18, 목: 19 } as const;

/** '월 08:59:59' 같은 표기를 현지 시각의 에포크 ms로 바꾼다. */
function at(text: string): number {
  const [day, clock] = text.split(' ') as [keyof typeof DAY, string];
  const [h = 0, m = 0, s = 0] = clock.split(':').map(Number);
  return new Date(2026, 10, DAY[day], h, m, s).getTime();
}

/** 'HH:MM'을 자정부터의 분으로. */
function min(clock: string): number {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** 'HH:MM' 두 개로 수업 시간 하나를 만든다. */
function period(start: string, end: string) {
  return { start: min(start), end: min(end) };
}

/** 스펙 시나리오 표의 평일반 수업 시간. */
const weekdayPeriods = [period('09:00', '09:50'), period('10:00', '10:50'), period('10:50', '11:40'), period('13:00', '13:50')];
/** 자정에 시작하는 새벽 수업. */
const dawnPeriods = [period('00:00', '00:40')];

/** 평일반 시간표. 시나리오 표의 요일 배정(월 · 화는 평일반, 수는 새벽반, 나머지는 없음)을 시간대로 옮겼다. */
function weekdayClass(slots: TimetableSlot[] = [
  { days: ['mon', 'tue'], periods: weekdayPeriods },
  { days: ['wed'], periods: dawnPeriods },
]): Timetable {
  return { id: 'weekday', name: '평일반', color: 0, slots };
}
/** 쓰는 시간표가 아닌 토요반. 월요일 이른 아침에도 수업이 있다. */
const saturdayClass: Timetable = {
  id: 'saturday',
  name: '토요반',
  color: 1,
  slots: [{ days: ['mon', 'thu', 'sat'], periods: [period('08:30', '08:45')] }],
};

/** 시나리오 표의 기본 상태(쓰는 시간표는 평일반)에서 필요한 부분만 바꿔 판정한다. */
function decide(from: string | null, to: string, override: Partial<BellDecisionInput> = {}) {
  return decideBell({
    timetables: [weekdayClass(), saturdayClass],
    activeTimetable: 'weekday',
    bellsOffDate: null,
    lastChecked: from === null ? null : at(from),
    now: at(to),
    ...override,
  });
}

describe('종 판정: 시나리오 표', () => {
  it('1. 수업 시작 시각에 시작종이 울리고 1교시 수업 중이 된다', () => {
    const result = decide('월 08:59:59', '월 09:00:00');
    expect(result.bell).toBe('start');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(1);
    expect(result.keepAwake).toBe(true);
  });

  it('2. 수업 끝 시각에 끝종이 울리고 쉬는 시간이 된다', () => {
    const result = decide('월 09:49:59', '월 09:50:00');
    expect(result.bell).toBe('end');
    expect(result.status.kind).toBe('break');
  });

  it('3. 이어지는 두 수업의 경계에서는 시작종만 울린다', () => {
    const result = decide('월 10:49:59', '월 10:50:00');
    expect(result.bell).toBe('start');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(3);
  });

  it('4. 59초 늦은 종은 울린다', () => {
    expect(decide('월 08:59:50', '월 09:00:59').bell).toBe('start');
  });

  it('5. 정확히 60초 늦은 종은 울린다', () => {
    expect(decide('월 08:59:50', '월 09:01:00').bell).toBe('start');
  });

  it('6. 61초 늦은 종은 버린다', () => {
    const result = decide('월 08:59:50', '월 09:01:01');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(1);
  });

  it('7. 구간에 종이 여럿이면 가장 최근 것 하나만 울리고 나머지는 버린다', () => {
    expect(decide('월 08:50:00', '월 10:00:30').bell).toBe('start');
  });

  it('8. 가장 최근 종도 60초를 넘겼으면 아무것도 울리지 않는다', () => {
    const result = decide('월 08:50:00', '월 10:30:00');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(2);
  });

  it('9. 시각이 뒤로 가면 종이 울리지 않고, 10. 그 시각이 다시 오면 한 번 더 울린다', () => {
    expect(decide('월 09:00:30', '월 08:59:00').bell).toBe('none');
    expect(decide('월 08:59:59', '월 09:00:00').bell).toBe('start');
  });

  it('11. 앱을 막 켠 첫 판정은 지난번 확인 시각이 없어 종이 울리지 않는다', () => {
    const result = decide(null, '월 09:00:20');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(1);
    expect(result.keepAwake).toBe(true);
  });

  it('12. 자정을 넘기면 넘어간 날의 요일이 든 시간대로 종을 정한다', () => {
    expect(decide('화 23:59:59', '수 00:00:00').bell).toBe('start');
  });

  it('13. 자정에 걸친 종도 40초 늦게 울린다', () => {
    expect(decide('화 23:59:30', '수 00:00:40').bell).toBe('start');
  });

  it('자정 직전에 끝난 수업의 끝종은 자정이 지난 뒤 확인해도 울린다', () => {
    const result = decide('화 23:58:50', '수 00:00:00', {
      timetables: [
        weekdayClass([
          { days: ['tue'], periods: [period('23:00', '23:59')] },
          { days: ['wed'], periods: weekdayPeriods },
        ]),
      ],
    });
    expect(result.bell).toBe('end');
  });

  it('14. 화요일에 끈 오늘만 끄기는 수요일 0시에 풀린다', () => {
    expect(decide('화 23:59:59', '수 00:00:00', { bellsOffDate: '2026-11-17' }).bell).toBe('start');
  });

  it('15. 쓰는 시간표에 그 요일이 든 시간대가 없으면 종이 없고 수업 없는 날이다', () => {
    const result = decide('목 08:59:59', '목 09:00:00');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-class-day');
    expect(result.keepAwake).toBe(false);
  });

  it('16. 오늘만 끄기 중에는 종이 없다', () => {
    const result = decide('월 08:59:59', '월 09:00:00', { bellsOffDate: '2026-11-16' });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(1);
    expect(result.keepAwake).toBe(false);
    expect(result.bellsOff).toBe(true);
  });

  it('오늘만 끄기는 지금 시각의 현지 날짜가 끈 날짜와 같을 때만 켜져 있다', () => {
    expect(decide('월 08:59:59', '월 09:00:00').bellsOff).toBe(false);
    expect(decide('화 23:59:59', '수 00:00:00', { bellsOffDate: '2026-11-17' }).bellsOff).toBe(false);
  });

  it('17. 오늘만 끄기를 다시 켠 뒤에는 이미 지난 종이 울리지 않는다', () => {
    expect(decide('월 09:00:10', '월 09:00:11').bell).toBe('none');
  });

  it('18. 수업 시작을 지난 시각으로 고쳐 저장해도 종이 뒤늦게 울리지 않는다', () => {
    const edited = weekdayClass([
      {
        days: ['mon', 'tue'],
        periods: [period('09:00', '09:50'), period('09:52', '10:50'), period('10:50', '11:40'), period('13:00', '13:50')],
      },
      { days: ['wed'], periods: dawnPeriods },
    ]);
    const result = decide('월 09:55:00', '월 09:55:01', { timetables: [edited, saturdayClass] });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('in-class');
    expect(result.status.periodNumber).toBe(2);
  });

  it('19. 첫 수업 전에는 잠자기를 막지 않는다', () => {
    const result = decide('월 08:59:58', '월 08:59:59');
    expect(result.status.kind).toBe('before-first');
    expect(result.keepAwake).toBe(false);
  });

  it('20. 수업 사이 쉬는 시간에는 잠자기를 막는다', () => {
    const result = decide('월 12:00:00', '월 12:00:01');
    expect(result.status.kind).toBe('break');
    expect(result.keepAwake).toBe(true);
  });

  it('21. 마지막 수업이 끝나면 끝종이 울리고 잠자기 막기를 푼다', () => {
    const result = decide('월 13:49:59', '월 13:50:00');
    expect(result.bell).toBe('end');
    expect(result.status.kind).toBe('after-last');
    expect(result.keepAwake).toBe(false);
  });

  it('22. 그 요일이 든 시간대에 수업 시간이 없으면 종이 없고 수업 없는 날이다', () => {
    const result = decide('월 08:59:59', '월 09:00:00', {
      timetables: [weekdayClass([{ days: ['mon'], periods: [] }, { days: ['tue'], periods: weekdayPeriods }])],
    });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-class-day');
    expect(result.keepAwake).toBe(false);
  });
});

describe('현황', () => {
  it('수업 중: 지금 교시, 오늘의 교시 수, 다음 종, 지금 구간을 낸다', () => {
    const { status } = decide('월 09:29:59', '월 09:30:00');
    expect(status).toEqual({
      kind: 'in-class',
      periodNumber: 1,
      periodCount: 4,
      periodsDone: 0,
      nextBell: { kind: 'end', at: at('월 09:50:00') },
      segment: { start: at('월 09:00:00'), end: at('월 09:50:00') },
    });
  });

  it('이어지는 수업의 두 번째 교시 중에는 끝난 교시가 하나다', () => {
    expect(decide('월 10:29:59', '월 10:30:00').status.periodsDone).toBe(1);
  });

  it('이어지는 수업 중에는 다음 종이 끝종이 아니라 다음 수업의 시작종이다', () => {
    const { status } = decide('월 10:29:59', '월 10:30:00');
    expect(status.periodNumber).toBe(2);
    expect(status.nextBell).toEqual({ kind: 'start', at: at('월 10:50:00') });
    expect(status.segment).toEqual({ start: at('월 10:00:00'), end: at('월 10:50:00') });
  });

  it('쉬는 시간: 다음 시작종과, 방금 끝난 수업의 끝부터 다음 시작까지의 구간을 낸다', () => {
    const { status } = decide('월 12:00:00', '월 12:00:01');
    expect(status).toEqual({
      kind: 'break',
      periodNumber: null,
      periodCount: 4,
      periodsDone: 3,
      nextBell: { kind: 'start', at: at('월 13:00:00') },
      segment: { start: at('월 11:40:00'), end: at('월 13:00:00') },
    });
  });

  it('첫 수업 전: 첫 시작종까지의 시각을 내고 고리 구간은 없다', () => {
    const { status } = decide('월 07:59:59', '월 08:00:00');
    expect(status).toEqual({
      kind: 'before-first',
      periodNumber: null,
      periodCount: 4,
      periodsDone: 0,
      nextBell: { kind: 'start', at: at('월 09:00:00') },
      segment: null,
    });
  });

  it('마지막 수업 뒤: 다음 종도 고리 구간도 없다', () => {
    const { status } = decide('월 18:00:00', '월 18:00:01');
    expect(status).toEqual({
      kind: 'after-last',
      periodNumber: null,
      periodCount: 4,
      periodsDone: 4,
      nextBell: null,
      segment: null,
    });
  });

  it('수업 없는 날: 교시 수 0에 다음 종이 없다', () => {
    const { status } = decide('목 12:00:00', '목 12:00:01');
    expect(status).toEqual({
      kind: 'no-class-day',
      periodNumber: null,
      periodCount: 0,
      periodsDone: 0,
      nextBell: null,
      segment: null,
    });
  });

  it('시간표가 하나도 없으면 시간표 없음이고 종이 없다', () => {
    const result = decide('월 08:59:59', '월 09:00:00', { timetables: [], activeTimetable: null });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-timetables');
    expect(result.keepAwake).toBe(false);
  });

  it('오늘만 끄기 중에도 현황은 시간표대로 계산한다', () => {
    const result = decide('월 09:29:59', '월 09:30:00', { bellsOffDate: '2026-11-16' });
    expect(result.status.kind).toBe('in-class');
    expect(result.status.nextBell).toEqual({ kind: 'end', at: at('월 09:50:00') });
  });

  it('쓰는 시간표 id가 목록에 없으면 시간표 없음으로 본다', () => {
    const result = decide('월 08:59:59', '월 09:00:00', { activeTimetable: 'gone' });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-timetables');
  });

  it('수업 시간을 입력 순서와 상관없이 시작 시각 순서로 매긴다', () => {
    const shuffled = weekdayClass([{ days: ['mon'], periods: [...weekdayPeriods].reverse() }]);
    const { status } = decide('월 10:29:59', '월 10:30:00', { timetables: [shuffled] });
    expect(status.periodNumber).toBe(2);
  });
});

describe('쓰는 시간표', () => {
  it('쓰는 시간표가 아닌 시간표의 시각에는 종이 울리지 않고, 현황도 쓰는 시간표를 따른다', () => {
    const result = decide('월 08:29:59', '월 08:30:00');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('before-first');
    expect(result.status.nextBell).toEqual({ kind: 'start', at: at('월 09:00:00') });
  });

  it('쓰는 시간표를 바꾸면 바꾼 시간표의 시각에 종이 울린다', () => {
    const result = decide('월 08:29:59', '월 08:30:00', { activeTimetable: 'saturday' });
    expect(result.bell).toBe('start');
    expect(result.status.kind).toBe('in-class');
    expect(decide('월 08:59:59', '월 09:00:00', { activeTimetable: 'saturday' }).bell).toBe('none');
  });

  it('시간표가 있어도 쓰는 시간표가 없으면 종이 없고 시간표 없음이다', () => {
    const result = decide('월 08:59:59', '월 09:00:00', { activeTimetable: null });
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-timetables');
    expect(result.keepAwake).toBe(false);
  });

  it('그 요일이 든 시간대가 없는 날은 수업 없는 날이고, 다른 요일의 시간대는 쓰지 않는다', () => {
    const result = decide('목 08:29:59', '목 08:30:00');
    expect(result.bell).toBe('none');
    expect(result.status.kind).toBe('no-class-day');
  });

  it('자정을 걸치면 날짜마다 그 요일이 든 시간대를 다시 찾는다', () => {
    const timetables = [
      weekdayClass([
        { days: ['tue'], periods: [period('23:00', '23:59')] },
        { days: ['wed'], periods: [period('00:00', '00:30')] },
      ]),
    ];
    // 화요일 시간대의 끝종과 수요일 시간대의 시작종이 한 구간에 들면 가장 최근인 수요일 시작종 하나만 울린다
    expect(decide('화 23:58:50', '수 00:00:10', { timetables }).bell).toBe('start');
    // 수요일 현황은 수요일 시간대만 본다
    const { status } = decide(null, '수 00:10:00', { timetables });
    expect(status).toMatchObject({ kind: 'in-class', periodNumber: 1, periodCount: 1 });
  });
});
