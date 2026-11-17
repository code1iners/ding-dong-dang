import { BrowserWindow, ipcMain } from 'electron';
import { CHANNEL, type AppState, type Command, type CommandResult } from '../shared/bridge';
import { WEEKDAYS, type Weekday } from '../shared/data';
import type { Period } from '../shared/timetable-validation';

/** 메인 쪽에서 앱 상태를 읽고 바꾸는 손잡이. */
export type StateHub = {
  /** 지금 상태. */
  get(): AppState;
  /** 상태 일부를 바꾸고 열린 모든 창에 새 상태를 보낸다. */
  update(patch: Partial<AppState>): void;
};

/** 상태 구독과 명령 두 통로를 연다. 형태가 맞는 명령만 onCommand로 넘기고 나머지는 거절한다. */
export function openBridge(initial: AppState, onCommand: (command: Command) => CommandResult | void): StateHub {
  /** 지금 앱 상태. */
  let state = initial;

  ipcMain.handle(CHANNEL.getState, () => state);
  ipcMain.handle(CHANNEL.command, (_event, raw: unknown) => {
    const command = parseCommand(raw);
    if (!command) throw new Error(`알 수 없는 명령이에요: ${JSON.stringify(raw)}`);
    return onCommand(command) ?? { ok: true };
  });

  return {
    get: () => state,
    update(patch) {
      state = { ...state, ...patch };
      // 구독 중인 모든 창에 새 상태를 보낸다
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(CHANNEL.stateChanged, state);
      }
    },
  };
}

/** 렌더러가 보낸 값을 명령으로 읽는다. 값의 타입을 믿지 않고 unknown으로 받으며, 모르는 명령이나 어긋난 값은 null이다. */
export function parseCommand(raw: unknown): Command | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  switch (value.type) {
    case 'set-keep-screen-on':
      return typeof value.on === 'boolean' ? { type: 'set-keep-screen-on', on: value.on } : null;
    case 'create-timetable':
      if (value.assignTo === undefined) return { type: 'create-timetable' };
      return isWeekday(value.assignTo) ? { type: 'create-timetable', assignTo: value.assignTo } : null;
    case 'rename-timetable':
      return typeof value.id === 'string' && typeof value.name === 'string' && value.name.trim() !== ''
        ? { type: 'rename-timetable', id: value.id, name: value.name }
        : null;
    case 'delete-timetable':
    case 'restore-timetable':
      return typeof value.id === 'string' ? { type: value.type, id: value.id } : null;
    case 'assign-weekday':
      return isWeekday(value.day) && (value.timetableId === null || typeof value.timetableId === 'string')
        ? { type: 'assign-weekday', day: value.day, timetableId: value.timetableId }
        : null;
    case 'ack-fresh-start':
      return { type: 'ack-fresh-start' };
    case 'set-periods': {
      const periods = readPeriods(value.periods);
      return typeof value.id === 'string' && periods ? { type: 'set-periods', id: value.id, periods } : null;
    }
    case 'set-editing-dirty':
      return typeof value.dirty === 'boolean' ? { type: 'set-editing-dirty', dirty: value.dirty } : null;
    case 'close-window':
      return { type: 'close-window' };
    default:
      return null;
  }
}

/** 요일 키인지. */
function isWeekday(v: unknown): v is Weekday {
  return typeof v === 'string' && (WEEKDAYS as readonly string[]).includes(v);
}

/** 수업 시간 목록으로 읽는다. 시작과 끝이 모두 정수인 객체의 배열이 아니면 null이다. 범위와 겹침은 검증 함수의 몫이다. */
function readPeriods(raw: unknown): Period[] | null {
  if (!Array.isArray(raw)) return null;
  const periods: Period[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { start, end } = item as Record<string, unknown>;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    periods.push({ start: start as number, end: end as number });
  }
  return periods;
}
