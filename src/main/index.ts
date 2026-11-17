import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, Menu, nativeImage, nativeTheme, powerMonitor, powerSaveBlocker, screen, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { localDate } from '../shared/bell-decision';
import { CHANNEL } from '../shared/bridge';
import type { AppState, CommandResult } from '../shared/bridge';
import type { Data } from '../shared/data';
import {
  pruneSounds,
  registerSound,
  removeSound,
  renameSound,
  restoreSound,
  setBell,
  setMasterVolume,
  setSoundVolume,
  type RemovedSound,
} from '../shared/sound-ops';
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
import { openBellPlayer, type BellPlayer } from './bell-player';
import { openBridge } from './bridge';
import { DEFAULT_DATA_DIR_NAME, dataDirFromArgv } from './data-dir';
import { DATA_FORMAT } from './data-format';
import { decideClose, trayIconFile, trayMenuTemplate } from './residency';
import { startScheduler, type Scheduler, type SchedulerParts } from './scheduler';
import { registerSoundFile, SOUND_EXTENSIONS, sweepSoundFiles } from './sound-files';
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

// 한 번에 하나만 실행한다. 단일 실행 잠금은 데이터 폴더마다 따로 잡힌다.
// 이미 떠 있으면 저장소를 열기 전에 끝내고, 떠 있는 앱이 second-instance로 창을 연다
if (!app.requestSingleInstanceLock()) {
  // app.exit은 곧바로 멈추지 않으므로, 아래의 저장소 열기와 창 만들기까지 가지 않게 프로세스를 바로 끝낸다
  app.exit(0);
  process.exit(0);
}
/** 두 번째 실행이 왔을 때 부를 함수. 앱 창을 만든 뒤에 채운다. */
let onSecondInstance: (() => void) | null = null;
app.on('second-instance', () => onSecondInstance?.());

// 밝은 화면 하나만 둔다. OS가 어두운 모드여도 창과 기본 부품의 색이 바뀌지 않게 한다
nativeTheme.themeSource = 'light';

/** 창을 옮기거나 크기를 바꾼 뒤 이만큼 가만히 있으면 자리를 저장한다. */
const BOUNDS_SAVE_DELAY_MS = 500;

/** 데이터 폴더의 저장소와 시작할 때 읽은 결과. */
const { storage, loaded } = openStorage(dataDir, DATA_FORMAT);

/** 저장된 값 가운데 화면 쪽 상태에 그대로 실리는 부분. */
function viewOf(data: Data): Pick<AppState, 'settings' | 'timetables' | 'weekdays' | 'bellsOffDate' | 'sounds' | 'soundVolumes' | 'startBell' | 'endBell' | 'masterVolume'> {
  const { settings, timetables, weekdays, bellsOffDate, sounds, soundVolumes, startBell, endBell, masterVolume } = data;
  return { settings, timetables, weekdays, bellsOffDate, sounds, soundVolumes, startBell, endBell, masterVolume };
}

/** 등록 음원을 복사해 두는 폴더. */
const soundsDir = join(dataDir, 'sounds');

/** 등록하는 중인(파일을 복사했지만 아직 목록에 넣지 않은) 요청의 수. 이 사이에는 파일 정리를 미룬다. */
let registrationsInFlight = 0;
/** 이번 실행에서 지운 등록 음원. 알림의 "되돌리기"가 id로 찾아 되살린다. 복사해 둔 파일은 되돌릴 수 없게 될 때까지 남는다. */
const removedSounds = new Map<string, RemovedSound>();

/** `sounds/`에서 목록에도, 되돌릴 수 있는 지운 음원에도 없는 파일을 지운다. 등록 중이면 방금 복사한 파일을 지울 수 있어 미룬다. */
function sweepUnusedSounds(): void {
  if (registrationsInFlight > 0) return;
  /** 지우면 안 되는 파일 이름. */
  const keep = new Set([
    ...storage.get().sounds.map((s) => s.file),
    ...[...removedSounds.values()].map((r) => r.sound.file),
  ]);
  void sweepSoundFiles(soundsDir, keep);
}

/**
 * 시작할 때 등록 음원의 파일이 없으면 알리지 않고 목록에서 뺀다. 쓰이던 자리는 기본 음원이 된다.
 * 목록에 없는 파일(되돌릴 수 없게 된 지운 음원 등)은 `sounds/`에서 지운다.
 */
