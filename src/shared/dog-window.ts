// 돌아다니는 강아지 창과 메인 사이의 통로. 강아지 창은 그림만 그리고, 행동 · 위치 · 클릭 통과는 메인이 정한다.
// 앱 창의 상태 구독 · 명령 통로와 따로 두어, 이 창에는 강아지에 필요한 것만 내보낸다(종 재생기 창과 같은 방식).

import type { Facing, Gait } from './roaming-dog';
import type { DogAction } from './status-view';

/** 메인이 강아지 창에 보내는 그릴 내용. 바뀔 때만 보낸다. */
export type DogView = {
  /** 저장된 강아지 테마 id. */
  themeId: string;
  /** 강아지 키(px). */
  height: number;
  /** 지금 동작. */
  action: DogAction;
  /** 바라보는 쪽. 1이 오른쪽이다. 옆모습 그림만 이 쪽으로 돌린다. */
  facing: Facing;
  /** 화면이 잠기거나 PC가 잠들어 그리기를 멈췄는지. */
  paused: boolean;
};

/** 강아지 창이 그림을 붙이고 잰 결과. 메인이 창 크기와 클릭 받을 자리를 정하는 데 쓴다. */
export type DogFigureReport = {
  /** 이 테마 · 키로 그린 강아지의 너비(px). */
  width: number;
  /** 테마의 이동 방법. */
  gait: Gait;
  /** OS의 동작 줄이기가 켜져 있는지. */
  reducedMotion: boolean;
};

/** 누르기의 단계. */
export type PressPhase = 'down' | 'up' | 'cancel';

/** 강아지 창의 preload가 `window.roamingDog`로 내보내는 통로. */
export type DogWindowApi = {
  /** 그릴 내용을 받는다. */
  onView(listener: (view: DogView) => void): void;
  /** 그림을 잰 결과와 동작 줄이기 설정을 알린다. 테마 · 키 · 동작 줄이기가 바뀔 때마다 다시 알린다. */
  reportFigure(report: DogFigureReport): void;
  /** 강아지를 누르기 시작함, 손을 뗌, 누름이 취소됨을 알린다. 손을 떼면 메인이 누른 것으로 친다. */
  press(phase: PressPhase): void;
};

/** 강아지 창 통로가 쓰는 IPC 채널 이름. */
export const DOG_CHANNEL = {
  view: 'dog:view',
  figure: 'dog:figure',
  press: 'dog:press',
} as const;
