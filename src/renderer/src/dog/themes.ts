// 강아지 테마: 그림 한 장과 "부위 이름 → 요소 번호, 관절 위치" 표.
// 표의 원본은 강아지 테마 SVG의 부위 구성 확인(23번)이고, 기본 테마의 표는 prototype/design-mockups 브랜치의 dog-idle.html에서 가져왔다.
// 요소 번호는 그림 안에서 그리는 요소(path, circle 등)의 순서다(0부터, defs · clipPath 안은 세지 않는다).

import beagleArt from './art/beagle.svg?raw';
import bucktoothArt from './art/bucktooth.svg?raw';
import codeOrangeArt from './art/code-orange.svg?raw';
import creativeArt from './art/creative.svg?raw';
import fluentDogArt from './art/fluent-dog.svg?raw';
import fluentFaceArt from './art/fluent-face.svg?raw';
import notoDogArt from './art/noto-dog.svg?raw';
import notoFaceArt from './art/noto-face.svg?raw';
import orangeSittingArt from './art/orange-sitting.svg?raw';

/**
 * 움직임을 붙이는 부위 이름. 동작 표(`moves.ts`)가 이 이름으로 부위를 움직인다. 테마에 없는 부위는 움직이지 않는다. */
export type PartName = 'body' | 'head' | 'tail' | 'earL' | 'earR' | 'eyes' | 'tongue' | 'legA' | 'legB' | 'legC' | 'legD';

/** 이동하는 방법. 걷기(다리를 번갈아 움직임)와 통통 튀기. */
export type Gait = 'walk' | 'hop';

/** 부위 하나. */
export type DogPart = {
  /** 부위 이름. */
  name: PartName;
  /** 이 부위를 이루는 요소 번호. */
  elements: number[];
  /**
   * 관절. 부위를 이루는 요소를 모두 감싼 상자(화면 방향) 안의 비율 [가로, 세로]이고 [0, 0]이 왼쪽 위다.
   * null이면 요소마다 자기 상자의 가운데를 관절로 쓴다(두 눈을 따로 감을 때).
   */
  joint: [number, number] | null;
};

/** 그림 한 장과 그 부위 표. */
export type DogFigure = {
  /** 그림 파일 이름(`art/` 아래). 출처와 라이선스는 `art/LICENSES.md`에 있다. */
  file: string;
  /** 그림의 SVG 원본 글. */
  art: string;
  /**
   * 부위 표. 바깥 부위(몸)부터 적는다. 한 요소가 여러 부위에 들면 앞의 부위 움직임이 바깥에 온다.
   * 그래서 몸이 튀어도 꼬리는 몸에 붙은 관절에서 흔들린다.
   */
  parts: DogPart[];
  /** 그리지 않는 요소 번호. 강아지가 아닌 그림자 · 풀밭이다. */
  hidden: number[];
};

/** 강아지 테마 하나. 그림은 고리 안 등 창 안에서 쓰고, `floor`가 있으면 화면 바닥은 그 그림을 쓴다. */
export type DogTheme = DogFigure & {
  /** 테마 id. 저장 데이터의 `settings.dogTheme` 값이다. */
  id: string;
  /** 이동하는 방법. 네 다리가 따로 있는 그림만 걷고, 나머지는 통통 튄다. */
  gait: Gait;
  /** 화면 바닥을 돌아다닐 때 쓰는 전신 그림. 얼굴만 있는 테마에만 있다. 없으면 `art`를 그대로 쓴다. */
  floor?: DogFigure;
};

/** 0부터 n-1까지에서 `except`를 뺀 번호. */
function allBut(n: number, except: number[]): number[] {
  return Array.from({ length: n }, (_, i) => i).filter((i) => !except.includes(i));
}

/**
 * 앉아 있는 주황 강아지(기본). 귀 · 꼬리의 관절은 dog-idle.html이 쓴 관절(각 path의 시작점)을 상자 비율로 잰 값이다.
 * 0 그림자, 1 혀, 2 · 3 귀, 4 꼬리, 5 · 8 다리, 6 머리와 몸통, 7 목, 9 코, 10 얼룩, 11~13 눈(흰자, 눈동자, 빛), 14 배.
 */
const orangeSitting: DogTheme = {
  id: 'orange-sitting',
  file: 'orange-sitting.svg',
  art: orangeSittingArt,
  parts: [
    // 그림자는 바닥에 남고 강아지만 튀도록 몸에서 뺀다
    { name: 'body', elements: allBut(15, [0]), joint: [0.5, 1] },
    { name: 'tail', elements: [4], joint: [0.99, 0.85] },
    { name: 'earL', elements: [3], joint: [0.82, 1] },
    { name: 'earR', elements: [2], joint: [0, 0.58] },
    { name: 'eyes', elements: [11, 12, 13], joint: [0.5, 0.5] },
    { name: 'tongue', elements: [1], joint: [0.5, 0] },
  ],
  hidden: [],
  gait: 'hop',
};

