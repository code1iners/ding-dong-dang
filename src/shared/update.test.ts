import { describe, expect, it } from 'vitest';
import { decideBell } from './bell-decision';
import { justUpdatedText, readyVersion, untilNextBellText, upcomingBellAt, updateLocked, updateTimingAt } from './update';

/** 기준 시각. */
const NOW = Date.UTC(2026, 10, 16, 0, 0);
/** 분을 밀리초로. */
const min = (n: number) => n * 60_000;

describe('"업데이트" 단추 잠금', () => {
  it('다음 종까지 2분이 안 남았으면 잠근다', () => {
    expect(updateLocked({ nextBellAt: NOW + min(2) - 1, ringing: false, now: NOW })).toBe(true);
    expect(updateLocked({ nextBellAt: NOW + 30_000, ringing: false, now: NOW })).toBe(true);
  });

  it('다음 종까지 2분이 남았거나 더 남았으면 잠그지 않는다', () => {
    expect(updateLocked({ nextBellAt: NOW + min(2), ringing: false, now: NOW })).toBe(false);
    expect(updateLocked({ nextBellAt: NOW + min(23), ringing: false, now: NOW })).toBe(false);
  });

  it('종이 울리는 중이면 다음 종과 상관없이 잠근다', () => {
    expect(updateLocked({ nextBellAt: null, ringing: true, now: NOW })).toBe(true);
    expect(updateLocked({ nextBellAt: NOW + min(40), ringing: true, now: NOW })).toBe(true);
  });

  it('오늘 남은 종이 없고 울리지 않으면 잠그지 않는다', () => {
    expect(updateLocked({ nextBellAt: null, ringing: false, now: NOW })).toBe(false);
  });
});

describe('확인 모달의 다음 종까지 남은 시간', () => {
  it('한 시간 미만은 분으로 쓰고 초는 버린다', () => {
    expect(untilNextBellText(NOW + min(23), NOW)).toBe('다음 종까지 23분 남았어요.');
    expect(untilNextBellText(NOW + min(23) + 59_000, NOW)).toBe('다음 종까지 23분 남았어요.');
  });

  it('한 시간 이상은 시간과 분으로 쓰고, 0분은 쓰지 않는다', () => {
    expect(untilNextBellText(NOW + min(72), NOW)).toBe('다음 종까지 1시간 12분 남았어요.');
    expect(untilNextBellText(NOW + min(120), NOW)).toBe('다음 종까지 2시간 남았어요.');
  });

  it('오늘 남은 종이 없으면 그렇게 말한다', () => {
    expect(untilNextBellText(null, NOW)).toBe('오늘은 남은 종이 없어요.');
  });
});

describe('잠금에 쓰는 다음 종 시각', () => {
  /** 오늘 13:00에 시작하는 수업 하나가 든 판정 입력. 2026-11-16은 월요일이다. */
  const input = (bellsOffDate: string | null) => ({
    timetables: [{ id: 't', name: '평일반', color: 0, periods: [{ start: 13 * 60, end: 13 * 60 + 50 }] }],
    weekdays: { mon: 't', tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    bellsOffDate,
    lastChecked: null,
    now: new Date(2026, 10, 16, 12, 59).getTime(),
  });

  it('오늘 남은 가장 가까운 종의 시각이다', () => {
    expect(upcomingBellAt(decideBell(input(null)))).toBe(new Date(2026, 10, 16, 13, 0).getTime());
  });

  it('오늘 종을 껐으면 울릴 종이 없으니 null이다', () => {
    expect(upcomingBellAt(decideBell(input('2026-11-16')))).toBeNull();
  });
});

describe('다시 켜진 뒤의 알림 문장', () => {
  it('마지막 숫자를 읽는 소리에 맞춰 "으로"와 "로"를 고른다', () => {
    expect(justUpdatedText('1.3.0')).toBe('1.3.0으로 업데이트했어요');
    expect(justUpdatedText('0.2.3')).toBe('0.2.3으로 업데이트했어요');
    expect(justUpdatedText('0.1.6')).toBe('0.1.6으로 업데이트했어요');
    expect(justUpdatedText('0.2.1')).toBe('0.2.1로 업데이트했어요');
    expect(justUpdatedText('0.2.7')).toBe('0.2.7로 업데이트했어요');
    expect(justUpdatedText('0.2.9')).toBe('0.2.9로 업데이트했어요');
  });
});

describe('지금 시각의 업데이트 잠금', () => {
  /** 오늘 13:00에 시작하는 수업 하나. 2026-11-16은 월요일이다. */
  const schedule = {
    timetables: [{ id: 't', name: '평일반', color: 0, periods: [{ start: 13 * 60, end: 13 * 60 + 50 }] }],
    weekdays: { mon: 't', tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    bellsOffDate: null,
  };
  /** 오늘 13:00. */
  const bellAt = new Date(2026, 10, 16, 13, 0).getTime();

  it('시간표에서 다음 종을 찾아 2분이 안 남았으면 잠근다', () => {
    expect(updateTimingAt(schedule, false, bellAt - min(1))).toEqual({ locked: true, nextBellAt: bellAt });
    expect(updateTimingAt(schedule, false, bellAt - min(23))).toEqual({ locked: false, nextBellAt: bellAt });
  });

  it('오늘 종을 껐으면 다음 종이 없어 잠그지 않는다', () => {
    expect(updateTimingAt({ ...schedule, bellsOffDate: '2026-11-16' }, false, bellAt - min(1))).toEqual({ locked: false, nextBellAt: null });
  });
});

describe('준비된 새 버전', () => {
  it('준비됨과 설치 중에만 있다', () => {
    expect(readyVersion({ kind: 'ready', version: '1.3.0' })).toBe('1.3.0');
    expect(readyVersion({ kind: 'installing', version: '1.3.0' })).toBe('1.3.0');
    expect(readyVersion({ kind: 'downloading', version: '1.3.0' })).toBeNull();
    expect(readyVersion({ kind: 'up-to-date' })).toBeNull();
  });
});
