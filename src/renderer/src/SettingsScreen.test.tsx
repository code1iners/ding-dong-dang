import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { UpdateStatus } from '../../shared/update';
import { emptyData } from '../../shared/data';
import { Rail } from './Rail';
import { SettingsScreen } from './SettingsScreen';

/** 잠기지 않은 업데이트 시점. */
const UNLOCKED = { locked: false, nextBellAt: null, now: 0 };

/** 설정 화면을 그린다. 주지 않은 값은 처음 상태다. */
function render(props: Partial<ComponentProps<typeof SettingsScreen>> = {}): string {
  return renderToStaticMarkup(
    <SettingsScreen
      settings={emptyData().settings}
      autoStartRegistered
      appVersion="1.2.0"
      update={{ status: { kind: 'idle' }, installFailures: 0, justUpdated: null }}
      updateTiming={UNLOCKED}
      {...props}
    />,
  );
}

/** 설정 화면에서 그 이름표 id가 든 줄만 뽑아 본다. */
function rowOf(html: string, labelId: string): string {
  return html.split('<div class="setting-row">').find((row) => row.includes(`id="${labelId}"`)) ?? '';
}

/** 자동 시작 줄만 뽑아 본다. */
function autoStartRow(autoStart: boolean, registered: boolean): string {
  const html = render({ settings: { ...emptyData().settings, autoStart }, autoStartRegistered: registered });
  return rowOf(html, 'setting-auto-start');
}

describe('설정 화면의 자동 시작 줄: 세 모습', () => {
  it('켬: 스위치가 켜져 있고 실패 표시가 없다', () => {
    const row = autoStartRow(true, true);
    expect(row).toContain('컴퓨터를 켜면 자동 시작');
    expect(row).toContain('aria-checked="true"');
    expect(row).not.toContain('등록하지 못했어요');
    expect(row).not.toContain('자동 시작 등록 방법');
  });

  it('끔: 스위치가 꺼져 있고 실패 표시가 없다', () => {
    const row = autoStartRow(false, false);
    expect(row).toContain('aria-checked="false"');
    expect(row).not.toContain('등록하지 못했어요');
  });

  it('실패: 켜 달라고 했는데 OS에 없으면 스위치는 꺼진 채 이유와 방법 링크가 나온다', () => {
    const row = autoStartRow(true, false);
    expect(row).toContain('aria-checked="false"');
    expect(row).toContain('등록하지 못했어요');
    expect(row).toContain('자동 시작 등록 방법');
    // 스위치 이름 다음에 실패 이유도 읽힌다
    expect(row).toContain('aria-describedby="setting-auto-start-error"');
  });

  it('스위치 값이 아니라 OS의 답을 따른다: 꺼 둔 설정에 등록이 남아 있으면 켜진 것으로 보인다', () => {
    const row = autoStartRow(false, true);
    expect(row).toContain('aria-checked="true"');
    expect(row).not.toContain('등록하지 못했어요');
  });
});

describe('설정 화면의 돌아다니는 강아지 줄', () => {
  /** 돌아다니는 강아지 줄만 뽑아 본다. */
  const roamingRow = (roamingDog: boolean) =>
    rowOf(render({ settings: { ...emptyData().settings, roamingDog } }), 'setting-roaming-dog');

  it('스위치가 저장된 값을 따르고 이름으로 읽힌다', () => {
    expect(roamingRow(true)).toContain('돌아다니는 강아지');
    expect(roamingRow(true)).toContain('aria-checked="true"');
    expect(roamingRow(true)).toContain('aria-labelledby="setting-roaming-dog"');
    expect(roamingRow(false)).toContain('aria-checked="false"');
  });

  it('같은 줄에 "작게"와 "크게" 사이의 크기 슬라이더(키 64~160)가 저장된 키를 보여 준다', () => {
    const row = rowOf(
      render({ settings: { ...emptyData().settings, dogHeight: 112 } }),
      'setting-roaming-dog',
    );
    expect(row).toMatch(/작게.*type="range".*크게/);
    expect(row).toContain('aria-label="강아지 크기"');
    expect(row).toContain('min="64"');
    expect(row).toContain('max="160"');
    expect(row).toContain('value="112"');
    expect(row).toContain('aria-valuetext="키 112"');
    // 채운 부분은 범위 안의 비율이다: (112 − 64) ÷ 96 = 50%
    expect(row).toContain('--fill:50%');
  });
});

describe('설정 화면의 모든 데이터 줄', () => {
  /** 설정 화면 전체. */
  const html = render();

  it('맨 아래 줄이고, 지우기 단추가 대상을 담은 이름으로 읽힌다', () => {
    /** 줄을 나눈 마지막 조각. */
    const last = html.split('<div class="setting-row">').at(-1) ?? '';
    expect(last).toContain('id="setting-wipe"');
    expect(last).toContain('모든 데이터');
    expect(last).toContain('>지우기</button>');
    expect(last).toContain('aria-label="모든 데이터 지우기"');
  });

  it('누르기 전에는 확인 모달이 없다', () => {
    expect(html).not.toContain('모든 데이터를 지울까요?');
  });
});

