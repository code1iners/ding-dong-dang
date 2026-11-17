import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, powerMonitor, powerSaveBlocker, screen } from 'electron';
import { randomUUID } from 'node:crypto';
import { localDate } from '../shared/bell-decision';
import { CHANNEL } from '../shared/bridge';
import type { CommandResult } from '../shared/bridge';
import type { Data } from '../shared/data';
import {
  assignWeekday,
  createTimetable,
  deleteTimetable,
  renameTimetable,
  restoreTimetable,
  setPeriods,
  type RemovedTimetable,
} from '../shared/timetable-ops';
import { validatePeriods } from '../shared/timetable-validation';
import { openBellPlayer } from './bell-player';
import { openBridge } from './bridge';
import { DEFAULT_DATA_DIR_NAME, dataDirFromArgv } from './data-dir';
import { DATA_FORMAT } from './data-format';
import { startScheduler, type Scheduler, type SchedulerParts } from './scheduler';
import { openStorage } from './storage';
import { usableBounds } from './window-bounds';

/**
 * 데이터 폴더. 실행 인자로 바꾸지 않았으면 OS가 앱에 주는 폴더 아래의 영문 `ding-dong-dang`이다.
 * Electron의 기본값은 표시 이름("딩동댕")을 폴더 이름으로 쓰므로 직접 정한다.
 */
const dataDir =
  dataDirFromArgv(process.argv, process.cwd()) ?? join(app.getPath('appData'), DEFAULT_DATA_DIR_NAME);
// 데이터 폴더는 app ready 전에 바꿔야 Chromium의 저장 위치까지 함께 옮겨 간다
mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);

// 밝은 화면 하나만 둔다. OS가 어두운 모드여도 창과 기본 부품의 색이 바뀌지 않게 한다
nativeTheme.themeSource = 'light';

/** 창을 옮기거나 크기를 바꾼 뒤 이만큼 가만히 있으면 자리를 저장한다. */
const BOUNDS_SAVE_DELAY_MS = 500;

/** 데이터 폴더의 저장소와 시작할 때 읽은 결과. */
const { storage, loaded } = openStorage(dataDir, DATA_FORMAT);

/** 잠자기 막기 부품. Electron의 powerSaveBlocker로 막고 푼다. */
function powerKeepAwake(): SchedulerParts['keepAwake'] {
  /** 걸어 둔 막기의 id. 없으면 null. */
  let blockerId: number | null = null;
  return {
    start(mode) {
      blockerId = powerSaveBlocker.start(mode === 'display' ? 'prevent-display-sleep' : 'prevent-app-suspension');
    },
    stop() {
      if (blockerId !== null) powerSaveBlocker.stop(blockerId);
      blockerId = null;
    },
  };
}

