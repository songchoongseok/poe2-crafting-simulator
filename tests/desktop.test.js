import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require=createRequire(import.meta.url);
const { resolveAssetPath }=require('../desktop/asset-router.cjs');
const manifest=JSON.parse(readFileSync('package.json','utf8'));
const desktopMain=readFileSync('desktop/main.cjs','utf8');

test('고객 배포에는 일렉트론 주 프로세스와 Windows 설치/무설치 타깃이 존재한다',()=>{
  assert.equal(manifest.main,'desktop/main.cjs');
  assert.equal(manifest.scripts.desktop,'electron .');
  assert.ok(manifest.scripts['dist:win'].includes('electron-builder'));
  assert.ok(manifest.scripts['dist:win'].includes('--publish never'),
    '고객용 실행 파일 빌드가 서명되지 않은 GitHub 릴리스를 자동 배포하면 안 됩니다.');
  assert.deepEqual(manifest.build.win.target.map(x=>x.target),['nsis','portable']);
  for(const f of ['desktop/**/*.cjs','index.html','src/**/*.js','data/**/*.js']){
    assert.ok(manifest.build.files.includes(f),f);
  }
});

test('일렉트론 프로토콜은 자사 화면·스크립트만 제공하며 파일 탐색을 차단한다',()=>{
  const root=path.resolve('.');
  for(const asset of ['index.html','src/app.js','src/style.css','src/engine.js',
    'data/demo.js','data/kr-base-names.js']){
    assert.equal(resolveAssetPath('poe2craft://app/'+asset,root),path.resolve(root,asset));
  }
  for(const url of [
    'file:///etc/passwd','https://example.com/src/app.js',
    'poe2craft://evil/index.html','poe2craft://app/package.json',
    'poe2craft://app/desktop/main.cjs','poe2craft://app/.env',
    'poe2craft://app/src/%2e%2e/package.json','poe2craft://app/src/../../package.json',
    'poe2craft://app/data/some.css'
  ]) assert.equal(resolveAssetPath(url,root),null,url);
});

test('데스크톱 화면에서는 Node.js 및 새 창 실행 권한을 열지 않는다',()=>{
  assert.match(desktopMain,/nodeIntegration:\s*false/);
  assert.match(desktopMain,/contextIsolation:\s*true/);
  assert.match(desktopMain,/sandbox:\s*true/);
  assert.match(desktopMain,/setWindowOpenHandler/);
  assert.match(desktopMain,/will-navigate/);
  assert.match(desktopMain,/protocol\.registerSchemesAsPrivileged/);
});
