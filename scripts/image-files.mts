// 아이콘 산출물을 만들고 검사할 때 쓰는 PNG · ICO 도구. 외부 패키지 없이 zlib만 쓴다.
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface RgbaImage {
  width: number;
  height: number;
  /** 픽셀마다 R, G, B, A 한 바이트씩. */
  data: Uint8Array;
}

export function isPng(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 8)).equals(PNG_SIGNATURE);
}

/** PNG 머리글에서 크기만 읽는다. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  if (!isPng(bytes)) throw new Error('PNG 파일이 아니다');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** 8비트 RGBA 또는 RGB, 끼워 넣기 없는 PNG만 푼다(RGB는 알파 255로 채운다). 그 밖의 형식이면 던진다. */
export function decodePng(bytes: Uint8Array): RgbaImage {
  const { width, height } = pngSize(bytes);
  const buf = Buffer.from(bytes);
  const idat: Buffer[] = [];
  let channels = 4;
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      if (body[8] !== 8 || (body[9] !== 6 && body[9] !== 2) || body[12] !== 0) {
        throw new Error('8비트 RGBA 또는 RGB, 끼워 넣기 없는 PNG만 지원한다');
      }
      channels = body[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? lines[y * stride + x - channels]! : 0;
      const up = y > 0 ? lines[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? lines[(y - 1) * stride + x - channels]! : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      lines[y * stride + x] = (line[x]! + predictor) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: lines };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set(lines.subarray(i * 3, i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export interface IcoEntry {
  size: number;
  png: Uint8Array;
}

/** PNG를 그대로 담은 .ico를 만든다(Windows Vista 이후 형식). 256px은 너비 0으로 적는다. */
export function buildIco(entries: readonly IcoEntry[]): Buffer {
  const headerSize = 6 + entries.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = headerSize;
  entries.forEach((entry, i) => {
    const at = 6 + i * 16;
    const dim = entry.size >= 256 ? 0 : entry.size;
    header.writeUInt8(dim, at);
    header.writeUInt8(dim, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(entry.png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });
  return Buffer.concat([header, ...entries.map((e) => Buffer.from(e.png))]);
}

/** .ico에 들어 있는 그림의 한 변 길이를 순서대로 돌려준다. */
export function icoSizes(bytes: Uint8Array): number[] {
  const buf = Buffer.from(bytes);
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('ICO 파일이 아니다');
  const count = buf.readUInt16LE(4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const width = buf.readUInt8(6 + i * 16);
    sizes.push(width === 0 ? 256 : width);
  }
  return sizes;
}

/** .ico 안에서 한 변이 size인 PNG 바이트를 꺼낸다. */
export function icoPng(bytes: Uint8Array, size: number): Uint8Array {
  const buf = Buffer.from(bytes);
  const index = icoSizes(bytes).indexOf(size);
  if (index < 0) throw new Error(`${size}px 그림이 없다`);
  const length = buf.readUInt32LE(6 + index * 16 + 8);
  const offset = buf.readUInt32LE(6 + index * 16 + 12);
  return buf.subarray(offset, offset + length);
}
