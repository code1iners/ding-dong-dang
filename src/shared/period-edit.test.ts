import { describe, expect, it } from 'vitest';
import { arcOf, clockParts, nextPeriod, periodRanks, sortByStart, timeFromEntry, typeEntryDigit } from './period-edit';

describe('periodRanks', () => {
  it('교시 번호는 시작 시각 순서다', () => {
    const rows = [{ start: 600, end: 650 }, { start: 540, end: 590 }, { start: 660, end: 700 }];
    expect(periodRanks(rows)).toEqual([2, 1, 3]);
  });

  it('시작 시각이 같으면 입력 순서로 매긴다', () => {
    expect(periodRanks([{ start: 540, end: 590 }, { start: 540, end: 560 }])).toEqual([1, 2]);
  });
});

describe('sortByStart', () => {
  it('시작 시각 순으로 정렬하고 같으면 처음 순서를 지킨다', () => {
    const rows = [{ start: 600, end: 1 }, { start: 540, end: 2 }, { start: 540, end: 3 }];
    expect(sortByStart(rows).map((r) => r.end)).toEqual([2, 3, 1]);
  });
});

describe('nextPeriod', () => {
  it('수업 시간이 없으면 09:00~09:50이다', () => {
    expect(nextPeriod([])).toEqual({ start: 540, end: 590 });
  });

  it('가장 늦은 끝에서 10분 쉰 뒤 50분이다', () => {
    expect(nextPeriod([{ start: 540, end: 590 }, { start: 600, end: 650 }])).toEqual({ start: 660, end: 710 });
  });

  it('하루를 넘기지 않게 23:59에서 멈춘다', () => {
    expect(nextPeriod([{ start: 1300, end: 1420 }])).toEqual({ start: 1430, end: 1439 });
  });
});

describe('clockParts', () => {
  it('시와 분을 두 자리씩 나눈다', () => {
    expect(clockParts(9 * 60 + 5)).toBe('0905');
    expect(clockParts(1439)).toBe('2359');
  });

  it('24시간을 넘는 값도 잘못된 시각으로 보여 준다', () => {
    expect(clockParts(25 * 60)).toBe('2500');
  });
});

describe('typeEntryDigit', () => {
  it('처음 누른 숫자는 이전 값을 지우고 새로 시작한다', () => {
    expect(typeEntryDigit(null, '1')).toBe('1');
  });

  it('이어 누르면 네 자리까지 쌓는다', () => {
    expect(typeEntryDigit('1', '1')).toBe('11');
    expect(typeEntryDigit('1110', '5')).toBe('1110');
  });

  it('분의 십의 자리는 5까지만 받는다', () => {
    expect(typeEntryDigit('11', '6')).toBe('11');
    expect(typeEntryDigit('11', '5')).toBe('115');
  });
});

describe('timeFromEntry', () => {
  it('네 자리를 분으로 바꾼다', () => {
    expect(timeFromEntry('1110')).toBe(11 * 60 + 10);
  });

  it('모자라면 앞을 0으로 채운다', () => {
    expect(timeFromEntry('930')).toBe(9 * 60 + 30);
    expect(timeFromEntry('9')).toBe(9);
  });

  it('24시 이상은 그대로 두어 검증이 잘못된 시각으로 알리게 한다', () => {
    expect(timeFromEntry('2500')).toBe(25 * 60);
  });

  it('비었으면 null이다', () => {
    expect(timeFromEntry('')).toBeNull();
  });
});

describe('arcOf', () => {
  it('12시간 시계판 위의 각도로 호를 돌려준다', () => {
    // 3시~6시는 시계판 오른쪽에서 아래까지 90도다(화면 좌표라 아래가 +y)
    const arc = arcOf({ start: 3 * 60, end: 6 * 60 }, 100);
    expect(arc?.large).toBe(false);
    expect(arc?.from.x).toBeCloseTo(100, 5);
    expect(arc?.from.y).toBeCloseTo(0, 5);
    expect(arc?.to.x).toBeCloseTo(0, 5);
    expect(arc?.to.y).toBeCloseTo(100, 5);
  });

  it('6시간을 넘으면 큰 호다', () => {
    expect(arcOf({ start: 0, end: 7 * 60 }, 100)?.large).toBe(true);
  });

  it('오후는 12시간을 빼서 같은 자리에 그린다', () => {
    const pm = arcOf({ start: 13 * 60, end: 14 * 60 }, 100);
    const am = arcOf({ start: 60, end: 120 }, 100);
    expect(pm?.mid.x).toBeCloseTo(am!.mid.x, 5);
    expect(pm?.mid.y).toBeCloseTo(am!.mid.y, 5);
  });

  it('정확히 12시간은 검증을 통과하므로 한 바퀴로 그린다', () => {
    expect(arcOf({ start: 9 * 60, end: 21 * 60 }, 100)?.full).toBe(true);
    expect(arcOf({ start: 0, end: 12 * 60 + 1 }, 100)).toBeNull();
  });

  it('잘못된 시각은 그리지 않는다', () => {
    expect(arcOf({ start: 600, end: 600 }, 100)).toBeNull();
    expect(arcOf({ start: 700, end: 600 }, 100)).toBeNull();
    expect(arcOf({ start: 0, end: 1500 }, 100)).toBeNull();
  });
});
