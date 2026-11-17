import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildIco, decodePng, icoPng, icoSizes, pngSize } from './image-files.mts';

// 2×1 크기 RGBA PNG를 손으로 만든다: 불투명 빨강, 반투명 검정
function tinyPng(): Buffer {
  const chunk = (type: string, body: Buffer) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    return out; // CRC는 이 도구가 확인하지 않아 0으로 둔다
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.from([0, 255, 0, 0, 255, 0, 0, 0, 128]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(row)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('PNG 읽기', () => {
  it('크기와 픽셀을 돌려준다', () => {
    const png = tinyPng();
    expect(pngSize(png)).toEqual({ width: 2, height: 1 });
    expect([...decodePng(png).data]).toEqual([255, 0, 0, 255, 0, 0, 0, 128]);
  });

  it('PNG가 아니면 던진다', () => {
    expect(() => pngSize(Buffer.from('not a png at all, really'))).toThrow();
  });
});

describe('ICO 만들기', () => {
  const png = tinyPng();
  const ico = buildIco([
    { size: 16, png },
    { size: 256, png },
  ]);

  it('담은 크기를 순서대로 읽는다. 256은 너비 0으로 적힌다', () => {
    expect(icoSizes(ico)).toEqual([16, 256]);
    expect(ico.readUInt8(6 + 16)).toBe(0);
  });

  it('크기별 PNG를 그대로 꺼낼 수 있다', () => {
    expect(Buffer.from(icoPng(ico, 256)).equals(png)).toBe(true);
    expect(() => icoPng(ico, 32)).toThrow();
  });
});
