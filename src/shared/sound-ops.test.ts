import { describe, expect, it } from 'vitest';
import { DEFAULT_END_BELL, DEFAULT_START_BELL, emptyData, type Data } from './data';
import {
  pruneSounds,
  registerSound,
  removeSound,
  renameSound,
  restoreSound,
  setBell,
  setMasterVolume,
  setSoundVolume,
} from './sound-ops';

/** 등록 음원 두 개가 있고 하나는 시작종, 하나는 끝종으로 고른 데이터. */
function seeded(): Data {
  let data = emptyData();
  data = registerSound(data, { id: 'a', name: '우리 학원 종', file: 'a.mp3' });
  data = registerSound(data, { id: 'b', name: '쉬는 종', file: 'b.wav' });
  data = setSoundVolume(data, 'a', 65);
  data = setBell(data, 'start', 'a');
  data = setBell(data, 'end', 'b');
  return data;
}

describe('종소리 지우기와 되돌리기', () => {
  it('시작종으로 쓰던 음원을 지우면 그 자리가 웨스트민스터 시작으로 돌아가고, 되돌리면 선택과 음량도 돌아온다', () => {
    const before = seeded();
    const { data: after, removed } = removeSound(before, 'a');
    expect(after.sounds.map((s) => s.id)).toEqual(['b']);
    expect(after.startBell).toBe(DEFAULT_START_BELL);
    expect(after.endBell).toBe('b');
    expect(after.soundVolumes.a).toBeUndefined();

    expect(restoreSound(after, removed!)).toEqual(before);
  });

  it('끝종으로 쓰던 음원을 지우면 웨스트민스터 끝으로 돌아간다', () => {
    const { data } = removeSound(seeded(), 'b');
    expect(data.endBell).toBe(DEFAULT_END_BELL);
    expect(data.startBell).toBe('a');
  });

  it('없는 음원과 내장 음원은 지우지 않는다', () => {
    const data = seeded();
    expect(removeSound(data, 'nope')).toEqual({ data, removed: null });
    expect(removeSound(data, DEFAULT_START_BELL).removed).toBeNull();
  });

  it('원래 자리에 되돌리고, 이미 있으면 그대로 둔다', () => {
    const before = seeded();
    const { data: after, removed } = removeSound(before, 'a');
    const restored = restoreSound(after, removed!);
    expect(restored.sounds.map((s) => s.id)).toEqual(['a', 'b']);
    expect(restoreSound(restored, removed!)).toBe(restored);
  });
});

describe('이름과 음량과 선택', () => {
  it('이름을 바꾼다. 앞뒤 공백을 떼고, 빈 이름과 내장 음원은 무시한다', () => {
    const data = seeded();
    expect(renameSound(data, 'a', '  새 이름 ').sounds[0]!.name).toBe('새 이름');
    expect(renameSound(data, 'a', '   ')).toBe(data);
    expect(renameSound(data, DEFAULT_START_BELL, 'x')).toBe(data);
  });

  it('음량은 0~100 정수로 맞추고, 모르는 음원은 무시한다', () => {
    const data = seeded();
    expect(setSoundVolume(data, 'b', 130).soundVolumes.b).toBe(100);
    expect(setSoundVolume(data, 'b', -4).soundVolumes.b).toBe(0);
    expect(setSoundVolume(data, 'b', 42.6).soundVolumes.b).toBe(43);
    expect(setSoundVolume(data, DEFAULT_END_BELL, 20).soundVolumes[DEFAULT_END_BELL]).toBe(20);
    expect(setSoundVolume(data, 'nope', 20)).toBe(data);
    expect(setMasterVolume(data, 55).masterVolume).toBe(55);
  });

  it('목록에 없는 음원은 시작종 · 끝종으로 고르지 못한다', () => {
    const data = seeded();
    expect(setBell(data, 'start', 'nope')).toBe(data);
    expect(setBell(data, 'end', 'chord-end').endBell).toBe('chord-end');
  });
});

describe('시작할 때 쓸 수 없는 등록 음원 빼기', () => {
  it('쓸 수 없는 음원은 목록과 음량에서 빠지고 쓰이던 자리는 기본 음원으로 돌아간다', () => {
    const data = pruneSounds(seeded(), new Set(['b']));
    expect(data.sounds.map((s) => s.id)).toEqual(['b']);
    expect(data.soundVolumes.a).toBeUndefined();
    expect(data.startBell).toBe(DEFAULT_START_BELL);
    expect(data.endBell).toBe('b');
  });

  it('모두 쓸 수 있으면 같은 데이터를 돌려준다', () => {
    const data = seeded();
    expect(pruneSounds(data, new Set(['a', 'b']))).toBe(data);
  });
});
