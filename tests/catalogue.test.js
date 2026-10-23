import test from 'node:test';
import assert from 'node:assert/strict';
import { bases } from '../data/demo.js';
import {makeInitial,setInitial,applyOrb,baseById} from '../src/engine.js';
import { parseSession,serializeSession } from '../src/session.js';
import {categoryOptions,subtypeOptions,filterBases,supportsDemoCrafting,describeBase} from '../src/catalogue.js';

test('PoB2 베이스: 1400개 이상, 주요 장비 카테고리 모두 존재',()=>{
  assert.ok(bases.length>=1474);
  assert.equal(new Set(bases.map(b=>b.id)).size,bases.length,'베이스 ID 중복');
  for(const cat of ['helmet','body','gloves','boots','shield','focus','sword','axe','staff','wand','mace','ring','amulet','belt','quiver']){
    assert.ok(bases.some(b=>b.category===cat),'누락: '+cat);
  }
  assert.equal(bases.some(b=>b.category==='jewel'||b.category==='flask'),false);
});

test('단검발 신발은 PoB2 기본 수치·요구 레벨 보존',()=>{
  const b=baseById.daggerfoot;
  assert.equal(b.sourceName,'Daggerfoot Shoes');
  assert.equal(b.armour.Evasion,140);
  assert.equal(b.armour.EnergyShield,43);
  assert.equal(b.requiredLevel,80);
  assert.match(describeBase(b),/회피 140/);
});

test('대분류와 종류에 따라 리스트가 구분됨',()=>{
  assert.ok(categoryOptions('방어구').includes('boots'));
  assert.ok(categoryOptions('장신구').includes('ring'));
  assert.ok(!categoryOptions('무기').includes('ring'));
  assert.ok(subtypeOptions('방어구','boots').includes('Evasion/Energy Shield'));
  const boots=filterBases({group:'방어구',category:'boots',subType:'Evasion/Energy Shield'});
  assert.ok(boots.some(b=>b.id==='daggerfoot'));
  assert.ok(boots.every(b=>b.category==='boots'&&b.subType==='Evasion/Energy Shield'));
});

test('베이스 원문과 한국어명 검색 가능',()=>{
  assert.ok(filterBases({group:'방어구',category:'boots',query:'Daggerfoot'}).some(b=>b.id==='daggerfoot'));
  assert.ok(filterBases({group:'방어구',category:'boots',query:'단검발'}).some(b=>b.id==='daggerfoot'));
  assert.ok(filterBases({group:'장신구',category:'ring',query:'iron ring'}).some(b=>b.sourceName==='Iron Ring'));
  assert.deepEqual(filterBases({group:'장신구',category:'ring',query:'not_real_item_zz'}),[]);
});

test('베이스를 바꿔 초기화하면 선택 및 세션 저장에 반영',()=>{
  const initial=makeInitial();
  const ring=bases.find(b=>b.category==='ring'&&b.sourceName==='Iron Ring');
  assert.ok(ring);
  const changed=setInitial(initial,{baseId:ring.id,mods:[],goals:[]});
  assert.equal(changed.ok,true);
  assert.equal(changed.state.baseId,ring.id);
  assert.equal(changed.state.mods.length,0);
  assert.equal(parseSession(serializeSession(changed.state)).baseId,ring.id);
});

test('미지원 장비에는 신발 속성이 추가되지 않으며 오브 미소모',()=>{
  const ring=bases.find(b=>b.category==='ring'&&b.sourceName==='Iron Ring');
  const s={...makeInitial(),baseId:ring.id,rarity:'normal',mods:[]};
  assert.equal(supportsDemoCrafting(ring),false);
  assert.equal(setInitial(s,{mods:[{id:'movement35',fractured:false}]}).ok,false);
  const r=applyOrb(s,'transmute',()=>0);
  assert.equal(r.ok,false);
  assert.deepEqual(r.state.usage,{});
  assert.deepEqual(r.state.mods,[]);
  assert.match(r.reason,/미검증|차단/);
});
