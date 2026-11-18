// 앱 내 업데이트로 다시 켜졌는지 알아보는 기록. 설치를 맡기기 직전에 남기고, 다음 실행이 시작할 때 읽고 지운다.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 업데이트 시도 기록 파일 이름. 데이터 폴더 안에 두어 "모든 데이터 지우기"가 함께 지운다. */
export const UPDATE_ATTEMPT_FILE = 'update-attempt.json';

/** 설치를 맡기기 직전에 남기는 업데이트 시도. */
export type UpdateAttempt = {
  /** 설치를 맡길 때의 앱 버전. */
  from: string;
  /** 설치할 새 버전. */
  to: string;
};

/** 설치를 맡기기 직전에 시도를 남긴다. 남기지 못해도 설치는 하고, 다시 켜졌을 때 알림만 빠진다. */
export function recordUpdateAttempt(dataDir: string, attempt: UpdateAttempt): void {
  try {
    writeFileSync(join(dataDir, UPDATE_ATTEMPT_FILE), JSON.stringify(attempt));
  } catch {
    // 알림 하나를 위해 업데이트를 막지 않는다
  }
}

/**
 * 시작할 때 부른다. 남은 시도가 있으면 지우고, 지금 버전이 그 시도의 새 버전이면 그 버전을 돌려준다.
 * 설치되지 않아 옛 버전으로 켜졌거나, 기록이 없거나 깨졌으면 null이다.
 */
export function takeJustUpdated(dataDir: string, currentVersion: string): string | null {
  /** 기록 파일의 경로. */
  const path = join(dataDir, UPDATE_ATTEMPT_FILE);
  /** 읽은 기록. */
  let attempt: unknown;
  try {
    attempt = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    attempt = null;
  }
  rmSync(path, { force: true });
  if (typeof attempt !== 'object' || attempt === null) return null;
  const { from, to } = attempt as Record<string, unknown>;
  return typeof to === 'string' && to === currentVersion && from !== to ? to : null;
}
