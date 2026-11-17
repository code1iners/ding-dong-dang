import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNEL, type AppState, type DingDongApi } from '../shared/bridge';

/** 렌더러에 내보낼 통로. 상태 구독과 명령 두 함수만 있고 ipcRenderer 자체는 넘기지 않는다. */
const api: DingDongApi = {
  subscribe(listener) {
    /** 구독이 아직 살아 있는지. */
    let active = true;
    /** 처음 상태를 받기 전에 바뀐 상태가 먼저 왔는지. 왔으면 늦게 온 처음 상태로 덮어쓰지 않는다. */
    let changed = false;
    /** 메인이 보낸 바뀐 상태를 받는 핸들러. */
    const onChange = (_event: IpcRendererEvent, state: AppState) => {
      changed = true;
      if (active) listener(state);
    };

    // 바뀐 상태를 먼저 듣기 시작한 뒤 지금 상태를 묻는다. 그 사이의 변경을 놓치지 않는다
    ipcRenderer.on(CHANNEL.stateChanged, onChange);
    void ipcRenderer.invoke(CHANNEL.getState).then((state: AppState) => {
      if (active && !changed) listener(state);
    });

    return () => {
      active = false;
      ipcRenderer.off(CHANNEL.stateChanged, onChange);
    };
  },
  command: (command) => ipcRenderer.invoke(CHANNEL.command, command),
  onCloseRequested(listener) {
    const onRequest = () => listener();
    ipcRenderer.on(CHANNEL.closeRequested, onRequest);
    return () => {
      ipcRenderer.off(CHANNEL.closeRequested, onRequest);
    };
  },
};

contextBridge.exposeInMainWorld('dingdong', api);
