import { describe, expect, it } from 'vitest';
import type { BellStatus } from './bell-decision';
import { formatRemaining, pawStates, remainingFraction, ringDogAction } from './status-view';

describe('formatRemaining', () => {
  it('한 시간 미만이면 분:초이고 두 자리로 채운다', () => {
    expect(formatRemaining(31 * 60_000 + 11_000)).toBe('31:11');
    expect(formatRemaining(4 * 60_000)).toBe('04:00');
    expect(formatRemaining(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('한 시간 이상이면 시:분:초이고 시는 채우지 않는다', () => {
    expect(formatRemaining(3_600_000)).toBe('1:00:00');
    expect(formatRemaining(72 * 60_000)).toBe('1:12:00');
    expect(formatRemaining(10 * 3_600_000 + 5 * 60_000 + 9_000)).toBe('10:05:09');
  });

  it('1초 미만 남았으면 올림해 00:01로 보이고, 종 시각에야 00:00이 된다', () => {
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(999)).toBe('00:01');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(-500)).toBe('00:00');
  });
});

describe('remainingFraction', () => {
  const segment = { start: 1000_000, end: 1000_000 + 50 * 60_000 };

  it('구간의 시작에서는 1, 가운데서는 0.5, 끝에서는 0이다', () => {
    expect(remainingFraction(segment, segment.start)).toBe(1);
    expect(remainingFraction(segment, segment.start + 25 * 60_000)).toBe(0.5);
    expect(remainingFraction(segment, segment.end)).toBe(0);
  });

  it('구간 밖이거나 구간이 없으면 범위 안으로 맞추고 없으면 0이다', () => {
    expect(remainingFraction(segment, segment.start - 5)).toBe(1);
    expect(remainingFraction(segment, segment.end + 5)).toBe(0);
    expect(remainingFraction(null, segment.start)).toBe(0);
    expect(remainingFraction({ start: 5, end: 5 }, 5)).toBe(0);
  });
});

describe('pawStates', () => {
  /** 필요한 값만 채운 현황. */
  function status(patch: Partial<BellStatus>): BellStatus {
    return { kind: 'in-class', periodNumber: null, periodCount: 0, periodsDone: 0, nextBell: null, segment: null, ...patch };
  }

  it('수업 중이면 지난 교시, 지금 교시, 남은 교시로 나눈다', () => {
    expect(pawStates(status({ periodNumber: 3, periodCount: 6, periodsDone: 2 }))).toEqual([
      'done', 'done', 'current', 'left', 'left', 'left',
    ]);
  });

  it('쉬는 시간에는 지금 교시가 없고 끝난 만큼만 지난 교시다', () => {
    expect(pawStates(status({ kind: 'break', periodCount: 4, periodsDone: 2 }))).toEqual(['done', 'done', 'left', 'left']);
  });

  it('첫 수업 전은 모두 남았고 마지막 수업 뒤는 모두 지났다', () => {
    expect(pawStates(status({ kind: 'before-first', periodCount: 2 }))).toEqual(['left', 'left']);
    expect(pawStates(status({ kind: 'after-last', periodCount: 2, periodsDone: 2 }))).toEqual(['done', 'done']);
  });

  it('수업 없는 날과 시간표 없음에는 도장이 없다', () => {
    expect(pawStates(status({ kind: 'no-class-day' }))).toEqual([]);
    expect(pawStates(status({ kind: 'no-timetables' }))).toEqual([]);
  });
});

describe('ringDogAction: 고리 안 강아지의 동작(DESIGN.md "현황" 표)', () => {
  it('수업 중, 쉬는 시간, 시간표가 하나도 없음은 평소다', () => {
    expect(ringDogAction('in-class', { ringing: false, petted: false })).toBe('idle');
    expect(ringDogAction('break', { ringing: false, petted: false })).toBe('idle');
    expect(ringDogAction('no-timetables', { ringing: false, petted: false })).toBe('idle');
  });

  it('첫 수업 전, 마지막 수업 뒤, 수업 없는 날은 졸림이다', () => {
    expect(ringDogAction('before-first', { ringing: false, petted: false })).toBe('sleepy');
    expect(ringDogAction('after-last', { ringing: false, petted: false })).toBe('sleepy');
    expect(ringDogAction('no-class-day', { ringing: false, petted: false })).toBe('sleepy');
  });

  it('종이 울리는 동안과 누른 뒤 잠깐은 어느 상태든 신남이다', () => {
    expect(ringDogAction('after-last', { ringing: true, petted: false })).toBe('happy');
    expect(ringDogAction('in-class', { ringing: true, petted: false })).toBe('happy');
    expect(ringDogAction('no-class-day', { ringing: false, petted: true })).toBe('happy');
    expect(ringDogAction('break', { ringing: false, petted: true })).toBe('happy');
  });
});
