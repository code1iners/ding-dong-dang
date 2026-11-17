import { useEffect, useRef, useState } from 'react';
import { Rail } from './Rail';
import { SCREENS, type ScreenId } from './screens';
import { SettingsScreen } from './SettingsScreen';
import { TimetableScreen } from './TimetableScreen';
import { ToastStack, useToasts } from './Toasts';
import { useAppState } from './useAppState';

/** 저장에 실패했을 때의 알림 문장. 무엇이 안 됐는지와 무엇을 하면 되는지를 함께 말한다(DESIGN.md "글"). */
const SAVE_FAILED_TEXT = '저장하지 못했어요. 디스크에 빈 공간이 있는지 확인하고 다시 저장해 주세요.';
/** 저장된 파일을 읽지 못해 빈 상태로 시작했을 때의 알림 문장. */
const FRESH_START_TEXT = '저장된 시간표를 읽지 못해 새로 시작했어요. 시간표를 다시 만들어 주세요.';

/** 왼쪽 세로 줄과 지금 고른 화면으로 된 앱 창의 내용. */
export function App() {
  /** 지금 보이는 화면. 창을 열면 현황 화면이다. */
  const [screen, setScreen] = useState<ScreenId>('status');
  /** 지금 화면의 이름. */
  const name = SCREENS.find((s) => s.id === screen)?.name;
  /** 메인에서 받은 앱 상태. */
  const state = useAppState();
  /** 알림 목록과 손잡이. */
  const toasts = useToasts();
  const { notify } = toasts;

  /** 지금까지 알린 저장 실패 횟수. 처음 상태를 받았을 때의 값으로 시작해, 그 뒤에 늘어난 것만 알린다. */
  const notifiedFailures = useRef<number | null>(null);
  const saveFailures = state?.storage.saveFailures;
  // 저장에 실패할 때마다 알린다. 이미 실패 중에 또 실패해도 다시 알린다
  useEffect(
    function announceSaveFailure() {
      if (saveFailures === undefined) return;
      if (notifiedFailures.current !== null && saveFailures > notifiedFailures.current) {
        notify({ key: 'save-failed', kind: 'failure', text: SAVE_FAILED_TEXT });
      }
      notifiedFailures.current = saveFailures;
    },
    [saveFailures, notify],
  );

  const freshStart = state?.storage.freshStart;
  // 시작할 때 저장된 시간표를 읽지 못했다면 한 번 알린다. 메인에 알렸음을 말해 창을 다시 열어도 반복하지 않게 한다
  useEffect(
    function announceFreshStart() {
      if (!freshStart) return;
      notify({ key: 'fresh-start', kind: 'failure', text: FRESH_START_TEXT });
      window.dingdong.command({ type: 'ack-fresh-start' }).catch((error: unknown) => console.error(error));
    },
    [freshStart, notify],
  );

  return (
    <div className="app">
      <Rail current={screen} onSelect={setScreen} />
      {/* 화면 제목은 보이지 않게 두고(DESIGN.md "글"), 화면 읽기용 이름만 붙인다. 비어 있는 화면은 화면 티켓에서 채운다 */}
      <main className="screen" aria-label={name}>
        {screen === 'timetable' && state && (
          <TimetableScreen timetables={state.timetables} weekdays={state.weekdays} toasts={toasts} />
        )}
        {screen === 'settings' && state && <SettingsScreen settings={state.settings} />}
      </main>
      <ToastStack toasts={toasts.toasts} dismiss={toasts.dismiss} />
    </div>
  );
}
