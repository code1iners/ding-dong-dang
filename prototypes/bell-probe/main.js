// PROTOTYPE: 서명 없는 Electron 앱의 상주 동작 실측용. 버리는 코드.
// 트레이 상주 + 메인 프로세스 타이머 + 숨긴 창 오디오만 갖고, 관찰한 것을 전부 로그 파일에 남긴다.
const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  powerMonitor,
  powerSaveBlocker,
  ipcMain,
  shell,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');

/** 실행 인자(`--이름=값`)를 읽는다. */
function readFlag(name, fallback) {
  /** 찾는 인자의 접두사. */
  const prefix = `--${name}=`;
  /** 일치하는 실행 인자. */
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

/** 종 간격(초). 벽시계의 배수 시각에 맞춰 울린다. */
const BELL_SEC = Number(readFlag('bell-sec', '15'));
/** 종 음량(0~1). */
const VOLUME = Number(readFlag('volume', '0.3'));
/** 스케줄러가 벽시계를 다시 읽는 주기(ms). */
const TICK_MS = 1000;
/** 이보다 늦은 틱은 따로 기록한다(ms). */
const LATE_TICK_MS = 1500;

/** 로그 파일 경로. */
let logPath = '';
/** 트레이 참조. 놓으면 아이콘이 사라진다. */
let tray = null;
/** 소리를 내는 숨긴 창. */
let audioWindow = null;
/** 잠자기 방지 블로커 id. 꺼져 있으면 null. */
let blockerId = null;
/** 다음 종의 예정 시각(ms). */
let nextBellAt = 0;
/** 직전 틱의 실제 시각(ms). */
let lastTickAt = 0;
/** 이번 분에 관찰한 가장 큰 틱 지연(ms). */
let maxLateInWindow = 0;
/** 이번 분에 실행된 틱 수. */
let ticksInWindow = 0;
/** 분 단위 요약을 마지막으로 남긴 시각(ms). */
let windowStartedAt = 0;

/** 로그 한 줄을 파일에 남긴다. */
function log(event, data = {}) {
  /** 기록할 한 줄. */
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...data });
  fs.appendFileSync(logPath, `${line}\n`);
  console.log(line);
}

/** 주어진 시각 뒤에 오는 첫 종 시각을 구한다. */
function bellAfter(now) {
  /** 종 간격(ms). */
  const step = BELL_SEC * 1000;
  return Math.floor(now / step) * step + step;
}

/** 숨긴 창에 종을 울리라고 보낸다. */
function ring(scheduledAt, reason) {
  /** 예정 시각보다 늦은 정도(ms). */
  const lateMs = Date.now() - scheduledAt;
  log('ring-request', { reason, scheduledAt: new Date(scheduledAt).toISOString(), lateMs });
  audioWindow.webContents.send('ring', { scheduledAt, volume: VOLUME });
}

/** 스케줄러 틱. 틱 지연을 재고 종 시각이 지났으면 울린다. */
function tick() {
  /** 지금 시각(ms). */
  const now = Date.now();
  /** 직전 틱에서 예정보다 더 흐른 시간(ms). */
  const lateMs = now - lastTickAt - TICK_MS;
  lastTickAt = now;
  ticksInWindow += 1;
  maxLateInWindow = Math.max(maxLateInWindow, lateMs);

  // 크게 늦은 틱은 App Nap · 잠자기 · 일시 중단의 흔적이라 바로 남긴다.
  if (lateMs > LATE_TICK_MS) {
    log('late-tick', { lateMs });
  }

  // 1분마다 틱 지연을 요약한다.
  if (now - windowStartedAt >= 60_000) {
    log('tick-summary', { ticks: ticksInWindow, maxLateMs: maxLateInWindow, blocker: blockerId !== null });
    windowStartedAt = now;
    ticksInWindow = 0;
    maxLateInWindow = 0;
  }

  // 종 시각이 지났나요?
  if (now >= nextBellAt) {
    /** 이번에 울릴 종의 예정 시각. */
    const scheduledAt = nextBellAt;
    nextBellAt = bellAfter(now);
    /** 잠든 사이 지나가 버린 종의 수. */
    const missed = Math.round((nextBellAt - scheduledAt) / (BELL_SEC * 1000)) - 1;
    if (missed > 0) {
      log('bells-missed', { missed });
    }
    ring(scheduledAt, 'schedule');
  }
}

