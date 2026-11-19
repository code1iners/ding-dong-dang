import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyData, type Data } from '../shared/data';
import { DATA_FORMAT, parseData } from './data-format';
import { DATA_FILE, openStorage } from './storage';

/** 테스트마다 새로 만드는 임시 데이터 폴더. */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ddd-data-format-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 시간대 둘을 가진 평일반이 쓰는 시간표인 버전 2 데이터. */
function sample(): Data {
  return {
    ...emptyData(),
    timetables: [
      {
        id: 'weekday',
        name: '평일반',
        color: 0,
        slots: [
          { days: ['mon', 'tue', 'wed', 'thu', 'fri'], periods: [{ start: 540, end: 590 }] },
          { days: ['sat'], periods: [] },
        ],
      },
      { id: 'vacation', name: '방학 특강', color: 1, slots: [{ days: [], periods: [] }] },
    ],
    nextColor: 2,
    activeTimetable: 'weekday',
  };
}

/** 버전 1 저장 파일. 요일마다 시간표를 배정하던 형태다. */
const VERSION_1 = {
  version: 1,
  timetables: [{ id: 't1', name: '평일반', color: 3, periods: [{ start: 540, end: 590 }] }],
  nextColor: 4,
  weekdays: { mon: 't1', tue: 't1', wed: null, thu: null, fri: null, sat: null, sun: null },
  bellsOffDate: '2026-11-18',
  sounds: [{ id: 's1', name: '우리 종', file: 's1.wav' }],
  soundVolumes: { s1: 40 },
  startBell: 's1',
  endBell: 'westminster-end',
  masterVolume: 70,
  settings: {
    dogTheme: 'beagle',
    roamingDog: false,
    dogHeight: 120,
    autoStart: false,
    hideOnClose: false,
    keepScreenOn: true,
    hideNoticeShown: true,
  },
  window: { x: 10, y: 20, width: 1000, height: 640 },
};

describe('저장 형태 버전 2', () => {
  it('시간표마다 시간대 목록을 가지고 쓰는 시간표 id를 담은 파일을 읽는다', () => {
    expect(parseData(sample())).toEqual(sample());
  });

  it('버전 1 파일을 읽으면 시간표는 비고 쓰는 시간표는 없으며, 음원 · 설정 · 창 위치는 남는다', () => {
    writeFileSync(join(dir, DATA_FILE), JSON.stringify(VERSION_1));
    const { storage, loaded } = openStorage(dir, DATA_FORMAT);
    // 깨진 파일이 아니라 올려 쓴 것이라 알리지 않는다
    expect(loaded.startedFresh).toBe(false);
    /** 요일 배정을 뺀 버전 1의 나머지 값. */
    const rest: Record<string, unknown> = { ...VERSION_1 };
    delete rest.weekdays;
    expect(storage.get()).toEqual({ ...rest, version: 2, timetables: [], nextColor: 0, activeTimetable: null });
  });

  it('한 시간표 안에서 같은 요일이 두 시간대에 있으면 깨진 파일로 본다', () => {
    const data = sample();
    data.timetables[0]!.slots[1]!.days = ['fri', 'sat'];
    expect(parseData(data)).toBeNull();
  });

  it('다른 시간표끼리는 같은 요일을 써도 된다', () => {
    const data = sample();
    data.timetables[1]!.slots[0]!.days = ['mon'];
    expect(parseData(data)).not.toBeNull();
  });

  it('쓰는 시간표가 목록에 없는 id면 깨진 파일로 본다', () => {
    expect(parseData({ ...sample(), activeTimetable: 'gone' })).toBeNull();
    expect(parseData({ ...emptyData(), activeTimetable: 'gone' })).toBeNull();
  });

  it('쓰는 시간표가 없는(null) 파일은 시간표가 있어도 읽는다', () => {
    expect(parseData({ ...sample(), activeTimetable: null })).not.toBeNull();
  });

  it('시간대가 없거나 모르는 요일이 든 시간표는 깨진 파일로 본다', () => {
    const noSlots = sample();
    noSlots.timetables[0]!.slots = [];
    expect(parseData(noSlots)).toBeNull();
    const unknownDay = sample() as unknown as { timetables: { slots: { days: string[] }[] }[] };
    unknownDay.timetables[0]!.slots[0]!.days = ['monday'];
    expect(parseData(unknownDay)).toBeNull();
  });

  it('요일 배정(weekdays)만 있고 시간대가 없는 버전 2 파일은 깨진 파일로 본다', () => {
    expect(parseData({ ...VERSION_1, version: 2, activeTimetable: null })).toBeNull();
  });
});
