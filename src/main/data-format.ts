import { emptyData, WEEKDAYS, type Data } from '../shared/data';
import type { Format } from './storage';

/** 알 수 없는 값이 객체인지. */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 유한한 수인지. */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 문자열 또는 null인지. */
function isStrOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

/** min~max 사이의 정수인지. */
function isIntIn(v: unknown, min: number, max: number): v is number {
  return isNum(v) && Number.isInteger(v) && v >= min && v <= max;
}

/** 배열의 모든 원소가 조건을 만족하는지. */
function every(v: unknown, test: (item: unknown) => boolean): boolean {
  return Array.isArray(v) && v.every(test);
}

/**
 * 저장 파일에서 읽은 값이 현재 형태(Data)와 맞는지 본다. 하나라도 어긋나면 null이다.
 * 어긋난 값을 고쳐 쓰지 않는다. 읽을 수 없는 파일로 보고 예비본으로 넘어가는 편이 안전하다.
 */
export function parseData(raw: unknown): Data | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  const { timetables, weekdays, sounds, soundVolumes, settings, window } = raw;

  const timetablesOk = every(
    timetables,
    (t) =>
      isRecord(t) &&
      typeof t.id === 'string' &&
      typeof t.name === 'string' &&
      isIntIn(t.color, 0, 7) &&
      every(t.periods, (p) => isRecord(p) && isNum(p.start) && isNum(p.end)),
  );
  const weekdaysOk = isRecord(weekdays) && WEEKDAYS.every((d) => isStrOrNull(weekdays[d]));
  const soundsOk = every(
    sounds,
    (s) => isRecord(s) && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.file === 'string',
  );
  const volumesOk = isRecord(soundVolumes) && Object.values(soundVolumes).every((v) => isIntIn(v, 0, 100));
  const settingsOk =
    isRecord(settings) &&
    typeof settings.dogTheme === 'string' &&
    typeof settings.roamingDog === 'boolean' &&
    isNum(settings.dogHeight) &&
    typeof settings.autoStart === 'boolean' &&
    typeof settings.hideOnClose === 'boolean' &&
    typeof settings.keepScreenOn === 'boolean' &&
    typeof settings.hideNoticeShown === 'boolean';
  const windowOk =
    window === null ||
    (isRecord(window) && isNum(window.x) && isNum(window.y) && isNum(window.width) && isNum(window.height));

  const ok =
    timetablesOk &&
    weekdaysOk &&
    soundsOk &&
    volumesOk &&
    settingsOk &&
    windowOk &&
    isIntIn(raw.nextColor, 0, 7) &&
    isStrOrNull(raw.bellsOffDate) &&
    typeof raw.startBell === 'string' &&
    typeof raw.endBell === 'string' &&
    isIntIn(raw.masterVolume, 0, 100);
  return ok ? (raw as Data) : null;
}

/** 앱이 쓰는 저장 파일의 형태. 아직 올려 쓸 낮은 버전은 없다. */
export const DATA_FORMAT: Format<Data> = {
  version: 1,
  empty: emptyData,
  migrations: {},
  parse: parseData,
};
