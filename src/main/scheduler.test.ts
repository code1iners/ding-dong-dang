import { describe, expect, it } from 'vitest';
import { emptyData, type Timetable } from '../shared/data';
import { startScheduler, type SchedulerData } from './scheduler';

/** 2026-11-16(월) 현지 시각 h:m:s의 에포크 ms. */
function mon(h: number, m: number, s = 0): number {
  return new Date(2026, 10, 16, h, m, s).getTime();
}

/** 월요일 반. 1교시 09:00~09:50, 2교시 10:00~10:50, 3교시 13:00~13:50. */
const mondayClass: Timetable = {
  id: 'mon-class',
  name: '월요반',
  color: 0,
  periods: [
    { start: 9 * 60, end: 9 * 60 + 50 },
    { start: 10 * 60, end: 10 * 60 + 50 },
    { start: 13 * 60, end: 13 * 60 + 50 },
  ],
};

/** 월요일에 월요반을 배정한 저장 값. */
function mondayData(): SchedulerData {
  const data = emptyData();
  return { ...data, timetables: [mondayClass], weekdays: { ...data.weekdays, mon: mondayClass.id } };
}

/**
 * 가짜 부품을 끼운 스케줄러. 시각은 즉시 넘기고, 부품에 요청한 일을 `log`에 차례로 남긴다.
 * 가짜 종 재생기는 울리면 "울리는 중"이 되고, 멈추거나 `finishBell()`을 부르면 끝난다.
 */
function setup(startAt: number, initial: SchedulerData = mondayData()) {
  let now = startAt;
  let data = initial;
  let tick: (() => void) | null = null;
  let wake: (() => void) | null = null;
  let ringing = false;
  const log: string[] = [];

  const scheduler = startScheduler({
    now: () => now,
    everySecond(fn) {
      tick = fn;
      return () => {
        tick = null;
        log.push('timer stopped');
      };
    },
    onWake(fn) {
      wake = fn;
      return () => {
        wake = null;
      };
    },
    bell: {
      ring(kind) {
        ringing = true;
        log.push(`ring ${kind}`);
      },
      stop() {
        ringing = false;
        log.push('stop bell');
      },
      isRinging: () => ringing,
    },
    keepAwake: {
      start(mode) {
        log.push(`keep awake ${mode}`);
      },
      stop() {
        log.push('release awake');
      },
    },
    read: () => data,
  });

  return {
    scheduler,
    log,
    /** 1초 타이머가 도는 것처럼 to까지 1초씩 시각을 넘긴다. */
    runUntil(to: number) {
      while (now + 1000 <= to) {
        now += 1000;
        tick?.();
      }
    },
    /** 타이머 없이 시각만 옮긴다. 잠든 동안처럼 타이머가 멈춘 상황이다. */
    jumpTo(to: number) {
      now = to;
    },
    wake: () => wake?.(),
    hasTimer: () => tick !== null,
    setData(change: (d: SchedulerData) => SchedulerData) {
      data = change(data);
    },
    finishBell() {
      ringing = false;
    },
  };
}

