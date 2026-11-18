// 동작별로 부위가 어떻게 움직이는지. 출발점은 돌아다니는 강아지 시안(09번)의 MOVES다.
// t는 동작을 시작한 뒤의 초이고, 값은 화면 기준 변환이다(각도는 도, ty는 키 96px 강아지의 px).

import type { DogAction } from '../../../shared/status-view';
import type { JointValue } from './matrix';
import type { PartName } from './themes';

/** 한 동작의 부위별 움직임. 없는 부위는 그 동작에서 가만히 있다. */
type Move = Partial<Record<PartName, (t: number) => JointValue>>;

/**
 * 눈 깜빡임. 4초마다 끝의 0.3초 동안 감는다.
 * 평소는 초당 4번만 그리므로 감는 시간이 한 번 그리는 간격(0.25초)보다 길어야 깜빡임이 빠지지 않는다.
 * 시작(t = 0)에는 눈을 뜨고 있어야 동작 줄이기 때 멈춘 첫 자세가 졸림처럼 보이지 않는다.
 */
const blink = (t: number): JointValue => ({ sy: t % 4 > 3.7 ? 0.1 : 1 });

/** 앞뒤 다리를 번갈아 흔든다. 걷기, 끌려가기, 낙하가 세기와 빠르기만 달리 쓴다. */
function legs(deg: number, speed: number): Move {
  return {
    legA: (t) => ({ r: deg * Math.sin(t * speed) }),
    legB: (t) => ({ r: -deg * Math.sin(t * speed) }),
    legC: (t) => ({ r: -deg * Math.sin(t * speed) }),
    legD: (t) => ({ r: deg * Math.sin(t * speed) }),
  };
}

/** 평소: 천천히 숨쉬고 꼬리와 귀를 살짝 흔들며 가끔 깜빡인다. */
const idle: Move = {
  body: (t) => ({ sy: 1 + 0.02 * Math.sin(t * 2.4) }),
  tail: (t) => ({ r: 8 * Math.sin(t * 3) }),
  eyes: blink,
  earL: (t) => ({ r: 2 * Math.sin(t * 1.2) }),
  earR: (t) => ({ r: -2 * Math.sin(t * 1.2) }),
};

/** 신남: 통통 튀고 꼬리를 세게 흔들며 귀가 펄럭이고 혀가 나온다. */
const happy: Move = {
  body: (t) => ({ ty: -6 * Math.abs(Math.sin(t * 6)), sy: 1 + 0.03 * Math.sin(t * 12) }),
  tail: (t) => ({ r: 26 * Math.sin(t * 14) }),
  earL: (t) => ({ r: 12 * Math.sin(t * 6) }),
  earR: (t) => ({ r: -12 * Math.sin(t * 6) }),
  tongue: (t) => ({ sy: 1.25 + 0.2 * Math.sin(t * 10) }),
};

/** 졸림: 눈을 감고 고개를 숙이며 숨이 느려지고 귀와 꼬리가 처진다. */
const sleepy: Move = {
  body: (t) => ({ sy: 1 + 0.035 * Math.sin(t * 1.1) }),
  head: (t) => ({ r: 5 + 3 * Math.sin(t * 1.1) }),
  eyes: () => ({ sy: 0.12 }),
  earL: () => ({ r: -8 }),
  earR: () => ({ r: 8 }),
  tail: () => ({ r: -6 }),
  // 조는 동안은 혀를 넣는다(기본 테마 시안 dog-idle.html의 졸림). 혀의 관절(입)로 접어 보이지 않게 한다
  tongue: () => ({ sy: 0 }),
};

/** 이동: 네 다리가 따로 있는 테마의 걷기. */
const walk: Move = {
  body: (t) => ({ ty: -2 * Math.abs(Math.sin(t * 8)) }),
  ...legs(18, 8),
  tail: (t) => ({ r: 14 * Math.sin(t * 8) }),
  eyes: blink,
};

/** 이동: 걷는 다리가 없는 테마는 몸째 통통 튄다. */
const hop: Move = {
  body: (t) => ({ ty: -12 * Math.abs(Math.sin(t * 7)) }),
  tail: (t) => ({ r: 14 * Math.sin(t * 9) }),
  earL: (t) => ({ r: 9 * Math.sin(t * 14) }),
  earR: (t) => ({ r: -9 * Math.sin(t * 14) }),
  eyes: blink,
};

/** 끌려가기: 매달려 다리를 버둥거린다. 몸의 기울기는 강아지 창이 끄는 빠르기로 정한다. */
const drag: Move = {
  ...legs(10, 5),
  tail: (t) => ({ r: 18 * Math.sin(t * 7) }),
  earL: () => ({ r: 10 }),
  earR: () => ({ r: -10 }),
};

/** 낙하: 낙하산에 매달려 천천히 다리를 흔든다. 귀는 바람에 들린다. */
const fall: Move = {
  ...legs(6, 3),
  tail: (t) => ({ r: 10 * Math.sin(t * 4) }),
  earL: () => ({ r: 14 }),
  earR: () => ({ r: -14 }),
  eyes: blink,
};

/** 동작별 움직임. 이동은 테마의 걷는 방법에 따라 고른다. */
export function moveOf(action: DogAction, gait: 'walk' | 'hop'): Move {
  switch (action) {
    case 'idle':
      return idle;
    case 'happy':
      return happy;
    case 'sleepy':
      return sleepy;
    case 'move':
      return gait === 'walk' ? walk : hop;
    case 'drag':
      return drag;
    case 'fall':
      return fall;
  }
}
