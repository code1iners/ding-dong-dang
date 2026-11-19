import { emptyData, isWeekday, type Data, type Weekday } from '../shared/data';
import { daysOverlap } from '../shared/timetable-ops';
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

/** 시간대 목록인지. 한 개 이상이고, 한 요일이 두 시간대에 들어 있지 않아야 한다. */
function isSlots(v: unknown): boolean {
  /** 시간대마다 요일 목록과 수업 시간 목록을 가졌는지. */
  const shapeOk =
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (slot) =>
        isRecord(slot) && every(slot.days, isWeekday) && every(slot.periods, (p) => isRecord(p) && isNum(p.start) && isNum(p.end)),
    );
  return shapeOk && !daysOverlap(v as { days: Weekday[] }[]);
}

/**
 * 저장 파일에서 읽은 값이 현재 형태(Data)와 맞는지 본다. 하나라도 어긋나면 null이다.
 * 어긋난 값을 고쳐 쓰지 않는다. 읽을 수 없는 파일로 보고 예비본으로 넘어가는 편이 안전하다.
 */
export function parseData(raw: unknown): Data | null {
  if (!isRecord(raw) || raw.version !== 2) return null;
  const { timetables, activeTimetable, sounds, soundVolumes, settings, window } = raw;

  const timetablesOk = every(
    timetables,
    (t) => isRecord(t) && typeof t.id === 'string' && typeof t.name === 'string' && isIntIn(t.color, 0, 7) && isSlots(t.slots),
  );
  // 쓰는 시간표는 없거나(null) 목록에 있는 id여야 한다
  const activeOk =
    activeTimetable === null ||
    (timetablesOk && (timetables as { id: string }[]).some((t) => t.id === activeTimetable));
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
    activeOk &&
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

/**
 * 버전 1(요일마다 시간표 배정)을 버전 2(시간표마다 시간대, 쓰는 시간표 하나)로 올린다.
 * 배포 전에 바꾼 형태라 시간표와 요일 배정은 옮기지 않고 비운다. 음원 · 설정 · 창 위치 같은 나머지는 그대로 둔다.
 * 시간표가 비므로 다음 색도 처음 색부터 다시 배정한다.
 */
function fromVersion1(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw, timetables: [], nextColor: 0, activeTimetable: null };
  delete next.weekdays;
  return next;
}

/** 앱이 쓰는 저장 파일의 형태. */
export const DATA_FORMAT: Format<Data> = {
  version: 2,
  empty: emptyData,
  migrations: { 1: fromVersion1 },
  parse: parseData,
};
