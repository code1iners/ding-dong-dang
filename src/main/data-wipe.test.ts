import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { removeAfterExitCommand, wipePaths, wipeTargets } from './data-wipe';

/** 테스트마다 새로 만드는 임시 폴더. 데이터 폴더와 그 옆의 다른 폴더를 담는다. */
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ddd-wipe-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('지우기 범위', () => {
  it('Mac에서는 데이터 폴더의 파일과 폴더, 내려받아 둔 업데이트, 앱 내부 기록을 가리킨다', () => {
    expect(wipeTargets({ platform: 'darwin', dataDir: '/u/Library/Application Support/ding-dong-dang', home: '/u', usesCustomDataDir: false })).toEqual([
      '/u/Library/Application Support/ding-dong-dang/data.json',
      '/u/Library/Application Support/ding-dong-dang/data.backup.json',
      '/u/Library/Application Support/ding-dong-dang/data.corrupt.json',
      '/u/Library/Application Support/ding-dong-dang/data.tmp.json',
      '/u/Library/Application Support/ding-dong-dang/sounds',
      '/u/Library/Application Support/ding-dong-dang',
      '/u/Library/Caches/ding-dong-dang-updater',
      '/u/Library/Caches/app.squadify.dingdongdang',
      '/u/Library/Caches/app.squadify.dingdongdang.ShipIt',
      '/u/Library/HTTPStorages/app.squadify.dingdongdang',
      '/u/Library/Saved Application State/app.squadify.dingdongdang.savedState',
      '/u/Library/Preferences/app.squadify.dingdongdang.plist',
    ]);
  });

  it('Windows에서는 데이터 폴더와 %LOCALAPPDATA%의 업데이트 폴더를 가리킨다', () => {
    expect(
      wipeTargets({ platform: 'win32', dataDir: 'C:/u/AppData/Roaming/ding-dong-dang', home: 'C:/u', localAppData: 'C:/u/AppData/Local', usesCustomDataDir: false }),
    ).toEqual([
      'C:/u/AppData/Roaming/ding-dong-dang/data.json',
      'C:/u/AppData/Roaming/ding-dong-dang/data.backup.json',
      'C:/u/AppData/Roaming/ding-dong-dang/data.corrupt.json',
      'C:/u/AppData/Roaming/ding-dong-dang/data.tmp.json',
      'C:/u/AppData/Roaming/ding-dong-dang/sounds',
      'C:/u/AppData/Roaming/ding-dong-dang',
      'C:/u/AppData/Local/ding-dong-dang-updater',
    ]);
  });

  it('실행 인자로 바꾼 데이터 폴더면 그 폴더만 가리켜, 자동 검증이 이 PC의 실제 앱 기록을 건드리지 않는다', () => {
    expect(wipeTargets({ platform: 'darwin', dataDir: '/tmp/e2e', home: '/u', usesCustomDataDir: true })).toEqual([
      '/tmp/e2e/data.json',
      '/tmp/e2e/data.backup.json',
      '/tmp/e2e/data.corrupt.json',
      '/tmp/e2e/data.tmp.json',
      '/tmp/e2e/sounds',
      '/tmp/e2e',
    ]);
  });
});

describe('지우기', () => {
  it('저장 파일, 예비본, 치워 둔 파일, 등록 음원과 데이터 폴더를 지우고, 폴더 밖의 원본 음원은 건드리지 않는다', () => {
    /** 데이터 폴더. */
    const dataDir = join(root, 'ding-dong-dang');
    mkdirSync(join(dataDir, 'sounds'), { recursive: true });
    for (const name of ['data.json', 'data.backup.json', 'data.corrupt.json', 'Local State']) writeFileSync(join(dataDir, name), '{}');
    writeFileSync(join(dataDir, 'sounds', 'a.mp3'), 'x');
    /** 사용자가 따로 가진 원본 음원이 있는 폴더. */
    const originals = join(root, 'Music');
    mkdirSync(originals);
    writeFileSync(join(originals, 'a.mp3'), 'x');

    wipePaths(wipeTargets({ platform: 'darwin', dataDir, home: root, usesCustomDataDir: true }));

    expect(existsSync(dataDir)).toBe(false);
    expect(readdirSync(originals)).toEqual(['a.mp3']);
  });

  it('없는 경로는 지운 것으로 보고 던지지 않는다', () => {
    expect(() => wipePaths([join(root, 'nothing'), join(root, 'nothing', 'data.json')])).not.toThrow();
  });
});

describe('앱이 끝난 뒤 한 번 더 지우기', () => {
  it('Windows: 몇 초 기다린 뒤 경로마다 폴더로도 파일로도 지우는 cmd 명령이다', () => {
    expect(removeAfterExitCommand('win32', 42, ['C:\\u\\AppData\\Roaming\\ding-dong-dang', 'C:\\u\\x.json'])).toEqual({
      file: 'cmd.exe',
      args: [
        '/d',
        '/s',
        '/c',
        '"ping -n 4 127.0.0.1 >nul' +
          ' & rmdir /s /q "C:\\u\\AppData\\Roaming\\ding-dong-dang" 2>nul & del /f /q "C:\\u\\AppData\\Roaming\\ding-dong-dang" 2>nul' +
          ' & rmdir /s /q "C:\\u\\x.json" 2>nul & del /f /q "C:\\u\\x.json" 2>nul"',
      ],
    });
  });

  it('Mac: 앱 프로세스가 끝나기를 기다린 뒤 경로를 지우는 sh 명령이고, 작은따옴표가 든 경로도 그대로 넘긴다', () => {
    expect(removeAfterExitCommand('darwin', 42, ['/u/Library/Application Support/ding-dong-dang', "/tmp/it's"])).toEqual({
      file: '/bin/sh',
      args: ['-c', "while kill -0 42 2>/dev/null; do sleep 0.1; done; rm -rf -- '/u/Library/Application Support/ding-dong-dang' '/tmp/it'\\''s'"],
    });
  });
});
