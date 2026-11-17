import type { BellPlayerApi, PlayRequest, ProbeRequest } from '../../shared/bell-player';

// 종 재생기. 메인이 보낸 음원을 한 번 재생하고, 소리가 나기 시작함 · 끝남 · 멈춤 · 실패를 메인에 알린다.
// 한 번에 하나만 울린다. 새 요청이 오면 울리던 것을 끊는다.

/** preload가 내보낸 재생기 통로. 이 창에만 있어 앱 창의 전역 타입에는 넣지 않는다. */
const player = (window as unknown as { bellPlayer: BellPlayerApi }).bellPlayer;

/** 지금 울리는 소리와 그 요청 번호. 없으면 null. */
let current: { id: number; audio: HTMLAudioElement; url: string } | null = null;

/** 울리던 소리를 치운다. 메인에 알리지는 않는다. */
function clear(): void {
  if (!current) return;
  current.audio.pause();
  current.audio.remove();
  URL.revokeObjectURL(current.url);
  current = null;
}

/** 요청 하나를 재생한다. */
async function play({ id, bytes, volume }: PlayRequest): Promise<void> {
  if (current) {
    player.report({ id: current.id, phase: 'stopped' });
    clear();
  }
  /** 받은 내용을 가리키는 주소. 끝나면 놓는다. */
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]));
  /** 이번 요청을 재생하는 소리. */
  const audio = new Audio(url);
  audio.volume = Math.min(1, Math.max(0, volume));
  // 문서에 붙여 두면 실제 앱 테스트가 숨긴 창에서 재생 중인지 읽을 수 있다
  document.body.append(audio);
  current = { id, audio, url };

  audio.addEventListener('ended', () => {
    if (current?.id !== id) return;
    clear();
    player.report({ id, phase: 'ended' });
  });
  try {
    await audio.play();
    if (current?.id === id) player.report({ id, phase: 'playing' });
  } catch {
    // 재생 중에 다음 요청이나 멈춤이 와서 끊긴 것은 실패가 아니다
    if (current?.id !== id) return;
    clear();
    player.report({ id, phase: 'failed' });
  }
}

player.onPlay((request) => void play(request));
player.onStop(() => {
  if (!current) return;
  /** 멈추는 요청의 번호. */
  const { id } = current;
  clear();
  player.report({ id, phase: 'stopped' });
});

/** 머리의 길이가 이만큼(초)을 넘으면 끝까지 풀지 않고 그 길이만 알린다. 등록 한도(60초)를 넘어 어차피 거절된다. */
const FULL_DECODE_LIMIT_SECONDS = 120;

/** 파일 머리의 정보로 길이(초)를 읽는다. 읽을 수 없으면 실패한다. 길이를 알 수 없는 파일은 Infinity나 NaN을 돌려준다. */
function readDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    /** 길이만 읽는 소리. 재생하지 않는다. */
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true });
    audio.addEventListener('error', () => reject(new Error('metadata')), { once: true });
    audio.src = url;
  });
}

/** 파일 하나를 끝까지 풀어 본다. 풀 수 없으면 실패하고, 풀리면 길이(초)를 돌려준다. */
async function decodeDuration(bytes: Uint8Array): Promise<number> {
  /** 풀어 보기만 하는 오디오 문맥. */
  const context = new AudioContext();
  try {
    return (await context.decodeAudioData(bytes.slice().buffer)).duration;
  } finally {
    void context.close();
  }
}

/** 등록하려는 파일의 길이를 재고 재생할 수 있는지 확인해 알린다. */
async function probe({ id, bytes }: ProbeRequest): Promise<void> {
  /** 파일 내용을 가리키는 주소. 끝나면 놓는다. */
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>]));
  try {
    /** 파일 머리에서 읽은 길이. */
    const header = await readDuration(url);
    // 너무 긴 파일은 어차피 거절되므로 끝까지 풀지 않는다
    if (Number.isFinite(header) && header > FULL_DECODE_LIMIT_SECONDS) {
      player.reportProbe({ id, ok: true, seconds: header });
      return;
    }
    // 머리가 알려 준 길이는 어긋날 수 있다. 끝까지 풀어서 재생할 수 있는지와 진짜 길이를 함께 본다
    player.reportProbe({ id, ok: true, seconds: await decodeDuration(bytes) });
  } catch {
    player.reportProbe({ id, ok: false });
  } finally {
    URL.revokeObjectURL(url);
  }
}

player.onProbe((request) => void probe(request));
