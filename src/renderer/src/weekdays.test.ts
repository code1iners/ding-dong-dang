import { describe, expect, it } from 'vitest';
import { daysSummary, slotSummary } from './weekdays';

describe('daysSummary', () => {
  it('요일이 없으면 "요일 없음"이다', () => {
    expect(daysSummary([])).toBe('요일 없음');
  });

  it('사흘 넘게 이어진 요일은 물결로 묶고, 하루는 그 요일 한 글자다', () => {
    expect(daysSummary(['mon', 'tue', 'wed', 'thu', 'fri'])).toBe('월~금');
    expect(daysSummary(['sat'])).toBe('토');
  });
});

describe('daysSummary의 묶음', () => {
  it('이틀만 이어지거나 떨어진 요일은 한 글자씩 잇는다', () => {
    expect(daysSummary(['sat', 'sun'])).toBe('토 · 일');
    expect(daysSummary(['fri', 'mon', 'wed'])).toBe('월 · 수 · 금');
  });

  it('묶음과 낱 요일이 섞여도 월요일부터의 순서다', () => {
    expect(daysSummary(['sun', 'mon', 'tue', 'wed'])).toBe('월~수 · 일');
  });

  it('일곱 요일이 모두면 "매일"이다', () => {
    expect(daysSummary(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBe('매일');
  });
});

describe('slotSummary', () => {
  it('요일 요약, 교시 수, 첫 시작~마지막 끝을 잇는다', () => {
    const periods = [
      { start: 15 * 60, end: 15 * 60 + 50 },
      { start: 9 * 60, end: 9 * 60 + 50 },
      { start: 10 * 60, end: 10 * 60 + 50 },
    ];
    expect(slotSummary({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], periods })).toBe('월~금 3교시 · 09:00~15:50');
  });

  it('수업 시간이 없으면 "수업 시간 없음"이다', () => {
    expect(slotSummary({ days: [], periods: [] })).toBe('요일 없음 수업 시간 없음');
  });
});
