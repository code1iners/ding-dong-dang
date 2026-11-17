import { WEEKDAYS, type Weekday } from '../../shared/data';

/** 요일 동그라미에 쓰는 한 글자 이름. */
export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

/** 요일의 전체 이름. 마우스를 올렸을 때와 화면 읽기에 쓴다. */
export function weekdayName(day: Weekday): string {
  return `${WEEKDAY_SHORT[day]}요일`;
}

/** 지금 PC의 현지 요일. */
export function todayWeekday(now: Date = new Date()): Weekday {
  // Date.getDay()는 일요일이 0이다
  return WEEKDAYS[(now.getDay() + 6) % 7]!;
}
