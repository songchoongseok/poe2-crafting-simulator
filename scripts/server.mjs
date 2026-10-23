import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url,`http://localhost:${port}`).pathname);
    const path = resolve(root, '.' + normalize(urlPath === '/' ? '/index.html' : urlPath));
    if (!(path===root || path.startsWith(root+sep))) {res.writeHead(403);res.end('Forbidden');return;}
    const data = await readFile(path);
    res.writeHead(200,{'Content-Type':MIME[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  } catch(e) {res.writeHead(404);res.end('Not Found');}
}).listen(port, '127.0.0.1',()=>console.log(`Open http://127.0.0.1:${port}`));
