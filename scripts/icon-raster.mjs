// Electron으로 SVG를 PNG로 그린다. 실행: electron scripts/icon-raster.mjs <작업 JSON 경로>
// 작업 JSON은 [{ svg, size, out }] 목록이다. 이 파일은 build-icons.mts가 띄우며 직접 쓰는 일은 없다.
// 브라우저 엔진이 곧 앱이 쓰는 렌더러라 별도 래스터라이저를 설치하지 않아도 된다.
import { app, BrowserWindow, nativeImage } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// 16px 같은 작은 창은 만들어지지 않아, 늘 큰 창에 그리고 왼쪽 위 size×size만 잘라 쓴다
const WINDOW = 1024;
// 내용을 바꾼 직후에는 바꾸기 전 그림이나 덜 그려진 장이 올 수 있다.
// 같은 결과가 이만큼 연달아 나올 때까지 기다린 뒤 그 그림을 쓴다.
const STABLE_POLLS = 4;
const POLL_MS = 50;

async function createCanvas() {
  const win = new BrowserWindow({
    show: false,
    // 투명 창이 아니면 오프스크린 그림의 바탕이 흰색으로 채워진다
    transparent: true,
    frame: false,
    width: WINDOW,
    height: WINDOW,
    useContentSize: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  const canvas = { win, last: null };
  win.webContents.on('paint', (_event, _dirty, image) => {
    if (image.getSize().width === WINDOW) {
      canvas.last = image;
    }
  });
  await win.loadURL('data:text/html,<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">');
  return canvas;
}

async function render(canvas, { svg, size }) {
  const html = `<style>svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
  await canvas.win.webContents.executeJavaScript(`document.body.innerHTML = ${JSON.stringify(html)}`);
  canvas.last = null;
  let previous = null;
  let stable = 0;
  for (let waited = 0; waited < 5000; waited += POLL_MS) {
    canvas.win.webContents.invalidate();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    if (!canvas.last) continue;
    const png = nativeImage
      .createFromBitmap(canvas.last.toBitmap(), { width: WINDOW, height: WINDOW })
      .crop({ x: 0, y: 0, width: size, height: size })
      .toPNG();
    stable = previous && previous.equals(png) ? stable + 1 : 1;
    previous = png;
    if (stable >= STABLE_POLLS) return png;
  }
  throw new Error(`${size}px 그림이 안정되지 않았다`);
}

app.whenReady().then(async () => {
  try {
    const canvas = await createCanvas();
    for (const job of jobs) writeFileSync(job.out, await render(canvas, job));
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
