// e2e의 시간표 준비 데이터와 저장 파일 읽기를 한 곳에 모은다.
// 저장 파일의 시간표 모양(지금은 시간표마다 `slots`, 그리고 `activeTimetable`)은 이 파일만 안다. 입력과 출력은 "이름 · 요일 · 수업 시간"으로 두어
// 저장 모양이 바뀌어도 e2e는 이 파일만 고치면 된다.
import { emptyData, WEEKDAYS, type Data, type Weekday } from '../src/shared/data';

/** 시간대 하나. 같은 수업 시간을 쓰는 요일들이다. */
export type SlotSpec = {
  days: readonly Weekday[];
  /** 수업 시간. 자정부터의 분이다. */
  periods: readonly { start: number; end: number }[];
};

/** 준비할 시간표 하나. 시간대가 하나면 `days`와 `periods`로, 여럿이면 `slots`로 준다. */
export type TimetableSpec = {
  /** 저장 파일의 id. 없으면 `t0`, `t1`… 순서로 정한다. */
  id?: string;
  name: string;
  /** 0~7. 없으면 만든 순서대로 배정한다. */
  color?: number;
} & (SlotSpec | { slots: readonly SlotSpec[] });

/** 읽어 낸 시간표 하나. */
export type SavedTimetable = {
  id: string;
  name: string;
  color: number;
  /** 종이 따르는 시간표인지. */
  active: boolean;
  /** 모든 시간대의 요일을 월요일부터. */
  days: Weekday[];
  slots: { days: Weekday[]; periods: { start: number; end: number }[] }[];
};

/** 오늘의 요일 키. `Date.getDay()`는 일요일이 0이다. */
export function weekdayOf(date: Date = new Date()): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]!;
}

/** 오늘이 아닌 요일 하나. */
export function weekdayOtherThan(day: Weekday): Weekday {
  return WEEKDAYS.find((d) => d !== day)!;
}

/** 준비할 시간표의 시간대 목록. */
function slotsOf(spec: TimetableSpec): readonly SlotSpec[] {
  return 'slots' in spec ? spec.slots : [spec];
}

/**
 * 시간표들을 담은 저장 데이터를 만든다. `base`를 주면 그 위에 시간표만 얹는다.
 * 종은 쓰는 시간표 하나만 따른다. `active`를 주지 않으면 첫 시간표가 쓰는 시간표이고, null이면 쓰는 시간표가 없다.
 */
export function dataWith(specs: readonly TimetableSpec[], base: Data = emptyData(), active?: string | null): Data {
  const timetables = specs.map((spec, i) => ({
    id: spec.id ?? `t${i}`,
    name: spec.name,
    color: spec.color ?? i % 8,
    slots: slotsOf(spec).map((slot) => ({ days: [...slot.days], periods: slot.periods.map((p) => ({ ...p })) })),
  }));
  return {
    ...base,
    timetables,
    nextColor: specs.length % 8,
    activeTimetable: active === undefined ? (timetables[0]?.id ?? null) : active,
  };
}

/** 시간표 부분만 담은 조각. `{ ...emptyData(), ...timetableFields([...]) }`처럼 펼쳐 쓴다. */
export function timetableFields(specs: readonly TimetableSpec[], active?: string | null): Pick<Data, 'timetables' | 'activeTimetable'> {
  const { timetables, activeTimetable } = dataWith(specs, emptyData(), active);
  return { timetables, activeTimetable };
}

/** 저장 파일 내용에서 시간표들을 읽는다. */
export function timetablesOf(data: Data): SavedTimetable[] {
  return data.timetables.map((t) => {
    /** 어느 시간대에든 든 요일. */
    const days = new Set(t.slots.flatMap((s) => s.days));
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      active: data.activeTimetable === t.id,
      days: WEEKDAYS.filter((d) => days.has(d)),
      slots: t.slots,
    };
  });
}

/**
 * 버전 1 저장 파일(요일마다 시간표 하나를 배정하던 형태)의 내용. 올려 쓰기를 확인할 때만 쓴다.
 * 시간표 하나를 `days`에 배정하고, 시간표 밖의 값은 `base`를 따른다.
 */
export function version1Data(spec: SlotSpec & { name: string }, base: Data = emptyData()): Record<string, unknown> {
  const data: Record<string, unknown> = {
    ...base,
    version: 1,
    timetables: [{ id: 't0', name: spec.name, color: 0, periods: spec.periods.map((p) => ({ ...p })) }],
    nextColor: 1,
    weekdays: Object.fromEntries(WEEKDAYS.map((d) => [d, spec.days.includes(d) ? 't0' : null])),
  };
  // 버전 1에는 쓰는 시간표가 없다
  delete data.activeTimetable;
  return data;
}
