import { clockParts } from '../../shared/period-edit';
import { WEEKDAYS, type TimetableSlot, type Weekday } from '../../shared/data';

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

/**
 * 시간대 탭과 목록 카드에 쓰는 요일 요약. 월요일부터 이어진 요일이 사흘 이상이면 "월~금"처럼 물결로 묶고,
 * 그보다 짧으면 한 글자씩 " · "로 잇는다. 일곱 요일이 모두면 "매일", 하나도 없으면 "요일 없음"이다.
 */
export function daysSummary(days: readonly Weekday[]): string {
  /** 월요일부터의 순서로 고른 요일. */
  const picked = WEEKDAYS.filter((d) => days.includes(d));
  if (picked.length === 0) return '요일 없음';
  if (picked.length === WEEKDAYS.length) return '매일';
  /** 이어진 요일 묶음. 각 묶음은 WEEKDAYS 순서로 붙어 있다. */
  const runs: Weekday[][] = [];
  for (const day of picked) {
    /** 지금까지의 마지막 묶음. */
    const last = runs.at(-1);
    // 앞 요일 바로 다음 요일이면 그 묶음에 잇고, 아니면 새 묶음을 연다
    if (last && WEEKDAYS.indexOf(last.at(-1)!) + 1 === WEEKDAYS.indexOf(day)) last.push(day);
    else runs.push([day]);
  }
  return runs
    .flatMap((run) => (run.length >= 3 ? [`${WEEKDAY_SHORT[run[0]!]}~${WEEKDAY_SHORT[run.at(-1)!]}`] : run.map((d) => WEEKDAY_SHORT[d])))
    .join(' · ');
}

/** 자정부터의 분을 'HH:MM'으로. */
function clock(minutes: number): string {
  /** 'HHMM' 네 자리. */
  const parts = clockParts(minutes);
  return `${parts.slice(0, 2)}:${parts.slice(2)}`;
}

/** 목록 카드의 시간대 한 줄. "월~금 6교시 · 09:00~15:50"처럼 요일 요약, 교시 수, 첫 시작~마지막 끝이다. */
export function slotSummary(slot: TimetableSlot): string {
  /** 시간대의 수업 시간. */
  const { periods } = slot;
  if (periods.length === 0) return `${daysSummary(slot.days)} 수업 시간 없음`;
  /** 첫 수업의 시작. */
  const first = Math.min(...periods.map((p) => p.start));
  /** 마지막 수업의 끝. */
  const last = Math.max(...periods.map((p) => p.end));
  return `${daysSummary(slot.days)} ${periods.length}교시 · ${clock(first)}~${clock(last)}`;
}
