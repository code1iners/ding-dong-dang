import { BrowserWindow, ipcMain } from 'electron';
import { CHANNEL, type AppState } from '../shared/bridge';

/** 메인 쪽에서 앱 상태를 읽고 바꾸는 손잡이. */
export type StateHub = {
  /** 지금 상태. */
  get(): AppState;
  /** 상태 일부를 바꾸고 열린 모든 창에 새 상태를 보낸다. */
  update(patch: Partial<AppState>): void;
};

/** 상태 구독과 명령 두 통로를 연다. */
export function openBridge(initial: AppState): StateHub {
  /** 지금 앱 상태. */
  let state = initial;

  ipcMain.handle(CHANNEL.getState, () => state);
  ipcMain.handle(CHANNEL.command, (_event, command: unknown) => handleCommand(command));

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

/** 렌더러가 보낸 명령 처리. 값의 타입을 믿지 않고 unknown으로 받으며, 모르는 명령은 거절한다. */
function handleCommand(command: unknown): void {
  /** 명령 종류. */
  const type = (command as { type?: unknown } | null)?.type;
  throw new Error(`알 수 없는 명령이에요: ${String(type)}`);
}
