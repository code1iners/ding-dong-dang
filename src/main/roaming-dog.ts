import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, powerMonitor, screen } from 'electron';
import { decideBell, type StatusKind } from '../shared/bell-decision';
import type { Data } from '../shared/data';
import { DOG_CHANNEL, type DogFigureReport, type DogView } from '../shared/dog-window';
import {
  dogWindowBounds,
  holdDog,
  isOverDog,
  moveHeldDog,
  placeDog,
  releaseDog,
  stepDog,
  summonDog,
  type DogScene,
  type RoamingDog,
} from '../shared/roaming-dog';
import { framesPerSecond } from '../shared/status-view';

// 돌아다니는 강아지 창. 강아지보다 조금 큰 투명 창 하나를 옮겨서 강아지를 움직인다.
// 창 옵션 · 크기 식 · 클릭 통과 방식은 돌아다니는 강아지 창을 Mac에서 검증하기(28번)의 "창 만드는 법"이고,
// 측정용 앱 prototypes/dog-window-probe/가 선례다. 끄는 동안의 위치는 강아지 창의 포인터 좌표가 아니라 메인이 읽은 커서 위치로 정한다.

/** 커서가 강아지 위에 있는지 확인하는 간격(ms). 강아지 위에서만 창이 클릭을 받는다. */
const HIT_TEST_MS = 33;

/** 강아지 창이 받는 값. */
type Options = {
  /** 지금 저장된 값. 설정 · 시간표 · 오늘만 끄기를 판정할 때마다 읽는다. */
  read(): Data;
  /** 지금 종이 울리는 중인지. */
  ringing(): boolean;
  /** 울리는 종을 멈춘다. 강아지를 누르거나 끌기 시작하면 부른다. */
  stopBell(): void;
};

/** 메인 쪽의 강아지 창 손잡이. */
export type RoamingDogWindow = {
  /** 설정이나 종 울림이 바뀌었을 때 부른다. 보이기 · 숨기기와 동작을 바로 맞춘다. */
  refresh(): void;
};

/** 지금 주 모니터의 바닥. 좌우 · 위 끝은 모니터 전체, 바닥은 작업 표시줄 · Dock을 뺀 작업 영역의 아래쪽이다(28번). */
function primaryFloor(): DogScene['floor'] {
  /** 주 모니터. */
  const display = screen.getPrimaryDisplay();
  return {
    left: display.bounds.x,
    right: display.bounds.x + display.bounds.width,
    top: display.bounds.y,
    bottom: display.workArea.y + display.workArea.height,
  };
}