/** 뻐드렁니 강아지(서 있음). 0 꼬리, 1 · 26과 2 · 3 귀, 4 그림자, 5 · 12 · 7(+6 · 27) · 11(+10) 네 다리, 8 · 9 몸, 13 목, 14 머리, 19~22 눈. */
const bucktooth: DogTheme = {
  id: 'bucktooth',
  file: 'bucktooth.svg',
  art: bucktoothArt,
  parts: [
    { name: 'body', elements: allBut(29, [4]), joint: [0.5, 1] },
    { name: 'tail', elements: [0], joint: [1, 1] },
    { name: 'earL', elements: [1, 26], joint: [0.5, 1] },
    { name: 'earR', elements: [2, 3], joint: [0.5, 1] },
    { name: 'eyes', elements: [19, 20, 21, 22], joint: null },
    { name: 'legA', elements: [5], joint: [0.5, 0] },
    { name: 'legB', elements: [12], joint: [0.5, 0] },
    { name: 'legC', elements: [7, 6, 27], joint: [0.5, 0] },
    { name: 'legD', elements: [11, 10], joint: [0.5, 0] },
  ],
  hidden: [4],
  gait: 'walk',
};

/**
 * 코드로 그린 주황 강아지(서 있음, 직접 그린 그림). 네 다리가 따로 있어 걷는다.
 * 0 꼬리, 1 · 2 먼 쪽 다리(뒤 · 앞), 3 몸, 4 가슴, 5 · 6 가까운 쪽 다리(뒤 · 앞), 7 먼 쪽 귀, 8 머리, 9 혀, 10 주둥이, 11 코, 12 입, 13 · 14 눈(눈동자, 빛), 15 가까운 쪽 귀.
 * 걸을 때 뒤 가까운 다리(A)와 앞 먼 다리(D)가 함께, 뒤 먼 다리(B)와 앞 가까운 다리(C)가 함께 움직인다.
 */
const codeOrange: DogTheme = {
  id: 'code-orange',
  file: 'code-orange.svg',
  art: codeOrangeArt,
  parts: [
    { name: 'body', elements: allBut(16, []), joint: [0.5, 1] },
    { name: 'head', elements: [7, 8, 9, 10, 11, 12, 13, 14, 15], joint: [0.4, 1] },
    { name: 'tail', elements: [0], joint: [0.95, 0.9] },
    { name: 'earL', elements: [15], joint: [0.85, 0.05] },
    { name: 'earR', elements: [7], joint: [0.2, 0.95] },
    { name: 'eyes', elements: [13, 14], joint: [0.5, 0.5] },
    { name: 'tongue', elements: [9], joint: [0.5, 0] },
    { name: 'legA', elements: [5], joint: [0.5, 0] },
    { name: 'legB', elements: [1], joint: [0.5, 0] },
    { name: 'legC', elements: [6], joint: [0.5, 0] },
    { name: 'legD', elements: [2], joint: [0.5, 0] },
  ],
  hidden: [],
  gait: 'walk',
};

/**
 * Fluent Emoji 얼굴. 0 머리, 1 주둥이, 2 혀, 3 · 4 귀, 5 · 6 눈, 7 코, 8 입.
 * 꼬리가 없어 신남은 귀와 혀로 만든다. 바닥에서는 같은 세트의 전신 그림(옆모습)을 쓴다.
 */
const fluentFace: DogTheme = {
  id: 'fluent-face',
  file: 'fluent-face.svg',
  art: fluentFaceArt,
  parts: [
    { name: 'body', elements: allBut(9, []), joint: [0.5, 1] },
    { name: 'earL', elements: [3], joint: [0.9, 0.1] },
    { name: 'earR', elements: [4], joint: [0.1, 0.1] },
    { name: 'eyes', elements: [5, 6], joint: null },
    { name: 'tongue', elements: [2], joint: [0.5, 0] },
  ],
  hidden: [],
  gait: 'hop',
  floor: {
    // 0 혀, 1 · 2 뒤쪽 다리, 3 몸 · 꼬리 · 앞쪽 다리, 4 코 · 입, 5 눈, 7 귀. 꼬리와 앞다리는 몸과 한 덩어리다
    file: 'fluent-dog.svg',
    art: fluentDogArt,
    parts: [
      { name: 'body', elements: allBut(8, []), joint: [0.5, 1] },
      { name: 'earL', elements: [7], joint: [0.5, 0] },
      { name: 'eyes', elements: [5], joint: null },
      { name: 'tongue', elements: [0], joint: [0.5, 0] },
      { name: 'legA', elements: [1], joint: [0.5, 0] },
      { name: 'legB', elements: [2], joint: [0.5, 0] },
    ],
    hidden: [],
  },
};

