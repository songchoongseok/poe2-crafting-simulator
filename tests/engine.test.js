import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInitial, validateStart, setInitial, applyOrb, toggleOmen, modById } from '../src/engine.js';

const rollFirst = () => 0;
const setup = (rarity, ids=[]) => ({...makeInitial(), rarity, mods:ids.map(id=>({id, fractured:false})), omenId:null, usage:{}, log:[], attempts:0, locked:false, notice:''});

const next = (state,orb) => applyOrb(state,orb,rollFirst);

test('초기 설정: 일반/마법/희귀, 옵션 자리를 검증',()=>{
  assert.match(validateStart(setup('normal',['fire42'])),/일반 아이템/);
  assert.equal(validateStart(setup('magic',['fire42','movement35'])),null);
  assert.match(validateStart(setup('magic',['fire42','cold38'])),/접미어/);
  assert.equal(validateStart(setup('rare',['fire42','cold38','light41'])),null);
});

test('최소 레벨 미달 속성 등록 금지',()=>{
  const s={...setup('magic',[]),itemLevel:81};
  assert.match(setInitial(s,{mods:[{id:'movement35',fractured:false}]}).reason,/레벨/);
});

test('같은 속성/그룹은 중복할 수 없다',()=>{
  assert.match(validateStart(setup('rare',['fire42','fire42'])),/중복/);
});

test('기존 옵션 등록은 제작 재료를 소모하지 않는다',()=>{
  const s=setup('rare',[]);
  const r=setInitial(s,{mods:[{id:'movement35',fractured:false}]});
  assert.equal(r.ok,true);assert.deepEqual(r.state.usage,{});assert.equal(r.state.log.length,0);
});

test('진화의 오브는 일반에서 마법으로 승급하고 오브 1회 집계',()=>{
  const r=next(setup('normal'),'transmute');
  assert.equal(r.ok,true);assert.equal(r.state.rarity,'magic');assert.equal(r.state.mods.length,1);
  assert.equal(r.state.usage.transmute,1);assert.equal(r.state.log.length,1);
});

test('확장의 오브는 마법 1속성에 1속성을 누적 추가',()=>{
  const r=next(setup('magic',['fire42']),'augment');
  assert.equal(r.ok,true);assert.equal(r.state.mods.length,2);
  assert.equal(r.state.mods[0].id,'fire42');assert.equal(r.state.usage.augment,1);
  assert.equal(r.state.locked,true);
});

test('확장의 오브 불가 조건은 원본 속성·사용량을 유지',()=>{
  const s=setup('magic',['fire42','movement35']);
  const r=next(s,'augment');
  assert.equal(r.ok,false);assert.deepEqual(r.state.mods,s.mods);
  assert.deepEqual(r.state.usage,{});assert.match(r.reason,/1개/);
  assert.equal(r.state.log.length,1);assert.equal(r.state.log[0].success,false);
});

test('제왕의 오브로 희귀 승급 후 엑잘티드 오브는 속성 추가',()=>{
  const r=next(setup('magic',['fire42']),'regal');
  assert.equal(r.ok,true);assert.equal(r.state.rarity,'rare');assert.equal(r.state.mods.length,2);
  const rr=next(r.state,'exalt');
  assert.equal(rr.ok,true);assert.equal(rr.state.mods.length,3);assert.equal(rr.state.usage.exalt,1);
});

test('카오스 오브는 변경 후에도 속성 개수를 유지',()=>{
  const r=next(setup('rare',['fire42']),'chaos');
  assert.equal(r.ok,true);assert.equal(r.state.mods.length,1);assert.equal(r.state.usage.chaos,1);
});

test('분열된 속성은 소멸 대상에서 제외',()=>{
  const s=setup('rare',['fire42','movement35']);s.mods[1].fractured=true;
  const r=next(s,'annul');
  assert.equal(r.ok,true);assert.deepEqual(r.state.mods.map(x=>x.id),['movement35']);
});

test('징조 활성화는 소모량 0, 연동 오브에서만 징조 소모',()=>{
  const s=setup('rare',['fire42','movement35']);
  const activated=toggleOmen(s,'left_annul');
  assert.equal(activated.state.omenId,'left_annul');assert.deepEqual(activated.state.usage,{});
  const r=next(activated.state,'annul');
  assert.equal(r.ok,true);assert.equal(r.state.omenId,null);
  assert.equal(r.state.usage.left_annul,1);assert.equal(r.state.usage.annul,1);
  assert.deepEqual(r.state.mods.map(x=>x.id),['fire42']);
});

test('징조 조건이 충족되지 않으면 오브·징조 미소모',()=>{
  const s=toggleOmen(setup('rare',['fire42']),'left_annul').state;
  const r=next(s,'annul');
  assert.equal(r.ok,false);assert.equal(r.state.omenId,'left_annul');assert.deepEqual(r.state.usage,{});
});

test('오브 사용 후에는 시작 옵션을 임의 수정할 수 없다',()=>{
  const s=next(setup('magic',['fire42']),'augment').state;
  const r=setInitial(s,{mods:[]});assert.equal(r.ok,false);
});

test('모든 6속성이 붙은 희귀 아이템은 엑잘티드 오브 사용 불가',()=>{
  const s=setup('rare',['movement35','life135','defense65','fire42','cold38','light41']);
  const r=next(s,'exalt');assert.equal(r.ok,false);assert.deepEqual(r.state.usage,{});
});
