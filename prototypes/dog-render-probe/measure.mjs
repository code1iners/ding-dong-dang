// 10분 평균 CPU 측정. 앱 프로세스 트리 전체의 누적 CPU 시간 차이로 코어 하나 기준 %를 낸다(28번과 같은 방법).
// 사용: node measure.mjs <방식> <ring|roam|both> <초> [결과 파일]
//  ring : 돌아다니는 강아지를 끄고 앱 창만(고리 안 강아지)
//  roam : --auto-start로 앱 창 없이 돌아다니는 강아지만
//  both : 앱 창과 돌아다니는 강아지 둘 다
import { spawn, execSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [variant, config, secsArg, resultFile = '/tmp/dog-probe/results.jsonl'] = process.argv.slice(2);
const secs = Number(secsArg);
const dir = mkdtempSync(join(tmpdir(), 'dogprobe-'));
const data = JSON.parse(readFileSync('/tmp/t07-data.json', 'utf8'));
// 하루 종일 수업 시간인 시간표(저장 값은 e2e 도우미로 만든 것)
data.settings.roamingDog = config !== 'ring';
writeFileSync(join(dir, 'data.json'), JSON.stringify(data));

const log = join(dir, 'app.log');
const args = [`/tmp/dog-probe/${variant}`, `--data-dir=${dir}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', ...(process.env.PROBE_CDP ? [`--remote-debugging-port=${process.env.PROBE_CDP}`] : [])];
if (config === 'roam') args.push('--auto-start');
const child = spawn(join(process.cwd(), 'node_modules/.bin/electron'), args, {
  stdio: ['ignore', openSync(log, 'a'), openSync(log, 'a')],
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1', DDD_HEADLESS: '' },
});

/** 프로세스 트리의 pid별 { 종류, CPU 초 }. */
function snapshot() {
  const rows = execSync('ps -axo pid=,ppid=,time=,command=').toString().split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/)).filter(Boolean);
  const pids = new Set([child.pid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows) if (pids.has(+r[2]) && !pids.has(+r[1])) { pids.add(+r[1]); grew = true; }
  }
  const out = {};
  for (const r of rows) {
    if (!pids.has(+r[1])) continue;
    const parts = r[3].split(':').map(parseFloat);
    const sec = parts.reduce((a, b) => a * 60 + b, 0);
    const type = /--type=(\w[\w-]*)/.exec(r[4])?.[1] ?? 'main';
    out[r[1]] = { type, sec };
  }
  return out;
}
const loadAvg = () => execSync('sysctl -n vm.loadavg').toString().trim();

await new Promise((r) => setTimeout(r, 30000));
const a = snapshot(); const w0 = Date.now(); const load0 = loadAvg();
await new Promise((r) => setTimeout(r, secs * 1000));
const b = snapshot(); const w1 = Date.now(); const load1 = loadAvg();
const wall = (w1 - w0) / 1000;
const byType = {};
let total = 0;
for (const [pid, p] of Object.entries(b)) {
  const d = p.sec - (a[pid]?.sec ?? 0);
  byType[p.type] = (byType[p.type] ?? 0) + d;
  total += d;
}
const pct = (s) => +((s / wall) * 100).toFixed(2);
const result = { variant, config, wall: +wall.toFixed(0), totalPct: pct(total), byTypePct: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, pct(v)])), load0, load1, at: new Date().toISOString() };
appendFileSync(resultFile, JSON.stringify(result) + '\n');
console.log(JSON.stringify(result));
child.kill();
console.log(readFileSync(log, 'utf8').split('\n').filter((l) => l.includes('[probe]')).join('\n'));