/**
 * Noto Emoji 얼굴. 0 머리, 1 눈 얼룩, 2 · 3 눈, 4 코, 5 · 6 혀, 7 입, 8 · 9 오른쪽 귀, 10 · 11 왼쪽 귀.
 * 꼬리가 없어 신남은 귀와 혀로 만든다. 바닥에서는 같은 세트의 전신 그림을 쓴다.
 */
const notoFace: DogTheme = {
  id: 'noto-face',
  file: 'noto-face.svg',
  art: notoFaceArt,
  parts: [
    { name: 'body', elements: allBut(12, []), joint: [0.5, 1] },
    { name: 'earL', elements: [10, 11], joint: [0.9, 0.1] },
    { name: 'earR', elements: [8, 9], joint: [0.1, 0.1] },
    { name: 'eyes', elements: [2, 3], joint: null },
    { name: 'tongue', elements: [5, 6], joint: [0.5, 0] },
  ],
  hidden: [],
  gait: 'hop',
  floor: {
    // 2 · 3 귀, 5 · 6 눈. 몸 · 다리 · 꼬리는 한 덩어리(0)다
    file: 'noto-dog.svg',
    art: notoDogArt,
    parts: [
      { name: 'body', elements: allBut(17, []), joint: [0.5, 1] },
      { name: 'earL', elements: [2], joint: [0.8, 0.1] },
      { name: 'earR', elements: [3], joint: [0.2, 0.1] },
      { name: 'eyes', elements: [5, 6], joint: null },
    ],
    hidden: [],
  },
};

/**
 * 갈색 · 흰색 강아지(앉음). 0 풀밭(뺌), 1 · 2 꼬리, 3 · 4 · 7 · 8 앉은 다리, 5 · 6 · 21 · 22 몸, 9~12 머리, 13~18 눈, 19 · 20 귀.
 * 혀가 없어 신남은 꼬리와 귀로 만들고, 눈이 작아 졸림은 고개 숙임과 느린 숨쉬기가 함께 있어야 보인다.
 */
const beagle: DogTheme = {
  id: 'beagle',
  file: 'beagle.svg',
  art: beagleArt,
  parts: [
    { name: 'body', elements: allBut(23, [0]), joint: [0.5, 1] },
    { name: 'head', elements: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], joint: [0.5, 1] },
    { name: 'tail', elements: [1, 2], joint: [0, 0.6] },
    { name: 'earL', elements: [19], joint: [0.8, 0.1] },
    { name: 'earR', elements: [20], joint: [0.2, 0.1] },
    { name: 'eyes', elements: [13, 14, 15, 16, 17, 18], joint: null },
  ],
  hidden: [0],
  gait: 'hop',
};

/**
 * The Creative Idea 강아지(앉음). 0 · 1 꼬리, 2 · 3 몸, 4 · 5 뒷다리, 7~12 머리, 13~18 눈, 19 머리 위쪽, 20 혀, 21 · 22 귀, 23~26 앞다리.
 */
const creative: DogTheme = {
  id: 'creative',
  file: 'creative.svg',
  art: creativeArt,
  parts: [
    { name: 'body', elements: allBut(32, []), joint: [0.5, 1] },
    { name: 'head', elements: allBut(23, [0, 1, 2, 3, 4, 5, 6]), joint: [0.5, 1] },
    { name: 'tail', elements: [0, 1], joint: [0, 1] },
    { name: 'earL', elements: [21], joint: [0.9, 0.1] },
    { name: 'earR', elements: [22], joint: [0.1, 0.1] },
    { name: 'eyes', elements: [13, 14, 15, 16, 17, 18], joint: null },
    { name: 'tongue', elements: [20], joint: [0.5, 0] },
  ],
  hidden: [],
  gait: 'hop',
};

/** 강아지 테마 일곱 개. 설정 화면에 놓이는 순서이고 `shared/dog-themes.ts`의 목록과 같다. */
export const DOG_THEMES: readonly DogTheme[] = [orangeSitting, codeOrange, fluentFace, notoFace, beagle, bucktooth, creative];

/** 처음 설치했을 때의 테마. 저장 데이터의 기본값과 같다. */
export const DEFAULT_THEME_ID = 'orange-sitting';

/** 저장된 테마 id의 테마. 모르는 id(지운 테마 등)는 기본 테마다. */
export function themeById(id: string): DogTheme {
  return DOG_THEMES.find((t) => t.id === id) ?? DOG_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}

/** 화면 바닥을 돌아다닐 때 그릴 테마. 전신 그림이 따로 있는 테마는 그 그림으로 바꾼다. */
export function floorTheme(theme: DogTheme): DogTheme {
  return theme.floor ? { ...theme, ...theme.floor, floor: undefined } : theme;
}
