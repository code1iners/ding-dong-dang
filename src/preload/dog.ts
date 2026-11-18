import { contextBridge, ipcRenderer } from 'electron';
import { DOG_CHANNEL, type DogFigureReport, type DogView, type DogWindowApi } from '../shared/dog-window';

/** 돌아다니는 강아지 창에 내보낼 통로. 그릴 내용과 하트 신호를 받고, 잰 결과와 누르기를 알리는 것만 있다. */
const api: DogWindowApi = {
  onView(listener) {
    ipcRenderer.on(DOG_CHANNEL.view, (_event, view: DogView) => listener(view));
  },
  reportFigure(report: DogFigureReport) {
    ipcRenderer.send(DOG_CHANNEL.figure, report);
  },
  press(phase) {
    ipcRenderer.send(DOG_CHANNEL.press, phase);
  },
  onHearts(listener) {
    ipcRenderer.on(DOG_CHANNEL.hearts, () => listener());
  },
};

contextBridge.exposeInMainWorld('roamingDog', api);
