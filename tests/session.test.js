import test from 'node:test';
import assert from 'node:assert/strict';
import {makeInitial,applyOrb,setGoals,goalProgress} from '../src/engine.js';
import {parseSession,serializeSession} from '../src/session.js';
test('목표 추가와 달성 판정은 오브를 소모하지 않는다',()=>{
 const s=makeInitial(),r=setGoals(s,['fire42','movement35']);
 assert.equal(r.ok,true);assert.deepEqual(goalProgress(r.state).achieved,['fire42']);assert.deepEqual(r.state.usage,{});
});
test('목표 중복과 미등록 속성은 거부한다',()=>{
 const s=makeInitial();assert.equal(setGoals(s,['fire42','fire42']).ok,false);assert.equal(setGoals(s,['unknown']).ok,false);
});
test('제작 상태와 로그를 손실 없이 저장하고 복원한다',()=>{
 const s=applyOrb(makeInitial(),'augment',()=>0).state;const restored=parseSession(serializeSession(s));
 for(const key of ['baseId','itemLevel','rarity','mods','goals','omenId','usage','log','locked','attempts'])assert.deepEqual(restored[key],s[key]);
});
test('잘못된 세션 형식·속성·사용량을 차단한다',()=>{
 for(const change of [x=>x.version=2,x=>x.state.mods[0].id='bad',x=>x.state.usage.hacked=1,x=>x.state.usage.augment=-1]){
  const p=JSON.parse(serializeSession(makeInitial()));change(p);assert.throws(()=>parseSession(JSON.stringify(p)));
 }
});
test('깨진 JSON과 잘못된 제작 로그를 차단한다',()=>{
 assert.throws(()=>parseSession('{broken'));
 const p=JSON.parse(serializeSession(makeInitial()));p.state.log=[{order:1,success:'yes',action:'orb',detail:'x'}];assert.throws(()=>parseSession(JSON.stringify(p)));
});
