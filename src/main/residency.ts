import type { MenuItemConstructorOptions } from 'electron';

/** 창 닫기 버튼을 눌렀을 때 앱이 할 일. */
export type CloseAction =
  /** 그대로 닫는다. 앱이 끝나는 중이거나 닫힌 창을 다시 쓰지 않을 때다. */
  | 'allow'
  /** 창을 닫는 대신 앱을 끝낸다. "닫으면 숨기기"를 껐을 때다. */
  | 'quit'
  /** 숨기기 전에 "딩동댕은 계속 켜져 있어요" 안내를 화면에 띄운다. */
  | 'notice'
  /** 창만 숨긴다. */
  | 'hide';

/** 닫기 버튼을 눌렀을 때 무엇을 할지 정한다. 저장하지 않은 편집을 묻는 일은 이보다 먼저 끝난 뒤다. */
export function decideClose(input: { quitting: boolean; hideOnClose: boolean; hideNoticeShown: boolean }): CloseAction {
  if (input.quitting) return 'allow';
  if (!input.hideOnClose) return 'quit';
  return input.hideNoticeShown ? 'hide' : 'notice';
}

/** 트레이 · 메뉴 막대 메뉴가 부르는 동작. */
export type TrayActions = {
  /** 앱 창을 연다. */
  open(): void;
  /** 울리는 종을 멈춘다. */
  stopBell(): void;
  /** "오늘 종"을 켜거나 끈다. 켜면 true. */
  setBellsOn(on: boolean): void;
  /** 앱을 끝낸다. */
  quit(): void;
};

/** 메뉴를 그릴 때 읽는 앱의 지금 상태. */
export type TrayState = {
  /** 지금 종이 울리는 중인지. */
  ringing: boolean;
  /** 오늘 종이 켜져 있는지. */
  bellsOn: boolean;
};

/** DESIGN.md의 순서대로 메뉴 항목을 만든다. "종 멈추기"는 울릴 때만 있다. */
export function trayMenuTemplate(state: TrayState, actions: TrayActions): MenuItemConstructorOptions[] {
  return [
    { label: '딩동댕 열기', click: actions.open },
    ...(state.ringing ? [{ label: '종 멈추기', click: actions.stopBell }] : []),
    { label: '오늘 종', type: 'checkbox', checked: state.bellsOn, click: (item) => actions.setBellsOn(item.checked) },
    { type: 'separator' },
    { label: '딩동댕 종료', click: actions.quit },
  ];
}

/** 트레이 아이콘 파일 이름(`resources/icons/` 아래). macOS는 템플릿 이미지(@2x는 Electron이 짝을 찾는다), 그 밖에는 색 아이콘이다. */
export function trayIconFile(platform: NodeJS.Platform, bellsOn: boolean): string {
  if (platform === 'darwin') return bellsOn ? 'trayTemplate.png' : 'trayOffTemplate.png';
  if (platform === 'win32') return bellsOn ? 'tray-win.ico' : 'tray-win-off.ico';
  return 'app-icon.png';
}
