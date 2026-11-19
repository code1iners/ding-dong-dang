import type { TimetableSlot } from './data';

/** 수업 시간 하나. 시작과 끝은 자정부터의 분이다. */
export type Period = TimetableSlot['periods'][number];

/** 한 줄 안에서 오류를 보여 주는 순서이기도 하다. */
const RULE_ORDER = ['out-of-range', 'end-not-after-start', 'overlap', 'too-long'] as const;
/** 어긴 규칙: 시각 범위, 끝이 시작보다 늦음, 겹침, 12시간 이하. */
export type PeriodRule = (typeof RULE_ORDER)[number];

export type PeriodError = {
  /** 입력 목록에서 잘못된 줄의 번호(0부터). */
  index: number;
  rule: PeriodRule;
  /** 그 줄 아래에 한 줄로 보여 줄 이유. */
  message: string;
};

/** 하루는 00:00~23:59, 자정부터의 분으로 0~1439다. */
const LAST_MINUTE = 24 * 60 - 1;
/** 첫 수업 시작부터 마지막 수업 끝까지 허용하는 길이(분). */
const MAX_SPAN = 12 * 60;

/** 00:00~23:59 안의 분 단위 정수인지. */
function isMinute(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= LAST_MINUTE;
}

/** 자정부터의 분을 'HH:MM'으로. */
function clock(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * 시간표의 수업 시간들을 검사해 잘못된 줄을 규칙별로 돌려준다. 자동으로 고치지 않는다.
 * 오류는 줄 번호 순, 같은 줄에서는 규칙 순서(범위, 끝과 시작, 겹침, 길이)다.
 * 시각이 잘못된 줄은 겹침과 길이 검사에서 뺀다. 그 줄의 시각을 믿을 수 없기 때문이다.
 */
export function validatePeriods(periods: readonly Period[]): PeriodError[] {
  const errors: PeriodError[] = [];
  /** 오류 하나를 모은다. */
  const add = (index: number, rule: PeriodRule, message: string) => errors.push({ index, rule, message });

  /** 시각 규칙을 모두 지켜 서로 비교할 수 있는 줄. */
  const checked: { index: number; start: number; end: number }[] = [];
  periods.forEach(({ start, end }, index) => {
    if (!isMinute(start) || !isMinute(end)) {
      add(index, 'out-of-range', '시각은 00:00부터 23:59 사이여야 해요. 시각을 고쳐 주세요.');
    } else if (end <= start) {
      add(index, 'end-not-after-start', '끝 시각이 시작 시각보다 늦어야 해요. 끝 시각을 고쳐 주세요.');
    } else {
      checked.push({ index, start, end });
    }
  });

  // 앞 수업의 끝과 다음 수업의 시작이 같은 것은 겹침이 아니라서 부등호에 등호를 넣지 않는다
  for (const a of checked) {
    const other = checked
      .filter((b) => b.index !== a.index && a.start < b.end && b.start < a.end)
      .sort((x, y) => x.start - y.start)[0];
    if (other) {
      add(a.index, 'overlap', `${clock(other.start)}~${clock(other.end)} 수업과 겹쳐요. 겹치지 않게 시각을 고쳐 주세요.`);
    }
  }

  if (checked.length > 0) {
    const first = Math.min(...checked.map((p) => p.start));
    const lastEnd = Math.max(...checked.map((p) => p.end));
    if (lastEnd - first > MAX_SPAN) {
      // 12시간을 넘기게 만든 줄은 가장 늦게 끝나는 줄이다
      const culprit = checked.find((p) => p.end === lastEnd)!;
      add(culprit.index, 'too-long', '첫 수업 시작부터 마지막 수업 끝까지 12시간을 넘을 수 없어요. 끝 시각을 앞당겨 주세요.');
    }
  }

  return errors.sort((a, b) => a.index - b.index || RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule));
}

/** 시간대 하나의 수업 시간 오류. */
export type SlotError = PeriodError & {
  /** 시간대 목록에서 그 시간대의 번호(0부터). */
  slot: number;
};

/**
 * 시간표의 시간대마다 수업 시간 규칙을 검사한다. 시간대 순, 그 안에서는 `validatePeriods`의 순서다.
 * 다른 시간대의 수업 시간끼리는 비교하지 않는다. 같은 날에 함께 울리지 않기 때문이다.
 */
export function validateSlots(slots: readonly TimetableSlot[]): SlotError[] {
  return slots.flatMap(({ periods }, slot) => validatePeriods(periods).map((error) => ({ ...error, slot })));
}
