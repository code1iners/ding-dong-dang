import { useState } from 'react';
import type { UpdateView } from '../../shared/bridge';
import type { Settings } from '../../shared/data';
import { DOG_HEIGHT_RANGE } from '../../shared/roaming-dog';
import { DogThemePicker } from './DogThemePicker';
import { ActionIcon } from './icons';
import { Modal } from './Modal';
import { Slider } from './Slider';
import { Switch } from './Switch';
import { readyVersion } from '../../shared/update';
import { UpdateConfirmModal, UpdateRow } from './UpdateRow';
import type { UpdateClock } from './useUpdateTiming';

type Props = {
  /** 메인에서 받은 지금 설정 값. */
  settings: Settings;
  /** OS에 물은 자동 시작 등록 상태. 스위치와 실패 표시는 설정 값이 아니라 이 값을 따른다. */
  autoStartRegistered: boolean;
  /** 앱 버전. */
  appVersion: string;
  /** 앱 내 업데이트의 화면 쪽 값. */
  update: UpdateView;
  /** 지금 "업데이트"를 잠가야 하는지와 다음 종까지 남은 시간. */
  updateTiming: UpdateClock;
};

/** 설정 화면. DESIGN.md의 항목 순서대로 줄이 놓이고, 아래쪽은 버전 · 의견 보내기 · 모든 데이터 순서다. */
export function SettingsScreen({ settings, autoStartRegistered, appVersion, update, updateTiming }: Props) {
  /** 켜 달라고 했는데 OS에 등록되지 않은 상태. 스위치는 꺼진 채로 두고 그 줄에 이유와 방법을 보여 준다. */
  const autoStartFailed = settings.autoStart && !autoStartRegistered;
  /** "모든 데이터 지우기" 확인 모달이 떠 있는지. */
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  /** 업데이트 확인 모달이 떠 있는지. */
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);
  /** 확인 모달에 보일 새 버전. 준비된 버전이 없어지면 모달도 닫힌다. */
  const version = readyVersion(update.status);
  return (
    <div className="card">
      <DogThemePicker themeId={settings.dogTheme} />
      <div className="setting-row">
        <span id="setting-roaming-dog">돌아다니는 강아지</span>
        <div className="setting-row__control">
          {/* 크기는 움직이는 즉시 저장되고 화면 바닥의 강아지 · 하트 · 낙하산에 바로 반영된다. 고리 안 강아지는 그대로다 */}
          <span className="setting-row__hint" aria-hidden="true">
            작게
          </span>
          <Slider
            label="강아지 크기"
            min={DOG_HEIGHT_RANGE.min}
            max={DOG_HEIGHT_RANGE.max}
            value={settings.dogHeight}
            valueText={(height) => `키 ${height}`}
            onChange={(height) => void window.dingdong.command({ type: 'set-dog-height', height })}
          />
          <span className="setting-row__hint" aria-hidden="true">
            크게
          </span>
          <Switch
            on={settings.roamingDog}
            labelledBy="setting-roaming-dog"
            onChange={(on) => void window.dingdong.command({ type: 'set-roaming-dog', on })}
          />
        </div>
      </div>
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
      <UpdateRow appVersion={appVersion} update={update} locked={updateTiming.locked} onUpdate={() => setConfirmingUpdate(true)} />
      <div className="setting-row">
        <span id="setting-feedback">의견 보내기</span>
        <span className="setting-row__note">버그나 불편한 점</span>
        <div className="setting-row__control">
          <button
            type="button"
            className="button button--ghost button--sm"
            aria-label="의견 보내기 폼 열기"
            onClick={() => void window.dingdong.command({ type: 'open-feedback-form' })}
          >
            보내기
            <ActionIcon name="external" />
          </button>
        </div>
      </div>
      {/* 맨 아래 줄 */}
      <div className="setting-row">
        <span id="setting-wipe">모든 데이터</span>
        <div className="setting-row__control">
          <button type="button" className="button button--ghost button--sm" aria-label="모든 데이터 지우기" onClick={() => setConfirmingWipe(true)}>
            지우기
          </button>
        </div>
      </div>
      {confirmingUpdate && version && (
        <UpdateConfirmModal
          appVersion={appVersion}
          version={version}
          timing={updateTiming}
          dogTheme={settings.dogTheme}
          onClose={() => setConfirmingUpdate(false)}
        />
      )}
      {confirmingWipe && (
        <Modal title="모든 데이터를 지울까요?" onClose={() => setConfirmingWipe(false)}>
          <p>
            시간표, 등록한 종소리, 설정이 모두 지워지고
            <br />
            딩동댕이 종료돼요. 되돌릴 수 없어요.
          </p>
          <div className="modal__actions">
            {/* 되돌릴 수 없는 일이라 처음 초점은 "취소"다 */}
            <button type="button" className="button button--ghost" data-autofocus onClick={() => setConfirmingWipe(false)}>
              취소
            </button>
            <button type="button" className="button button--red" onClick={() => void window.dingdong.command({ type: 'wipe-all-data' })}>
              지우고 종료
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
