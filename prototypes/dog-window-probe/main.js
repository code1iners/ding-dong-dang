// PROTOTYPE: 돌아다니는 강아지 창 검증용. 버리는 코드.
// --mode=small   강아지 크기의 작은 창을 움직인다.
// --mode=overlay 주 모니터를 덮는 투명 창 안에서 강아지를 움직인다.
// --mode=target  클릭이 통과하는지 받는 과녁 창.
const { app, BrowserWindow, ipcMain, screen, powerMonitor, nativeTheme } = require('electron');
const fs = require('fs'), http = require('http'), path = require('path');
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const MODE = arg('mode', 'overlay'), PORT = +arg('port', 47800), LOG = arg('log', path.join(__dirname, 'logs', MODE + '.jsonl'));
fs.mkdirSync(path.dirname(LOG), { recursive: true });
const log = (ev, d) => fs.appendFileSync(LOG, JSON.stringify(Object.assign({ t: new Date().toISOString(), ev }, d || {})) + '\n');
process.on('uncaughtException', e => { try { log('uncaught', { message: String(e && e.stack || e) }); } catch {} app.exit(1); });
app.setPath('userData', path.join(app.getPath('temp'), 'dog-window-probe-' + MODE + '-' + PORT));
if (arg('dock', '1') === '0' && app.dock) app.dock.hide();

let armedUntil = 0;
let win, layout = null, pos = null, ringing = false, dragging = false, isDown = false, ignoring = true, on = arg('on', '1') === '1', lastStat = null, setPosCalls = 0;