/** 강아지 창을 만들고 메인 쪽 손잡이를 돌려준다. 앱 창과 종 재생기 창보다 뒤에 만든다. */
export function openRoamingDog(options: Options): RoamingDogWindow {
  /** 처음 크기를 잡을 때 쓰는 키(px). 그림을 잰 뒤에 실제 크기로 바꾼다. */
  const firstHeight = options.read().settings.dogHeight;
  /** 강아지 창. 포커스를 받지 않고, 다른 앱 창 · Dock · 전체 화면 앱 위에 뜬다. */
  const win = new BrowserWindow({
    ...dogWindowBounds({ x: 0, feetY: 0, width: firstHeight, height: firstHeight }),
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: false,
    // 강아지가 화면 가장자리에 있으면 창의 여백이 모니터 밖으로 나간다
    enableLargerThanScreen: true,
    fullscreenable: false,
    // macOS에서 전체 화면 앱 위에도 보이려면 panel이어야 한다(28번)
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/dog.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 창이 가려지거나 앱이 뒤에 있어도 그리기 횟수를 타이머대로 지킨다
      backgroundThrottling: false,
    },
  });
  // floating 레벨은 Dock 뒤에 가려진다. pop-up-menu는 Dock 위에 그린다(28번)
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  win.setIgnoreMouseEvents(true);
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  /** 그림을 잰 결과. 받기 전에는 창을 띄우지 않는다. */
  let figure: DogFigureReport | null = null;
  /** 강아지 상태. 처음 띄울 때 바닥의 무작위 위치에 놓는다. */
  let dog: RoamingDog | null = null;
  /** 설정이 꺼진 채 종 때문에 나타나 있는지. 나타날 때 한 번 바닥 가운데로 옮긴다. */
  let summoned = false;
  /** 화면이 잠겼는지와 PC가 잠들었는지. 둘 중 하나라도 참이면 그리기를 멈춘다(잠긴 채 깨어나도 멈춰 있다). */
  const power = { locked: false, asleep: false };
  /** 지금 그리기를 멈췄는지. */
  let paused = false;
  /** 지금 창이 클릭을 통과시키는지. */
  let ignoring = true;
  /** 주 모니터의 바닥. 모니터 구성이 바뀔 때만 다시 읽는다. */
  let floor = primaryFloor();
  /** 이번 초의 현황. 같은 초 안에서는 다시 계산하지 않는다. */
  let status: { second: number; kind: StatusKind; bellsOff: boolean } | null = null;
  /** 마지막으로 보낸 그릴 내용. 같으면 다시 보내지 않는다. */
  let sentView = '';
  /** 마지막으로 맞춘 창 자리. 같으면 다시 옮기지 않는다. */
  let placed = '';
  /** 다음 판정을 미룬 타이머. */
  let tickTimer: NodeJS.Timeout | undefined;
  /** 커서 확인 타이머. 창이 보이고 멈추지 않은 동안만 돈다. */
  let hitTimer: NodeJS.Timeout | undefined;

  /** 지금 시각의 현황과 오늘만 끄기. 종 판정과 같은 함수로 정한다. */
  function statusAt(now: number, data: Data): { kind: StatusKind; bellsOff: boolean } {
    /** 지금 시각의 초. */
    const second = Math.floor(now / 1000);
    if (status?.second !== second) {
      /** 종 판정 결과. 현황과 오늘만 끄기만 쓴다. */
      const decision = decideBell({
        timetables: data.timetables,
        activeTimetable: data.activeTimetable,
        bellsOffDate: data.bellsOffDate,
        lastChecked: null,
        now,
      });
      status = { second, kind: decision.status.kind, bellsOff: decision.bellsOff };
    }
    return status;
  }

  /** 상태 기계에 넣을 지금 장면. 그림을 재기 전에는 없다. */
  function sceneAt(now: number, data: Data): DogScene | null {
    if (!figure) return null;
    return {
      ...statusAt(now, data),
      ringing: options.ringing(),
      reducedMotion: figure.reducedMotion,
      floor,
      width: figure.width,
      height: data.settings.dogHeight,
      gait: figure.gait,
      summoned: !data.settings.roamingDog,
    };
  }

  /** 그릴 내용이 바뀌었으면 강아지 창에 보낸다. */
  function sendView(data: Data): void {
    /** 지금 그릴 내용. */
    const view: DogView = {
      themeId: data.settings.dogTheme,
      height: data.settings.dogHeight,
      action: dog?.action ?? 'idle',
      facing: dog?.facing ?? 1,
      paused,
    };
    /** 견주기 위한 열쇠. */
    const key = JSON.stringify(view);
    if (key === sentView || win.isDestroyed()) return;
    sentView = key;
    win.webContents.send(DOG_CHANNEL.view, view);
  }

  /** 강아지 발끝이 놓인 화면 자리. */
  function placement(data: Data) {
    return { x: dog!.x, feetY: dog!.y, width: figure!.width, height: data.settings.dogHeight };
  }

  /** 창을 강아지 자리로 옮긴다. */
  function place(data: Data): void {
    /** 강아지 자리에 맞춘 창 자리. */
    const bounds = dogWindowBounds(placement(data));
    /** 견주기 위한 열쇠. */
    const key = JSON.stringify(bounds);
    if (key === placed) return;
    placed = key;
    win.setBounds(bounds);
  }

  /** 커서가 강아지 위에 있거나 누르는 중일 때만 클릭을 받는다. forward 옵션 없이 메인이 직접 확인한다(28번). */
  function hitTest(): void {
    if (win.isDestroyed() || !dog || !figure) return;
    /** 클릭을 통과시킬지. 누르고 있거나 끄는 동안은 커서가 강아지에서 벗어나도 클릭을 받는다. */
    const ignore = !(dog.hold || isOverDog(screen.getCursorScreenPoint(), placement(options.read())));
    if (ignore === ignoring) return;
    ignoring = ignore;
    win.setIgnoreMouseEvents(ignore);
  }

  /** 커서 확인을 켜거나 끈다. */
  function setHitTesting(on: boolean): void {
    if (on && !hitTimer) hitTimer = setInterval(hitTest, HIT_TEST_MS);
    if (!on && hitTimer) {
      clearInterval(hitTimer);
      hitTimer = undefined;
    }
  }

  /** 손을 놓는다. 끌던 중이면 그 자리에서 내려오기 시작해, 다시 보일 때 낙하를 끝내고 착지한다. */
  function letGo(): void {
    if (!dog?.hold) return;
    /** 놓을 때의 장면. 그림을 재기 전이면 없고, 그때는 손만 놓는다. */
    const scene = sceneAt(Date.now(), options.read());
    dog = scene ? releaseDog(dog, scene, Date.now(), false).dog : { ...dog, hold: null };
  }

  /** 창을 숨기고 클릭을 다시 통과시킨다. 누르거나 끌던 손은 놓은 것으로 한다(숨은 창에는 손을 떼는 신호가 오지 않는다). */
  function hide(): void {
    setHitTesting(false);
    letGo();
    if (!ignoring) {
      ignoring = true;
      win.setIgnoreMouseEvents(true);
    }
    if (win.isVisible()) win.hide();
  }

  /**
   * 한 번 판정한다: 보일지 정하고, 상태 기계로 동작과 위치를 넘기고, 창을 옮기고, 다음 판정을 동작의 그리는 횟수에 맞춰 미룬다.
   * 숨었거나 멈춘 동안은 다음 판정을 걸지 않고, 설정 · 종 · 잠금 해제가 다시 부른다.
   */
  function update(): void {
    clearTimeout(tickTimer);
    if (win.isDestroyed()) return;
    /** 이번 판정의 시각. */
    const now = Date.now();
    /** 이번 판정에 쓰는 저장된 값. */
    const data = options.read();
    /** 이번 판정의 장면. 그림을 재기 전이면 없다. */
    const scene = sceneAt(now, data);
    if (!scene) return;
    // 꺼진 채로는 종이 울리는 동안에만 나타난다
    if (!data.settings.roamingDog && !scene.ringing) {
      summoned = false;
      hide();
      return;
    }
    dog ??= placeDog(scene, now, Math.random);
    if (!data.settings.roamingDog && !summoned) dog = summonDog(dog, scene);
    summoned = !data.settings.roamingDog;
    /** 끌기가 이번에 시작돼 울리는 종을 멈춰야 하는지. */
    let stopBell = false;
    if (paused) {
      // 멈춘 동안은 시각만 넘겨, 풀린 뒤 그동안 걸은 것처럼 옮겨 가지 않게 한다
      dog = { ...dog, at: now };
    } else {
      // 누르고 있으면 커서를 따라 끌기를 시작하거나 옮긴다. 위치는 메인이 읽은 커서로 정한다(28번)
      if (dog.hold) ({ dog, stopBell } = moveHeldDog(dog, scene, screen.getCursorScreenPoint(), now));
      dog = stepDog(dog, scene, now, Math.random);
    }
    place(data);
    sendView(data);
    if (!win.isVisible()) win.showInactive();
    setHitTesting(!paused);
    // 누르고 있는 동안은 끌기를 바로 알아채도록 끄는 동작과 같은 횟수로 판정한다
    if (!paused) tickTimer = setTimeout(update, 1000 / framesPerSecond(dog.hold ? 'drag' : dog.action));
    if (stopBell) options.stopBell();
  }

  ipcMain.on(DOG_CHANNEL.figure, (event, raw: unknown) => {
    if (event.sender !== win.webContents) return;
    /** 강아지 창이 보낸 값. 형태를 믿지 않고 하나씩 확인한다. */
    const report = raw as Partial<DogFigureReport> | null;
    if (
      typeof report?.width !== 'number' ||
      !Number.isFinite(report.width) ||
      report.width <= 0 ||
      (report.gait !== 'walk' && report.gait !== 'hop') ||
      typeof report.reducedMotion !== 'boolean'
    ) {
      return;
    }
    figure = { width: report.width, gait: report.gait, reducedMotion: report.reducedMotion };
    placed = '';
    update();
  });
  ipcMain.on(DOG_CHANNEL.press, (event, phase: unknown) => {
    if (event.sender !== win.webContents || (phase !== 'down' && phase !== 'up' && phase !== 'cancel')) return;
    if (!dog || !win.isVisible()) return;
    if (phase === 'down') {
      dog = holdDog(dog, screen.getCursorScreenPoint());
      update();
      return;
    }
    /** 이번 판정의 시각. */
    const now = Date.now();
    /** 손을 뗄 때의 장면. 그림을 재기 전이면 없다. */
    const scene = sceneAt(now, options.read());
    if (!scene) {
      // 클릭을 계속 받지 않도록 손은 놓는다
      letGo();
      return;
    }
    // 끌던 중이면 놓아 낙하산으로 내려오고, 끌지 않았으면 누른 것이다(2초쯤 신남, 하트, 울리는 종 멈춤)
    /** 손을 뗀 결과. */
    const released = releaseDog(dog, scene, now, phase === 'up');
    dog = released.dog;
    if (released.petted) win.webContents.send(DOG_CHANNEL.hearts);
    if (released.stopBell) options.stopBell();
    update();
  });

  // 창이 새로 불러지면 그릴 내용을 다시 보낸다
  win.webContents.on('did-finish-load', () => {
    sentView = '';
    sendView(options.read());
  });

  // 모니터를 붙이거나 떼거나 Dock · 작업 표시줄이 바뀌면 바닥을 다시 읽는다
  /** 주 모니터의 바닥을 다시 읽고 강아지를 그 안으로 옮긴다. */
  const refloor = (): void => {
    floor = primaryFloor();
    placed = '';
    update();
  };
  screen.on('display-added', refloor);
  screen.on('display-removed', refloor);
  screen.on('display-metrics-changed', refloor);

  // 화면이 잠기거나 PC가 잠들면 그리기를 멈추고, 풀리면 다시 그린다
  /** 잠금이나 잠자기 상태 하나를 바꾸고, 그에 따라 그리기를 멈추거나 다시 시작한다. */
  const setPower = (key: keyof typeof power, value: boolean) => (): void => {
    power[key] = value;
    /** 바뀐 뒤 멈춰야 하는지. */
    const next = power.locked || power.asleep;
    if (paused === next) return;
    paused = next;
    if (paused) {
      clearTimeout(tickTimer);
      setHitTesting(false);
      sendView(options.read());
    } else {
      update();
    }
  };
  powerMonitor.on('lock-screen', setPower('locked', true));
  powerMonitor.on('unlock-screen', setPower('locked', false));
  powerMonitor.on('suspend', setPower('asleep', true));
  powerMonitor.on('resume', setPower('asleep', false));

  win.on('closed', () => {
    clearTimeout(tickTimer);
    setHitTesting(false);
  });

  /** 개발 서버 주소. 있으면 그 주소의 강아지 화면을 연다. */
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) void win.loadURL(`${devUrl}/dog.html`);
  else void win.loadFile(join(__dirname, '../renderer/dog.html'));

  return {
    refresh() {
      // 저장된 시간표 · 오늘만 끄기가 바뀌었을 수 있어 이번 초의 현황을 다시 계산한다
      status = null;
      update();
    },
  };
}
