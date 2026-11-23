import { useCallback, useEffect, useRef, useState } from 'react';
import { DogArt, WindowShownContext } from './dog/DogArt';
import { Modal } from './Modal';
import { BellScreen, UNDO_SOUND_PREFIX } from './BellScreen';
import { Rail } from './Rail';
import { SCREENS, type ScreenId } from './screens';
import { SettingsScreen } from './SettingsScreen';
import { StatusScreen } from './StatusScreen';
import type { LeaveGuard } from './TimetableDetail';
import { TimetableScreen } from './TimetableScreen';
import { ToastStack, useToasts } from './Toasts';
import { useAppState } from './useAppState';
import { useUpdateTiming } from './useUpdateTiming';
import type { AppState } from '../../shared/bridge';
import { justUpdatedText, readyVersion } from '../../shared/update';

/** 저장에 실패했을 때의 알림 문장. 무엇이 안 됐는지와 무엇을 하면 되는지를 함께 말한다(DESIGN.md "글"). */
const SAVE_FAILED_TEXT = '저장하지 못했어요. 디스크에 빈 공간이 있는지 확인하고 다시 저장해 주세요.';
/** 저장된 파일을 읽지 못해 빈 상태로 시작했을 때의 알림 문장. */
const FRESH_START_TEXT = '저장된 시간표를 읽지 못해 새로 시작했어요. 시간표를 다시 만들어 주세요.';

/** 처음 닫을 때 안내 문장. 아이콘이 있는 자리를 OS에 맞춘다(DESIGN.md "처음 닫을 때"). */
const HIDE_NOTICE_TEXT = navigator.userAgent.includes('Mac')
  ? '창을 닫아도 종은 울려요. 화면 위쪽 메뉴 막대의 아이콘에서 다시 열거나 끝낼 수 있어요.'
  : '창을 닫아도 종은 울려요. 화면 아래 오른쪽 알림 영역의 아이콘에서 다시 열거나 끝낼 수 있어요.';

/** 앱 안에서 업데이트를 설치하지 못했을 때의 알림 문장. */
const INSTALL_FAILED_TEXT = '업데이트하지 못했어요. 사이트에서 새 버전을 내려받아 설치해 주세요.';

/** 설정 화면. 업데이트 잠금을 매초 다시 정하는 일은 설정 화면이 떠 있을 때만 한다. */
function Settings({ state }: { state: AppState }) {
  /** 지금 "업데이트"를 잠가야 하는지와 다음 종까지 남은 시간. */
  const updateTiming = useUpdateTiming(state);
  return (
    <SettingsScreen
      settings={state.settings}
      autoStartRegistered={state.autoStartRegistered}
      appVersion={state.appVersion}
      update={state.update}
      updateTiming={updateTiming}
    />
  );
}

