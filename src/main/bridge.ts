import { BrowserWindow, ipcMain } from 'electron';
import { CHANNEL, type AppState, type Command } from '../shared/bridge';
import { WEEKDAYS, type Weekday } from '../shared/data';

/** 메인 쪽에서 앱 상태를 읽고 바꾸는 손잡이. */
export type StateHub = {
  /** 지금 상태. */
  get(): AppState;
  /** 상태 일부를 바꾸고 열린 모든 창에 새 상태를 보낸다. */
  update(patch: Partial<AppState>): void;
};

/** 상태 구독과 명령 두 통로를 연다. 형태가 맞는 명령만 onCommand로 넘기고 나머지는 거절한다. */
export function openBridge(initial: AppState, onCommand: (command: Command) => void): StateHub {
  /** 지금 앱 상태. */
  let state = initial;

  ipcMain.handle(CHANNEL.getState, () => state);
  ipcMain.handle(CHANNEL.command, (_event, raw: unknown) => {
    const command = parseCommand(raw);
    if (!command) throw new Error(`알 수 없는 명령이에요: ${JSON.stringify(raw)}`);
    onCommand(command);
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
    default:
      return null;
  }
}

/** 요일 키인지. */
function isWeekday(v: unknown): v is Weekday {
  return typeof v === 'string' && (WEEKDAYS as readonly string[]).includes(v);
}
