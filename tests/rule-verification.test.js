import test from 'node:test';
import assert from 'node:assert/strict';
import { bases, orbs } from '../data/demo.js';
import { essenceCatalogue } from '../data/poe2db-essences.js';
import { essenceVerifiedKinds } from '../data/poe2db-essence-affixes.js';
import { applyEssence,applyOrb,makeInitial,modById } from '../src/engine.js';
import { essenceModFor,essenceModsFor,essenceOptionFor } from '../src/essences.js';
import { modsForBase } from '../src/affixes.js';
import { isMartialWeapon,isMeleeWeapon,isCasterWeapon } from '../src/equipment-rules.js';

const zero=()=>0;
const base=(category,subType)=>bases.find(b=>b.category===category&&
  (!subType||b.subType===subType)&&b.requiredLevel>=1);
const item=(b,rarity='normal',mods=[])=>({...makeInitial(),baseId:b.id,itemLevel:100,
  rarity,mods:mods.map(m=>({id:m.id,fractured:false})),goals:[],
  locked:true,omenId:null,usage:{},log:[],attempts:0,corrupted:false});

test('PoE2DB 무도 무기 정의는 활·쇠뇌·부적·육척봉을 포함하고 주문 지팡이는 제외한다',()=>{
  for(const category of ['axe','bow','crossbow','talisman'])
    assert.equal(isMartialWeapon(base(category)),true,category);
  assert.equal(isMartialWeapon(base('staff','Warstaff')),true);
  assert.equal(isMeleeWeapon(base('staff','Warstaff')),true);
  assert.equal(isMartialWeapon(base('staff','Staff')),false);
  assert.equal(isMeleeWeapon(base('staff','Staff')),false);
  assert.equal(isCasterWeapon(base('staff','Staff')),true);
  assert.equal(isCasterWeapon(base('staff','Warstaff')),false);
});

test('무도 무기 대상 전투의 에센스는 활·쇠뇌·육척봉에서 동작하고 주문 지팡이는 거절한다',()=>{
  const essence=essenceCatalogue.find(e=>e.name==='전투의 에센스');
  for(const b of [base('bow'),base('crossbow'),base('staff','Warstaff'),base('talisman')]){
    assert.ok(essenceOptionFor(b,essence),b.sourceName);
    const r=applyEssence(item(b,'magic'),essence.id,zero);
    assert.equal(r.ok,true,`${b.sourceName}: ${r.reason}`);
    assert.equal(r.state.rarity,'rare');
  }
  assert.equal(essenceOptionFor(base('staff','Staff'),essence),null);
  assert.equal(essenceOptionFor(base('wand'),essence),null);
});

test('신비학자의 식각기·대장장이의 숫돌은 주문 지팡이와 육척봉을 구분한다',()=>{
  const warstaff=item(base('staff','Warstaff'));
  assert.equal(applyOrb(warstaff,'whetstone',zero).ok,true);
  assert.equal(applyOrb(warstaff,'etcher',zero).ok,false);
  const caster=item(base('staff','Staff'));
  assert.equal(applyOrb(caster,'etcher',zero).ok,true);
  assert.equal(applyOrb(caster,'whetstone',zero).ok,false);
});

test('PoE2DB 검증: 풍요의 에센스의 아이템 희귀도는 접미어',()=>{
  for(const name of ['하위 풍요의 에센스','풍요의 에센스','상위 풍요의 에센스']){
    const e=essenceCatalogue.find(x=>x.name===name);
    assert.equal(essenceModFor(base('ring'),e).kind,'suffix',name);
    assert.equal(essenceModFor(base('boots'),e).kind,'suffix',name);
  }
});

test('PoE2DB 검증: 발작의 에센스 특수 속성의 접두·접미가 정확하다',()=>{
  const e=essenceCatalogue.find(x=>x.name==='발작의 에센스');
  const expected={helmet:'suffix',body:'prefix',gloves:'suffix',boots:'prefix',
    ring:'suffix',amulet:'suffix',belt:'suffix',shield:'prefix',quiver:'prefix',focus:'suffix'};
  for(const [category,kind] of Object.entries(expected))
    assert.equal(essenceModFor(base(category),e).kind,kind,category);
});

test('에센스 82종과 옵션 130개가 개별 PoE2DB 접두·접미 검증 자료에 연결돼 있다',()=>{
  assert.equal(essenceCatalogue.length,82);
  assert.equal(essenceCatalogue.reduce((n,e)=>n+e.options.length,0),130);
  for(const e of essenceCatalogue){
    const verified=essenceVerifiedKinds[e.id];
    assert.ok(verified,e.name);
    assert.equal(Object.keys(verified).length,e.options.length,e.name);
    for(let i=0;i<e.options.length;i++){
      const sides=Array.isArray(verified[i])?verified[i]:[verified[i]];
      assert.ok(sides.length>0&&sides.every(s=>['prefix','suffix'].includes(s)),e.name);
    }
  }
});

