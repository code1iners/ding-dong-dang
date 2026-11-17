import { contextBridge, ipcRenderer } from 'electron';
import { BELL_CHANNEL, type BellPlayerApi, type PlayRequest } from '../shared/bell-player';

/** 종 재생기(숨긴 창)에 내보낼 통로. 재생 · 멈춤 요청을 받고 상태를 알리는 것만 있다. */
const api: BellPlayerApi = {
  onPlay(listener) {
    ipcRenderer.on(BELL_CHANNEL.play, (_event, request: PlayRequest) => listener(request));
  },
  onStop(listener) {
    ipcRenderer.on(BELL_CHANNEL.stop, () => listener());
  },
  report(report) {
    ipcRenderer.send(BELL_CHANNEL.report, report);
  },
};

contextBridge.exposeInMainWorld('bellPlayer', api);
