// 수업 시간 편집 화면이 쓰는 순수 계산: 교시 번호, 새 줄의 기본값, 시각 숫자 입력, 12시간 시계판의 호.

import type { Period } from './data';

/** 하루의 마지막 분(23:59). */
const LAST_MINUTE = 24 * 60 - 1;
/** 시계판 한 바퀴가 나타내는 분(12시간). */
const DIAL_MINUTES = 12 * 60;
/** 새 수업 시간의 길이와 앞 수업과의 사이(분). */
const NEW_LENGTH = 50;
const NEW_GAP = 10;

/** 시작 시각 순으로 정렬한 새 목록. 시작이 같으면 처음 순서를 지킨다. */
export function sortByStart<T extends Period>(periods: readonly T[]): T[] {
  return periods
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p.start - b.p.start || a.index - b.index)
    .map(({ p }) => p);
}

/** 줄마다의 교시 번호(1부터). 시작 시각 순서로 매기고, 같으면 입력 순서다. 입력 목록과 같은 순서로 돌려준다. */
export function periodRanks(periods: readonly Period[]): number[] {
  const order = periods.map((p, index) => ({ start: p.start, index })).sort((a, b) => a.start - b.start || a.index - b.index);
  const ranks: number[] = new Array<number>(periods.length).fill(0);
  order.forEach(({ index }, i) => {
    ranks[index] = i + 1;
  });
  return ranks;
}

/** "수업 시간"을 더할 때 채우는 값. 가장 늦은 끝에서 10분 쉰 뒤 50분이고, 아무것도 없으면 09:00~09:50이다. */
export function nextPeriod(periods: readonly Period[]): Period {
  if (periods.length === 0) return { start: 9 * 60, end: 9 * 60 + NEW_LENGTH };
  const start = Math.min(Math.max(...periods.map((p) => p.end)) + NEW_GAP, LAST_MINUTE);
  return { start, end: Math.min(start + NEW_LENGTH, LAST_MINUTE) };
}

/** 자정부터의 분을 'HHMM' 네 자리로. 24시간을 넘는 값도 그대로 시로 보여 줘서, 잘못된 시각이 눈에 띈다. */
export function clockParts(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * 시각 칸에 숫자를 하나 눌렀을 때의 입력 글자. `typed`가 null이면 아직 이 칸에 아무것도 치지 않은 것이라
 * 이전 값을 지우고 새로 시작한다. 네 자리가 차면 더 받지 않고, 분의 십의 자리는 5까지만 받는다.
 */
export function typeEntryDigit(typed: string | null, digit: string): string {
  if (typed === null) return digit;
  if (typed.length >= 4) return typed;
  // 세 번째 글자가 분의 십의 자리다
  if (typed.length === 2 && Number(digit) > 5) return typed;
  return typed + digit;
}

/** 입력한 숫자 글자를 자정부터의 분으로. 모자라면 앞을 0으로 채운다. 비었으면 null이다. 24시 이상도 그대로 두어 검증이 알리게 한다. */
export function timeFromEntry(typed: string): number | null {
  if (typed === '') return null;
  const padded = typed.padStart(4, '0');
  return Number(padded.slice(0, 2)) * 60 + Number(padded.slice(2));
}

/** 시계판에 그리는 호. 좌표는 시계판 중심이 원점이고 아래가 +y다. */
export type Arc = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** 호의 한가운데. 교시 번호를 놓는 자리다. */
  mid: { x: number; y: number };
  /** 반원보다 큰 호인지(SVG의 large-arc 플래그). */
  large: boolean;
  /** 정확히 12시간이라 시작과 끝이 같은 자리에 겹치는 한 바퀴인지. 호 경로로는 그릴 수 없어 원으로 그려야 한다. */
  full: boolean;
};

/** 시계판 위의 한 점. 12시 방향이 0이고 시계 방향으로 돈다. */
function onDial(minutes: number, radius: number): { x: number; y: number } {
  const angle = ((minutes % DIAL_MINUTES) / DIAL_MINUTES) * 2 * Math.PI;
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

/** 수업 시간 하나의 호. 오전과 오후는 같은 자리에 그린다. 그릴 수 없는 시각(범위 밖, 끝이 시작보다 이름, 12시간 초과)은 null이다. 검증이 허용하는 정확히 12시간은 한 바퀴다. */
export function arcOf(period: Period, radius: number): Arc | null {
  const { start, end } = period;
  const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= LAST_MINUTE && end > start;
  if (!valid || end - start > DIAL_MINUTES) return null;
  return {
    from: onDial(start, radius),
    to: onDial(end, radius),
    mid: onDial((start + end) / 2, radius),
    large: end - start > DIAL_MINUTES / 2,
    full: end - start === DIAL_MINUTES,
  };
}
