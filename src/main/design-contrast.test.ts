import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** tokens.css에서 `--이름: #값` 선언을 읽는다. */
const tokensCss = readFileSync(resolve(__dirname, '../renderer/src/styles/tokens.css'), 'utf8');
/** DESIGN.md 전문. */
const designMd = readFileSync(resolve(__dirname, '../../DESIGN.md'), 'utf8');

/** 토큰 이름(`--color-ink`)에서 `#rrggbb` 값을 찾는다. */
function token(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokensCss);
  if (!match) throw new Error(`tokens.css에 ${name}이 없어요`);
  return match[1]!.toLowerCase();
}

/** sRGB 색의 상대 휘도(WCAG 2.2). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 대비비. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** 시간표 색 여덟. */
const TIMETABLE = Array.from({ length: 8 }, (_, i) => token(`--timetable-${i}`));

/** 글자와 바탕 쌍: 4.5:1 이상이어야 한다. [글자 토큰, 바탕 토큰 또는 값, 쓰는 곳] */
const TEXT_PAIRS: [string, string, string][] = [
  ['--color-ink', '--color-bg', '창 바탕 위 글자'],
  ['--color-ink', '--color-card', '카드 · 모달 · 알림 위 글자'],
  ['--color-ink', '--color-soft', '목록 줄 · 옅은 단추 위 글자'],
  ['--color-ink', '--color-green', '초록 면(주 단추 · 수업 중) 위 글자'],
  ['--color-ink', '--color-orange', '주황 면(교시 번호) 위 글자'],
  ['--color-ink-2', '--color-card', '흰 면 위 보조 글자'],
  ['--color-ink-2', '--color-soft', '옅은 면 위 보조 글자'],
  ['--color-link', '--color-card', '모달의 "편집" · 글자 링크'],
  ['--color-link', '--color-soft', '옅은 면 위 글자 링크'],
  ['--color-red', '--color-card', '오류 글자'],
  ['--color-red', '--color-soft', '옅은 면 위 오류 글자'],
  ['#ffffff', '--color-red', '지우는 단추의 흰 글자'],
  ...TIMETABLE.map((c, i): [string, string, string] => ['--color-ink', c, `시간표 색 ${i} 위 글자`]),
];

/** 부품의 경계와 아이콘 쌍: 3:1 이상이어야 한다. */
const NON_TEXT_PAIRS: [string, string, string][] = [
  ['--color-line', '--color-card', '입력 칸 · 슬라이더 · 선택 동그라미 테두리(흰 면)'],
  ['--color-line', '--color-soft', '선택 동그라미 테두리(옅은 면)'],
  ['--color-line-on-bg', '--color-bg', '바탕 위 아이콘과 테두리'],
  ['--color-line-on-bg', '--color-card', '흰 단추 위 아이콘'],
  ['--color-off', '--color-card', '꺼진 스위치'],
  ['--color-green-line', '--color-card', '켜진 스위치의 테두리'],
  ['--color-ink', '--color-bg', '선택 테두리(바탕)'],
  ['--color-ink', '--color-card', '선택 테두리(흰 면)'],
  ['--color-focus', '--color-bg', '초점 테두리(바탕)'],
  ['--color-focus', '--color-card', '초점 테두리(흰 면)'],
  ['--color-focus', '--color-soft', '초점 테두리(옅은 면)'],
  ['--color-focus', '--color-green', '초점 테두리(초록 단추)'],
  ['--color-red', '--color-card', '오류 테두리와 지우기 아이콘'],
  ['--color-red', '--color-bg', '빨강 면이 바탕과 만나는 경계'],
  ['--color-stamp', '--color-card', '지난 교시의 발바닥 도장'],
  ['--color-ink', '--color-orange', '업데이트 점의 테두리와 주황'],
];

/** 값이 토큰 이름이면 읽고, `#`으로 시작하면 그대로 쓴다. */
function resolveColor(value: string): string {
  return value.startsWith('--') ? token(value) : value;
}

describe('색 쌍 대비', () => {
  it.each(TEXT_PAIRS)('글자 %s / %s (%s)는 4.5:1 이상이다', (fg, bg) => {
    expect(contrast(resolveColor(fg), resolveColor(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('부품 %s / %s (%s)는 3:1 이상이다', (fg, bg) => {
    expect(contrast(resolveColor(fg), resolveColor(bg))).toBeGreaterThanOrEqual(3);
  });

  it('주황 점은 글자 색 테두리가 있어 바탕 · 흰 단추 · 초록 단추와 구분된다', () => {
    // 주황 자체는 어느 면과도 3:1이 안 되므로, 점의 테두리(글자 색)가 경계를 맡는다
    const orange = token('--color-orange');
    expect(contrast(orange, token('--color-bg'))).toBeLessThan(3);
    for (const surface of ['--color-bg', '--color-card', '--color-green']) {
      expect(contrast(token('--color-ink'), token(surface))).toBeGreaterThanOrEqual(3);
    }
  });

  it('잠긴 단추의 회색 글자는 WCAG가 대비를 요구하지 않는 비활성 부품이라 검사 밖이다', () => {
    // DESIGN.md가 정한 값(#6B7480 on #E3E7EC)을 그대로 쓰고, 이유를 옆에 글로 적어 상태를 전한다
    expect(token('--color-locked')).toBe('#e3e7ec');
    expect(token('--color-locked-ink')).toBe('#6b7480');
  });
});

describe('DESIGN.md의 색 표와 tokens.css', () => {
  /** 표의 `이름 | \`#값\`` 줄에서 첫 `#rrggbb`를 모은다. */
  const rows = [...designMd.matchAll(/^\| (.+?) \| `(#[0-9A-Fa-f]{6})`/gm)].map((m) => [m[1]!, m[2]!.toLowerCase()] as const);
  /** 표 이름 → tokens.css 변수. */
  const NAMES: Record<string, string> = {
    바탕: '--color-bg',
    카드: '--color-card',
    '옅은 면': '--color-soft',
    글자: '--color-ink',
    '보조 글자': '--color-ink-2',
    경계: '--color-line',
    '바탕 위 경계': '--color-line-on-bg',
    띠: '--color-band',
    초록: '--color-green',
    주황: '--color-orange',
    도장: '--color-stamp',
    꺼짐: '--color-off',
    빨강: '--color-red',
    초점: '--color-focus',
    링크: '--color-link',
  };

  it('표의 색 열다섯 개를 모두 읽는다', () => {
    expect(rows.map(([name]) => name).sort()).toEqual(Object.keys(NAMES).sort());
  });

  it.each(Object.entries(NAMES))('%s는 tokens.css의 %s와 같다', (name, variable) => {
    expect(rows.find(([n]) => n === name)?.[1]).toBe(token(variable));
  });
});