test('심연의 에센스는 실제 접두·접미 양쪽 가능, 접두어가 가득 차면 접미어에 부여',()=>{
  const b=base('boots'),essence=essenceCatalogue.find(e=>e.name==='심연의 에센스');
  assert.deepEqual(essenceModsFor(b,essence).map(m=>m.kind),['prefix','suffix']);
  const crafted=applyOrb({...item(b),omenId:'omen-of-sinistral-alchemy'},'alchemy',zero);
  assert.equal(crafted.ok,true,crafted.reason);
  assert.equal(crafted.state.mods.filter(m=>modById[m.id].kind==='prefix').length,3);
  const applied=applyEssence(crafted.state,essence.id,()=>0.99);
  assert.equal(applied.ok,true,applied.reason);
  const forced=applied.state.mods.find(m=>modById[m.id]?.essenceId===essence.id);
  assert.ok(forced);
  assert.equal(modById[forced.id].kind,'suffix');
  assert.equal(applied.state.usage[essence.id],1);
});

test('기회의 오브 파괴/보호/고유 확정 분기를 나누고 소모량을 기록한다',()=>{
  const s=item(base('boots'));
  const destroyed=applyOrb(s,'chance',()=>0.99);
  assert.equal(destroyed.ok,true);
  assert.equal(destroyed.state.destroyed,true);
  assert.equal(applyOrb(destroyed.state,'transmute').ok,false);
  const protectedResult=applyOrb({...s,omenId:'omen-of-chance'},'chance',()=>0.99);
  assert.equal(protectedResult.ok,true);
  assert.equal(protectedResult.state.destroyed||false,false);
  assert.equal(protectedResult.state.rarity,'normal');
  assert.equal(protectedResult.state.usage['omen-of-chance'],1);
  const unique=applyOrb({...s,omenId:'omen-of-the-ancients'},'chance',()=>0.99);
  assert.equal(unique.ok,true);
  assert.equal(unique.state.rarity,'unique');
  assert.equal(unique.state.usage['omen-of-the-ancients'],1);
});

const graded=orbs.filter(o=>['transmute','augment','regal','exalt','chaos'].includes(o.action));
for(const orb of graded){
  test(`${orb.name}: 등급 전환·최소 속성 레벨·재료 소모 검증`,()=>{
    const b=base('boots'),existing=modsForBase(b,100)[0];
    const rarity=({transmute:'normal',augment:'magic',regal:'magic',
      exalt:'rare',chaos:'rare'})[orb.action];
    const mods=['augment','regal','chaos'].includes(orb.action)?[existing]:[];
    const s=item(b,rarity,mods);
    const r=applyOrb(s,orb.id,zero);
    assert.equal(r.ok,true,`${orb.name}: ${r.reason}`);
    assert.equal(r.state.usage[orb.id],1);
    assert.equal(r.state.log.at(-1).success,true);
    // Chaos can randomly replace a modifier with another roll of the same ID.
    const added=orb.action==='chaos'?r.state.mods:
      r.state.mods.filter(m=>!mods.some(x=>x.id===m.id));
    assert.ok(added.length>0,`${orb.name} 추가 속성 누락`);
    for(const m of added)assert.ok(modById[m.id].level>=orb.minModLevel,orb.name);
    const bad=applyOrb(item(b,'normal'),orb.id,zero);
    if(orb.action!=='transmute'){
      assert.equal(bad.ok,false,`${orb.name} 일반 등급에서 거부되어야 함`);
      assert.equal(bad.state.usage[orb.id]||0,0);
    }
  });
}

// Every option of every imported essence must work on at least one real base.
// This is catalogue-wide runtime coverage, not proof of game spawn odds.
for(const essence of essenceCatalogue)for(const [optionIndex,option] of essence.options.entries()){
  test(`${essence.name} [${optionIndex+1}]: ${option.target} 부위에 적용`,()=>{
    const replacement=essence.action.includes('희귀 아이템에서');
    const candidates=bases.filter(b=>b.id!=='custom_boots'&&essenceOptionFor(b,essence)===option);
    assert.ok(candidates.length>0,`${essence.name}: ${option.target} 사용 대상 없음`);
    let success=null;
    for(const b of candidates){
      const regular=modsForBase(b,100);
      const starting=replacement?regular.slice(0,1):[];
      const s=item(b,replacement?'rare':'magic',starting);
      if(!replacement||starting.length){
        const r=applyEssence(s,essence.id,zero);
        if(r.ok){success=r;break;}
      }
      // Failure on a single specific base is not proof that all targets fail.
    }
    assert.ok(success,`${essence.name}의 모든 등록 대상에서 적용 실패`);
    assert.equal(success.state.usage[essence.id],1);
    assert.ok(success.state.mods.some(m=>modById[m.id]?.essenceId===essence.id));
  });
}