function dropMissingSounds(): void {
  /** 파일이 있는 등록 음원 id. */
  const present = new Set(storage.get().sounds.filter((s) => existsSync(join(soundsDir, s.file))).map((s) => s.id));
  /** 파일이 없는 음원을 뺀 값. */
  const pruned = pruneSounds(storage.get(), present);
  if (pruned !== storage.get()) storage.update(() => pruned);
  sweepUnusedSounds();
}
dropMissingSounds();

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
  onClosing: (event: Electron.Event) => void,
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
  // 저장하지 않은 편집을 묻는 일이 끝난 닫기는 숨기거나 앱을 끝낸다
  win.on('close', (event) => {
    if (!event.defaultPrevented) onClosing(event);
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
  /** 숨긴 창의 종 재생기. 앱 창 다음에 만든다. */
  let bell: BellPlayer | null = null;

  /** 화면에 저장하지 않은 수업 시간 편집이 있는지. */
  let editingDirty = false;
  /** 화면이 닫기를 허락해 `close-window`로 닫는 중인지. */
  let closeApproved = false;

  /** 렌더러와 상태를 주고받는 손잡이. */
  const hub = openBridge(
    {
      appVersion: app.getVersion(),
      storage: { saveFailed: false, freshStart: loaded.startedFresh, saveFailures: 0 },
      bellRinging: false,
      ...viewOf(storage.get()),
      previewingSound: null,
      closeNotice: false,
    },
    (command): CommandResult | void | Promise<CommandResult | void> => {
      switch (command.type) {
        case 'set-keep-screen-on':
          save((d) => ({ ...d, settings: { ...d.settings, keepScreenOn: command.on } }));
          break;
        case 'set-bells-off':
          setBellsOff(command.off);
          break;
        case 'set-hide-on-close':
          save((d) => ({ ...d, settings: { ...d.settings, hideOnClose: command.on } }));
          break;
        case 'confirm-hide':
          // 안내가 떠 있을 때만 안내를 봤다고 저장하고 숨긴다
          if (!hub.get().closeNotice) break;
          save((d) => ({ ...d, settings: { ...d.settings, hideNoticeShown: true } }));
          hideMainWindow();
          break;
        case 'dismiss-hide-notice':
          hub.update({ closeNotice: false });
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
        case 'set-master-volume':
          save((d) => setMasterVolume(d, command.volume));
          break;
        case 'set-sound-volume':
          save((d) => setSoundVolume(d, command.id, command.volume));
          break;
        case 'set-bell':
          save((d) => setBell(d, command.kind, command.id));
          break;
        case 'register-sound':
          return registerFromDialog();
        case 'rename-sound':
          save((d) => renameSound(d, command.id, command.name));
          break;
        case 'delete-sound':
          // 지우는 음원을 미리 듣는 중이면 멈춘다
          if (bell?.previewing() === command.id) bell.stopPreview();
          save((d) => {
            const result = removeSound(d, command.id);
            if (result.removed) removedSounds.set(command.id, result.removed);
            return result.data;
          });
          break;
        case 'restore-sound': {
          const removed = removedSounds.get(command.id);
          if (!removed) break;
          removedSounds.delete(command.id);
          save((d) => restoreSound(d, removed));
          break;
        }
        case 'discard-removed-sound': {
          const removed = removedSounds.get(command.id);
          if (!removed) break;
          removedSounds.delete(command.id);
          sweepUnusedSounds();
          break;
        }
        case 'toggle-preview':
          if (bell?.previewing() === command.id) bell.stopPreview();
          else bell?.preview(command.id);
          break;
      }
    },
  );


  /** "오늘 종"을 끄거나 켠다. 끄면 오늘 날짜를 끈 날짜로 저장하고, 저장하면서 스케줄러가 바로 판정해 울리던 종을 멈춘다. */
  function setBellsOff(off: boolean): void {
    save((d) => ({ ...d, bellsOffDate: off ? localDate(Date.now()) : null }));
  }

  /** 파일 고르기 창을 열고, 고른 파일을 확인해 종소리로 등록한다. */
  async function registerFromDialog(): Promise<CommandResult> {
    /** 파일 고르기 결과. */
    const picked = mainWindow
      ? await dialog.showOpenDialog(mainWindow, {
          title: '종소리 등록',
          properties: ['openFile'],
          filters: [{ name: '소리 파일', extensions: [...SOUND_EXTENSIONS] }],
        })
      : { canceled: true, filePaths: [] as string[] };
    const path = picked.filePaths[0];
    if (picked.canceled || !path || !bell) return { ok: true };
    /** 확인하고 복사한 결과. 거절이면 이유가 들어 있다. */
    registrationsInFlight += 1;
    try {
      const result = await registerSoundFile({ path, soundsDir, id: randomUUID(), probe: bell.probe });
      if (!result.ok) return { ok: false, message: result.message };
      // 저장에 실패하면 앱이 실패 알림을 띄운다. 목록에는 메모리의 값대로 나온다
      save((d) => registerSound(d, result.sound));
      return { ok: true, name: result.sound.name };
    } finally {
      registrationsInFlight -= 1;
    }
  }

  /** 시작할 때 등록 음원을 숨긴 창에 하나씩 확인시켜, 재생할 수 없는 것은 알리지 않고 목록에서 뺀다. */
  async function dropUnplayableSounds(): Promise<void> {
    /** 재생할 수 없다고 확인된 음원 id. 확인하지 못한 것(읽기 실패, 재생기 무응답)은 파일 탓이 아니니 둔다. */
    const unplayable = new Set<string>();
    for (const sound of storage.get().sounds) {
      try {
        if ((await bell!.probe(await readFile(join(soundsDir, sound.file)))).status === 'unplayable') {
          unplayable.add(sound.id);
        }
      } catch {
        // 읽지 못한 파일은 건드리지 않는다
      }
    }
    if (unplayable.size === 0) return;
    // 확인하는 사이에 등록한 음원은 건드리지 않는다
    save((d) => pruneSounds(d, new Set(d.sounds.filter((s) => !unplayable.has(s.id)).map((s) => s.id))), { quiet: true });
    sweepUnusedSounds();
  }

  /** 종 스케줄러. 숨긴 재생기 창과 함께 앱 창 다음에 만들어, 그 전의 저장은 판정을 부르지 않는다. */
  let scheduler: Scheduler | null = null;

  /** 저장된 값을 바꾸고 파일에 쓴 뒤, 화면 쪽 상태와 스케줄러에 알린다. */
  function save(change: (data: Data) => Data, options?: { quiet: boolean }): boolean {
    /** 파일에 쓰지 못했는지. 바꾼 내용은 메모리에 남는다. */
    const saveFailed = !storage.update(change).ok;
    /** 바뀐 뒤의 화면 쪽 값. */
    const view = viewOf(storage.get());
    /** 화면 쪽에 알릴 저장 상태. quiet이면 실패를 세지 않아 화면이 알림을 띄우지 않는다. */
    const notice = hub.get().storage;
    const failures = saveFailed && !options?.quiet ? notice.saveFailures + 1 : notice.saveFailures;
    if (
      notice.saveFailed !== saveFailed ||
      notice.saveFailures !== failures ||
      (Object.keys(view) as (keyof typeof view)[]).some((key) => hub.get()[key] !== view[key])
    ) {
      hub.update({ storage: { ...notice, saveFailed, saveFailures: failures }, ...view });
    }
    // 바뀐 시간표 · 배정 · 오늘만 끄기 · 화면 켜 두기를 1초 기다리지 않고 반영한다
    scheduler?.check();
    refreshTray();
    return !saveFailed;
  }

  /** 앱 창. 닫혀 있으면 null. */
  let mainWindow: BrowserWindow | null = null;
  /** 앱이 끝나는 중인지. 끝나는 중의 창 닫기는 숨기지 않고 그대로 닫는다. */
  let quitting = false;
  app.on('before-quit', () => {
    quitting = true;
  });

  /** 앱 창을 만들고, 닫히면 비운다. */
  const openMainWindow = (): void => {
    editingDirty = false;
    closeApproved = false;
    mainWindow = createMainWindow(
      save,
      // 종료 중에는 저장하지 않은 편집이 있어도 확인 없이 닫는다
      () => editingDirty && !closeApproved && !quitting,
      (event) => {
        /** 닫기 버튼에 대한 처리. */
        const action = decideClose({ quitting, ...storage.get().settings });
        if (action === 'allow') return;
        if (action === 'quit') {
          quitting = true;
          app.quit();
          return;
        }
        // 숨기는 길에서는 창을 닫지 않는다. 다음 닫기가 저장하지 않은 편집을 다시 묻게 한다
        event.preventDefault();
        closeApproved = false;
        if (action === 'notice') hub.update({ closeNotice: true });
        else hideMainWindow();
      },
    );
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  };

  /** 앱 창을 숨긴다. macOS는 창이 없는 동안 Dock 아이콘도 숨긴다. */
  function hideMainWindow(): void {
    hub.update({ closeNotice: false });
    mainWindow?.hide();
    if (process.platform === 'darwin') app.dock?.hide();
  }

  /** 숨겼거나 닫힌 앱 창을 앞으로 가져온다. */
  function showMainWindow(): void {
    if (process.platform === 'darwin') void app.dock?.show();
    if (!mainWindow) {
      openMainWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  onSecondInstance = showMainWindow;

  /** 트레이 · 메뉴 막대 아이콘. */
  let tray: Tray | null = null;
  /** 지금 아이콘과 메뉴를 만든 상태의 열쇠. 같으면 다시 만들지 않는다. */
  let trayKey = '';
  /** 오늘 종이 켜져 있는지. 끈 날짜가 오늘일 때만 꺼진 것이다. */
  const bellsOn = (): boolean => storage.get().bellsOffDate !== localDate(Date.now());
  /** 오늘 종이 켜졌는지에 맞는 트레이 아이콘 그림. */
  const trayImage = (on: boolean) => nativeImage.createFromPath(join(app.getAppPath(), 'resources/icons', trayIconFile(process.platform, on)));
  /** 종이 울리는지와 오늘 종에 맞춰 트레이 아이콘과 메뉴를 고친다. 날짜가 넘어가는 것도 1초 타이머가 여기서 잡는다. */
  function refreshTray(): void {
    if (!tray) return;
    /** 메뉴에 반영할 상태. */
    const state = { ringing: hub.get().bellRinging, bellsOn: bellsOn() };
    /** 이 상태의 열쇠. */
    const key = `${state.ringing}|${state.bellsOn}`;
    if (key === trayKey) return;
    trayKey = key;
    tray.setImage(trayImage(state.bellsOn));
    tray.setContextMenu(
      Menu.buildFromTemplate(
        trayMenuTemplate(state, {
          open: showMainWindow,
          stopBell: () => bell?.stop(),
          setBellsOn: (on) => {
            setBellsOff(!on);
            // 저장에 실패해도 OS가 이미 바꾼 체크 표시를 실제 값에 맞춰 다시 그린다
            trayKey = '';
            refreshTray();
          },
          quit: () => app.quit(),
        }),
      ),
    );
  }
  // 앱 창을 먼저 만든다. 숨긴 재생기 창보다 먼저 떠야 첫 창이 앱 창이다
  openMainWindow();

  bell = openBellPlayer({
    read: storage.get,
    builtinDir: join(app.getAppPath(), 'resources/sounds/builtin'),
    registeredDir: soundsDir,
    onRingingChange: (bellRinging) => {
      hub.update({ bellRinging });
      refreshTray();
    },
    onPreviewChange: (previewingSound) => hub.update({ previewingSound }),
  });
  void dropUnplayableSounds();


  /** 돌고 있는 스케줄러. 창이 없어도 메인 프로세스에서 1초마다, 그리고 깨어나면 바로 판정한다. */
  const running = startScheduler({
    now: () => Date.now(),
    everySecond(tick) {
      /** 1초 타이머. */
      const timer = setInterval(() => {
        tick();
        refreshTray();
      }, 1000);
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

  /** 트레이 아이콘을 만든다. */
  const createTray = (): void => {
    tray = new Tray(trayImage(bellsOn()));
    tray.setToolTip('딩동댕');
    // Windows는 아이콘을 왼쪽 클릭하면 창을 연다. macOS는 누르면 메뉴가 열린다
    if (process.platform !== 'darwin') tray.on('click', showMainWindow);
    refreshTray();
  };
  // 앱 창의 화면을 다 불러온 뒤에 만든다. 창을 만드는 도중에 트레이를 만들면 숨긴 재생기 창이 첫 창으로 먼저 잡히는 일이 있다
  /** 지금 떠 있는 앱 창. 타입 검사기는 위의 대입을 따라가지 못해 null로만 본다. */
  const firstWindow = mainWindow as BrowserWindow | null;
  if (firstWindow?.webContents.isLoading()) firstWindow.webContents.once('did-finish-load', createTray);
  else createTray();
  app.on('will-quit', () => running.stop());

  // 창이 없을 때 Dock 아이콘을 누르면 앱 창을 다시 연다. 숨긴 재생기 창은 세지 않는다
  app.on('activate', showMainWindow);
});
