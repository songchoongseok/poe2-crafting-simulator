import test from 'node:test';
import assert from 'node:assert/strict';
import { bases } from '../data/demo.js';
import { makeInitial,applyOrb,toggleOmen,validateStart,modById } from '../src/engine.js';
import { applyBone,revealDesecration,rerollDesecration,hasDesecration,abyssMods } from '../src/abyss.js';
import { parseSession,serializeSession } from '../src/session.js';

const baseOf=(category)=>bases.find(x=>x.category===category&&x.requiredLevel>=1);
function ready(base,rarity='rare') {
  return {...makeInitial(),baseId:base.id,itemLevel:Math.max(65,base.requiredLevel),
    rarity,mods:[],goals:[],omenId:null,log:[],usage:{},attempts:0,
    locked:true,desecration:null,corrupted:false};
}
test('희귀 방어구에 보존된 갈비뼈 사용 → 1개의 숨겨진 속성 및 재료 로그',()=>{
 const s=ready(baseOf('boots')),r=applyBone(s,baseOf('boots'),'preserved-rib',()=>0);
 assert.equal(r.ok,true);assert.equal(r.state.mods.length,1);
 assert.equal(r.state.mods[0].unrevealed,true);
 assert.equal(r.state.usage['preserved-rib'],1);
 assert.equal(r.state.desecration.offers.length,3);
 assert.equal(validateStart(r.state),null);
 assert.equal(applyBone(r.state,baseOf('boots'),'preserved-rib',()=>0).ok,false);
});
test('영혼의 우물 선택으로 한국어 훼손 속성을 실제 아이템에 반영한다',()=>{
 const initial=applyBone(ready(baseOf('boots')),baseOf('boots'),'preserved-rib',()=>0).state;
 const chosen=initial.desecration.offers[0];
 const done=revealDesecration(initial,chosen,()=>0);
 assert.equal(done.ok,true);
 assert.equal(done.state.mods[0].id,chosen);
 assert.equal(done.state.mods[0].desecrated,true);
 assert.equal(done.state.desecration.revealed,true);
 assert.match(done.state.mods[0].valueText,/[가-힣]/);
 assert.equal(validateStart(done.state),null);
 assert.equal(revealDesecration(done.state,chosen).ok,false);
});
test('장비 종류, 뼈 등급과 아이템 레벨의 사용 조건을 검사하고 미소모',()=>{
 const boots=baseOf('boots'),ring=baseOf('ring'),s=ready(boots);
 for(const bone of ['preserved-jawbone','preserved-collarbone']){
  const r=applyBone(s,boots,bone);assert.equal(r.ok,false);
  assert.deepEqual(r.state.usage,{});assert.deepEqual(r.state.mods,[]);
 }
 const r=applyBone(s,boots,'gnawed-rib');
 assert.equal(r.ok,false);assert.deepEqual(r.state.usage,{});
 assert.equal(applyBone(ready(ring),ring,'preserved-collarbone',()=>0).ok,true);
});
test('좌측 강령술 징조는 훼손 접두어만 만들고 실제 사용 수량을 기록한다',()=>{
 const base=baseOf('ring'),s=ready(base);
 s.omenId='omen-of-sinistral-necromancy';
 const r=applyBone(s,base,'preserved-collarbone',()=>0);
 assert.equal(r.ok,true);
 assert.equal(modById[r.state.mods[0].id].kind,'prefix');
 assert.equal(r.state.usage['omen-of-sinistral-necromancy'],1);
 assert.equal(r.state.omenId,null);
 assert.equal(r.state.log.at(-1).omen,'좌측 강령술의 징조');
});
test('심연의 메아리의 징조 활성화 → 훼손 선택지 다시 추첨 및 소모',()=>{
 const base=baseOf('boots'),r=applyBone(ready(base),base,'preserved-rib',()=>0).state;
 const activated=toggleOmen(r,'omen-of-abyssal-echoes').state;
 const reroll=rerollDesecration(activated,()=>0.5);
 assert.equal(reroll.ok,true);
 assert.equal(reroll.state.usage['omen-of-abyssal-echoes'],1);
 assert.equal(reroll.state.desecration.rerolled,true);
 assert.equal(reroll.state.log.at(-1).omen,'심연의 메아리의 징조');
 assert.equal(rerollDesecration(reroll.state).ok,false);
});
test('빛의 징조 + 소멸은 훼손 속성을 제거하고 새 뼈 제작을 허용한다',()=>{
 const base=baseOf('boots'),r=applyBone(ready(base),base,'preserved-rib',()=>0).state;
 const activated=toggleOmen(r,'omen-of-light').state;
 const result=applyOrb(activated,'annul',()=>0);
 assert.equal(result.ok,true);
 assert.equal(hasDesecration(result.state.mods),false);
 assert.equal(result.state.desecration,null);
 assert.equal(result.state.usage['omen-of-light'],1);
 assert.equal(applyBone(result.state,base,'preserved-rib',()=>0).ok,true);
});
test('상위 찬미의 징조는 엑잘티드 오브 하나로 서로 다른 2속성을 추가한다',()=>{
 const base=baseOf('ring'),s=ready(base);s.omenId='omen-of-greater-exaltation';
 const r=applyOrb(s,'exalt',()=>0);
 assert.equal(r.ok,true);assert.equal(r.state.mods.length,2);
 assert.equal(r.state.usage.exalt,1);
 assert.equal(r.state.usage['omen-of-greater-exaltation'],1);
 assert.equal(validateStart(r.state),null);
});
test('상위 소멸의 징조는 속성 2개를 제거하며 1개만 있으면 미소모 처리',()=>{
 const base=baseOf('ring'),s=ready(base);
 let a=applyOrb(s,'exalt',()=>0).state;a=applyOrb(a,'exalt',()=>0).state;
 a.omenId='omen-of-greater-annulment';
 const r=applyOrb(a,'annul',()=>0);
 assert.equal(r.ok,true);assert.equal(r.state.mods.length,0);
 assert.equal(r.state.usage['omen-of-greater-annulment'],1);
 const fail=applyOrb({...a,mods:[a.mods[0]]},'annul',()=>0);
 assert.equal(fail.ok,false);
 assert.equal(fail.state.usage['omen-of-greater-annulment']||0,0);
});
test('훼손 전후 상태와 뼈 사용량이 세션을 저장한 후에도 유지된다',()=>{
 const base=baseOf('boots'),s=applyBone(ready(base),base,'preserved-rib',()=>0).state;
 const restored=parseSession(serializeSession(s));
 assert.deepEqual(restored.desecration,s.desecration);
 assert.deepEqual(restored.mods,s.mods);
 assert.deepEqual(restored.usage,s.usage);
 const id=restored.desecration.offers[1];
 assert.equal(revealDesecration(restored,id).ok,true);
});
test('훼손 전용 속성 풀은 지정한 베이스의 한국어 옵션으로 구성된다',()=>{
 const b=baseOf('ring'),s=applyBone(ready(b),b,'preserved-collarbone',()=>0).state;
 assert.ok(s.desecration.offers.every(id=>id.startsWith('Ring::')));
 assert.ok(s.desecration.offers.every(id=>/[가-힣]/.test(modById[id].effect)));
});
