import { describe, expect, it } from 'vitest';
import { feedbackFormUrl, FEEDBACK_FORM_URL, osLabel } from './feedback-form';

describe('제보 폼 주소', () => {
  it('딩동댕 폼 경로에 앱 버전과 macOS 이름 · 버전을 담는다', () => {
    const url = new URL(feedbackFormUrl({ appVersion: '0.1.0', platform: 'darwin', systemVersion: '27.2.0' }));
    expect(`${url.origin}${url.pathname}`).toBe(FEEDBACK_FORM_URL);
    expect(url.pathname).toBe('/form/ding-dong-dang');
    expect(url.searchParams.get('version')).toBe('0.1.0');
    expect(url.searchParams.get('os')).toBe('macOS 27.2.0');
  });

  it('Windows는 "Windows <버전>"이다', () => {
    const url = new URL(feedbackFormUrl({ appVersion: '1.2.3', platform: 'win32', systemVersion: '10.0.26100' }));
    expect(url.searchParams.get('os')).toBe('Windows 10.0.26100');
  });

  it('공백과 기호가 든 값도 그대로 돌아오게 인코딩한다', () => {
    const url = feedbackFormUrl({ appVersion: '1.0.0-beta+1 &x', platform: 'win32', systemVersion: '10.0 (빌드)' });
    expect(url).not.toContain(' ');
    expect(new URL(url).searchParams.get('version')).toBe('1.0.0-beta+1 &x');
    expect(new URL(url).searchParams.get('os')).toBe('Windows 10.0 (빌드)');
  });

  it('배포하지 않는 OS는 플랫폼 이름을 그대로 쓴다', () => {
    expect(osLabel('linux', '6.8.0')).toBe('linux 6.8.0');
  });
});