app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay();
  log('start', { mode: MODE, argv: process.argv.slice(2), electron: process.versions.electron, primary: { bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor, hz: d.displayFrequency }, displays: screen.getAllDisplays().map(x => ({ id: x.id, bounds: x.bounds })), reducedMotion: nativeTheme.prefersReducedMotion });
  ipcMain.on('log', (_, m) => log(m.ev, m));
  if (MODE === 'target') return target(d);

  const wa = d.workArea;
  const cfg = {
    mode: MODE, theme: arg('theme', 'bucktooth'), size: +arg('size', 96), fps: +arg('fps', 0), timer: arg('timer', '0') === '1', still: arg('still', '0') === '1', idlefps: +arg('idlefps', 0),
    fast: arg('fast', '0') === '1', sec: arg('sec', 'class'), on, fall: +arg('fall', 120), debug: arg('outline', '0') === '1', reduced: arg('reduced', '0') === '1',
    floorY: wa.y + wa.height - +arg('lift', 0), topY: d.bounds.y, minX: d.bounds.x, maxX: d.bounds.x + d.bounds.width, winX: d.bounds.x, winY: d.bounds.y,
    startX: arg('startx') ? +arg('startx') : null, ringMs: +arg('ringms', 8000),
  };
  const b = MODE === 'overlay' ? d.bounds : { x: d.bounds.x, y: d.bounds.y, width: 300, height: 300 };
  win = new BrowserWindow({
    ...b, frame: false, transparent: true, resizable: false, movable: false, hasShadow: false, show: false, focusable: arg('focusable', '0') === '1',
    skipTaskbar: true, alwaysOnTop: true, roundedCorners: false, enableLargerThanScreen: true, fullscreenable: false,
    type: arg('panel', '1') === '1' ? 'panel' : undefined,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.setAlwaysOnTop(true, arg('level', 'pop-up-menu'));
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  win.setIgnoreMouseEvents(true);
  win.webContents.on('console-message', (e) => log('console', { level: e.level, message: e.message, line: e.lineNumber }));
  win.webContents.on('render-process-gone', (_, d) => log('renderer-gone', d));
  win.loadFile('dog.html', { hash: encodeURIComponent(JSON.stringify(cfg)) });

  const place = () => { if (MODE === 'small' && layout && pos) { win.setBounds({ x: Math.round(pos.sx - layout.winW / 2), y: Math.round(pos.sy - (layout.winH - layout.PADB)), width: layout.winW, height: layout.winH }); setPosCalls++; } };
  const showOrHide = () => { const want = on || ringing; if (want && !win.isVisible()) { win.showInactive(); log('show'); } else if (!want && win.isVisible()) { win.hide(); log('hide'); } };
  ipcMain.on('layout', (_, l) => { layout = l; log('layout', l); });
  ipcMain.on('pos', (_, p) => { const first = !pos; pos = p; place(); if (first) showOrHide(); });
  ipcMain.on('cursor', e => { e.returnValue = screen.getCursorScreenPoint(); });
  ipcMain.on('drag', (_, v) => { dragging = v; });
  let appActive = false;
  app.on('did-become-active', () => { appActive = true; }); app.on('did-resign-active', () => { appActive = false; });
  // 강아지를 누르면 앱이 맨 앞 앱이 된다. 손을 떼면 앱을 숨겼다가 창만 다시 보여 원래 앱으로 돌려준다.
  ipcMain.on('down', (_, v) => { isDown = v; if (!v && arg('refocus', '0') === '1' && appActive) { const t0 = Date.now(); app.hide(); setTimeout(() => { win.showInactive(); log('refocus', { ms: Date.now() - t0 }); }, +arg('refocusms', 0)); } });
  ipcMain.on('ringing', (_, v) => { ringing = v; showOrHide(); });
  ipcMain.on('stat', (_, s) => { lastStat = s; });

  // 강아지 자리에서만 클릭을 받는다. forward 옵션 대신 메인이 커서 위치를 직접 확인한다.
  setInterval(() => {
    if (win.isDestroyed() || !pos || !win.isVisible()) return;
    const c = screen.getCursorScreenPoint();
    const over = c.x >= pos.sx - pos.W / 2 && c.x <= pos.sx + pos.W / 2 && c.y >= pos.sy - pos.H && c.y <= pos.sy;
    const want = !(over || dragging || isDown || Date.now() < armedUntil);
    if (want !== ignoring) { ignoring = want; win.setIgnoreMouseEvents(want); log('ignore', { v: want }); }
  }, +arg('hit', 33));

  setInterval(() => {
    if (win.isDestroyed()) return;
    const m = app.getAppMetrics().map(p => ({ type: p.type, cpu: +p.cpu.percentCPUUsage.toFixed(2), cum: p.cpu.cumulativeCPUUsage, mem: Math.round(p.memory.workingSetSize / 1024) }));
    log('metrics', { total: +m.reduce((a, p) => a + p.cpu, 0).toFixed(2), m, stat: lastStat, setPosCalls, idle: powerMonitor.getSystemIdleTime(), idleState: powerMonitor.getSystemIdleState(60) });
    setPosCalls = 0;
  }, 5000);

  // 화면이 잠기거나 꺼지면 그리기를 멈춘다.
  const freeze = (v, why) => { log('power', { why, frozen: v }); win.webContents.send('frozen', v); };
  powerMonitor.on('lock-screen', () => freeze(true, 'lock-screen'));
  powerMonitor.on('unlock-screen', () => freeze(false, 'unlock-screen'));
  powerMonitor.on('suspend', () => freeze(true, 'suspend'));
  powerMonitor.on('resume', () => freeze(false, 'resume'));
  for (const ev of ['focus', 'blur', 'show', 'hide']) win.on(ev, () => log('win-' + ev));
  for (const ev of ['did-become-active', 'did-resign-active', 'browser-window-focus']) app.on(ev, () => log('app-' + ev));

  serve((u, res) => {
    const v = u.searchParams.get('v');
    if (u.pathname === '/ring') win.webContents.send('ring', v !== '0');
    else if (u.pathname === '/sec') win.webContents.send('sec', v);
    else if (u.pathname === '/on') { on = v === '1'; win.webContents.send('on', on); showOrHide(); }
    else if (u.pathname === '/freeze') freeze(v === '1', 'manual');
    else if (u.pathname === '/arm') { armedUntil = Date.now() + 3000; ignoring = false; win.setIgnoreMouseEvents(false); }
    else if (u.pathname === '/level') win.setAlwaysOnTop(true, v);
    return { pos, layout, bounds: win.getBounds(), visible: win.isVisible(), focused: win.isFocused(), appFocused: !!BrowserWindow.getFocusedWindow(), ignoring, ringing, dragging, on, cursor: screen.getCursorScreenPoint(), stat: lastStat };
  });
});

function target(d) {
  const x = +arg('x', d.bounds.x + 200), y = +arg('y', d.bounds.y + 500);
  win = new BrowserWindow({ x, y, width: +arg('w', 500), height: +arg('h', 400), show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadFile('target.html'); win.once('ready-to-show', () => win.showInactive());
  for (const ev of ['enter-full-screen', 'leave-full-screen', 'focus']) win.on(ev, () => log('target-' + ev));
  serve(u => { if (u.pathname === '/fullscreen') win.setFullScreen(u.searchParams.get('v') === '1'); return { bounds: win.getBounds(), fullscreen: win.isFullScreen() }; });
}
function serve(fn) {
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/quit') { res.end('bye'); return setTimeout(() => app.exit(0), 50); }
    res.end(JSON.stringify(fn(u, res)));
  }).on('error', e => { log('port-error', { message: String(e) }); app.exit(1); }).listen(PORT, '127.0.0.1');
}
app.on('window-all-closed', () => app.quit());