/** 처음 닫을 때 안내의 "창 닫기". 메인이 안내를 봤다고 저장하고 창을 숨긴다. */
function confirmHide(): void {
  window.dingdong.command({ type: 'confirm-hide' }).catch((error: unknown) => console.error(error));
}
/** 안내를 창 닫기 없이 거둔다. */
function dismissHideNotice(): void {
  window.dingdong.command({ type: 'dismiss-hide-notice' }).catch((error: unknown) => console.error(error));
}

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

  /** 시간표 상세가 등록한, 저장하지 않은 초안을 두고 떠나기 전에 묻는 손잡이. 상세가 없으면 null. */
  const guardRef = useRef<LeaveGuard | null>(null);
  const registerGuard = useCallback((guard: LeaveGuard | null) => {
    guardRef.current = guard;
  }, []);
  /** 시간표 상세에 저장하지 않은 초안이 있는지. */
  const [editingDirty, setEditingDirty] = useState(false);
  /** 저장하지 않은 초안이 있으면 먼저 묻고, 허락을 받으면 `proceed`를 부른다. */
  const leave: LeaveGuard = useCallback((proceed) => (guardRef.current ? guardRef.current(proceed) : proceed()), []);

  // 초안이 있는지 메인에 알려, 창을 닫으려 할 때 메인이 닫기를 멈추고 묻게 한다
  useEffect(
    function reportEditingDirty() {
      window.dingdong.command({ type: 'set-editing-dirty', dirty: editingDirty }).catch((error: unknown) => console.error(error));
    },
    [editingDirty],
  );
  // 메인이 멈춘 창 닫기는 저장하지 않은 초안을 어떻게 할지 정한 뒤에 이어서 닫는다
  useEffect(
    function closeAfterAsking() {
      return window.dingdong.onCloseRequested(() => {
        leave(() => {
          window.dingdong.command({ type: 'close-window' }).catch((error: unknown) => console.error(error));
        });
      });
    },
    [leave],
  );

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

  /** 지금 떠 있는 "종소리를 지웠어요" 알림의 음원 id를 쉼표로 이은 글. 배열 대신 글로 둬야 알림이 바뀌지 않을 때 아래 효과가 다시 돌지 않는다. */
  const undoSoundIds = toasts.toasts.filter((t) => t.key.startsWith(UNDO_SOUND_PREFIX)).map((t) => t.key.slice(UNDO_SOUND_PREFIX.length)).join(',');
  /** 직전에 떠 있던 지운 종소리 알림의 음원 id. */
  const previousUndoSoundIds = useRef('');
  // 알림이 사라지면 그 종소리는 더 되돌릴 수 없다. 메인이 복사해 둔 파일을 지우게 알린다
  useEffect(
    function discardSoundsNoLongerRestorable() {
      /** 아직 떠 있는 음원 id. */
      const still = new Set(undoSoundIds.split(',').filter(Boolean));
      for (const id of previousUndoSoundIds.current.split(',').filter(Boolean)) {
        if (!still.has(id)) {
          window.dingdong.command({ type: 'discard-removed-sound', id }).catch((error: unknown) => console.error(error));
        }
      }
      previousUndoSoundIds.current = undoSoundIds;
    },
    [undoSoundIds],
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

  /** 앱 내 업데이트로 다시 켜진 첫 실행이면 그 버전. */
  const justUpdated = state?.update.justUpdated;
  // 앱 내 업데이트로 다시 켜졌으면 한 번 알린다. 메인에 알렸음을 말해 창을 다시 열어도 반복하지 않게 한다
  useEffect(
    function announceJustUpdated() {
      if (!justUpdated) return;
      notify({ key: 'just-updated', kind: 'success', text: justUpdatedText(justUpdated) });
      window.dingdong.command({ type: 'ack-just-updated' }).catch((error: unknown) => console.error(error));
    },
    [justUpdated, notify],
  );

  /** 지금까지 알린 설치 실패 횟수. 처음 상태를 받았을 때의 값으로 시작해, 그 뒤에 늘어난 것만 알린다. */
  const notifiedInstallFailures = useRef<number | null>(null);
  /** 메인이 센 설치 실패 횟수. */
  const installFailures = state?.update.installFailures;
  // 앱 안에서 설치하지 못하면 알린다
  useEffect(
    function announceInstallFailure() {
      if (installFailures === undefined) return;
      if (notifiedInstallFailures.current !== null && installFailures > notifiedInstallFailures.current) {
        notify({ key: 'install-failed', kind: 'failure', text: INSTALL_FAILED_TEXT });
      }
      notifiedInstallFailures.current = installFailures;
    },
    [installFailures, notify],
  );

  return (
    <WindowShownContext.Provider value={state?.windowShown ?? true}>
      <div className="app">
        <Rail
          current={screen}
          onSelect={(next) => next !== screen && leave(() => setScreen(next))}
          updateReady={state ? readyVersion(state.update.status) !== null : false}
        />
        {/* 화면 제목은 보이지 않게 두고(DESIGN.md "글"), 화면 읽기용 이름만 붙인다. 비어 있는 화면은 화면 티켓에서 채운다 */}
        <main className="screen" aria-label={name}>
          {screen === 'status' && state && <StatusScreen state={state} onMakeTimetable={() => setScreen('timetable')} />}
          {screen === 'timetable' && state && (
            <TimetableScreen
              timetables={state.timetables}
              activeTimetable={state.activeTimetable}
              dogTheme={state.settings.dogTheme}
              toasts={toasts}
              registerGuard={registerGuard}
              onDirtyChange={setEditingDirty}
            />
          )}
          {screen === 'bells' && state && <BellScreen state={state} toasts={toasts} />}
          {screen === 'settings' && state && <Settings state={state} />}
        </main>
        {state?.closeNotice && (
          <Modal
            title="딩동댕은 계속 켜져 있어요"
            illustration={<DogArt themeId={state.settings.dogTheme} action="idle" className="modal__dog" />}
            onClose={dismissHideNotice}
          >
            <p>{HIDE_NOTICE_TEXT}</p>
            <div className="modal__actions">
              <button type="button" className="button" data-autofocus onClick={confirmHide}>
                창 닫기
              </button>
            </div>
          </Modal>
        )}
        <ToastStack toasts={toasts.toasts} dismiss={toasts.dismiss} />
      </div>
    </WindowShownContext.Provider>
  );
}
