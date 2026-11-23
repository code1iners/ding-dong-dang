const { app, BrowserWindow, screen } = require('electron');
const mode = (process.argv.find(a => a.startsWith('--mode=')) || '').slice(7);
const transparent = !mode.startsWith('opaque');
const hidden = mode.includes('hidden');
app.dock && app.dock.hide();
app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: 260, height: 215, x: 200, y: d.workArea.y + d.workArea.height - 215,
    show: false, frame: false, transparent, hasShadow: false, resizable: false, focusable: false,
    alwaysOnTop: true, roundedCorners: false, skipTaskbar: true,
    ...(transparent ? {} : { backgroundColor: '#ffffff' }),
    type: 'panel',
    webPreferences: { backgroundThrottling: false, sandbox: true, contextIsolation: true, preload: require('path').join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setIgnoreMouseEvents(true);
  win.loadFile('index.html', { query: { mode } });
  win.once('ready-to-show', () => { if (!hidden) win.showInactive(); });
  if (hidden) win.webContents.once('did-finish-load', () => setTimeout(() => win.hide(), 1000));
});
