import { describe, expect, it } from 'vitest';
import { DOG_THEME_INFOS } from '../../../shared/dog-themes';
import beagleArt from './art/beagle.svg?raw';
import bucktoothArt from './art/bucktooth.svg?raw';
import codeOrangeArt from './art/code-orange.svg?raw';
import creativeArt from './art/creative.svg?raw';
import fluentDogArt from './art/fluent-dog.svg?raw';
import fluentFaceArt from './art/fluent-face.svg?raw';
import notoDogArt from './art/noto-dog.svg?raw';
import notoFaceArt from './art/noto-face.svg?raw';
import orangeSittingArt from './art/orange-sitting.svg?raw';
import licenses from './art/LICENSES.md?raw';
import { DEFAULT_THEME_ID, DOG_THEMES, floorTheme, themeById, type DogFigure } from './themes';

/** 파일 이름 → 그림 원본 글. 테마가 가리키는 파일을 시험이 따로 읽는다. */
const ART: Record<string, string> = {
  'orange-sitting.svg': orangeSittingArt,
  'code-orange.svg': codeOrangeArt,
  'fluent-face.svg': fluentFaceArt,
  'fluent-dog.svg': fluentDogArt,
  'noto-face.svg': notoFaceArt,
  'noto-dog.svg': notoDogArt,
  'beagle.svg': beagleArt,
  'bucktooth.svg': bucktoothArt,
  'creative.svg': creativeArt,
};

/**
 * 그림 원본에서 그리는 요소의 수. defs · clipPath · mask 안의 모양은 그리지 않으므로 세지 않는다.
 * 그리기 모듈은 DOM에서 고르지만, 여기서는 원본 글자를 따로 세어 표의 번호와 맞춰 본다.
 */
function drawableCount(svg: string): number {
  /** 주석과, 그리지 않는 묶음(닫는 태그가 있는 것과 스스로 닫는 것)을 지운 글. */
  const drawn = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(defs|clipPath|mask)\b[^>]*\/>/g, '')
    .replace(/<(defs|clipPath|mask)\b[\s\S]*?<\/\1>/g, '');
  return drawn.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g)?.length ?? 0;
}