/** 왼쪽 세로 줄과 네 화면이 있는 앱 창을 만든다. */
function createMainWindow(
  save: (change: (data: Data) => Data, options?: { quiet: boolean }) => boolean,
  holdsClose: () => boolean,
): BrowserWindow {
  /** 앱 창. */
  const win = new BrowserWindow({
    // 크기는 제목 표시줄을 뺀 내용 영역 기준이다. 디자인 시안이 920×580의 내용 영역으로 그려졌다
    useContentSize: true,
    width: 1000,
    height: 640,
    minWidth: 920,
    minHeight: 580,
    title: '딩동댕',
    // 화면이 그려지기 전의 창 바탕. DESIGN.md의 바탕 색(tokens.css의 --color-bg)과 같다
    backgroundColor: '#CFE3F8',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 저장된 자리가 지금 연결된 모니터 안일 때만 그 자리와 크기로 연다
  const saved = usableBounds(
    storage.get().window,
    screen.getAllDisplays().map((d) => d.workArea),
  );
  if (saved) win.setBounds(saved);

  /** 자리 저장을 미루는 타이머. */
  let saveTimer: NodeJS.Timeout | undefined;
  /** 최대화·전체 화면이 아닌 평소 자리와 크기를 저장한다. */
  const saveBounds = (): void => {
    clearTimeout(saveTimer);
    if (win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    // 창 자리 저장이 실패해도 알림은 띄우지 않는다. 창을 끌 때마다 알림이 쌓이기 때문이다
    save((d) => ({ ...d, window: bounds }), { quiet: true });
  };
  const saveBoundsLater = (): void => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveBounds, BOUNDS_SAVE_DELAY_MS);
  };
  // 저장하지 않은 편집이 있으면 닫기를 멈추고 화면에 묻는다. 화면이 정한 뒤 `close-window` 명령으로 다시 닫는다
  win.on('close', (event) => {
    if (!holdsClose()) return;
    event.preventDefault();
    win.webContents.send(CHANNEL.closeRequested);
  });
  win.on('move', saveBoundsLater);
  win.on('resize', saveBoundsLater);
  // 닫기 직전에 마지막 자리를 확실히 남긴다
  win.on('close', saveBounds);

  win.once('ready-to-show', () => win.show());

  // 앱 화면 밖으로 나가는 이동과 새 창은 막는다
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  /** electron-vite dev가 띄운 렌더러 개발 서버 주소. */
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}

void app.whenReady().then(() => {
  /** 이번 실행에서 지운 시간표. 알림의 "되돌리기"가 id로 찾아 되살린다. */
  const removedTimetables = new Map<string, RemovedTimetable>();
  /** 화면에 저장하지 않은 수업 시간 편집이 있는지. */
  let editingDirty = false;
  /** 화면이 닫기를 허락해 `close-window`로 닫는 중인지. */
  let closeApproved = false;

  /** 렌더러와 상태를 주고받는 손잡이. */
  const hub = openBridge(
    {
      appVersion: app.getVersion(),
      storage: { saveFailed: false, freshStart: loaded.startedFresh, saveFailures: 0 },
      settings: storage.get().settings,
      timetables: storage.get().timetables,
      weekdays: storage.get().weekdays,
      bellsOffDate: storage.get().bellsOffDate,
      bellRinging: false,
    },
    (command): CommandResult | void => {
      switch (command.type) {
        case 'set-keep-screen-on':
          save((d) => ({ ...d, settings: { ...d.settings, keepScreenOn: command.on } }));
          break;
        case 'set-bells-off':
          // 끄면 오늘 날짜를 끈 날짜로 저장하고, 저장하면서 스케줄러가 바로 판정해 울리던 종을 멈춘다
          save((d) => ({ ...d, bellsOffDate: command.off ? localDate(Date.now()) : null }));
          break;
        case 'create-timetable':
          save((d) => createTimetable(d, randomUUID(), command.assignTo));
          break;
        case 'rename-timetable':
          save((d) => renameTimetable(d, command.id, command.name));
          break;
        case 'delete-timetable':
          save((d) => {
            const result = deleteTimetable(d, command.id);
            if (result.removed) removedTimetables.set(command.id, result.removed);
            return result.data;
          });
          break;
        case 'restore-timetable': {
          const removed = removedTimetables.get(command.id);
          if (!removed) break;
          removedTimetables.delete(command.id);
          save((d) => restoreTimetable(d, removed));
          break;
        }
        case 'assign-weekday':
          save((d) => assignWeekday(d, command.day, command.timetableId));
          break;
        case 'ack-fresh-start':
          hub.update({ storage: { ...hub.get().storage, freshStart: false } });
          break;
        case 'set-periods': {
          // 화면이 이미 막지만, 잘못된 수업 시간은 여기서도 저장하지 않는다
          if (validatePeriods(command.periods).length > 0) return { ok: false };
          return { ok: save((d) => setPeriods(d, command.id, command.periods)) };
        }
        case 'set-editing-dirty':
          editingDirty = command.dirty;
          break;
        case 'close-window':
          closeApproved = true;
          mainWindow?.close();
          break;
      }
    },
  );


  /** 종 스케줄러. 숨긴 재생기 창과 함께 앱 창 다음에 만들어, 그 전의 저장은 판정을 부르지 않는다. */
  let scheduler: Scheduler | null = null;

  /** 저장된 값을 바꾸고 파일에 쓴 뒤, 화면 쪽 상태와 스케줄러에 알린다. */
  function save(change: (data: Data) => Data, options?: { quiet: boolean }): boolean {
    /** 파일에 쓰지 못했는지. 바꾼 내용은 메모리에 남는다. */
    const saveFailed = !storage.update(change).ok;
    /** 바뀐 뒤의 데이터. */
    const { settings, timetables, weekdays, bellsOffDate } = storage.get();
    /** 화면 쪽에 알릴 저장 상태. quiet이면 실패를 세지 않아 화면이 알림을 띄우지 않는다. */
    const notice = hub.get().storage;
    const failures = saveFailed && !options?.quiet ? notice.saveFailures + 1 : notice.saveFailures;
    if (
      notice.saveFailed !== saveFailed ||
      notice.saveFailures !== failures ||
      hub.get().settings !== settings ||
      hub.get().timetables !== timetables ||
      hub.get().weekdays !== weekdays ||
      hub.get().bellsOffDate !== bellsOffDate
    ) {
      hub.update({
        storage: { ...notice, saveFailed, saveFailures: failures },
        settings,
        timetables,
        weekdays,
        bellsOffDate,
      });
    }
    // 바뀐 시간표 · 배정 · 오늘만 끄기 · 화면 켜 두기를 1초 기다리지 않고 반영한다
    scheduler?.check();
    return !saveFailed;
  }

  /** 앱 창. 닫혀 있으면 null. */
  let mainWindow: BrowserWindow | null = null;
  /** 앱 창을 만들고, 닫히면 비운다. */
  const openMainWindow = (): void => {
    editingDirty = false;
    closeApproved = false;
    mainWindow = createMainWindow(save, () => editingDirty && !closeApproved);
    mainWindow.on('closed', () => {
      mainWindow = null;
      // 창을 닫아도 머무는 동작은 상주 티켓에서 붙인다. 그 전까지 Windows는 OS 관례대로 끝낸다
      if (process.platform !== 'darwin') app.quit();
    });
  };
  // 앱 창을 먼저 만든다. 숨긴 재생기 창보다 먼저 떠야 첫 창이 앱 창이다
  openMainWindow();

  /** 숨긴 창의 종 재생기. */
  const bell = openBellPlayer({
    read: storage.get,
    builtinDir: join(app.getAppPath(), 'resources/sounds/builtin'),
    registeredDir: join(dataDir, 'sounds'),
    onRingingChange: (bellRinging) => hub.update({ bellRinging }),
  });

  /** 돌고 있는 스케줄러. 창이 없어도 메인 프로세스에서 1초마다, 그리고 깨어나면 바로 판정한다. */
  const running = startScheduler({
    now: () => Date.now(),
    everySecond(tick) {
      /** 1초 타이머. */
      const timer = setInterval(tick, 1000);
      return () => clearInterval(timer);
    },
    onWake(listener) {
      powerMonitor.on('resume', listener);
      return () => powerMonitor.off('resume', listener);
    },
    bell,
    keepAwake: powerKeepAwake(),
    read: storage.get,
  });
  scheduler = running;
  app.on('will-quit', () => running.stop());

  // 창이 없을 때 Dock 아이콘을 누르면 앱 창을 다시 연다. 숨긴 재생기 창은 세지 않는다
  app.on('activate', () => {
    if (!mainWindow) openMainWindow();
  });
});
