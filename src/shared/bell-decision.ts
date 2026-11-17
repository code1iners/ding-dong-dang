import type { Timetable, Weekday } from './data';

/** 종의 종류. 수업 시간이 시작될 때의 시작종과 끝날 때의 끝종. */
export type BellKind = 'start' | 'end';

/** 현황 화면의 여섯 상태. DESIGN.md의 "현황" 표와 같다. */
export type StatusKind = 'in-class' | 'break' | 'before-first' | 'after-last' | 'no-class-day' | 'no-timetables';

export type BellStatus = {
  kind: StatusKind;
  /** 지금 수업 중인 교시 번호(1부터). 수업 중이 아니면 null. */
  periodNumber: number | null;
  /** 오늘 시간표의 교시 수. 수업 없는 날과 시간표가 없을 때는 0. */
  periodCount: number;
  /** 지금까지 끝난 교시 수. 발바닥 도장의 "지난 교시"다. 수업 없는 날과 시간표가 없을 때는 0. */
  periodsDone: number;
  /** 오늘 남은 종 가운데 가장 가까운 것. 없으면 null. */
  nextBell: { kind: BellKind; at: number } | null;
  /** 고리가 줄어드는 지금 구간(에포크 ms). 수업 중과 쉬는 시간에만 있다. */
  segment: { start: number; end: number } | null;
};

export type BellDecisionInput = {
  timetables: readonly Timetable[];
  weekdays: Readonly<Record<Weekday, string | null>>;
  /** 오늘만 끄기를 켠 현지 날짜 'YYYY-MM-DD'. */
  bellsOffDate: string | null;
  /** 지난번 확인한 시각(에포크 ms). 앱을 막 켰으면 null. */
  lastChecked: number | null;
  /** 지금 시각(에포크 ms). */
  now: number;
};

export type BellDecision = {
  /** 지금 울릴 종. 없으면 'none'. */
  bell: BellKind | 'none';
  status: BellStatus;
  /** 방치로 인한 잠자기를 막아야 하는지. */
  keepAwake: boolean;
  /** 지금 오늘만 끄기 중인지. 스케줄러가 이 값으로 울리던 종을 멈춘다. */
  bellsOff: boolean;
};

/** 늦게 확인했을 때 지난 종을 아직 울려 주는 한도. 정확히 이 길이만큼 늦은 종까지 울린다. */
const LATE_LIMIT_MS = 60_000;

/** Date.getDay()(일요일 0)에 맞춘 요일 키. */
const WEEKDAY_BY_DAY: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** 울릴 시각이 정해진 종 하나. `at`은 에포크 ms. */
type Bell = { kind: BellKind; at: number };

/** 종도 구간도 없는 현황 값. 수업 없는 날과 시간표 없음이 같이 쓴다. */
const NO_LESSONS = { periodNumber: null, periodCount: 0, periodsDone: 0, nextBell: null, segment: null } as const;

