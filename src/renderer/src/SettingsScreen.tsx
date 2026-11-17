import type { Settings } from '../../shared/data';
import { DogThemePicker } from './DogThemePicker';
import { ActionIcon } from './icons';
import { Switch } from './Switch';

type Props = {
  /** 메인에서 받은 지금 설정 값. */
  settings: Settings;
  /** OS에 물은 자동 시작 등록 상태. 스위치와 실패 표시는 설정 값이 아니라 이 값을 따른다. */
  autoStartRegistered: boolean;
};

/** 설정 화면. DESIGN.md의 항목 순서대로 줄이 놓이며, 나머지 줄은 해당 기능 티켓에서 더한다. */
export function SettingsScreen({ settings, autoStartRegistered }: Props) {
  /** 켜 달라고 했는데 OS에 등록되지 않은 상태. 스위치는 꺼진 채로 두고 그 줄에 이유와 방법을 보여 준다. */
  const autoStartFailed = settings.autoStart && !autoStartRegistered;
  return (
    <div className="card">
      <DogThemePicker themeId={settings.dogTheme} />
      <div className="setting-row">
        <span id="setting-auto-start">컴퓨터를 켜면 자동 시작</span>
        <div className="setting-row__control">
          {autoStartFailed && (
            <>
              <span id="setting-auto-start-error" className="setting-row__error">
                <ActionIcon name="bang" />
                등록하지 못했어요
              </span>
              <button
                type="button"
                className="text-link"
                onClick={() => void window.dingdong.command({ type: 'open-auto-start-help' })}
              >
                자동 시작 등록 방법
              </button>
            </>
          )}
          <Switch
            on={autoStartRegistered}
            labelledBy="setting-auto-start"
            describedBy={autoStartFailed ? 'setting-auto-start-error' : undefined}
            onChange={(on) => void window.dingdong.command({ type: 'set-auto-start', on })}
          />
        </div>
      </div>
      <div className="setting-row">
        <span id="setting-hide-on-close">닫으면 숨기기</span>
        <div className="setting-row__control">
          <Switch
            on={settings.hideOnClose}
            labelledBy="setting-hide-on-close"
            onChange={(on) => void window.dingdong.command({ type: 'set-hide-on-close', on })}
          />
        </div>
      </div>
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
