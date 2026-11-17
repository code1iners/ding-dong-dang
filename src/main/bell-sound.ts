import type { BellKind } from '../shared/bell-decision';
import { BUILTIN_SOUNDS } from '../shared/builtin-sounds';
import { DEFAULT_END_BELL, DEFAULT_START_BELL, type Data } from '../shared/data';

/** 울릴 음원 파일과 크기. */
export type BellSound = {
  /** builtin은 앱에 든 내장 음원, registered는 데이터 폴더의 `sounds/`에 복사한 등록 음원이다. */
  source: 'builtin' | 'registered';
  /** 그 폴더 안의 파일 이름. */
  file: string;
  /** 0~1. 음원별 음량 × 전체 음량이다. */
  volume: number;
};

/**
 * 시작종이나 끝종으로 고른 음원과 크기를 정한다.
 * 고른 음원이 목록에 없으면(지워졌거나 파일이 사라져 빠진 경우) 그 자리의 기본 내장 음원이다.
 */
export function bellSoundFor(data: Data, kind: BellKind): BellSound {
  /** 고른 음원 id. */
  const chosen = kind === 'start' ? data.startBell : data.endBell;
  return soundOf(data, chosen) ?? defaultBellSound(data, kind);
}

/** 그 자리의 기본 내장 음원("웨스트민스터 시작" 또는 "웨스트민스터 끝")과 크기. 고른 음원을 쓸 수 없을 때 대신 울린다. */
export function defaultBellSound(data: Data, kind: BellKind): BellSound {
  // 기본 음원 id는 내장 목록에 늘 있다
  return soundOf(data, kind === 'start' ? DEFAULT_START_BELL : DEFAULT_END_BELL) as BellSound;
}

/** 음원 id가 가리키는 파일과 그 음원의 크기. 내장 음원을 먼저 찾고 없으면 등록 음원에서 찾는다. 목록에 없으면 null. */
function soundOf(data: Data, id: string): BellSound | null {
  /** 그 id의 내장 음원. */
  const builtin = BUILTIN_SOUNDS.find((s) => s.id === id);
  /** 그 id의 등록 음원. 내장 음원이 있으면 찾지 않는다. */
  const registered = builtin ? undefined : data.sounds.find((s) => s.id === id);
  /** 찾은 파일 이름. */
  const file = builtin?.file ?? registered?.file;
  if (file === undefined) return null;
  // 음량은 둘 다 0~100의 정수라 곱한 뒤 한 번에 나눠 소수 오차를 줄인다
  return {
    source: builtin ? 'builtin' : 'registered',
    file,
    volume: ((data.soundVolumes[id] ?? 100) * data.masterVolume) / 10_000,
  };
}
