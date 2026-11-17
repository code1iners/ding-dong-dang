import { describe, expect, it } from 'vitest';
import bucktoothArt from './art/bucktooth.svg?raw';
import orangeSittingArt from './art/orange-sitting.svg?raw';
import { DEFAULT_THEME_ID, DOG_THEMES, themeById } from './themes';

/** 파일 이름 → 그림 원본 글. 테마가 가리키는 파일을 시험이 따로 읽는다. */
const ART: Record<string, string> = { 'orange-sitting.svg': orangeSittingArt, 'bucktooth.svg': bucktoothArt };

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
  it('기본 테마와 뻐드렁니 강아지가 있다', () => {
    expect(DOG_THEMES.map((t) => t.id)).toEqual(['orange-sitting', 'bucktooth']);
    expect(DEFAULT_THEME_ID).toBe('orange-sitting');
  });

  it('원본 글자를 세는 방법이 맞다: 기본 테마 15개(clipPath 안의 사각형 제외), 뻐드렁니 강아지 29개', () => {
    // 개수는 강아지 테마 SVG의 부위 구성 확인(23번)과 원본을 하나씩 강조해 본 결과다
    expect(drawableCount(orangeSittingArt)).toBe(15);
    expect(drawableCount(bucktoothArt)).toBe(29);
  });

  for (const theme of DOG_THEMES) {
    describe(theme.id, () => {
      /** 그림 원본의 그리는 요소 수. */
      const count = drawableCount(ART[theme.file] ?? '');

      it('부위 표와 숨김 목록에 그림에 없는 요소 번호가 없다', () => {
        /** 표가 가리키는 모든 번호. */
        const indexes = [...theme.parts.flatMap((p) => p.elements), ...theme.hidden];
        for (const i of indexes) {
          expect(Number.isInteger(i) && i >= 0 && i < count, `요소 ${i} (그림에는 0~${count - 1})`).toBe(true);
        }
      });

      it('그리는 그림이 테마가 가리키는 파일이다', () => {
        expect(theme.art).toBe(ART[theme.file]);
      });

      it('관절은 부위 상자 안의 비율이고, 숨긴 요소는 어느 부위에도 들지 않는다', () => {
        for (const part of theme.parts) {
          expect(part.elements.length, part.name).toBeGreaterThan(0);
          for (const v of part.joint ?? []) expect(v >= 0 && v <= 1, part.name).toBe(true);
          for (const i of part.elements) expect(theme.hidden, `${part.name}의 ${i}`).not.toContain(i);
        }
      });
    });
  }

  it('뻐드렁니 강아지는 걷고 그림자(요소 4)를 빼며, 기본 테마는 통통 튄다', () => {
    expect(themeById('bucktooth').gait).toBe('walk');
    expect(themeById('bucktooth').hidden).toEqual([4]);
    expect(themeById('orange-sitting').gait).toBe('hop');
    expect(themeById('bucktooth').parts.map((p) => p.name)).toEqual(expect.arrayContaining(['legA', 'legB', 'legC', 'legD']));
  });

  it('모르는 테마 id는 기본 테마로 그린다', () => {
    expect(themeById('nope').id).toBe('orange-sitting');
  });
});
