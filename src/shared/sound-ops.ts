// 종소리 등록 · 이름 바꾸기 · 지우기 · 음량 · 시작종/끝종 고르기. 저장 데이터를 받아 새 데이터를 돌려주는 순수 함수다.
// 바뀌는 것이 없으면 받은 데이터를 그대로 돌려줘서, 부르는 쪽이 `===`로 변경 여부를 알 수 있다.

import type { BellKind } from './bell-decision';
import { BUILTIN_SOUNDS } from './builtin-sounds';
import { DEFAULT_END_BELL, DEFAULT_START_BELL, type Data, type RegisteredSound } from './data';

/** 지운 등록 음원과 지우기 전의 자리 · 음량 · 시작종/끝종 선택. 되돌리기에 쓴다. */
export type RemovedSound = {
  sound: RegisteredSound;
  index: number;
  /** 지우기 전의 음원별 음량. 따로 정한 적이 없으면 undefined. */
  volume: number | undefined;
  wasStart: boolean;
  wasEnd: boolean;
};

/** 내장이든 등록이든 목록에 있는 음원 id인지. */
export function isKnownSound(data: Data, id: string): boolean {
  return BUILTIN_SOUNDS.some((s) => s.id === id) || data.sounds.some((s) => s.id === id);
}

/** 0~100 정수로 맞춘다. */
function clampVolume(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** 등록 음원을 목록 맨 끝에 더한다. */
export function registerSound(data: Data, sound: RegisteredSound): Data {
  return { ...data, sounds: [...data.sounds, sound] };
}

/** 등록 음원의 이름을 바꾼다. 앞뒤 공백은 뗀다. 비게 되는 이름, 내장 음원, 없는 id는 무시한다. */
export function renameSound(data: Data, id: string, name: string): Data {
  const trimmed = name.trim();
  if (trimmed === '' || !data.sounds.some((s) => s.id === id)) return data;
  return { ...data, sounds: data.sounds.map((s) => (s.id === id ? { ...s, name: trimmed } : s)) };
}

/** `ids`에 든 음원을 쓰던 시작종 · 끝종 자리를 기본 내장 음원으로 돌린다. */
function resetBellsUsing(data: Data, ids: ReadonlySet<string>): Pick<Data, 'startBell' | 'endBell'> {
  return {
    startBell: ids.has(data.startBell) ? DEFAULT_START_BELL : data.startBell,
    endBell: ids.has(data.endBell) ? DEFAULT_END_BELL : data.endBell,
  };
}

/** 지운 음원의 음량 기록을 뺀 음량 목록. */
function withoutVolumes(volumes: Data['soundVolumes'], ids: ReadonlySet<string>): Data['soundVolumes'] {
  return Object.fromEntries(Object.entries(volumes).filter(([id]) => !ids.has(id)));
}

/** 등록 음원을 목록에서 뺀다. 쓰던 시작종 · 끝종 자리는 기본 내장 음원이 된다. 내장 음원과 없는 id는 지우지 않는다. */
export function removeSound(data: Data, id: string): { data: Data; removed: RemovedSound | null } {
  const index = data.sounds.findIndex((s) => s.id === id);
  const sound = data.sounds[index];
  if (!sound) return { data, removed: null };
  const ids = new Set([id]);
  return {
    data: {
      ...data,
      sounds: data.sounds.filter((s) => s.id !== id),
      soundVolumes: withoutVolumes(data.soundVolumes, ids),
      ...resetBellsUsing(data, ids),
    },
    removed: {
      sound,
      index,
      volume: data.soundVolumes[id],
      wasStart: data.startBell === id,
      wasEnd: data.endBell === id,
    },
  };
}

/** 지운 등록 음원을 원래 자리와 음량, 시작종 · 끝종 선택까지 되돌린다. 이미 있으면 그대로 둔다. */
export function restoreSound(data: Data, { sound, index, volume, wasStart, wasEnd }: RemovedSound): Data {
  if (data.sounds.some((s) => s.id === sound.id)) return data;
  const sounds = [...data.sounds];
  sounds.splice(Math.min(index, sounds.length), 0, sound);
  return {
    ...data,
    sounds,
    soundVolumes: volume === undefined ? data.soundVolumes : { ...data.soundVolumes, [sound.id]: volume },
    startBell: wasStart ? sound.id : data.startBell,
    endBell: wasEnd ? sound.id : data.endBell,
  };
}

/** 음원별 음량을 바꾼다. 내장 음원도 된다. 목록에 없는 음원은 무시한다. */
export function setSoundVolume(data: Data, id: string, volume: number): Data {
  if (!isKnownSound(data, id)) return data;
  return { ...data, soundVolumes: { ...data.soundVolumes, [id]: clampVolume(volume) } };
}

/** 전체 음량을 바꾼다. */
export function setMasterVolume(data: Data, volume: number): Data {
  return { ...data, masterVolume: clampVolume(volume) };
}

/** 시작종이나 끝종으로 쓸 음원을 고른다. 목록에 없는 음원은 무시한다. */
export function setBell(data: Data, kind: BellKind, id: string): Data {
  if (!isKnownSound(data, id)) return data;
  return kind === 'start' ? { ...data, startBell: id } : { ...data, endBell: id };
}

/** 쓸 수 있는 등록 음원(`usable`의 id)만 남긴다. 빠진 음원이 쓰이던 자리는 기본 내장 음원이 된다. */
export function pruneSounds(data: Data, usable: ReadonlySet<string>): Data {
  const gone = new Set(data.sounds.filter((s) => !usable.has(s.id)).map((s) => s.id));
  if (gone.size === 0) return data;
  return {
    ...data,
    sounds: data.sounds.filter((s) => !gone.has(s.id)),
    soundVolumes: withoutVolumes(data.soundVolumes, gone),
    ...resetBellsUsing(data, gone),
  };
}
