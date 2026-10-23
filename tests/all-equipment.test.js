import test from 'node:test';
import assert from 'node:assert/strict';
import { bases, omens, abyssCraftingMaterials } from '../data/demo.js';
import {baseById,makeInitial,applyOrb,setInitial,modById} from '../src/engine.js';
import {modsForBase,allRealMods,modClassOf} from '../src/affixes.js';
import {affixFamilies} from '../src/affix-options.js';
import {serializeSession,parseSession} from '../src/session.js';

function blank(base) {
 return {...makeInitial(),baseId:base.id,itemLevel:Math.max(1,base.requiredLevel),
   rarity:'normal',mods:[],goals:[],omenId:null,usage:{},log:[],locked:false,attempts:0};
}
test('전체 장비 종류의 일반 속성 후보가 연결돼 있다',()=>{
 const categories=[...new Set(bases.map(b=>b.category))].filter(c=>c!=='custom');
 for(const category of categories) {
   const list=bases.filter(b=>b.category===category);
   assert.ok(list.some(b=>modsForBase(b,100).length>0),'후보 누락: '+category);
 }
});
test('베이스 변경 이후 기존 신발용 시연 속성은 다른 장비에 붙지 않는다',()=>{
 const ring=bases.find(b=>b.category==='ring'&&b.sourceName==='Iron Ring');
 const s=blank(ring);
 assert.equal(setInitial({...s,rarity:'magic'},{mods:[{id:'fire42',fractured:false}]}).ok,false);
 const result=applyOrb(s,'transmute',()=>0);
 assert.equal(result.ok,true);assert.equal(result.state.usage.transmute,1);
 assert.ok(result.state.mods.every(m=>!!modById[m.id].effect));
});
test('동일한 원본 속성 ID라도 장비 종류별로 고유 ID를 사용한다',()=>{
 const boots=bases.find(b=>b.category==='boots'&&b.sourceName==='Daggerfoot Shoes');
 const ring=bases.find(b=>b.category==='ring'&&b.sourceName==='Iron Ring');
 const b=modsForBase(boots,100),r=modsForBase(ring,100);
 assert.ok(b.every(m=>m.id.startsWith('Boots::')));
 assert.ok(r.every(m=>m.id.startsWith('Ring::')));
 assert.ok(Object.keys(allRealMods).length>1000);
});
test('한글 베이스 이름과 옵션 설명이 표시된다',()=>{
 const b=bases.find(x=>x.category==='ring'&&x.sourceName==='Iron Ring');
 assert.ok(b);assert.notEqual(b.name,b.sourceName);
 const available=modsForBase(b,100);
 assert.ok(available.some(m=>/[가-힣]/.test(m.effect)));
});
test('속성별 티어를 선택할 수 있고 높은 단계 순서로 표시한다',()=>{
 const base=baseById.daggerfoot;
 const families=affixFamilies(base,100);
 assert.ok(families.length>10);
 assert.ok(families.some(f=>f.tiers.length>1));
 for(const family of families){
   assert.ok(family.tiers.every((t,i)=>i===0||t.level<=family.tiers[i-1].level));
   assert.ok(family.tiers.every(t=>modsForBase(base,100).some(m=>m.id===t.id)));
 }
});
test('징조 45종과 심연 제작 재료 11종이 한글로 로드되고 미구현은 소모를 막는다',()=>{
 assert.equal(omens.length,45);assert.equal(abyssCraftingMaterials.length,11);
 assert.ok(omens.filter(o=>o.implemented).length===6);
 assert.ok(omens.every(o=>/[가-힣]/.test(o.name)));
 assert.ok(abyssCraftingMaterials.some(x=>x.name==='보존된 빗장뼈'));
});
test('아이템 옵션 수치 텍스트와 시도 로그의 전후 상태가 세션 저장에 보존된다',()=>{
 const base=bases.find(b=>b.category==='ring'&&b.sourceName==='Iron Ring');
 const r=applyOrb(blank(base),'transmute',()=>0).state;
 const restored=parseSession(serializeSession(r));
 assert.deepEqual(restored.mods,r.mods);
 assert.deepEqual(restored.log,r.log);
 assert.equal(restored.usage.transmute,1);
});

test('일반 베이스마다 부여 가능한 속성 후보가 존재하는지 검증',()=>{
 const uncovered=bases.filter(b=>b.id!=='custom_boots'&&modsForBase(b,100).length===0);
 assert.equal(uncovered.length,0,'속성 후보가 없는 베이스 '+uncovered.length+'개: '+uncovered.slice(0,20).map(x=>x.id).join(', '));
});
