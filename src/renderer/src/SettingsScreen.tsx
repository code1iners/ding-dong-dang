import type { Settings } from '../../shared/data';
import { Switch } from './Switch';

type Props = {
  /** 메인에서 받은 지금 설정 값. */
  settings: Settings;
};

/** 설정 화면. DESIGN.md의 항목 순서대로 줄이 놓이며, 나머지 줄은 해당 기능 티켓에서 더한다. */
export function SettingsScreen({ settings }: Props) {
  return (
    <div className="card">
      <div className="setting-row">
        <span id="setting-keep-screen-on">수업 중 화면 켜 두기</span>
        <div className="setting-row__control">
          <Switch
            on={settings.keepScreenOn}
            labelledBy="setting-keep-screen-on"
            onChange={(on) => void window.dingdong.command({ type: 'set-keep-screen-on', on })}
          />
        </div>
      </div>
    </div>
  );
}
