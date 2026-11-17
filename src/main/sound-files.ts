import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { RegisteredSound } from '../shared/data';
import type { ProbeOutcome } from './bell-player';

/** 등록할 수 있는 종소리의 최대 길이(초). */
export const MAX_SOUND_SECONDS = 60;
/** 길이를 재는 값이 어긋나는 것을 봐주는 폭(초). 60초 파일이 60.02초로 읽혀도 거절하지 않는다. */
const LENGTH_TOLERANCE_SECONDS = 0.1;
/** 읽어 볼 파일의 최대 크기. 60초 안쪽 파일은 이보다 훨씬 작아서, 넘으면 길이를 재지 않고 긴 파일로 본다. */
const MAX_SOUND_BYTES = 64 * 1024 * 1024;
/** 등록할 수 있는 확장자. */
export const SOUND_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg'] as const;

/** 종소리 하나를 등록한 결과. 거절하면 사용자에게 보여 줄 이유가 있다. */
export type RegisterResult = { ok: true; sound: RegisteredSound } | { ok: false; message: string };

/**
 * 고른 파일을 확인하고 데이터 폴더의 `sounds/`로 복사한다. 파일 이름은 `<id>.<확장자>`로 바꿔
 * 같은 이름의 다른 파일과 겹치지 않게 하고, 목록에 보일 이름은 원래 파일 이름에서 확장자를 뺀 것이다.
 */
export async function registerSoundFile(options: {
  /** 사용자가 고른 파일 경로. */
  path: string;
  /** 등록 음원을 복사해 두는 폴더. */
  soundsDir: string;
  /** 새 음원 id. */
  id: string;
  /** 파일 내용의 길이와 재생 가능 여부를 확인하는 부품. */
  probe(bytes: Uint8Array): Promise<ProbeOutcome>;
}): Promise<RegisterResult> {
  /** 확장자(점과 대소문자 뺀 것). */
  const ext = extname(options.path).slice(1).toLowerCase();
  /** 목록에 보일 이름. */
  const name = basename(options.path, extname(options.path));
  if (!(SOUND_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, message: `'${name}' 파일은 등록할 수 없어요. mp3, wav, m4a, ogg 파일을 골라 주세요.` };
  }

  /** 파일 내용. */
  let bytes: Uint8Array;
  try {
    if ((await stat(options.path)).size > MAX_SOUND_BYTES) return tooLong(name);
    bytes = await readFile(options.path);
  } catch {
    return { ok: false, message: `'${name}' 파일을 읽지 못했어요. 파일이 그대로 있는지 확인해 주세요.` };
  }

  /** 길이와 재생 가능 여부. */
  const outcome = await options.probe(bytes);
  if (outcome.status === 'unplayable') {
    return { ok: false, message: `'${name}' 파일을 재생할 수 없어요. 다른 파일을 골라 주세요.` };
  }
  if (outcome.status === 'unavailable') {
    return { ok: false, message: `'${name}' 파일을 확인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.` };
  }
  if (outcome.seconds > MAX_SOUND_SECONDS + LENGTH_TOLERANCE_SECONDS) return tooLong(name);

  /** 복사해 둘 파일 이름. */
  const file = `${options.id}.${ext}`;
  try {
    await mkdir(options.soundsDir, { recursive: true });
    await copyFile(options.path, join(options.soundsDir, file));
  } catch {
    return { ok: false, message: `'${name}' 파일을 복사하지 못했어요. 디스크에 빈 공간이 있는지 확인해 주세요.` };
  }
  return { ok: true, sound: { id: options.id, name, file } };
}

/** 너무 긴 파일을 거절하는 결과. */
function tooLong(name: string): RegisterResult {
  return { ok: false, message: `'${name}' 파일이 ${MAX_SOUND_SECONDS}초를 넘어요. ${MAX_SOUND_SECONDS}초 이하의 파일을 골라 주세요.` };
}

/** `sounds/` 안에서 `keep`에 없는 파일을 지운다. 폴더가 없거나 못 지워도 넘어간다. */
export async function sweepSoundFiles(soundsDir: string, keep: ReadonlySet<string>): Promise<void> {
  /** 폴더 안의 파일 이름. */
  const files = await readdir(soundsDir).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => !keep.has(f)).map((f) => rm(join(soundsDir, f), { force: true }).catch(() => {})));
}
