'use strict';

const { app, BrowserWindow, Menu, net, protocol } = require('electron');
const { pathToFileURL } = require('node:url');
const { resolveAssetPath } = require('./asset-router.cjs');

const APP_URL = 'poe2craft://app/index.html';

// A secure, standard origin lets Chromium load the existing ES modules without
// an HTTP server or --allow-file-access-from-files / disabled web security.
protocol.registerSchemesAsPrivileged([{
  scheme: 'poe2craft',
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}]);

async function createWindow() {
  const window = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1060,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'POE2 제작 시뮬레이터',
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== APP_URL) event.preventDefault();
  });
  await window.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  protocol.handle('poe2craft', request => {
    const asset = resolveAssetPath(request.url, app.getAppPath());
    if (!asset || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('찾을 수 없는 파일입니다.', { status: 404 });
    }
    return net.fetch(pathToFileURL(asset).toString());
  });

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch(error => {
  console.error('데스크톱 앱 실행 오류:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
