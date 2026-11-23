const { app, BrowserWindow, screen } = require('electron');
const mode = (process.argv.find(a => a.startsWith('--mode=')) || '').slice(7);
const transparent = !mode.startsWith('opaque');
const hidden = mode.includes('hidden') || mode.includes('hide');
const throttle = mode.split('-').includes('throttle');
app.dock && app.dock.hide();
app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: 260, height: 215, x: 200, y: d.workArea.y + d.workArea.height - 215,
    show: false, frame: false, transparent, hasShadow: false, resizable: false, focusable: false,
    alwaysOnTop: true, roundedCorners: false, skipTaskbar: true,
    ...(transparent ? {} : { backgroundColor: '#ffffff' }),
    ...(mode.includes('normal') ? {} : { type: 'panel' }),
    webPreferences: { backgroundThrottling: throttle, sandbox: true, contextIsolation: true, preload: require('path').join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setIgnoreMouseEvents(true);
  win.loadFile('index.html', { query: { mode } });
  win.once('ready-to-show', () => { win.showInactive(); });
  if (hidden) win.webContents.once('did-finish-load', () => setTimeout(() => win.hide(), 1000));
});
// 타이머/rAF가 실제로 몇 번 돌았는지 5초마다 파일에 남긴다(스로틀링 확인용)
const fs = require('fs');
app.whenReady().then(() => setInterval(() => {
  const w = BrowserWindow.getAllWindows()[0]; if (!w) return;
  w.webContents.executeJavaScript("(window.__n||0)+' vs='+document.visibilityState").then(n => fs.appendFileSync(process.env.LOGF || '/dev/null', `${mode} t=${Math.round(process.uptime())} n=${n} vis=${w.isVisible()}\n`)).catch(()=>{});
}, 5000));
