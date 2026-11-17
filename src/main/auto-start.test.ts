import { describe, expect, it, vi } from 'vitest';
import {
  AUTO_START_ARG,
  electronLoginItem,
  inertLoginItem,
  isRegistered,
  launchedByAutoStart,
  reconcileAutoStart,
  type LoginItemApi,
} from './auto-start';

describe('isRegistered: OS가 돌려준 등록 상태를 읽는다', () => {
  it('macOS는 status가 enabled일 때만 등록된 것이다', () => {
    expect(isRegistered('darwin', { openAtLogin: true, status: 'enabled' })).toBe(true);
    // 사용자가 시스템 설정에서 허용해야 하는 상태는 아직 뜨지 않는다
    expect(isRegistered('darwin', { openAtLogin: false, status: 'requires-approval' })).toBe(false);
    expect(isRegistered('darwin', { openAtLogin: false, status: 'not-found' })).toBe(false);
    expect(isRegistered('darwin', { openAtLogin: false, status: 'not-registered' })).toBe(false);
  });

  it('Windows는 등록돼 있고 작업 관리자에서 꺼지지 않았을 때만 등록된 것이다', () => {
    expect(isRegistered('win32', { openAtLogin: true, executableWillLaunchAtLogin: true })).toBe(true);
    expect(isRegistered('win32', { openAtLogin: true, executableWillLaunchAtLogin: false })).toBe(false);
    expect(isRegistered('win32', { openAtLogin: false, executableWillLaunchAtLogin: false })).toBe(false);
  });
});

describe('launchedByAutoStart: 자동 시작으로 떴는지', () => {
  it('macOS는 OS가 알려 주는 wasOpenedAtLogin을 따른다', () => {
    expect(launchedByAutoStart('darwin', ['app'], { openAtLogin: true, wasOpenedAtLogin: true })).toBe(true);
    expect(launchedByAutoStart('darwin', ['app'], { openAtLogin: true, wasOpenedAtLogin: false })).toBe(false);
  });

  it('Windows는 등록할 때 넣은 실행 인자를 본다', () => {
    expect(launchedByAutoStart('win32', ['app.exe', AUTO_START_ARG], { openAtLogin: true })).toBe(true);
    expect(launchedByAutoStart('win32', ['app.exe'], { openAtLogin: true })).toBe(false);
  });

  it('실행 인자는 어느 OS에서든 자동 시작으로 읽는다(자동 검증이 같은 길을 쓴다)', () => {
    expect(launchedByAutoStart('darwin', ['app', AUTO_START_ARG], { openAtLogin: false })).toBe(true);
  });
});

describe('electronLoginItem: Electron app 위의 어댑터', () => {
  /** 마지막으로 받은 설정을 기억하는 가짜 app. */
  function fakeApp() {
    return {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: true, status: 'enabled' })),
      setLoginItemSettings: vi.fn(),
    };
  }

  it('Windows는 등록과 조회에 같은 실행 인자를 넘긴다', () => {
    const app = fakeApp();
    const item = electronLoginItem(app as never, 'win32');
    item.set(true);
    item.get();
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, args: [AUTO_START_ARG] });
    expect(app.getLoginItemSettings).toHaveBeenCalledWith({ args: [AUTO_START_ARG] });
  });

  it('macOS는 실행 인자 없이 등록한다', () => {
    const app = fakeApp();
    electronLoginItem(app as never, 'darwin').set(false);
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false });
  });
});

describe('inertLoginItem: OS를 건드리지 않는 자리 채움', () => {
  it('켜고 끈 값을 기억할 뿐 어디에도 등록하지 않는다', () => {
    const item = inertLoginItem(false);
    expect(item.get().openAtLogin).toBe(false);
    item.set(true);
    expect(isRegistered(process.platform, item.get())).toBe(true);
    expect(item.get().wasOpenedAtLogin).toBeUndefined();
  });
});

describe('reconcileAutoStart: 시작할 때 설정과 OS 등록을 맞춘다', () => {
  /** 상태를 돌려주고 set 호출을 기록하는 가짜 어댑터. */
  function item(snapshot: ReturnType<LoginItemApi['get']>) {
    const set = vi.fn();
    return { api: { get: () => snapshot, set } satisfies LoginItemApi, set };
  }
  const NONE = { openAtLogin: false, status: 'not-registered' };
  const ON = { openAtLogin: true, status: 'enabled' };

  it('켜 둔 설정인데 등록이 없으면 처음 실행에 등록한다', () => {
    const { api, set } = item(NONE);
    reconcileAutoStart('darwin', true, true, api);
    expect(set).toHaveBeenCalledWith(true);
  });

  it('처음이 아니면 등록이 없어도 되살리지 않는다(사용자가 지웠을 수 있다)', () => {
    const { api, set } = item(NONE);
    reconcileAutoStart('darwin', true, false, api);
    expect(set).not.toHaveBeenCalled();
  });

  it('이미 등록돼 있으면 건드리지 않는다', () => {
    const { api, set } = item(ON);
    reconcileAutoStart('darwin', true, true, api);
    expect(set).not.toHaveBeenCalled();
  });

  it('끈 설정인데 등록이 남아 있으면 지운다', () => {
    const { api, set } = item(ON);
    reconcileAutoStart('darwin', false, false, api);
    expect(set).toHaveBeenCalledWith(false);
  });

  it('끈 설정에 등록도 없으면 아무것도 하지 않는다', () => {
    const { api, set } = item(NONE);
    reconcileAutoStart('darwin', false, true, api);
    expect(set).not.toHaveBeenCalled();
  });

  it('OS가 등록을 거절해 던져도 앱은 계속 뜬다', () => {
    const set = vi.fn(() => {
      throw new Error('거절');
    });
    expect(() => reconcileAutoStart('darwin', true, true, { get: () => NONE, set })).not.toThrow();
  });
});
