// 강아지 테마: 그림 한 장과 "부위 이름 → 요소 번호, 관절 위치" 표.
// 표의 원본은 강아지 테마 SVG의 부위 구성 확인(23번)이고, 기본 테마의 표는 prototype/design-mockups 브랜치의 dog-idle.html에서 가져왔다.
// 요소 번호는 그림 안에서 그리는 요소(path, circle 등)의 순서다(0부터, defs · clipPath 안은 세지 않는다).

import bucktoothArt from './art/bucktooth.svg?raw';
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

/** 강아지 테마 하나. */
export type DogTheme = {
  /** 테마 id. 저장 데이터의 `settings.dogTheme` 값이다. */
  id: string;
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
  /** 이동하는 방법. 네 다리가 따로 있는 그림만 걷고, 나머지는 통통 튄다. */
  gait: Gait;
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

/** 지금 있는 강아지 테마. 나머지 다섯은 테마 고르기 티켓(43번)이 더한다. */
export const DOG_THEMES: readonly DogTheme[] = [orangeSitting, bucktooth];

/** 처음 설치했을 때의 테마. 저장 데이터의 기본값과 같다. */
export const DEFAULT_THEME_ID = 'orange-sitting';

/** 저장된 테마 id의 테마. 모르는 id(지운 테마 등)는 기본 테마다. */
export function themeById(id: string): DogTheme {
  return DOG_THEMES.find((t) => t.id === id) ?? DOG_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}
