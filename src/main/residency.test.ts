import { describe, expect, it, vi } from 'vitest';
import { decideClose, trayIconFile, trayMenuTemplate, type TrayActions } from './residency';

describe('decideClose', () => {
  it('앱이 끝나는 중이면 그대로 닫는다', () => {
    expect(decideClose({ quitting: true, hideOnClose: true, hideNoticeShown: false })).toBe('allow');
  });
  it('닫으면 숨기기를 껐으면 앱을 끝낸다', () => {
    expect(decideClose({ quitting: false, hideOnClose: false, hideNoticeShown: false })).toBe('quit');
  });
  it('처음 숨길 때는 안내를 먼저 띄운다', () => {
    expect(decideClose({ quitting: false, hideOnClose: true, hideNoticeShown: false })).toBe('notice');
  });
  it('안내를 본 뒤에는 바로 숨긴다', () => {
    expect(decideClose({ quitting: false, hideOnClose: true, hideNoticeShown: true })).toBe('hide');
  });
});

describe('trayMenuTemplate', () => {
  const actions: TrayActions = { open: vi.fn(), stopBell: vi.fn(), setBellsOn: vi.fn(), quit: vi.fn() };
  const labels = (ringing: boolean) => trayMenuTemplate({ ringing, bellsOn: true }, actions).map((i) => i.label ?? i.type);

  it('DESIGN.md의 순서이고 "종 멈추기"는 울릴 때만 있다', () => {
    expect(labels(false)).toEqual(['딩동댕 열기', '오늘 종', 'separator', '딩동댕 종료']);
    expect(labels(true)).toEqual(['딩동댕 열기', '종 멈추기', '오늘 종', 'separator', '딩동댕 종료']);
  });
  it('"오늘 종"은 켜져 있을 때 체크이고 누른 뒤의 체크 값을 동작에 넘긴다', () => {
    const item = trayMenuTemplate({ ringing: false, bellsOn: false }, actions).find((i) => i.label === '오늘 종')!;
    expect(item).toMatchObject({ type: 'checkbox', checked: false });
    (item.click as (i: { checked: boolean }) => void)({ checked: true });
    expect(actions.setBellsOn).toHaveBeenCalledWith(true);
  });
});

describe('trayIconFile', () => {
  it('꺼지면 빗금 아이콘이다', () => {
    expect(trayIconFile('darwin', true)).toBe('trayTemplate.png');
    expect(trayIconFile('darwin', false)).toBe('trayOffTemplate.png');
    expect(trayIconFile('win32', true)).toBe('tray-win.ico');
    expect(trayIconFile('win32', false)).toBe('tray-win-off.ico');
  });
});