/** 잠자기 방지 블로커를 켜거나 끈다. */
function setBlocker(on) {
  if (on && blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-app-suspension');
  }
  if (!on && blockerId !== null) {
    powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }
  log('blocker', { on: blockerId !== null });
}

/** 로그인 항목을 등록하거나 해제하고 OS가 답한 상태를 남긴다. */
function setLoginItem(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: on });
  } catch (error) {
    log('login-item-error', { on, message: String(error) });
  }
  log('login-item', { requested: on, settings: app.getLoginItemSettings() });
}

/** 트레이 메뉴를 현재 상태로 다시 만든다. */
function refreshTray() {
  /** OS가 알려 준 로그인 항목 상태. */
  const login = app.getLoginItemSettings();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `종 간격 ${BELL_SEC}초`, enabled: false },
      { label: '지금 종 울리기', click: () => ring(Date.now(), 'manual') },
      { type: 'separator' },
      {
        label: '잠자기 방지 블로커',
        type: 'checkbox',
        checked: blockerId !== null,
        click: (item) => {
          setBlocker(item.checked);
          refreshTray();
        },
      },
      {
        label: `로그인 시 자동 실행 (상태: ${login.status ?? login.openAtLogin})`,
        type: 'checkbox',
        checked: login.openAtLogin,
        click: (item) => {
          setLoginItem(item.checked);
          refreshTray();
        },
      },
      { type: 'separator' },
      { label: '로그 폴더 열기', click: () => shell.showItemInFolder(logPath) },
      { label: '종료', click: () => app.quit() },
    ]),
  );
}

/** 트레이 아이콘으로 쓸 16px 단색 사각형. 그림 파일 없이 만든다. */
function makeTrayIcon() {
  /** 한 변의 픽셀 수. */
  const size = 16;
  /** BGRA 픽셀 버퍼. */
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    pixels.writeUInt32LE(0xffe08a2e, i * 4);
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

// 창이 하나도 없어도 종료하지 않는다(트레이 상주).
app.on('window-all-closed', () => {});

app.whenReady().then(() => {
  logPath = path.join(app.getPath('userData'), 'probe-log.jsonl');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  log('start', {
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    packaged: app.isPackaged,
    exe: app.getPath('exe'),
    argv: process.argv.slice(1),
    bellSec: BELL_SEC,
    loginItem: app.getLoginItemSettings(),
  });

  // macOS에서는 Dock 아이콘을 숨겨 메뉴 막대 전용 앱으로 만든다(App Nap이 가장 걸리기 쉬운 구성).
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  audioWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  audioWindow.loadFile('audio.html');

  ipcMain.on('ring-result', (_event, result) => log('ring-result', result));

  // 전원 · 잠금 이벤트를 모두 남긴다.
  for (const name of ['suspend', 'resume', 'lock-screen', 'unlock-screen', 'on-ac', 'on-battery', 'shutdown']) {
    powerMonitor.on(name, () => log(`power:${name}`));
  }

  tray = new Tray(makeTrayIcon());
  tray.setToolTip('BellProbe');
  if (process.platform === 'darwin') {
    tray.setTitle('종');
  }

  // 실행 인자로 받은 초기 설정을 적용한다.
  if (readFlag('blocker', 'off') === 'on') {
    setBlocker(true);
  }
  /** 로그인 항목 실행 인자(on · off · 없음). */
  const loginFlag = readFlag('login', '');
  if (loginFlag) {
    setLoginItem(loginFlag === 'on');
  }
  refreshTray();

  // 스케줄러 시작.
  lastTickAt = Date.now();
  windowStartedAt = lastTickAt;
  nextBellAt = bellAfter(lastTickAt);
  setInterval(tick, TICK_MS);
});