/** 현지 날짜 'YYYY-MM-DD'. 오늘만 끄기의 끈 날짜와 견주는 형식이다. */
export function localDate(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 그 시각이 속한 현지 날짜의 시간표. 배정이 없거나 목록에 없는 id면 null. */
function timetableOn(input: BellDecisionInput, at: number): Timetable | null {
  // getDay()는 항상 0~6이라 표에 빈 칸이 없다
  const id = input.weekdays[WEEKDAY_BY_DAY[new Date(at).getDay()] as Weekday];
  return input.timetables.find((t) => t.id === id) ?? null;
}

/** 그 시각이 속한 현지 날짜의 자정에서 minutes분 뒤(에포크 ms). */
function atMinuteOfDay(at: number, minutes: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime();
}

/** 시작 시각 순서로 정렬한 그 날의 수업 시간(에포크 ms). */
function periodsOn(timetable: Timetable | null, at: number): { start: number; end: number }[] {
  if (!timetable) return [];
  return timetable.periods
    .map((p) => ({ start: atMinuteOfDay(at, p.start), end: atMinuteOfDay(at, p.end) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * 수업 시간 목록에서 그 날의 종 목록을 시각순으로 만든다.
 * 끝과 시작이 같은 시각에 겹치는 끝종은 빼고 시작종만 남긴다.
 */
function bellsOf(periods: readonly { start: number; end: number }[]): Bell[] {
  const starts = new Set(periods.map((p) => p.start));
  const bells: Bell[] = [...starts].map((at) => ({ kind: 'start', at }));
  for (const p of periods) {
    if (!starts.has(p.end)) bells.push({ kind: 'end', at: p.end });
  }
  return bells.sort((a, b) => a.at - b.at);
}

/** 지난번 확인 이후 지금까지 울려야 할 종 하나를 정한다. 없으면 null. */
function bellToRing(input: BellDecisionInput): BellKind | null {
  const { lastChecked, now } = input;
  if (lastChecked === null || now <= lastChecked) return null;

  // 60초보다 오래된 종은 어차피 버리므로 [now-60초, now]가 걸치는 날짜(어제와 오늘)만 본다
  const dayStarts = new Set([atMinuteOfDay(now - LATE_LIMIT_MS, 0), atMinuteOfDay(now, 0)]);
  let latest: Bell | null = null;
  for (const dayStart of dayStarts) {
    // 종 시각마다 그 날짜의 요일 배정과 끈 날짜를 쓴다
    if (localDate(dayStart) === input.bellsOffDate) continue;
    for (const bell of bellsOf(periodsOn(timetableOn(input, dayStart), dayStart))) {
      if (bell.at <= lastChecked || bell.at > now) continue;
      if (!latest || bell.at > latest.at) latest = bell;
    }
  }
  if (!latest || now - latest.at > LATE_LIMIT_MS) return null;
  return latest.kind;
}

/** 지금 시각의 현황. 오늘 시간표의 수업 시간 사이에서 지금이 어디인지 가려낸다. */
function statusAt(input: BellDecisionInput): BellStatus {
  const { now } = input;
  if (input.timetables.length === 0) {
    return { kind: 'no-timetables', ...NO_LESSONS };
  }
  const periods = periodsOn(timetableOn(input, now), now);
  const first = periods[0];
  if (!first) {
    return { kind: 'no-class-day', ...NO_LESSONS };
  }

  const periodCount = periods.length;
  const nextBell = bellsOf(periods).find((bell) => bell.at > now) ?? null;
  const index = periods.findIndex((p) => p.start <= now && now < p.end);
  const current = periods[index];
  if (current) {
    return { kind: 'in-class', periodNumber: index + 1, periodCount, periodsDone: index, nextBell, segment: current };
  }
  if (now < first.start) {
    return { kind: 'before-first', periodNumber: null, periodCount, periodsDone: 0, nextBell, segment: null };
  }
  const last = periods.reduce((latestEnd, p) => Math.max(latestEnd, p.end), 0);
  if (now >= last) {
    return { kind: 'after-last', periodNumber: null, periodCount, periodsDone: periodCount, nextBell: null, segment: null };
  }
  // 수업 시간 사이: 방금 끝난 수업의 끝부터 다음 수업의 시작까지가 쉬는 시간이다
  const previousEnd = Math.max(...periods.filter((p) => p.end <= now).map((p) => p.end));
  const nextStart = Math.min(...periods.filter((p) => p.start > now).map((p) => p.start));
  return {
    kind: 'break',
    periodNumber: null,
    periodCount,
    periodsDone: periods.filter((p) => p.end <= now).length,
    nextBell,
    segment: { start: previousEnd, end: nextStart },
  };
}

/**
 * 시각을 값으로 받아 지금 울릴 종, 현황, 잠자기를 막아야 하는지를 정한다.
 * 시계와 타이머를 모르는 순수 함수라서 어떤 시각이든 즉시 넣어 볼 수 있다.
 */
export function decideBell(input: BellDecisionInput): BellDecision {
  const status = statusAt(input);
  // 오늘만 끄기 중에도 현황은 시간표대로이고, 꺼진 것은 종과 잠자기 막기뿐이다
  const bellsOff = localDate(input.now) === input.bellsOffDate;
  const duringLessons = status.kind === 'in-class' || status.kind === 'break';
  return {
    bell: bellToRing(input) ?? 'none',
    status,
    keepAwake: duringLessons && !bellsOff,
    bellsOff,
  };
}
