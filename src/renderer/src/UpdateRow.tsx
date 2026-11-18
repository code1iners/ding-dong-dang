import { useState } from 'react';
import type { UpdateView } from '../../shared/bridge';
import { readyVersion, untilNextBellText, UPDATE_LOCKED_TEXT, versionTo } from '../../shared/update';
import { DogArt } from './dog/DogArt';
import { ActionIcon } from './icons';
import { Modal } from './Modal';
import type { UpdateClock } from './useUpdateTiming';

/** 설치를 맡겨 앱이 곧 다시 켜질 때 잠긴 "업데이트" 곁에 쓰는 이유. */
const INSTALLING_TEXT = '다시 켜는 중이에요';

type RowProps = {
  /** 지금 앱 버전. */
  appVersion: string;
  /** 앱 내 업데이트의 화면 쪽 값. */
  update: UpdateView;
  /** "업데이트"를 잠가야 하는지. */
  locked: boolean;
  /** "업데이트"를 누를 때 부른다. 확인 모달을 연다. */
  onUpdate(): void;
};

/**
 * 설정 화면의 버전 줄. 새 버전이 없으면 지금 버전과 "최신이에요", 확인에 실패하면 "새 버전을 확인할 수 없어요"와 "다시 확인",
 * 준비되면 새 버전 번호와 "업데이트"다. 확인 중 · 내려받는 중 · 검증 실패 · 확인하지 않는 실행은 지금 버전만 보인다.
 */
export function UpdateRow({ appVersion, update, locked, onUpdate }: RowProps) {
  /** 준비된 새 버전. */
  const version = readyVersion(update.status);
  /** 설치를 맡긴 뒤인지. */
  const installing = update.status.kind === 'installing';
  /** 잠긴 "업데이트" 곁에 쓰는 이유. 잠기지 않았으면 null. */
  const reason = installing ? INSTALLING_TEXT : locked ? UPDATE_LOCKED_TEXT : null;
  return (
    <div className="setting-row">
      <span id="setting-version">버전</span>
      <div className="setting-row__control">
        {version ? (
          <>
            {/* 잠기면 시안대로 이유만 남기고, 이유를 단추의 설명으로도 읽힌다 */}
            {reason ? (
              <span id="setting-update-locked" className="setting-row__note">
                {reason}
              </span>
            ) : (
              <>
                <span className="setting-row__note">{appVersion}</span>
                <span className="setting-row__new">새 버전 {version}</span>
              </>
            )}
            <button
              type="button"
              className="button button--sm"
              disabled={reason !== null}
              aria-describedby={reason ? 'setting-update-locked' : undefined}
              onClick={onUpdate}
            >
              업데이트
            </button>
          </>
        ) : (
          <>
            <span className="setting-row__note">{appVersion}</span>
            {update.status.kind === 'up-to-date' && <span className="setting-row__note">최신이에요</span>}
            {update.status.kind === 'check-failed' && (
              <>
                <span className="setting-row__note">새 버전을 확인할 수 없어요</span>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={() => void window.dingdong.command({ type: 'check-update' })}
                >
                  다시 확인
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type ModalProps = {
  /** 지금 앱 버전. */
  appVersion: string;
  /** 설치할 새 버전. */
  version: string;
  /** 잠금과 다음 종까지 남은 시간. 매초 바뀐다. */
  timing: UpdateClock;
  /** 모달에 그릴 강아지 테마. */
  dogTheme: string;
  /** "나중에"나 Esc로 닫을 때 부른다. */
  onClose(): void;
};

/**
 * "업데이트"를 누르면 뜨는 확인 모달. 승인해야만 설치하고 다시 켠다.
 * 다음 종까지 2분이 안 남았거나 종이 울리는 중이면 "업데이트"를 잠그고 이유를 보여 준다.
 */
export function UpdateConfirmModal({ appVersion, version, timing, dogTheme, onClose }: ModalProps) {
  /** 설치를 맡겼는지. 앱이 곧 꺼지므로 단추를 다시 누르지 못하게 잠근다. */
  const [installing, setInstalling] = useState(false);
  /** "업데이트"를 누른다. 메인이 거절하면(그 사이 잠금 조건이 됨) 다시 누를 수 있다. */
  const install = (): void => {
    setInstalling(true);
    window.dingdong
      .command({ type: 'install-update' })
      .then((result) => {
        if (!result.ok) setInstalling(false);
      })
      .catch((error: unknown) => {
        setInstalling(false);
        console.error(error);
      });
  };
  /** 둘째 줄의 글. 잠기면 잠긴 이유, 아니면 다음 종까지 남은 시간이다. */
  const timingText = installing
    ? `${INSTALLING_TEXT}.`
    : timing.locked
      ? `${UPDATE_LOCKED_TEXT}.`
      : untilNextBellText(timing.nextBellAt, timing.now);
  return (
    <Modal title="업데이트할까요?" illustration={<DogArt themeId={dogTheme} action="idle" className="modal__dog" />} onClose={onClose}>
      {/* 화살표는 눈으로만 읽히므로 화면 읽기에는 같은 뜻의 문장을 따로 준다 */}
      <div className="update-versions">
        <span className="update-versions__chip" aria-hidden="true">
          {appVersion}
        </span>
        <ActionIcon name="right" />
        <span className="update-versions__chip update-versions__chip--to" aria-hidden="true">
          {version}
        </span>
        <span className="sr-only">
          {appVersion}에서 {versionTo(version)}
        </span>
      </div>
      <p>
        앱이 잠깐 꺼졌다가 다시 켜져요.
        <br />
        <span id="update-modal-timing">{timingText}</span>
      </p>
      <div className="modal__actions">
        {/* 수업 중에 Enter 한 번으로 앱이 꺼지지 않게 처음 초점은 "나중에"다 */}
        <button type="button" className="button button--ghost" data-autofocus onClick={onClose}>
          나중에
        </button>
        <button
          type="button"
          className="button"
          disabled={timing.locked || installing}
          aria-describedby={timing.locked || installing ? 'update-modal-timing' : undefined}
          onClick={install}
        >
          업데이트
        </button>
      </div>
    </Modal>
  );
}