describe('설정 화면의 버전 줄', () => {
  /** 이 상태일 때의 버전 줄. */
  const versionRow = (status: UpdateStatus, locked = false) =>
    rowOf(render({ update: { status, installFailures: 0, justUpdated: null }, updateTiming: { ...UNLOCKED, locked } }), 'setting-version');

  it('"의견 보내기" 바로 위에 있다', () => {
    /** 줄 이름의 차례. */
    const labels = [...render().matchAll(/id="(setting-[a-z-]+)"/g)].map((m) => m[1]);
    expect(labels.slice(-3)).toEqual(['setting-version', 'setting-feedback', 'setting-wipe']);
  });

  it('새 버전이 없으면 이름표 "버전 1.2.0"과 "최신 버전이에요"만 있고 단추가 없다', () => {
    const row = versionRow({ kind: 'up-to-date' });
    expect(row).toContain('버전 1.2.0');
    expect(row).toContain('최신 버전이에요');
    expect(row).not.toContain('<button');
  });

  it('확인에 실패하면 "새 버전을 확인하지 못했어요"와 "다시 확인"이 나온다', () => {
    const row = versionRow({ kind: 'check-failed' });
    expect(row).toContain('버전 1.2.0');
    expect(row).toContain('새 버전을 확인하지 못했어요');
    expect(row).toContain('>다시 확인</button>');
    expect(row).not.toContain('최신 버전이에요');
  });

  it('새 버전이 준비되면 "새 버전이 있어요"와 "업데이트" 단추가 나오고, 새 번호는 확인 모달에서만 보인다', () => {
    const row = versionRow({ kind: 'ready', version: '1.3.0' });
    expect(row).toContain('버전 1.2.0');
    expect(row).toContain('새 버전이 있어요');
    expect(row).not.toContain('1.3.0');
    expect(row).toMatch(/<button[^>]*>업데이트<\/button>/);
    expect(row).not.toMatch(/<button[^>]*disabled/);
  });

  it('잠기면 "업데이트"가 잠기고 "종이 울린 뒤에 할 수 있어요"가 단추의 설명으로 나온다', () => {
    const row = versionRow({ kind: 'ready', version: '1.3.0' }, true);
    expect(row).toContain('종이 울린 뒤에 할 수 있어요');
    expect(row).not.toContain('새 버전이 있어요');
    expect(row).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="setting-update-locked"[^>]*>업데이트<\/button>/);
  });

  it('설치를 맡긴 뒤에는 "업데이트"가 잠기고 "다시 켜는 중이에요"가 단추의 설명으로 나온다', () => {
    const row = versionRow({ kind: 'installing', version: '1.3.0' });
    expect(row).toContain('다시 켜는 중이에요');
    expect(row).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="setting-update-locked"[^>]*>업데이트<\/button>/);
  });

  it('확인하지 않는 실행, 확인 중, 내려받는 중, 검증 실패 뒤에는 지금 버전만 보인다', () => {
    for (const status of [{ kind: 'off' }, { kind: 'idle' }, { kind: 'checking' }, { kind: 'downloading', version: '1.3.0' }] as const) {
      const row = versionRow(status);
      expect(row).toContain('버전 1.2.0');
      expect(row).not.toContain('최신 버전이에요');
      expect(row).not.toContain('새 버전이 있어요');
      expect(row).not.toContain('1.3.0');
      expect(row).not.toContain('<button');
    }
  });
});

describe('왼쪽 설정 단추의 주황 점', () => {
  /** 세로 줄의 설정 단추. */
  const settingsButton = (updateReady: boolean) =>
    renderToStaticMarkup(<Rail current="status" onSelect={() => undefined} updateReady={updateReady} />)
      .split('<button')
      .find((b) => b.includes('설정')) ?? '';

  it('새 버전이 준비되면 점이 붙고 이름에도 알린다', () => {
    const button = settingsButton(true);
    expect(button).toContain('rail-button__dot');
    expect(button).toContain('aria-label="설정, 새 버전이 있어요"');
  });

  it('준비되지 않았으면 점이 없다', () => {
    const button = settingsButton(false);
    expect(button).not.toContain('rail-button__dot');
    expect(button).toContain('aria-label="설정"');
  });
});

describe('설정 화면의 의견 보내기 줄', () => {
  it('"모든 데이터" 바로 위에 있고, 단추가 대상을 담은 이름으로 읽힌다', () => {
    const html = render();
    const row = rowOf(html, 'setting-feedback');
    expect(row).toContain('의견 보내기');
    expect(row).toContain('버그나 불편한 점');
    expect(row).toContain('aria-label="의견 보내기 폼 열기"');
    expect(row).toContain('보내기');
  });
});
