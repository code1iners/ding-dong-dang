import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 저장 파일의 형태 하나. 저장소는 이 형태의 값만 다룬다. */
export type Format<T extends { version: number }> = {
  /** 이 앱이 아는 가장 높은 형태 버전. */
  version: T['version'];
  /** 처음 실행한 빈 상태. */
  empty(): T;
  /** 버전 N인 원본을 N+1로 올리는 함수. 키는 올리기 전의 버전이다. */
  migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>;
  /** 현재 버전의 원본이 형태에 맞는지 확인해 돌려준다. 맞지 않으면 null이다. */
  parse(raw: unknown): T | null;
};

/** 시작할 때 읽은 결과. */
export type LoadResult<T> = {
  data: T;
  /** 본 파일과 예비본을 모두 읽지 못해 빈 상태로 새로 시작했는지. 파일이 아예 없던 첫 실행은 false다. */
  startedFresh: boolean;
};

/** 쓰기 결과. 실패해도 바꾼 내용은 메모리에 남는다. */
export type SaveResult = { ok: true } | { ok: false; error: Error };

/** 데이터 폴더의 JSON 파일을 맡는 저장소. */
export type Storage<T> = {
  /** 지금 메모리의 데이터. 쓰기에 실패했어도 바꾼 내용이 들어 있다. */
  get(): T;
  /** 데이터를 바꾸고 파일에 쓴다. 이전에 쓰기가 실패했다면 이번에 함께 다시 쓴다. */
  update(change: (draft: T) => T): SaveResult;
};

/** 본 파일 이름. */
export const DATA_FILE = 'data.json';
/** 직전의 정상 파일을 남기는 예비본 이름. */
export const BACKUP_FILE = 'data.backup.json';
/** 읽지 못해 치워 둔 파일 이름. 가장 최근 것 하나만 남긴다. */
export const CORRUPT_FILE = 'data.corrupt.json';
/** 쓰는 도중의 임시 파일 이름. */
const TEMP_FILE = 'data.tmp.json';

/** 파일을 읽어 형태에 맞는 값으로 돌려준다. 없거나 깨졌거나 버전이 높으면 null이다. */
function readData<T extends { version: number }>(path: string, format: Format<T>): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  let raw = parsed as Record<string, unknown>;
  /** 파일에 적힌 형태 버전. */
  let version = raw.version;
  // 앱이 아는 것보다 높은 버전은 읽을 수 없는 파일과 같이 처리한다
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0 || version > format.version) {
    return null;
  }
  // 낮은 버전은 한 단계씩 올려 쓴다
  while (version < format.version) {
    const up = format.migrations[version];
    if (!up) return null;
    try {
      raw = up(raw);
    } catch {
      return null;
    }
    version += 1;
    raw.version = version;
  }
  return format.parse(raw);
}

/** 읽지 못한 파일 하나를 치워 둔 이름으로 옮긴다. 이전에 치워 둔 것은 덮어쓴다. */
function quarantine(dir: string, name: string): void {
  try {
    renameSync(join(dir, name), join(dir, CORRUPT_FILE));
  } catch {
    // 치우지 못해도 빈 상태로 시작하는 데는 지장이 없다
  }
}

/**
 * 데이터 폴더를 읽어 저장소를 연다.
 * 본 파일을 읽을 수 없으면 알리지 않고 예비본으로 시작한다. 둘 다 읽을 수 없으면 깨진 파일을 치워 두고 빈 상태로 시작한다.
 * 폴더를 만들 수 없는 등 읽는 쪽에서 막혀도 던지지 않고 빈 상태로 시작한다. 이때 쓰기가 실패로 알려 준다.
 */
export function openStorage<T extends { version: number }>(
  dir: string,
  format: Format<T>,
): { storage: Storage<T>; loaded: LoadResult<T> } {
  /** 본 파일 경로. */
  const mainPath = join(dir, DATA_FILE);
  /** 예비본 경로. */
  const backupPath = join(dir, BACKUP_FILE);
  /** 임시 파일 경로. */
  const tempPath = join(dir, TEMP_FILE);

  /** 시작할 때 읽은 결과. */
  const loaded = load();
  /** 메모리의 데이터. */
  let current = loaded.data;

  function load(): LoadResult<T> {
    /** 본 파일에서 읽은 값. */
    const fromMain = readData(mainPath, format);
    if (fromMain) return { data: fromMain, startedFresh: false };
    /** 예비본에서 읽은 값. */
    const fromBackup = readData(backupPath, format);
    if (fromBackup) return { data: fromBackup, startedFresh: false };

    /** 읽지 못한 파일이 실제로 있었는지. 없으면 첫 실행이다. */
    const mainExists = existsSync(mainPath);
    const backupExists = existsSync(backupPath);
    if (!mainExists && !backupExists) return { data: format.empty(), startedFresh: false };
    // 가장 최근 것은 본 파일이다. 본 파일이 없을 때만 예비본을 치운다
    if (mainExists) {
      quarantine(dir, DATA_FILE);
      rmSync(backupPath, { force: true });
    } else {
      quarantine(dir, BACKUP_FILE);
    }
    return { data: format.empty(), startedFresh: true };
  }

  /** 지금 메모리의 데이터를 파일에 쓴다. */
  function write(): SaveResult {
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(tempPath, JSON.stringify(current, null, 2), 'utf8');
      // 직전의 본 파일이 정상일 때만 예비본으로 남긴다. 깨진 파일로 좋은 예비본을 덮어쓰지 않는다
      if (readData(mainPath, format)) copyFileSync(mainPath, backupPath);
      renameSync(tempPath, mainPath);
      return { ok: true };
    } catch (error) {
      try {
        rmSync(tempPath, { force: true });
      } catch {
        // 임시 파일을 못 지워도 실패 보고가 우선이다
      }
      return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  return {
    loaded,
    storage: {
      get: () => current,
      update(change) {
        current = change(current);
        return write();
      },
    },
  };
}
