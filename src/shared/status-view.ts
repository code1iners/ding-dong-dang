import type { BellStatus } from './bell-decision';

/** 발바닥 도장 하나의 모양을 정하는 상태. 지난 교시, 지금 교시, 남은 교시. */
export type PawState = 'done' | 'current' | 'left';

/**
 * 남은 시간을 화면에 쓰는 글로 바꾼다. 한 시간 미만은 "분:초", 이상은 "시:분:초"다.
 * 초 미만은 올려서, 종이 울리는 순간에야 00:00이 되게 한다.
 */
export function formatRemaining(ms: number): string {
  /** 올림한 남은 초. 이미 지났으면 0. */
  const total = Math.max(0, Math.ceil(ms / 1000));
  /** 시, 분, 초 자리. */
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  /** 두 자리로 0을 채운다. */
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** 지금 구간에서 남은 비율(0~1). 고리가 채워진 정도다. 구간이 없거나 길이가 0이면 0. */
export function remainingFraction(segment: BellStatus['segment'], now: number): number {
  if (!segment || segment.end <= segment.start) return 0;
  return Math.min(1, Math.max(0, (segment.end - now) / (segment.end - segment.start)));
}

/** 오늘 교시마다의 발바닥 도장 상태. 수업 없는 날과 시간표가 없을 때는 도장이 없다. */
export function pawStates(status: BellStatus): PawState[] {
  return Array.from({ length: status.periodCount }, (_, i): PawState => {
    if (i < status.periodsDone) return 'done';
    // 지금 교시는 수업 중에만 있고, 그때 periodsDone이 곧 지금 교시의 0부터 센 번호다
    return status.kind === 'in-class' && i === status.periodsDone ? 'current' : 'left';
  });
}
