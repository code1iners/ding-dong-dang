import { describe, expect, it } from 'vitest';
import { isHeadlessRun } from './headless';

describe('isHeadlessRun', () => {
  it('자동 검증 실행(--data-dir)에서 DDD_HEADLESS=1이면 헤드리스다', () => {
    expect(isHeadlessRun({ DDD_HEADLESS: '1' }, '/tmp/ddd')).toBe(true);
  });

  it('DDD_HEADLESS가 없거나 1이 아니면 헤드리스가 아니다', () => {
    expect(isHeadlessRun({}, '/tmp/ddd')).toBe(false);
    expect(isHeadlessRun({ DDD_HEADLESS: '0' }, '/tmp/ddd')).toBe(false);
    expect(isHeadlessRun({ DDD_HEADLESS: 'true' }, '/tmp/ddd')).toBe(false);
  });

  it('--data-dir 없이 띄운 실제 앱은 환경변수가 남아 있어도 창을 숨기지 않는다', () => {
    expect(isHeadlessRun({ DDD_HEADLESS: '1' }, null)).toBe(false);
  });
});
