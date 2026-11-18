import type { BellStatus, StatusKind } from './bell-decision';

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

/** 강아지 그리기가 아는 동작. 이동은 테마에 따라 걷기나 통통 튀기다. */
export type DogAction = 'idle' | 'happy' | 'sleepy' | 'move' | 'drag' | 'fall';

/** 수업 밖이라 고리 안 강아지가 조는 상태. */
const SLEEPY_KINDS: ReadonlySet<StatusKind> = new Set<StatusKind>(['before-first', 'after-last', 'no-class-day']);

/**
 * 현황의 고리 안 강아지 동작. DESIGN.md "현황" 표대로 평소나 졸림이고,
 * 종이 울리는 동안과 누른 뒤 잠깐(`petted`)은 신남이다.
 */
export function ringDogAction(kind: StatusKind, { ringing, petted }: { ringing: boolean; petted: boolean }): DogAction {
  if (ringing || petted) return 'happy';
  return SLEEPY_KINDS.has(kind) ? 'sleepy' : 'idle';
}

/**
 * 동작을 그리는 횟수(초당). 평소 · 졸림은 느리게 움직여 초당 4번, 그 밖은 24번이다(스펙 "돌아다니는 강아지").
 * 화면 주사율에 맞춘 그리기를 쓰지 않아 CPU를 아낀다. 창 안의 강아지와 돌아다니는 강아지가 같이 쓴다.
 */
export function framesPerSecond(action: DogAction): number {
  return action === 'idle' || action === 'sleepy' ? 4 : 24;
}