describe('스케줄러', () => {
  it('종 시각에 시작종과 끝종 재생을 요청한다', () => {
    const s = setup(mon(8, 59, 50));
    s.runUntil(mon(9, 0, 0));
    expect(s.log.filter((l) => l.startsWith('ring'))).toEqual(['ring start']);
    s.finishBell();
    s.runUntil(mon(9, 50, 0));
    expect(s.log.filter((l) => l.startsWith('ring'))).toEqual(['ring start', 'ring end']);
  });

  it('깨어남 신호가 오면 1초를 기다리지 않고 판정한다', () => {
    const s = setup(mon(8, 59, 0));
    s.runUntil(mon(8, 59, 30));
    // 잠든 사이 타이머 없이 종 시각이 지나갔다. 깨어나자마자 30초 늦은 시작종을 울린다
    s.jumpTo(mon(9, 0, 30));
    s.wake();
    expect(s.log).toContain('ring start');
  });

  it('첫 수업 시작에 잠자기 막기를 시작하고 마지막 수업 끝에 해제한다', () => {
    const s = setup(mon(8, 59, 50));
    expect(s.log).toEqual([]);
    /** 잠자기 막기에 요청한 일만. */
    const awake = () => s.log.filter((l) => l.startsWith('keep') || l.startsWith('release'));
    s.runUntil(mon(9, 0, 0));
    expect(awake()).toEqual(['keep awake system']);
    // 쉬는 시간에도 이어서 막고, 다시 부르지 않는다
    s.runUntil(mon(13, 49, 59));
    expect(awake()).toEqual(['keep awake system']);
    s.runUntil(mon(13, 50, 0));
    expect(awake()).toEqual(['keep awake system', 'release awake']);
  });

  it('"수업 중 화면 켜 두기"가 켜져 있으면 화면 꺼짐도 막고, 바꾸면 바로 종류를 바꾼다', () => {
    const data = mondayData();
    const s = setup(mon(9, 30, 0), { ...data, settings: { ...data.settings, keepScreenOn: true } });
    expect(s.log).toEqual(['keep awake display']);
    s.setData((d) => ({ ...d, settings: { ...d.settings, keepScreenOn: false } }));
    s.scheduler.check();
    expect(s.log).toEqual(['keep awake display', 'release awake', 'keep awake system']);
  });

  it('울리는 중에 다음 종이 오면 앞의 종을 끊고 새 종을 울린다', () => {
    const s = setup(mon(9, 49, 50));
    s.runUntil(mon(9, 50, 0));
    // 끝종이 다 울리기 전에 다음 시작종 시각이 왔다
    s.runUntil(mon(10, 0, 0));
    expect(s.log.filter((l) => !l.startsWith('keep') && !l.startsWith('release'))).toEqual([
      'ring end',
      'stop bell',
      'ring start',
    ]);
  });

  it('앞의 종이 다 울린 뒤에 온 종은 멈춤 없이 울린다', () => {
    const s = setup(mon(9, 49, 50));
    s.runUntil(mon(9, 50, 0));
    s.finishBell();
    s.runUntil(mon(10, 0, 0));
    expect(s.log).not.toContain('stop bell');
  });

  it('오늘만 끄기를 켜면 울리던 종을 멈추고 잠자기 막기를 푼다', () => {
    const s = setup(mon(8, 59, 50));
    s.runUntil(mon(9, 0, 3));
    expect(s.log).toEqual(['ring start', 'keep awake system']);
    s.setData((d) => ({ ...d, bellsOffDate: '2026-11-16' }));
    s.scheduler.check();
    expect(s.log).toEqual(['ring start', 'keep awake system', 'stop bell', 'release awake']);
    // 그날의 다음 종은 울리지 않는다
    s.runUntil(mon(9, 50, 0));
    expect(s.log.filter((l) => l.startsWith('ring'))).toEqual(['ring start']);
  });

  it('저장된 시간표나 요일 배정이 바뀌면 다음 판정부터 새 값을 쓴다', () => {
    const s = setup(mon(9, 55, 0));
    // 2교시 시작을 09:57로 앞당겨 저장하면 그 시각에 시작종이 울린다
    s.setData((d) => ({
      ...d,
      timetables: [
        {
          ...mondayClass,
          periods: mondayClass.periods.map((p, i) => (i === 1 ? { ...p, start: 9 * 60 + 57 } : p)),
        },
      ],
    }));
    s.runUntil(mon(9, 57, 0));
    expect(s.log).toContain('ring start');
    // 월요일 배정을 없음으로 바꾸면 그다음 종은 울리지 않고 잠자기 막기도 푼다
    s.finishBell();
    s.setData((d) => ({ ...d, weekdays: { ...d.weekdays, mon: null } }));
    s.runUntil(mon(10, 50, 0));
    expect(s.log.filter((l) => l.startsWith('ring'))).toEqual(['ring start']);
    expect(s.log.at(-1)).toBe('release awake');
  });

  it('멈추면 타이머를 끄고 잠자기 막기를 푼다', () => {
    const s = setup(mon(9, 30, 0));
    s.scheduler.stop();
    expect(s.hasTimer()).toBe(false);
    expect(s.log).toEqual(['keep awake system', 'timer stopped', 'release awake']);
  });

  it('앱을 켠 직후의 첫 판정은 막 지난 종을 울리지 않는다', () => {
    const s = setup(mon(9, 0, 20));
    s.runUntil(mon(9, 0, 30));
    expect(s.log.filter((l) => l.startsWith('ring'))).toEqual([]);
  });
});
