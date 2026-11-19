// 화면에서 메인으로 명령을 보내는 공용 도우미.
import type { Command, CommandResult } from '../../shared/bridge';

/** 메인에 명령을 보낸다. 보내지 못하면 콘솔에 남기고 거절(`ok: false`)로 돌려준다. 저장 실패 알림은 앱이 따로 띄운다. */
export function sendCommand(command: Command): Promise<CommandResult> {
  return window.dingdong.command(command).catch((error: unknown) => {
    console.error(error);
    return { ok: false };
  });
}
