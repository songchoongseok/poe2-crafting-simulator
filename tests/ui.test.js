import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const html=readFileSync('index.html','utf8');
const app=readFileSync('src/app.js','utf8');
const css=readFileSync('src/style.css','utf8');

test('UI: 화면에서 사용하는 고정 ID가 HTML에 모두 존재한다',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
 const used=new Set([...app.matchAll(/\$\('#([^']+)'\)/g)].map(x=>x[1]));
 for(const id of used)assert.ok(ids.has(id),'HTML 요소 누락 #'+id);
});
test('UI: 제작하기, 설정/옵션 티어, 심연/징조, 이전 제작 보관함이 존재한다',()=>{
 for(const id of ['start-craft','prepare-craft','mod-family','modifier','goal-family',
  'goal-modifier','abyss-select','omen-select','archive-list','prefix-list','suffix-list']) {
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/function archiveCurrent\(/);
 assert.match(app,/localStorage\.setItem\(/);
 assert.match(app,/picker\.setLocked\(false\)/);
});
test('UI: 속성은 접두/접미 각각 고정 3칸이고 버튼 높이는 영향받지 않는다',()=>{
 assert.match(app,/Array\.from\(\{length:3\}/);
 assert.match(css,/\.item-card\{height:660px/);
 assert.match(css,/#prefix-list,#suffix-list\{/);
});
test('UI: 브라우저 모듈과 데이터 모듈 모두 문법 검사를 통과한다',()=>{
 for(const file of ['src/app.js','src/engine.js','src/affixes.js','src/affix-options.js',
   'src/base-picker.js','src/catalogue.js','src/session.js','data/demo.js']) {
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,file+': '+(result.stderr||result.stdout));
 }
});
