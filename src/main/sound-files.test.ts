import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProbeOutcome } from './bell-player';
import { registerSoundFile, sweepSoundFiles, MAX_SOUND_SECONDS } from './sound-files';

/** 테스트마다 새로 만드는 데이터 폴더. */
let dir: string;
/** 등록하려고 고르는 파일이 든 폴더. */
let source: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ddd-sounds-'));
  source = await mkdtemp(join(tmpdir(), 'ddd-source-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(source, { recursive: true, force: true });
});

/** 늘 같은 답을 하는 가짜 파일 확인. */
const answers = (outcome: ProbeOutcome) => () => Promise.resolve(outcome);

describe('종소리 등록', () => {
  it('재생할 수 있고 60초 이하이면 sounds/로 복사하고 확장자를 뺀 파일 이름으로 등록한다', async () => {
    const path = join(source, '우리 학원 종.mp3');
    await writeFile(path, 'abc');
    const result = await registerSoundFile({
      path,
      soundsDir: join(dir, 'sounds'),
      id: 'id1',
      probe: answers({ status: 'ok', seconds: MAX_SOUND_SECONDS }),
    });
    expect(result).toEqual({ ok: true, sound: { id: 'id1', name: '우리 학원 종', file: 'id1.mp3' } });
    expect(await readFile(join(dir, 'sounds', 'id1.mp3'), 'utf8')).toBe('abc');
  });

  it('61초짜리 파일은 이유와 함께 거절하고 복사하지 않는다', async () => {
    const path = join(source, 'long.wav');
    await writeFile(path, 'abc');
    const result = await registerSoundFile({
      path,
      soundsDir: join(dir, 'sounds'),
      id: 'id1',
      probe: answers({ status: 'ok', seconds: 61 }),
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('60초');
    await expect(readdir(join(dir, 'sounds'))).rejects.toThrow();
  });

  it('재생할 수 없는 파일, 지원하지 않는 확장자, 읽을 수 없는 파일은 각각 이유와 함께 거절한다', async () => {
    const bad = join(source, 'broken.ogg');
    await writeFile(bad, 'abc');
    const txt = join(source, 'a.txt');
    await writeFile(txt, 'abc');
    const common = { soundsDir: join(dir, 'sounds'), id: 'id1' };
    const unplayable = await registerSoundFile({ ...common, path: bad, probe: answers({ status: 'unplayable' }) });
    const unavailable = await registerSoundFile({ ...common, path: bad, probe: answers({ status: 'unavailable' }) });
    const wrongType = await registerSoundFile({ ...common, path: txt, probe: answers({ status: 'ok', seconds: 1 }) });
    const missing = await registerSoundFile({
      ...common,
      path: join(source, 'none.mp3'),
      probe: answers({ status: 'ok', seconds: 1 }),
    });
    const messages = [unplayable, unavailable, wrongType, missing].map((r) => !r.ok && r.message);
    expect(messages.every((m) => typeof m === 'string' && m.length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(4);
    expect(messages[0]).toContain('재생할 수 없어요');
  });
});

describe('sounds/ 정리', () => {
  it('목록에 없는 파일만 지운다', async () => {
    const soundsDir = join(dir, 'sounds');
    await registerSoundFile({
      path: await (async () => {
        const p = join(source, 'a.mp3');
        await writeFile(p, 'a');
        return p;
      })(),
      soundsDir,
      id: 'keep',
      probe: answers({ status: 'ok', seconds: 1 }),
    });
    await writeFile(join(soundsDir, 'orphan.wav'), 'x');
    await sweepSoundFiles(soundsDir, new Set(['keep.mp3']));
    expect(await readdir(soundsDir)).toEqual(['keep.mp3']);
  });
});
