import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordUpdateAttempt, takeJustUpdated, UPDATE_ATTEMPT_FILE } from './update-attempt';

/** 임시 데이터 폴더. */
let dataDir: string;
beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-attempt-'));
});
afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe('업데이트 뒤 첫 실행 알아보기', () => {
  it('설치를 맡기기 전에 남긴 버전으로 다시 켜졌으면 그 버전을 알려 주고 기록을 지운다', () => {
    recordUpdateAttempt(dataDir, { from: '0.1.0', to: '0.2.0' });
    expect(takeJustUpdated(dataDir, '0.2.0')).toBe('0.2.0');
    expect(existsSync(join(dataDir, UPDATE_ATTEMPT_FILE))).toBe(false);
    // 한 번만 알린다
    expect(takeJustUpdated(dataDir, '0.2.0')).toBeNull();
  });

  it('설치되지 않아 옛 버전 그대로 켜졌으면 알리지 않고 기록을 지운다', () => {
    recordUpdateAttempt(dataDir, { from: '0.1.0', to: '0.2.0' });
    expect(takeJustUpdated(dataDir, '0.1.0')).toBeNull();
    expect(existsSync(join(dataDir, UPDATE_ATTEMPT_FILE))).toBe(false);
  });

  it('기록이 없거나 깨졌으면 알리지 않는다', async () => {
    expect(takeJustUpdated(dataDir, '0.2.0')).toBeNull();
    await writeFile(join(dataDir, UPDATE_ATTEMPT_FILE), '{ 깨진');
    expect(takeJustUpdated(dataDir, '0.2.0')).toBeNull();
    expect(existsSync(join(dataDir, UPDATE_ATTEMPT_FILE))).toBe(false);
  });
});
