import test from 'node:test';
import assert from 'node:assert/strict';
import { bases } from '../data/demo.js';
import { essenceCatalogue } from '../data/poe2db-essences.js';
import { essenceOptionFor } from '../src/essences.js';
import { makeInitial,applyOrb,applyEssence,validateStart,toggleOmen,modById } from '../src/engine.js';
import { applyBone,revealDesecration } from '../src/abyss.js';
import { serializeSession,parseSession } from '../src/session.js';

const zero=()=>0;
const base=category=>bases.find(b=>b.category===category&&b.requiredLevel>=1);
function ready(category,rarity='rare',mods=[]){
 const b=base(category);
 return {...makeInitial(),baseId:b.id,itemLevel:80,rarity,mods,locked:true,
  omenId:null,usage:{},log:[],goals:[],desecration:null,desecrations:null,corrupted:false};
}
test('상위·완벽한 오브가 최소 속성 레벨을 충족한 후보만 선택한다',()=>{
 const s=ready('boots','normal');
 const r=applyOrb(s,'transmute-perfect',zero);
 assert.equal(r.ok,true);assert.equal(r.state.rarity,'magic');
 assert.ok(modById[r.state.mods[0].id].level>=70);
 assert.equal(r.state.usage['transmute-perfect'],1);
});
test('연금술은 일반을 희귀 4옵션으로 재설정하고 분열은 속성을 고정한다',()=>{
 const r=applyOrb(ready('boots','normal'),'alchemy',zero);
 assert.equal(r.ok,true);assert.equal(r.state.mods.length,4);
 assert.equal(validateStart(r.state),null);
 const f=applyOrb(r.state,'fracture',zero);
 assert.equal(f.ok,true);assert.equal(f.state.mods.filter(m=>m.fractured).length,1);
 assert.equal(f.state.usage.fracture,1);
});
test('좌측 연금술 징조는 접두어 세 개를 확정한다',()=>{
 let s=ready('boots','normal');s=toggleOmen(s,'omen-of-sinistral-alchemy').state;
 const r=applyOrb(s,'alchemy',zero);
 assert.equal(r.ok,true);assert.equal(r.state.mods.filter(m=>modById[m.id].kind==='prefix').length,3);
 assert.equal(r.state.usage['omen-of-sinistral-alchemy'],1);
});
test('PoE2DB 에센스가 마법 아이템을 희귀로 바꾸며 정확한 확정 텍스트를 사용한다',()=>{
 const essence=essenceCatalogue.find(x=>x.name==='육신의 에센스');
 const r=applyEssence(ready('boots','magic'),essence.id,zero);
 assert.equal(r.ok,true);assert.equal(r.state.rarity,'rare');
 assert.match(r.state.mods[0].valueText,/생명력 최대치/);
 assert.equal(r.state.usage[essence.id],1);assert.equal(validateStart(r.state),null);
});
test('등록된 한국어 에센스 82종에 모두 적용 가능한 일반 장비 베이스가 존재한다',()=>{
 assert.equal(essenceCatalogue.length,82);
 for(const essence of essenceCatalogue){
  assert.ok(bases.some(b=>essenceOptionFor(b,essence)),essence.name+' 대상 베이스가 없습니다.');
 }
});
test('에센스의 적용 부위가 없으면 재료를 소모하지 않는다',()=>{
 const essence=essenceCatalogue.find(x=>x.name==='완벽한 육신의 에센스');
 const s=ready('boots');assert.equal(essenceOptionFor(base('boots'),essence),null);
 const r=applyEssence(s,essence.id,zero);
 assert.equal(r.ok,false);assert.deepEqual(r.state.usage,{});
});
test('신성한 오브와 축성 징조가 상태·소모량을 변경한다',()=>{
 const r=applyOrb(ready('boots','normal'),'alchemy',zero);
 const s=toggleOmen(r.state,'omen-of-sanctification').state;
 const d=applyOrb(s,'divine',zero);
 assert.equal(d.ok,true);assert.equal(d.state.sanctified,true);
 assert.equal(d.state.usage['omen-of-sanctification'],1);
});
test('촉진하는 찬미의 징조는 기폭제 품질을 사용하고 소모한다',()=>{
 let s=ready('ring');s.catalystType='fire';s.catalystQuality=20;
 s=toggleOmen(s,'omen-of-catalysing-exaltation').state;
 const r=applyOrb(s,'exalt',zero);
 assert.equal(r.ok,true,r.reason);assert.equal(r.state.catalystQuality,0);
 assert.equal(r.state.usage['omen-of-catalysing-exaltation'],1);
});
test('부패의 징조는 기존 속성을 교체하고 6개 훼손 선택지를 순차 공개한다',()=>{
 const s=ready('boots');s.omenId='omen-of-putrefaction';
 const b=base('boots');let r=applyBone(s,b,'preserved-rib',zero);
 assert.equal(r.ok,true);assert.equal(r.state.corrupted,true);
 assert.equal(r.state.mods.length,6);
 assert.equal(r.state.usage['omen-of-putrefaction'],1);
 let state=parseSession(serializeSession(r.state));
 for(let i=0;i<6;i++){
  const d=state.desecrations.find(x=>!x.revealed);
  r=revealDesecration(state,d.offers[0],zero);
  assert.equal(r.ok,true,r.reason);state=r.state;
 }
 assert.equal(state.mods.filter(x=>x.unrevealed).length,0);
 assert.equal(validateStart(state),null);
});
test('미구현 세계 이벤트 징조는 임의로 소모하거나 제작 성공 처리하지 않는다',()=>{
 const s=ready('ring');const r=toggleOmen(s,'omen-of-refreshment');
 assert.equal(r.ok,false);assert.deepEqual(r.state.usage,{});
});
