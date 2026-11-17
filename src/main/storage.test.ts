import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyData, type Data } from '../shared/data';
import { DATA_FORMAT } from './data-format';
import { BACKUP_FILE, CORRUPT_FILE, DATA_FILE, openStorage, type Format } from './storage';

/** 테스트마다 새로 만드는 임시 데이터 폴더. */
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ddd-storage-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** 시간표 하나가 든 데이터. 쓴 내용을 구분하려고 이름을 받는다. */
function dataWith(name: string): Data {
  return { ...emptyData(), timetables: [{ id: 't1', name, color: 0, periods: [{ start: 540, end: 590 }] }] };
}

/** 폴더에 있는 파일 이름들. */
function files(): string[] {
  return readdirSync(dir).sort();
}

describe('저장소', () => {
  it('처음 실행하면 스펙의 기본값으로 시작하고 알릴 일이 없다', () => {
    const { storage, loaded } = openStorage(dir, DATA_FORMAT);
    expect(loaded.startedFresh).toBe(false);
    expect(storage.get()).toEqual({
      version: 1,
      timetables: [],
      nextColor: 0,
      weekdays: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
      bellsOffDate: null,
      sounds: [],
      soundVolumes: {},
      startBell: 'westminster-start',
      endBell: 'westminster-end',
      masterVolume: 100,
      settings: {
        dogTheme: 'orange-sitting',
        roamingDog: true,
        dogHeight: 96,
        autoStart: true,
        hideOnClose: true,
        keepScreenOn: false,
        hideNoticeShown: false,
      },
      window: null,
    });
  });

  it('쓰고 다시 열면 같은 내용을 읽는다', () => {
    const first = openStorage(dir, DATA_FORMAT);
    expect(first.storage.update(() => dataWith('평일반'))).toEqual({ ok: true });
    const second = openStorage(dir, DATA_FORMAT);
    expect(second.storage.get()).toEqual(dataWith('평일반'));
    expect(second.loaded.startedFresh).toBe(false);
  });

  it('쓸 때마다 직전의 정상 파일이 예비본으로 남는다', () => {
    const { storage } = openStorage(dir, DATA_FORMAT);
    storage.update(() => dataWith('하나'));
    storage.update(() => dataWith('둘'));
    expect(JSON.parse(readFileSync(join(dir, BACKUP_FILE), 'utf8')).timetables[0].name).toBe('하나');
    expect(JSON.parse(readFileSync(join(dir, DATA_FILE), 'utf8')).timetables[0].name).toBe('둘');
    expect(files()).toEqual([BACKUP_FILE, DATA_FILE]);
  });

  it('본 파일이 깨지면 알리지 않고 예비본으로 시작한다', () => {
    const { storage } = openStorage(dir, DATA_FORMAT);
    storage.update(() => dataWith('하나'));
    storage.update(() => dataWith('둘'));
    writeFileSync(join(dir, DATA_FILE), '{"version":1,');
    const reopened = openStorage(dir, DATA_FORMAT);
    expect(reopened.loaded.startedFresh).toBe(false);
    expect(reopened.storage.get().timetables[0]?.name).toBe('하나');
  });

  it('깨진 본 파일은 다음 쓰기에서 정상 예비본을 덮어쓰지 않는다', () => {
    const { storage } = openStorage(dir, DATA_FORMAT);
    storage.update(() => dataWith('하나'));
    storage.update(() => dataWith('둘'));
    writeFileSync(join(dir, DATA_FILE), 'broken');
    const reopened = openStorage(dir, DATA_FORMAT);
    reopened.storage.update((d) => ({ ...d, nextColor: 3 }));
    expect(JSON.parse(readFileSync(join(dir, BACKUP_FILE), 'utf8')).timetables[0].name).toBe('하나');
  });

  it('둘 다 깨지면 깨진 파일을 치워 두고 빈 상태로 시작하며 한 번 알린다', () => {
    writeFileSync(join(dir, DATA_FILE), 'broken main');
    writeFileSync(join(dir, BACKUP_FILE), 'broken backup');
    const { storage, loaded } = openStorage(dir, DATA_FORMAT);
    expect(loaded.startedFresh).toBe(true);
    expect(storage.get()).toEqual(emptyData());
    expect(files()).toEqual([CORRUPT_FILE]);
    expect(readFileSync(join(dir, CORRUPT_FILE), 'utf8')).toBe('broken main');
    // 다시 열면 이미 비운 뒤이므로 또 알리지 않는다
    expect(openStorage(dir, DATA_FORMAT).loaded.startedFresh).toBe(false);
  });

  it('치워 둔 파일은 가장 최근 것 하나만 남는다', () => {
    writeFileSync(join(dir, DATA_FILE), 'first broken');
    openStorage(dir, DATA_FORMAT);
    writeFileSync(join(dir, DATA_FILE), 'second broken');
    openStorage(dir, DATA_FORMAT);
    expect(files().filter((f) => f.includes('corrupt'))).toEqual([CORRUPT_FILE]);
    expect(readFileSync(join(dir, CORRUPT_FILE), 'utf8')).toBe('second broken');
  });

  it('형태가 어긋난 파일은 깨진 파일로 본다', () => {
    writeFileSync(join(dir, DATA_FILE), JSON.stringify({ ...emptyData(), masterVolume: 'loud' }));
    expect(openStorage(dir, DATA_FORMAT).loaded.startedFresh).toBe(true);
  });

  it('앱이 아는 것보다 높은 형태 버전은 깨진 파일처럼 처리한다', () => {
    writeFileSync(join(dir, DATA_FILE), JSON.stringify({ ...emptyData(), version: 2 }));
    const { loaded } = openStorage(dir, DATA_FORMAT);
    expect(loaded.startedFresh).toBe(true);
    expect(files()).toEqual([CORRUPT_FILE]);
  });

  it('낮은 형태 버전은 시작할 때 올려 쓴다', () => {
    /** 버전 2에서 `count`가 `n`으로 이름이 바뀐 가상의 형태. */
    type V2 = { version: 2; n: number };
    const v2: Format<V2> = {
      version: 2,
      empty: () => ({ version: 2, n: 0 }),
      migrations: { 1: (raw) => ({ ...raw, n: raw.count }) },
      parse: (raw) => {
        const r = raw as { version?: unknown; n?: unknown };
        return r.version === 2 && typeof r.n === 'number' ? (raw as V2) : null;
      },
    };
    writeFileSync(join(dir, DATA_FILE), JSON.stringify({ version: 1, count: 7 }));
    const { storage, loaded } = openStorage(dir, v2);
    expect(loaded.startedFresh).toBe(false);
    expect(storage.get()).toMatchObject({ version: 2, n: 7 });
  });

  it('쓸 수 없는 폴더에서는 실패를 돌려주고 바꾼 내용은 메모리에 둔다', () => {
    // 폴더 자리에 파일이 있어 만들 수도 쓸 수도 없다
    const blocked = join(dir, 'blocked');
    writeFileSync(blocked, 'not a folder');
    const { storage } = openStorage(join(blocked, 'data'), DATA_FORMAT);
    const result = storage.update(() => dataWith('메모리'));
    expect(result.ok).toBe(false);
    expect(storage.get().timetables[0]?.name).toBe('메모리');
  });

  it('쓰기에 실패한 뒤 다음 변경 때 다시 시도해 성공하면 지난 변경도 함께 저장된다', () => {
    const target = join(dir, 'later');
    // 폴더 자리를 파일이 막고 있다가 치워진 상황
    writeFileSync(target, 'blocker');
    const { storage } = openStorage(target, DATA_FORMAT);
    expect(storage.update(() => dataWith('첫 변경')).ok).toBe(false);
    rmSync(target);
    mkdirSync(target);
    expect(storage.update((d) => ({ ...d, nextColor: 2 }))).toEqual({ ok: true });
    const reopened = openStorage(target, DATA_FORMAT).storage.get();
    expect(reopened.timetables[0]?.name).toBe('첫 변경');
    expect(reopened.nextColor).toBe(2);
  });

  it('정상으로 쓰고 나면 임시 파일이 남지 않는다', () => {
    const { storage } = openStorage(dir, DATA_FORMAT);
    storage.update(() => dataWith('하나'));
    expect(files()).toEqual([DATA_FILE]);
  });
});
