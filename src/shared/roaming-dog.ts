// 돌아다니는 강아지의 행동. 시계와 창을 모르는 순수 함수라서 구간 · 종 울림 · 누르기 · 시각 · 난수를 값으로 넣어 본다.
// 원본은 스펙 "돌아다니는 강아지"와 강아지 연출의 범위와 동작 결정(09번)이다.

import type { StatusKind } from './bell-decision';
import type { DogAction } from './status-view';

/** 이동하는 방법. 네 다리가 따로 있는 테마는 걷고(다리를 번갈아 움직임), 나머지는 통통 튄다. */
export type Gait = 'walk' | 'hop';

/** 바라보는 쪽. 1이 오른쪽, -1이 왼쪽이다. */
export type Facing = 1 | -1;

/** 강아지가 지금 있는 자리와 사정. 판정할 때마다 새로 받는다. */
export type DogScene = {
  /** 지금 현황. 수업 중일 때만 돌아다닌다. */
  kind: StatusKind;
  /** 오늘만 끄기 중인지. 그동안은 수업 중이어도 존다. */
  bellsOff: boolean;
  /** 종이 울리는 중인지. 그동안은 제자리에서 신남이다. */
  ringing: boolean;
  /** OS의 동작 줄이기가 켜져 있는지. 켜져 있으면 이동하지 않는다. */
  reducedMotion: boolean;
  /** 주 모니터의 좌우 끝(화면 x). 강아지는 이 안에만 있다. */
  floor: { left: number; right: number };
  /** 강아지 그림의 너비와 키(px). */
  width: number;
  height: number;
  /** 테마의 이동 방법. 걷기와 통통 튀기는 빠르기가 다르다. */
  gait: Gait;
};

/** 강아지 하나의 상태. */
export type RoamingDog = {
  /** 발끝 가운데의 화면 x. */
  x: number;
  /** 바라보는 쪽. 1이 오른쪽이다. */
  facing: Facing;
  /** 지금 동작. */
  action: DogAction;
  /** 마지막으로 판정한 시각(에포크 ms). */
  at: number;
  /** 수업 중에 되풀이하는 걷기와 멈춰 쉬기 중 지금 것과 끝나는 시각(에포크 ms). 수업 밖이면 null이다. */
  phase: { kind: 'walk' | 'rest'; until: number } | null;
  /** 누른 뒤의 신남이 끝나는 시각(에포크 ms). 누른 적이 없으면 0. */
  pettedUntil: number;
};

/** 걷기 한 번의 길이(ms) 범위. */
const WALK_MS = [5_000, 10_000] as const;
/** 멈춰 쉬기 한 번의 길이(ms) 범위. */
const REST_MS = [10_000, 20_000] as const;
/** 키 96 강아지가 1초에 옮겨 가는 거리(px). 키에 비례한다. 통통 튀기는 조금 느리다(시안 09번의 값). */
const SPEED = { walk: 45, hop: 38 } as const;
/** 누른 뒤 신남이 이어지는 시간(ms). 고리 안 강아지도 같은 값을 쓴다. */
export const PETTED_MS = 2_000;
/** 한 번의 판정에서 셀 수 있는 가장 긴 경과 시간(ms). 잠들었다 깨어나도 강아지가 순간 이동하지 않는다. */
const MAX_STEP_MS = 250;

/** 화면 좌우 끝에서 강아지를 더 띄우는 여백(px). */
const EDGE_MARGIN = 8;

/** 강아지 발끝 가운데가 놓일 수 있는 x 범위. 모니터보다 강아지가 크면 가운데에 둔다. */
function range(scene: DogScene): { min: number; max: number } {
  /** 왼쪽 끝에서 강아지 반 너비와 여백만큼 안쪽. */
  const min = scene.floor.left + scene.width / 2 + EDGE_MARGIN;
  /** 오른쪽 끝에서 강아지 반 너비와 여백만큼 안쪽. */
  const max = scene.floor.right - scene.width / 2 - EDGE_MARGIN;
  if (min > max) {
    /** 바닥의 가운데. */
    const middle = (scene.floor.left + scene.floor.right) / 2;
    return { min: middle, max: middle };
  }
  return { min, max };
}

/** 앱을 시작할 때 바닥의 무작위 위치에 강아지를 놓는다. 위치는 저장하지 않는다. */
export function placeDog(scene: DogScene, now: number, random: () => number): RoamingDog {
  /** 놓일 수 있는 x 범위. */
  const { min, max } = range(scene);
  return { x: min + (max - min) * random(), facing: 1, action: 'idle', at: now, phase: null, pettedUntil: 0 };
}

/** [a, b) 범위의 난수. */
function randomIn([a, b]: readonly [number, number], random: () => number): number {
  return a + (b - a) * random();
}

/** 무작위 방향. */
function randomFacing(random: () => number): Facing {
  return random() < 0.5 ? -1 : 1;
}

/**
 * 수업 중의 걷기 · 쉬기 차례를 지금 시각까지 넘긴다. 차례가 끝났으면 다음 차례를 뽑는다.
 * 다음 차례는 앞 차례가 끝난 시각부터 센다. 잠금 등으로 오래 판정하지 않았으면 밀린 차례를 몰아서 넘기지 않고 지금부터 센다.
 */
