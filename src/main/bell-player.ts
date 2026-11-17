import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import type { BellKind } from '../shared/bell-decision';
import { BELL_CHANNEL, type PlayRequest, type PlayerReport } from '../shared/bell-player';
import type { Data } from '../shared/data';
import { bellSoundFor, defaultBellSound, type BellSound } from './bell-sound';
import type { SchedulerParts } from './scheduler';

/**
 * 메인 쪽의 종 재생기 손잡이. 스케줄러의 종 재생 부품으로 그대로 끼운다.
 * "울리는 중"은 울리라고 한 순간부터 재생이 끝나거나 멈추거나 실패할 때까지다.
 */
export type BellPlayer = SchedulerParts['bell'];

/** 종 재생기가 받는 값. */
type Options = {
  /** 지금 저장된 값. 울릴 때마다 읽어 그때 고른 음원과 음량을 쓴다. */
  read(): Data;
  /** 내장 음원 WAV가 든 폴더. */
  builtinDir: string;
  /** 등록 음원을 복사해 두는 데이터 폴더의 `sounds/`. */
  registeredDir: string;
  /** 울리는 중인지가 바뀔 때 부른다. */
  onRingingChange(ringing: boolean): void;
};

/** 소리를 내는 숨긴 창을 만들고 메인 쪽 손잡이를 돌려준다. */
export function openBellPlayer(options: Options): BellPlayer {
  /** 소리만 내는 숨긴 창. 보이지 않고 작업 표시줄에도 나오지 않는다. */
  const win = new BrowserWindow({
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/bell.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 사용자가 누르지 않아도 종이 울려야 한다
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  /** 창의 화면을 다 불러왔는지. 그 전에 온 재생 요청은 미뤄 둔다. */
  let loaded = false;
  /** 불러오기 전에 온 마지막 재생 요청. */
  let pending: PlayRequest | null = null;
  /** 가장 최근 요청의 번호. 멈추거나 새로 울리면 늘어나 이전 요청의 늦은 알림과 파일 읽기를 버린다. */
  let latestId = 0;
  /** 지금 울리는 중인지. */
  let ringing = false;

  /** 울리는 중인지를 바꾸고, 바뀐 때만 알린다. */
  function setRinging(value: boolean): void {
    if (ringing === value) return;
    ringing = value;
    options.onRingingChange(value);
  }

  /** 미뤄 둔 재생 요청을 창에 보낸다. 창이 아직 화면을 불러오는 중이면 다 불러온 뒤에 보낸다. */
  function flush(): void {
    if (!pending || !loaded || win.isDestroyed()) return;
    win.webContents.send(BELL_CHANNEL.play, pending);
    pending = null;
  }

  win.webContents.on('did-finish-load', () => {
    loaded = true;
    flush();
  });
  // 숨긴 창의 화면 처리가 죽으면 끝남 · 멈춤 알림이 오지 않는다. 울리던 종은 끝난 것으로 보고 화면을 다시 불러온다
  win.webContents.on('render-process-gone', () => {
    loaded = false;
    latestId += 1;
    pending = null;
    setRinging(false);
    if (!win.isDestroyed()) win.webContents.reload();
  });

  ipcMain.on(BELL_CHANNEL.report, (event, report: PlayerReport) => {
    // 이 창이 보낸, 가장 최근 요청의 알림만 믿는다
    if (event.sender !== win.webContents || report.id !== latestId) return;
    setRinging(report.phase === 'playing');
  });

  /** 음원 파일을 읽는다. */
  function readSound(sound: BellSound): Promise<Uint8Array> {
    return readFile(join(sound.source === 'builtin' ? options.builtinDir : options.registeredDir, sound.file));
  }

  /**
   * 울릴 음원과 그 내용을 정한다. 실행 중에 등록 음원 파일이 사라졌거나 읽을 수 없으면
   * 시작할 때 목록에서 빠진 것과 같이 그 자리의 기본 내장 음원을 그 음원의 음량으로 쓴다.
   */
  async function loadBell(kind: BellKind): Promise<{ sound: BellSound; bytes: Uint8Array }> {
    /** 지금 저장된 값. */
    const data = options.read();
    /** 고른 음원. */
    const chosen = bellSoundFor(data, kind);
    try {
      return { sound: chosen, bytes: await readSound(chosen) };
    } catch (error) {
      /** 대신 울릴 기본 내장 음원. */
      const fallback = defaultBellSound(data, kind);
      if (chosen.source === fallback.source && chosen.file === fallback.file) throw error;
      return { sound: fallback, bytes: await readSound(fallback) };
    }
  }

  /** 시작종이나 끝종으로 고른 음원을 한 번 울린다. 울리던 것은 숨긴 창이 끊는다. */
  function ring(kind: BellKind): void {
    /** 이번 요청의 번호. */
    const id = ++latestId;
    // 울리라고 한 순간부터 울리는 중으로 본다. 스케줄러가 바로 다음 판정에서 끊을 수 있어야 한다
    setRinging(true);
    loadBell(kind).then(
      ({ sound, bytes }) => {
        if (id !== latestId) return;
        pending = { id, bytes, volume: sound.volume };
        flush();
      },
      () => {
        if (id === latestId) setRinging(false);
      },
    );
  }

  /** 울리던 종을 멈춘다. 아직 보내지 않은 요청도 버린다. */
  function stop(): void {
    latestId += 1;
    pending = null;
    if (!win.isDestroyed()) win.webContents.send(BELL_CHANNEL.stop);
    setRinging(false);
  }

  /** electron-vite dev가 띄운 렌더러 개발 서버 주소. */
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) {
    void win.loadURL(`${devUrl}/bell.html`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/bell.html'));
  }
  return { ring, stop, isRinging: () => ringing };
}