describe('강아지 테마 표', () => {
  it('테마 일곱 개가 설정 화면의 순서대로 있고 첫째가 기본 테마다', () => {
    expect(DOG_THEMES.map((t) => t.id)).toEqual([
      'orange-sitting',
      'code-orange',
      'fluent-face',
      'noto-face',
      'beagle',
      'bucktooth',
      'creative',
    ]);
    expect(DOG_THEMES.map((t) => t.id)).toEqual(DOG_THEME_INFOS.map((t) => t.id));
    expect(DEFAULT_THEME_ID).toBe('orange-sitting');
  });

  it('원본 글자를 세는 방법이 맞다: 그림마다 그리는 요소의 수(clipPath 안의 사각형 제외)', () => {
    // 개수는 강아지 테마 SVG의 부위 구성 확인(23번)과 원본을 하나씩 강조해 본 결과다
    expect(Object.fromEntries(Object.entries(ART).map(([file, art]) => [file, drawableCount(art)]))).toEqual({
      'orange-sitting.svg': 15,
      'code-orange.svg': 16,
      'fluent-face.svg': 9,
      'fluent-dog.svg': 8,
      'noto-face.svg': 12,
      'noto-dog.svg': 17,
      'beagle.svg': 23,
      'bucktooth.svg': 29,
      'creative.svg': 32,
    });
  });

  /** 시험할 그림 한 장: 테마의 고리 안 그림, 그리고 있으면 화면 바닥용 그림. */
  const figures: { label: string; figure: DogFigure }[] = DOG_THEMES.flatMap((theme) => [
    { label: theme.id, figure: theme },
    ...(theme.floor ? [{ label: `${theme.id} 바닥`, figure: theme.floor }] : []),
  ]);

  for (const { label, figure } of figures) {
    describe(label, () => {
      /** 그림 원본의 그리는 요소 수. */
      const count = drawableCount(ART[figure.file] ?? '');

      it('부위 표와 숨김 목록에 그림에 없는 요소 번호가 없다', () => {
        /** 표가 가리키는 모든 번호. */
        const indexes = [...figure.parts.flatMap((p) => p.elements), ...figure.hidden];
        for (const i of indexes) {
          expect(Number.isInteger(i) && i >= 0 && i < count, `요소 ${i} (그림에는 0~${count - 1})`).toBe(true);
        }
      });

      it('그리는 그림이 가리키는 파일이다', () => {
        expect(figure.art).toBe(ART[figure.file]);
      });

      it('관절은 부위 상자 안의 비율이고, 숨긴 요소는 어느 부위에도 들지 않는다', () => {
        for (const part of figure.parts) {
          expect(part.elements.length, part.name).toBeGreaterThan(0);
          for (const v of part.joint ?? []) expect(v >= 0 && v <= 1, part.name).toBe(true);
          for (const i of part.elements) expect(figure.hidden, `${part.name}의 ${i}`).not.toContain(i);
        }
      });

      it('같은 이름의 부위가 둘 있지 않고, 몸이 맨 앞(가장 바깥)에 있다', () => {
        /** 부위 이름들. */
        const names = figure.parts.map((p) => p.name);
        expect(new Set(names).size).toBe(names.length);
        expect(names[0]).toBe('body');
      });

      it('눈과 귀가 따로 있어 졸림에서 눈을 감고 귀를 늘어뜨릴 수 있다', () => {
        /** 부위 이름들. */
        const names = figure.parts.map((p) => p.name);
        expect(names).toContain('eyes');
        expect(names.some((n) => n === 'earL' || n === 'earR')).toBe(true);
      });
    });
  }

  it('이동은 뻐드렁니 강아지와 코드로 그린 강아지만 걷고 나머지 다섯은 통통 튄다', () => {
    expect(Object.fromEntries(DOG_THEMES.map((t) => [t.id, t.gait]))).toEqual({
      'orange-sitting': 'hop',
      'code-orange': 'walk',
      'fluent-face': 'hop',
      'noto-face': 'hop',
      beagle: 'hop',
      bucktooth: 'walk',
      creative: 'hop',
    });
    for (const id of ['bucktooth', 'code-orange']) {
      expect(themeById(id).parts.map((p) => p.name)).toEqual(expect.arrayContaining(['legA', 'legB', 'legC', 'legD']));
    }
  });

  it('뻐드렁니 강아지의 그림자(요소 4)와 갈색 · 흰색 강아지의 풀밭(요소 0)은 그리지 않는다', () => {
    expect(themeById('bucktooth').hidden).toEqual([4]);
    expect(themeById('beagle').hidden).toEqual([0]);
  });

  it('신남을 만드는 부위: 꼬리가 없는 테마는 귀와 혀가, 혀가 없는 테마는 꼬리와 귀가 있다', () => {
    /** 테마의 부위 이름. */
    const names = (id: string) => themeById(id).parts.map((p) => p.name);
    for (const id of ['fluent-face', 'noto-face']) {
      expect(names(id), id).not.toContain('tail');
      expect(names(id), id).toEqual(expect.arrayContaining(['earL', 'earR', 'tongue']));
    }
    for (const id of ['beagle', 'bucktooth']) {
      expect(names(id), id).not.toContain('tongue');
      expect(names(id), id).toEqual(expect.arrayContaining(['tail', 'earL', 'earR']));
    }
    // 갈색 · 흰색 강아지의 졸림은 고개 숙임이 있어야 하므로 머리가 따로 움직인다
    expect(names('beagle')).toContain('head');
  });

  it('얼굴 테마(Fluent · Noto)만 화면 바닥용 전신 그림을 따로 갖고, 바닥 테마는 그 그림으로 바뀐다', () => {
    expect(DOG_THEMES.filter((t) => t.floor).map((t) => t.id)).toEqual(['fluent-face', 'noto-face']);
    expect(floorTheme(themeById('fluent-face')).file).toBe('fluent-dog.svg');
    expect(floorTheme(themeById('noto-face')).file).toBe('noto-dog.svg');
    expect(floorTheme(themeById('noto-face')).id).toBe('noto-face');
    // 전신 그림이 따로 없는 테마는 같은 그림을 쓴다
    expect(floorTheme(themeById('bucktooth'))).toBe(themeById('bucktooth'));
  });

  it('그림마다 출처와 라이선스가 적혀 있다', () => {
    for (const file of Object.keys(ART)) expect(licenses, file).toContain(`\`${file}\``);
    expect(licenses).toMatch(/fluent-face\.svg[^\n]*MIT/);
    expect(licenses).toMatch(/noto-face\.svg[^\n]*Apache-2\.0/);
    for (const file of ['beagle.svg', 'creative.svg', 'bucktooth.svg', 'orange-sitting.svg']) {
      expect(licenses, file).toMatch(new RegExp(`${file.replace('.', '\\.')}[^\\n]*Unsplash License`));
    }
  });

  it('모르는 테마 id는 기본 테마로 그린다', () => {
    expect(themeById('nope').id).toBe('orange-sitting');
  });
});
