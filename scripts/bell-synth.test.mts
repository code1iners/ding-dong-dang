import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_SOUNDS } from '../src/shared/builtin-sounds.ts';
import { DEFAULT_END_BELL, DEFAULT_START_BELL } from '../src/shared/data.ts';
import {
  PEAK_CEILING,
  decodeWav,
  limit,
  noteFrequency,
  peakOf,
  renderBuiltinSound,
  rmsOf,
} from './bell-synth.mts';

const dir = join(import.meta.dirname, '..', 'resources', 'sounds', 'builtin');
const read = (file: string) => new Uint8Array(readFileSync(join(dir, file)));

describe('내장 음원 목록', () => {
  it('열두 개이고 id와 파일 이름이 겹치지 않는다', () => {
    expect(BUILTIN_SOUNDS).toHaveLength(12);
    expect(new Set(BUILTIN_SOUNDS.map((s) => s.id)).size).toBe(12);
    expect(new Set(BUILTIN_SOUNDS.map((s) => s.file)).size).toBe(12);
  });

  it('화면 이름은 짝 이름에 "시작" 또는 "끝"을 붙인다', () => {
    expect(BUILTIN_SOUNDS.map((s) => s.name)).toEqual([
      '웨스트민스터 시작', '웨스트민스터 끝',
      '딩동댕동 시작', '딩동댕동 끝',
      '띠링 시작', '띠링 끝',
      '다섯 음 시작', '다섯 음 끝',
      '아르페지오 시작', '아르페지오 끝',
      '화음 시작', '화음 끝',
    ]);
  });

  it('기본 시작종과 끝종 id가 목록에 있다', () => {
    const ids = BUILTIN_SOUNDS.map((s) => s.id);
    expect(ids).toContain(DEFAULT_START_BELL);
    expect(ids).toContain(DEFAULT_END_BELL);
  });
});

describe.each(BUILTIN_SOUNDS)('$name ($file)', (sound) => {
  const wav = decodeWav(read(sound.file));

  it('길이가 확정표와 0.1초 안에서 맞는다', () => {
    expect(Math.abs(wav.samples.length / wav.sampleRate - sound.seconds)).toBeLessThanOrEqual(0.1);
  });

  it('최대값이 1을 넘지 않고 한도 안이다', () => {
    expect(peakOf(wav.samples)).toBeLessThanOrEqual(PEAK_CEILING);
  });

  it('소리가 난다', () => {
    expect(peakOf(wav.samples)).toBeGreaterThan(0.1);
  });

  it('크기(RMS)가 이전(-17.7 dBFS)보다 확실히 크고, 청취 시안의 범위 안에 있다', () => {
    // 승인한 +9 dB 시안은 파일마다 평균이 -9.4 ~ -11.2 dBFS였다. 이를 감싸는 -12 ~ -8 dBFS(0.251 ~ 0.398)
    expect(rmsOf(wav.samples)).toBeGreaterThan(0.25);
    expect(rmsOf(wav.samples)).toBeLessThan(0.4);
  });

  it('스크립트를 다시 돌려도 저장소의 파일과 바이트가 같다', () => {
    expect(renderBuiltinSound(sound.id)).toEqual(read(sound.file));
  });
});

describe('음높이', () => {
  it('A4는 440Hz, 한 옥타브 위는 두 배다', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440);
    expect(noteFrequency('A5')).toBeCloseTo(880);
  });
});

describe('리미터', () => {
  it('한도를 넘는 피크가 있어도 출력 최대값이 한도 이하다', () => {
    /** 0.5로 이어지다 한 곳에서 1.9로 튀는 신호. */
    const input = new Float32Array(44100).fill(0.5);
    input[20000] = 1.9;
    expect(peakOf(limit(input, 0.95))).toBeLessThanOrEqual(0.95);
  });

  it('피크 앞부터 서서히 줄여서 한도에 닿는 순간 소리를 갑자기 자르지 않는다', () => {
    /** 0.5로 이어지다 한 곳에서 1.9로 튀는 신호. */
    const input = new Float32Array(88200).fill(0.5);
    input[20000] = 1.9;
    /** 눌러 낸 신호. */
    const output = limit(input, 0.95);
    /** 샘플마다 원래 크기에 곱한 배율. */
    const gains = Array.from(output, (v, i) => v / (input[i] as number));
    /** 이웃한 샘플 사이에서 배율이 가장 크게 바뀐 폭. */
    let biggestStep = 0;
    for (let i = 1; i < gains.length; i++) {
      biggestStep = Math.max(biggestStep, Math.abs((gains[i] as number) - (gains[i - 1] as number)));
    }
    expect(biggestStep).toBeLessThan(0.01);
    // 피크 50샘플(약 1ms) 앞에서는 이미 줄어들기 시작했다
    expect(gains[19950]).toBeLessThan(1);
  });

  it('피크가 지나간 뒤에도 한동안 눌린 채 있다가 서서히 원래 크기로 돌아온다', () => {
    /** 0.5로 이어지다 한 곳에서 1.9로 튀는 신호. */
    const input = new Float32Array(88200).fill(0.5);
    input[20000] = 1.9;
    /** 눌러 낸 신호. */
    const output = limit(input, 0.95);
    /** 샘플마다 원래 크기에 곱한 배율. */
    const gains = Array.from(output, (v, i) => v / (input[i] as number));
    // 피크 10ms 뒤에는 아직 한참 눌려 있다
    expect(gains[20000 + 441]).toBeLessThan(0.9);
    // 피크 0.5초 뒤에는 원래 크기로 돌아와 있다
    expect(gains[20000 + 22050]).toBeGreaterThan(0.999);
  });

  it('한도 안에 있는 소리는 그대로 두고, 무음은 무음으로 둔다', () => {
    /** 최대값 0.9로 오르내리는 신호. */
    const quiet = Float32Array.from({ length: 44100 }, (_, i) => 0.9 * Math.sin(i / 20));
    expect(limit(quiet, 0.95)).toEqual(quiet);
    expect(limit(new Float32Array(1000), 0.95)).toEqual(new Float32Array(1000));
  });
});
