import { describe, expect, it } from 'vitest';
import { emptyData, type Data } from '../shared/data';
import { bellSoundFor, defaultBellSound } from './bell-sound';

/** 등록 음원 하나가 있는 저장 값. change로 일부를 바꾼다. */
function withRegistered(change: (d: Data) => Partial<Data> = () => ({})): Data {
  const data = { ...emptyData(), sounds: [{ id: 'my-bell', name: '우리 학원 종', file: 'my-bell.mp3' }] };
  return { ...data, ...change(data) };
}

describe('울릴 음원 고르기', () => {
  it('처음 설치한 상태는 웨스트민스터 시작 · 끝을 100%로 울린다', () => {
    expect(bellSoundFor(emptyData(), 'start')).toEqual({ source: 'builtin', file: 'westminster-start.wav', volume: 1 });
    expect(bellSoundFor(emptyData(), 'end')).toEqual({ source: 'builtin', file: 'westminster-end.wav', volume: 1 });
  });

  it('크기는 음원별 음량 × 전체 음량이다', () => {
    const data = { ...emptyData(), endBell: 'chord-end', soundVolumes: { 'chord-end': 50 }, masterVolume: 80 };
    expect(bellSoundFor(data, 'end')).toEqual({ source: 'builtin', file: 'chord-end.wav', volume: 0.4 });
    // 다른 음원의 음량은 쓰지 않는다
    expect(bellSoundFor(data, 'start').volume).toBe(0.8);
  });

  it('등록 음원을 고르면 그 파일을 울린다', () => {
    const data = withRegistered(() => ({ startBell: 'my-bell', soundVolumes: { 'my-bell': 0 } }));
    expect(bellSoundFor(data, 'start')).toEqual({ source: 'registered', file: 'my-bell.mp3', volume: 0 });
  });

  it('고른 음원이 목록에 없으면 그 자리의 기본 내장 음원을 그 음원의 음량으로 울린다', () => {
    const data = {
      ...emptyData(),
      startBell: 'gone',
      endBell: 'gone',
      soundVolumes: { gone: 10, 'westminster-start': 60 },
    };
    expect(bellSoundFor(data, 'start')).toEqual({ source: 'builtin', file: 'westminster-start.wav', volume: 0.6 });
    expect(bellSoundFor(data, 'end')).toEqual({ source: 'builtin', file: 'westminster-end.wav', volume: 1 });
  });

  it('기본 내장 음원은 고른 음원과 상관없이 그 자리의 웨스트민스터를 그 음원의 음량으로 낸다', () => {
    const data = withRegistered(() => ({ startBell: 'my-bell', soundVolumes: { 'my-bell': 20, 'westminster-start': 40 } }));
    expect(defaultBellSound(data, 'start')).toEqual({ source: 'builtin', file: 'westminster-start.wav', volume: 0.4 });
  });
});
