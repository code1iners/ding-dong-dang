// 내장 종소리 열두 개를 WAV 파일로 만들어 resources/sounds/builtin/에 쓴다.
// 실행: npm run sounds. 브라우저 없이 돌고, 다시 돌려도 같은 바이트가 나온다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_SOUNDS } from '../src/shared/builtin-sounds.ts';
import { renderBuiltinSound } from './bell-synth.mts';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'sounds', 'builtin');
mkdirSync(outDir, { recursive: true });
for (const sound of BUILTIN_SOUNDS) {
  writeFileSync(join(outDir, sound.file), renderBuiltinSound(sound.id));
  console.log(`${sound.file}  ${sound.name}`);
}
