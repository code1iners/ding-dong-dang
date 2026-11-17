// 발바닥 종 아이콘 산출물을 resources/icons/에 쓴다. 실행: npm run icons
// SVG 원본(icon-art.mts)을 Electron으로 PNG로 그리고, 같은 그림에서 .ico를 묶는다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIco } from './image-files.mts';
import { appIconSvg, appTileSvg, macTraySvg, winTraySvg } from './icon-art.mts';
import { APP_ICON_SIZE, ICON_FILES, MAC_TRAY_SIZES, TILE_ICO_SIZES, TRAY_ICO_SIZES } from './icon-files.mts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'resources', 'icons');
mkdirSync(join(outDir, 'source'), { recursive: true });

// SVG 원본도 함께 남겨 두면 산출물을 만든 그림을 바로 열어 볼 수 있다
const sources = {
  'source/app-icon.svg': appIconSvg(),
  'source/app-tile.svg': appTileSvg(),
  'source/tray-mac-on.svg': macTraySvg('on'),
  'source/tray-mac-off.svg': macTraySvg('slash'),
  'source/tray-win-on.svg': winTraySvg('on'),
  'source/tray-win-off.svg': winTraySvg('off'),
};
for (const [file, svg] of Object.entries(sources)) writeFileSync(join(outDir, file), svg);

const work = mkdtempSync(join(tmpdir(), 'ding-dong-dang-icons-'));
/** 임시 폴더 안의 중간 PNG 경로. */
const png = (name: string, size: number) => join(work, `${name}-${size}.png`);
const jobs: { svg: string; size: number; out: string }[] = [];
/** name 그림을 sizes 각 크기로 그리라는 작업을 목록에 더한다. */
const need = (name: string, svg: string, sizes: readonly number[]) =>
  sizes.forEach((size) => jobs.push({ svg, size, out: png(name, size) }));

need('app', appIconSvg(), [APP_ICON_SIZE]);
need('tile', appTileSvg(), TILE_ICO_SIZES);
need('mac-on', macTraySvg('on'), MAC_TRAY_SIZES);
need('mac-off', macTraySvg('slash'), MAC_TRAY_SIZES);
need('win-on', winTraySvg('on'), TRAY_ICO_SIZES);
need('win-off', winTraySvg('off'), TRAY_ICO_SIZES);

try {
  const jobsFile = join(work, 'jobs.json');
  writeFileSync(jobsFile, JSON.stringify(jobs));
  // 'electron' 패키지를 Node에서 불러오면 실행 파일 경로 문자열이 나온다
  const electron = (await import('electron')).default as unknown as string;
  const run = spawnSync(electron, [join(root, 'scripts', 'icon-raster.mjs'), jobsFile], {
    stdio: 'inherit',
    // 이 값이 켜져 있으면 Electron이 앱이 아니라 Node로 떠서 창을 만들 수 없다
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  if (run.status !== 0) throw new Error(`그리기 실패(종료 코드 ${run.status})`);

  const read = (name: string, size: number) => readFileSync(png(name, size));
  const ico = (name: string, sizes: readonly number[]) =>
    buildIco(sizes.map((size) => ({ size, png: read(name, size) })));

  writeFileSync(join(outDir, ICON_FILES.appPng), read('app', APP_ICON_SIZE));
  writeFileSync(join(outDir, ICON_FILES.appIco), ico('tile', TILE_ICO_SIZES));
  writeFileSync(join(outDir, ICON_FILES.trayWinOn), ico('win-on', TRAY_ICO_SIZES));
  writeFileSync(join(outDir, ICON_FILES.trayWinOff), ico('win-off', TRAY_ICO_SIZES));
  // macOS는 파일 이름 끝이 Template이면 검정 + 알파를 시스템 색으로 칠한다. 2배판은 @2x를 붙인다.
  writeFileSync(join(outDir, ICON_FILES.trayMacOn), read('mac-on', MAC_TRAY_SIZES[0]));
  writeFileSync(join(outDir, ICON_FILES.trayMacOn2x), read('mac-on', MAC_TRAY_SIZES[1]));
  writeFileSync(join(outDir, ICON_FILES.trayMacOff), read('mac-off', MAC_TRAY_SIZES[0]));
  writeFileSync(join(outDir, ICON_FILES.trayMacOff2x), read('mac-off', MAC_TRAY_SIZES[1]));
  for (const file of Object.values(ICON_FILES)) console.log(file);
} finally {
  rmSync(work, { recursive: true, force: true });
}
