// 강아지 테마의 id와 이름. 메인(저장할 값 검사)과 렌더러(그림 · 고르기 화면)가 같은 목록을 본다.
// 그림과 부위 표는 렌더러의 `dog/themes.ts`에 있다.

/** 테마 하나의 id와 이름. 이름은 화면에 글자로 나오지 않고 단추의 접근성 이름으로만 쓴다. */
export type DogThemeInfo = {
  /** 저장 데이터의 `settings.dogTheme` 값. */
  id: string;
  /** 테마 이름. */
  name: string;
};

/** 테마 일곱 개. 설정 화면에 놓이는 순서다. 첫째가 기본 테마다. */
export const DOG_THEME_INFOS: readonly DogThemeInfo[] = [
  { id: 'orange-sitting', name: '앉아 있는 주황 강아지' },
  { id: 'code-orange', name: '코드로 그린 주황 강아지' },
  { id: 'fluent-face', name: 'Fluent Emoji 얼굴' },
  { id: 'noto-face', name: 'Noto Emoji 얼굴' },
  { id: 'beagle', name: '갈색 · 흰색 강아지' },
  { id: 'bucktooth', name: '뻐드렁니 강아지' },
  { id: 'creative', name: 'The Creative Idea 강아지' },
];

/** 있는 테마 id인지. */
export function isDogThemeId(value: unknown): value is string {
  return DOG_THEME_INFOS.some((t) => t.id === value);
}
