import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_SOUNDS } from '../src/shared/builtin-sounds.ts';
import { DEFAULT_END_BELL, DEFAULT_START_BELL } from '../src/shared/data.ts';
import {
  PEAK_CEILING,
  TARGET_RMS,
  decodeWav,
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

  it('크기(RMS)가 정한 범위 안에 있다', () => {
    expect(rmsOf(wav.samples)).toBeGreaterThan(TARGET_RMS * 0.97);
    expect(rmsOf(wav.samples)).toBeLessThan(TARGET_RMS * 1.03);
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
