// e2e의 시간표 준비 데이터와 저장 파일 읽기를 한 곳에 모은다.
// 저장 파일의 시간표 모양(지금은 `timetables`와 `weekdays`)은 이 파일만 안다. 입력과 출력은 "이름 · 요일 · 수업 시간"으로 두어
// 저장 모양이 바뀌어도 e2e는 이 파일만 고치면 된다.
import { emptyData, WEEKDAYS, type Data, type Weekday } from '../src/shared/data';

/** 준비할 시간표 하나. */
export type TimetableSpec = {
  /** 저장 파일의 id. 없으면 `t0`, `t1`… 순서로 정한다. */
  id?: string;
  name: string;
  /** 이 시간표로 종이 울리는 요일. */
  days: readonly Weekday[];
  /** 수업 시간. 자정부터의 분이다. */
  periods: readonly { start: number; end: number }[];
  /** 0~7. 없으면 만든 순서대로 배정한다. */
  color?: number;
};

/** 읽어 낸 시간표 하나. */
export type SavedTimetable = {
  id: string;
  name: string;
  color: number;
  days: Weekday[];
  periods: { start: number; end: number }[];
};

/** 오늘의 요일 키. `Date.getDay()`는 일요일이 0이다. */
export function weekdayOf(date: Date = new Date()): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]!;
}

/** 오늘이 아닌 요일 하나. */
export function weekdayOtherThan(day: Weekday): Weekday {
  return WEEKDAYS.find((d) => d !== day)!;
}

/**
 * 시간표들을 담은 저장 데이터를 만든다. `base`를 주면 그 위에 시간표만 얹는다.
 * 요일이 겹치면 뒤의 시간표가 이긴다.
 */
export function dataWith(specs: readonly TimetableSpec[], base: Data = emptyData()): Data {
  const data: Data = { ...base, weekdays: { ...base.weekdays } };
  data.timetables = specs.map((spec, i) => ({
    id: spec.id ?? `t${i}`,
    name: spec.name,
    color: spec.color ?? i % 8,
    periods: spec.periods.map((p) => ({ ...p })),
  }));
  data.nextColor = specs.length % 8;
  specs.forEach((spec, i) => {
    for (const day of spec.days) data.weekdays[day] = data.timetables[i]!.id;
  });
  return data;
}

/** 시간표 부분만 담은 조각. `{ ...emptyData(), ...timetableFields([...]) }`처럼 펼쳐 쓴다. */
export function timetableFields(specs: readonly TimetableSpec[]): Pick<Data, 'timetables' | 'weekdays'> {
  const { timetables, weekdays } = dataWith(specs);
  return { timetables, weekdays };
}

/** 저장 파일 내용에서 시간표들을 읽는다. */
export function timetablesOf(data: Data): SavedTimetable[] {
  return data.timetables.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    days: WEEKDAYS.filter((d) => data.weekdays[d] === t.id),
    periods: t.periods,
  }));
}
