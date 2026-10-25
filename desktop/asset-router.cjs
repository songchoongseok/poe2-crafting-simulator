'use strict';

const path = require('node:path');

// Only public browser assets may be served to the renderer. In particular,
// never expose package files, build configuration or the Electron main process.
function resolveAssetPath(requestUrl, appRoot) {
  let parsed;
  try { parsed = new URL(requestUrl); } catch { return null; }
  if (parsed.protocol !== 'poe2craft:' || parsed.hostname !== 'app' ||
      parsed.username || parsed.password || parsed.port) return null;

  let pathname;
  try { pathname = decodeURIComponent(parsed.pathname); } catch { return null; }
  if (pathname === '/') pathname = '/index.html';
  if (pathname !== '/index.html' &&
      !/^\/(?:src|data)\/[a-zA-Z0-9_-]+\.(?:js|css)$/.test(pathname)) return null;
  if (pathname.endsWith('.css') && pathname !== '/src/style.css') return null;

  const asset = path.resolve(appRoot, pathname.slice(1));
  if (!asset.startsWith(path.resolve(appRoot) + path.sep)) return null;
  return asset;
}

module.exports = { resolveAssetPath };
