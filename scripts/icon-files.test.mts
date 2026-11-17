import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appIconSvg, appTileSvg, macTraySvg, winTraySvg } from './icon-art.mts';
import {
  APP_ICON_SIZE,
  ICON_FILES,
  MAC_TRAY_SIZES,
  TILE_ICO_SIZES,
  TRAY_ICO_SIZES,
} from './icon-files.mts';
import { decodePng, icoPng, icoSizes, pngSize, type RgbaImage } from './image-files.mts';

const dir = join(import.meta.dirname, '..', 'resources', 'icons');
const read = (file: string) => new Uint8Array(readFileSync(join(dir, file)));

// 보이는(알파 > 0) 픽셀만 모아 본다
function visible(image: RgbaImage) {
  const pixels: { r: number; g: number; b: number; a: number }[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const a = image.data[i + 3]!;
    if (a > 0) pixels.push({ r: image.data[i]!, g: image.data[i + 1]!, b: image.data[i + 2]!, a });
  }
  return pixels;
}
const alphaOf = (image: RgbaImage) => Array.from({ length: image.data.length / 4 }, (_, i) => image.data[i * 4 + 3]!);

describe('macOS 앱 아이콘', () => {
  const png = read(ICON_FILES.appPng);

  it('1024px 정사각형이다', () => {
    expect(pngSize(png)).toEqual({ width: APP_ICON_SIZE, height: APP_ICON_SIZE });
  });

  it('틀과 그림자 없이 네 모서리까지 바탕색으로 꽉 차 있다', () => {
    const image = decodePng(png);
    const at = (x: number, y: number) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]] as const) {
      expect(at(x, y)).toEqual([0xf2, 0xa3, 0x3c, 255]);
    }
  });
});

describe('Windows 앱 아이콘(둥근 타일)', () => {
  const ico = read(ICON_FILES.appIco);

  it('정한 크기 여덟 개가 모두 들어 있다', () => {
    expect(icoSizes(ico)).toEqual([...TILE_ICO_SIZES]);
    expect([...TILE_ICO_SIZES]).toEqual([16, 20, 24, 32, 40, 48, 64, 256]);
  });

  it('각 그림의 실제 크기가 머리글과 같다', () => {
    for (const size of TILE_ICO_SIZES) {
      expect(pngSize(icoPng(ico, size))).toEqual({ width: size, height: size });
    }
  });

  it('모서리는 투명하고 한가운데는 차 있다', () => {
    const image = decodePng(icoPng(ico, 256));
    expect(image.data[3]).toBe(0);
    expect(image.data[(128 * 256 + 128) * 4 + 3]).toBe(255);
  });
});

describe('macOS 메뉴 막대 템플릿 이미지', () => {
  const files = [
    [ICON_FILES.trayMacOn, MAC_TRAY_SIZES[0]],
    [ICON_FILES.trayMacOn2x, MAC_TRAY_SIZES[1]],
    [ICON_FILES.trayMacOff, MAC_TRAY_SIZES[0]],
    [ICON_FILES.trayMacOff2x, MAC_TRAY_SIZES[1]],
  ] as const;

  it('파일 이름이 Template으로 끝나고 2배판은 @2x가 붙는다', () => {
    for (const [file] of files) expect(file).toMatch(/Template(@2x)?\.png$/);
  });

  it.each(files)('%s는 %ipx이고 검정 + 알파만 쓴다(색이 없다)', (file, size) => {
    const png = read(file);
    expect(pngSize(png)).toEqual({ width: size, height: size });
    const pixels = visible(decodePng(png));
    expect(pixels.length).toBeGreaterThan(size); // 비어 있지 않다
    expect(pixels.every((p) => p.r === 0 && p.g === 0 && p.b === 0)).toBe(true);
    expect(pixels.length).toBeLessThan(size * size); // 발바닥과 바깥이 투명하다
  });

  it('켜짐과 빗금 그림은 서로 다르고 빗금이 닿은 곳이 꽤 바뀐다', () => {
    for (const [on, off] of [
      [files[0], files[2]],
      [files[1], files[3]],
    ] as const) {
      const onAlpha = alphaOf(decodePng(read(on[0])));
      const offAlpha = alphaOf(decodePng(read(off[0])));
      expect(offAlpha).not.toEqual(onAlpha);
      const changed = onAlpha.filter((v, i) => v !== offAlpha[i]).length;
      expect(changed).toBeGreaterThan(on[1] * 2);
    }
  });
});

describe('Windows 트레이 색 아이콘', () => {
  const on = read(ICON_FILES.trayWinOn);
  const off = read(ICON_FILES.trayWinOff);

  it('16 · 20 · 24 · 32px가 들어 있다', () => {
    expect([...TRAY_ICO_SIZES]).toEqual([16, 20, 24, 32]);
    expect(icoSizes(on)).toEqual([...TRAY_ICO_SIZES]);
    expect(icoSizes(off)).toEqual([...TRAY_ICO_SIZES]);
  });

  it('켜짐은 노란색과 갈색이 있는 색 아이콘이다', () => {
    const pixels = visible(decodePng(icoPng(on, 32)));
    const yellow = pixels.filter((p) => p.r > 220 && p.g > 170 && p.b < 100);
    const brown = pixels.filter((p) => p.r > 170 && p.r < 220 && p.g > 90 && p.g < 140 && p.b < 80);
    expect(yellow.length).toBeGreaterThan(100);
    expect(brown.length).toBeGreaterThan(30);
  });

  it('꺼짐은 색 없이 회색뿐이다', () => {
    for (const size of TRAY_ICO_SIZES) {
      const pixels = visible(decodePng(icoPng(off, size)));
      expect(pixels.length).toBeGreaterThan(size);
      expect(pixels.every((p) => p.r === p.g && p.g === p.b)).toBe(true);
    }
  });

  it('16px에서도 켜짐과 꺼짐의 모양이 다르다(꺼짐에는 빗금이 있다)', () => {
    const onAlpha = alphaOf(decodePng(icoPng(on, 16)));
    const offAlpha = alphaOf(decodePng(icoPng(off, 16)));
    expect(onAlpha.filter((v, i) => v !== offAlpha[i]).length).toBeGreaterThan(30);
  });
});

describe('SVG 원본', () => {
  it('저장된 SVG가 코드가 그리는 그림과 같다(원본을 고치고 npm run icons를 잊지 않게)', () => {
    const sources = {
      'app-icon.svg': appIconSvg(),
      'app-tile.svg': appTileSvg(),
      'tray-mac-on.svg': macTraySvg('on'),
      'tray-mac-off.svg': macTraySvg('slash'),
      'tray-win-on.svg': winTraySvg('on'),
      'tray-win-off.svg': winTraySvg('off'),
    };
    for (const [file, svg] of Object.entries(sources)) {
      expect(readFileSync(join(dir, 'source', file), 'utf8')).toBe(svg);
    }
  });
});