function nextPhase(dog: RoamingDog, now: number, random: () => number): Pick<RoamingDog, 'phase' | 'facing'> {
  /** 지금까지의 차례. */
  const phase = dog.phase;
  // 수업이 막 시작됐으면 걷기부터 한다
  if (!phase) return { phase: { kind: 'walk', until: now + randomIn(WALK_MS, random) }, facing: randomFacing(random) };
  if (now < phase.until) return { phase, facing: dog.facing };
  /** 다음 차례가 시작하는 시각. */
  const start = now - phase.until > MAX_STEP_MS ? now : phase.until;
  if (phase.kind === 'walk') return { phase: { kind: 'rest', until: start + randomIn(REST_MS, random) }, facing: dog.facing };
  // 걸을 때마다 방향을 새로 고른다
  return { phase: { kind: 'walk', until: start + randomIn(WALK_MS, random) }, facing: randomFacing(random) };
}

/** 지금 시각의 동작과 위치를 정한다. 초당 몇 번이든 불러도 되고, 경과 시간은 앞 판정과의 차이로 센다. */
export function stepDog(dog: RoamingDog, scene: DogScene, now: number, random: () => number): RoamingDog {
  /** 앞 판정 뒤 지난 시간(초). */
  const dt = Math.min(MAX_STEP_MS, Math.max(0, now - dog.at)) / 1000;
  /** 놓일 수 있는 x 범위. */
  const { min, max } = range(scene);
  /** 지금 자리. 모니터가 바뀌어 범위 밖에 있게 됐으면 안으로 들인다. */
  const x = Math.min(max, Math.max(min, dog.x));
  /** 종이 울리거나 누른 뒤라 제자리에서 신남인지. */
  const happy = scene.ringing || now < dog.pettedUntil;
  // 수업 밖과 오늘만 끄기 중에는 제자리에서 존다. 다음 수업은 걷기부터 새로 한다
  if (scene.kind !== 'in-class' || scene.bellsOff) {
    return { ...dog, x, phase: null, action: happy ? 'happy' : 'sleepy', at: now };
  }
  /** 지금의 걷기 · 쉬기 차례와 방향. 차례는 신남 동안에도 흘러간다. */
  const { phase, facing } = nextPhase(dog, now, random);
  if (happy) return { ...dog, x, phase, facing, action: 'happy', at: now };
  // 동작 줄이기가 켜져 있으면 걷는 차례에도 제자리에서 숨만 쉰다
  if (phase?.kind !== 'walk' || scene.reducedMotion) return { ...dog, x, phase, facing, action: 'idle', at: now };
  /** 이번에 옮겨 갈 거리(px). */
  const distance = SPEED[scene.gait] * (scene.height / 96) * dt;
  /** 끝을 넘지 않게 맞춘 다음 자리. */
  const next = Math.min(max, Math.max(min, x + facing * distance));
  /** 다음 방향. 끝에 닿으면 돌아선다. */
  const turned: Facing = (facing === 1 && next >= max) || (facing === -1 && next <= min) ? (facing === 1 ? -1 : 1) : facing;
  return { ...dog, phase, facing: turned, action: 'move', x: next, at: now };
}

/** 강아지를 눌렀을 때. 그 뒤 2초쯤 제자리에서 신남이다. 다시 누르면 그때부터 2초다. */
export function pressDog(dog: RoamingDog, now: number): RoamingDog {
  return { ...dog, pettedUntil: now + PETTED_MS };
}

/** 설정이 꺼진 채 종이 울려 잠깐 나타날 때. 바닥의 가운데에 놓는다. */
export function summonDog(dog: RoamingDog, scene: DogScene): RoamingDog {
  return { ...dog, x: (scene.floor.left + scene.floor.right) / 2 };
}

/** 강아지 창 안에서 강아지 발끝을 창 아래 끝에서 띄우는 거리(px). */
export const DOG_WINDOW_PAD_BOTTOM = 6;

/** 화면에 놓인 강아지 하나. 발끝 가운데의 화면 좌표와 그림의 크기(px). */
export type DogPlacement = { x: number; floorY: number; width: number; height: number };

/**
 * 강아지 창의 화면 자리와 크기. 하트 · 낙하산 · 끌 때의 흔들림이 들어가도록 강아지보다 크게 잡는다
 * (돌아다니는 강아지 창을 Mac에서 검증하기(28번)의 "창 만드는 법"). 강아지는 창의 아래 가운데에 고정이다.
 */
export function dogWindowBounds(dog: DogPlacement): { x: number; y: number; width: number; height: number } {
  /** 강아지의 너비와 키. */
  const { width: w, height: h } = dog;
  /** 창 너비. 낙하산 · 하트가 옆으로 나가는 폭, 끌 때 기울어진 몸, 키가 큰 그림 가운데 큰 것에 여유 8px를 더한다. */
  const width = Math.ceil(Math.max(1.6 * w + 92, w + 0.75 * h, 1.5 * h) + 8);
  /** 창 높이. 강아지 위로 낙하산과 하트가 들어갈 만큼이다. */
  const height = Math.ceil(1.925 * h + 12 + DOG_WINDOW_PAD_BOTTOM);
  return { x: Math.round(dog.x - width / 2), y: Math.round(dog.floorY - (height - DOG_WINDOW_PAD_BOTTOM)), width, height };
}

/** 커서가 강아지 그림의 네모 안에 있는지. 그 위에서만 강아지 창이 클릭을 받는다. */
export function isOverDog(cursor: { x: number; y: number }, dog: DogPlacement): boolean {
  return (
    cursor.x >= dog.x - dog.width / 2 &&
    cursor.x <= dog.x + dog.width / 2 &&
    cursor.y >= dog.floorY - dog.height &&
    cursor.y <= dog.floorY
  );
}
