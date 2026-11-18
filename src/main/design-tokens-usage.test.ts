import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** 렌더러 스타일 전문. */
const appCss = readFileSync(resolve(__dirname, '../renderer/src/styles/app.css'), 'utf8');

/** `속성: 값;` 선언의 값을 모두 모은다. */
function valuesOf(property: string): string[] {
  return [...appCss.matchAll(new RegExp(`(?:^|[\\s{;])${property}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
}

describe('DESIGN.md 글자 크기와 모서리 규칙', () => {
  it('글자 크기는 토큰만 쓴다(여섯 단계 밖의 리터럴이 없다)', () => {
    const literals = valuesOf('font-size').filter((v) => !v.startsWith('var(--font-size-'));
    expect(literals).toEqual([]);
  });

  it('모서리 반지름은 허용 목록(10·14·16·20과 원)에 든다', () => {
    const allowed = /^(var\(--radius-(input|button-sm|button|rail|card|pill)\)|50%|999px|10px|14px|16px|20px)$/;
    const bad = valuesOf('border-radius').filter((v) => !allowed.test(v));
    expect(bad).toEqual([]);
  });
});
