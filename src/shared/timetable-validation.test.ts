import { describe, expect, it } from 'vitest';
import { validatePeriods } from './timetable-validation';

/** 'HH:MM'을 자정부터의 분으로. */
function min(clock: string): number {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** 'HH:MM' 두 개로 수업 시간 하나를 만든다. */
function period(start: string, end: string) {
  return { start: min(start), end: min(end) };
}

/** 오류가 난 줄 번호와 규칙만 뽑는다. 문구는 따로 본다. */
function summarize(periods: { start: number; end: number }[]) {
  return validatePeriods(periods).map(({ index, rule }) => ({ index, rule }));
}

describe('validatePeriods', () => {
  it('규칙을 모두 지킨 수업 시간은 오류가 없다', () => {
    expect(validatePeriods([period('09:00', '09:50'), period('10:00', '10:50')])).toEqual([]);
  });

  it('수업 시간이 하나도 없는 시간표는 통과한다', () => {
    expect(validatePeriods([])).toEqual([]);
  });

  describe('끝은 시작보다 늦어야 한다', () => {
    it('끝이 시작보다 이르면 그 줄이 실패한다', () => {
      expect(summarize([period('09:00', '09:50'), period('11:00', '10:00')])).toEqual([
        { index: 1, rule: 'end-not-after-start' },
      ]);
    });

    it('끝이 시작과 같아도 실패한다', () => {
      expect(summarize([period('09:00', '09:00')])).toEqual([{ index: 0, rule: 'end-not-after-start' }]);
    });

    it('1분이라도 길면 통과한다', () => {
      expect(validatePeriods([period('09:00', '09:01')])).toEqual([]);
    });
  });

  describe('시각은 00:00~23:59다', () => {
    it('00:00 시작과 23:59 끝은 통과한다', () => {
      expect(validatePeriods([period('00:00', '00:10')])).toEqual([]);
      expect(validatePeriods([period('23:00', '23:59')])).toEqual([]);
    });

    it('24:00 이상이나 음수, 분 단위가 아닌 값은 그 줄이 실패한다', () => {
      expect(summarize([{ start: 23 * 60, end: 24 * 60 }])).toEqual([{ index: 0, rule: 'out-of-range' }]);
      expect(summarize([{ start: -1, end: 60 }])).toEqual([{ index: 0, rule: 'out-of-range' }]);
      expect(summarize([{ start: 60.5, end: 120 }])).toEqual([{ index: 0, rule: 'out-of-range' }]);
      expect(summarize([{ start: Number.NaN, end: 120 }])).toEqual([{ index: 0, rule: 'out-of-range' }]);
    });
  });

  describe('수업 시간이 겹치면 안 된다', () => {
    it('겹치는 두 줄이 모두 실패하고 서로의 시각을 이유로 든다', () => {
      const errors = validatePeriods([period('09:00', '10:00'), period('09:30', '10:30')]);
      expect(errors.map(({ index, rule }) => ({ index, rule }))).toEqual([
        { index: 0, rule: 'overlap' },
        { index: 1, rule: 'overlap' },
      ]);
      expect(errors[0]?.message).toContain('09:30~10:30');
      expect(errors[1]?.message).toContain('09:00~10:00');
    });

    it('앞 수업의 끝과 다음 수업의 시작이 같으면 겹침이 아니다', () => {
      expect(validatePeriods([period('09:00', '10:00'), period('10:00', '11:00')])).toEqual([]);
    });

    it('입력 순서가 시작 시각 순서가 아니어도 겹침을 찾는다', () => {
      expect(summarize([period('10:30', '11:30'), period('09:00', '10:45')])).toEqual([
        { index: 0, rule: 'overlap' },
        { index: 1, rule: 'overlap' },
      ]);
    });

    it('다른 수업을 통째로 품은 수업도 겹침이다', () => {
      expect(summarize([period('09:00', '12:00'), period('10:00', '11:00')])).toEqual([
        { index: 0, rule: 'overlap' },
        { index: 1, rule: 'overlap' },
      ]);
    });
  });

  describe('첫 시작부터 마지막 끝까지 12시간 이하여야 한다', () => {
    it('정확히 12시간은 통과한다', () => {
      expect(validatePeriods([period('08:00', '09:00'), period('19:00', '20:00')])).toEqual([]);
    });

    it('12시간에서 1분이라도 넘으면 가장 늦게 끝나는 줄이 실패한다', () => {
      expect(summarize([period('08:00', '09:00'), period('19:00', '20:01')])).toEqual([
        { index: 1, rule: 'too-long' },
      ]);
    });

    it('수업 하나가 12시간을 넘어도 실패한다', () => {
      expect(summarize([period('06:00', '18:01')])).toEqual([{ index: 0, rule: 'too-long' }]);
    });
  });

  it('한 줄이 시각 순서 오류면 그 줄은 다른 규칙 검사에서 뺀다', () => {
    // 11:00~10:00은 끝이 이르다는 오류만 받고, 09:00~10:30과 겹침으로 엮이지 않는다
    expect(summarize([period('09:00', '10:30'), period('11:00', '10:00')])).toEqual([
      { index: 1, rule: 'end-not-after-start' },
    ]);
  });

  it('오류는 규칙이 아니라 줄 번호 순서로 나온다', () => {
    expect(summarize([period('09:00', '10:00'), { start: -1, end: 60 }, period('09:30', '10:30')])).toEqual([
      { index: 0, rule: 'overlap' },
      { index: 1, rule: 'out-of-range' },
      { index: 2, rule: 'overlap' },
    ]);
  });

  it('이유 문구는 무엇이 안 됐는지와 무엇을 하면 되는지를 "~해요"로 말한다', () => {
    const [tooLong] = validatePeriods([period('06:00', '18:01')]);
    expect(tooLong?.message).toBe('첫 수업 시작부터 마지막 수업 끝까지 12시간을 넘을 수 없어요. 끝 시각을 앞당겨 주세요.');
    const [reversed] = validatePeriods([period('11:00', '10:00')]);
    expect(reversed?.message).toBe('끝 시각이 시작 시각보다 늦어야 해요. 끝 시각을 고쳐 주세요.');
  });
});
