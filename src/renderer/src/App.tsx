import { useState } from 'react';
import { Rail } from './Rail';
import { SCREENS, type ScreenId } from './screens';
import { SettingsScreen } from './SettingsScreen';
import { useAppState } from './useAppState';

/** 왼쪽 세로 줄과 지금 고른 화면으로 된 앱 창의 내용. */
export function App() {
  /** 지금 보이는 화면. 창을 열면 현황 화면이다. */
  const [screen, setScreen] = useState<ScreenId>('status');
  /** 지금 화면의 이름. */
  const name = SCREENS.find((s) => s.id === screen)?.name;
  /** 메인에서 받은 앱 상태. */
  const state = useAppState();

  return (
    <div className="app">
      <Rail current={screen} onSelect={setScreen} />
      {/* 화면 제목은 보이지 않게 두고(DESIGN.md "글"), 화면 읽기용 이름만 붙인다. 비어 있는 화면은 화면 티켓에서 채운다 */}
      <main className="screen" aria-label={name}>
        {screen === 'settings' && state && <SettingsScreen settings={state.settings} />}
      </main>
    </div>
  );
}
