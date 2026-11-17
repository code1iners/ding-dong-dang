import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyData } from '../../shared/data';
import { SettingsScreen } from './SettingsScreen';

/** 자동 시작 줄만 뽑아 본다. */
function autoStartRow(autoStart: boolean, registered: boolean): string {
  const html = renderToStaticMarkup(
    <SettingsScreen settings={{ ...emptyData().settings, autoStart }} autoStartRegistered={registered} />,
  );
  return html.split('<div class="setting-row">')[1] ?? '';
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
