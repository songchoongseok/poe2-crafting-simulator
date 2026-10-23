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
test('UI: 일반 장비는 양쪽 3칸, 특수 반지의 예외 칸도 표시한다',()=>{
 assert.match(app,/Array\.from\(\{length:Math\.max\(3,available\)\}/);
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

test('등급별 테두리 색상이 아이템 데이터 등급과 연결돼 있다',()=>{
  assert.match(html,/id="item-card"[^>]*data-rarity="normal"/);
  assert.match(app,/\$\('#item-card'\)\.dataset\.rarity=state\.rarity/);
  for(const rarity of ['normal','magic','rare']){
    assert.match(css,new RegExp('\\.item-card\\[data-rarity="'+rarity+'"\\]\\{border:3px'));
  }
});
test('심연 재료 클릭, 훼손 세 가지 중 선택, 징조 재추첨 동작이 버튼에 연결된다',()=>{
  for(const id of ['abyss-apply','abyss-reveal','abyss-reroll']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  for(const method of ['applyBone\(','revealDesecration\(','rerollDesecration\(']){
    assert.ok(app.includes(method.replace('\\','')),method+' function must be called');
  }
});
