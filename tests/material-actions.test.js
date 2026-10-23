import test from 'node:test';
import assert from 'node:assert/strict';
import { bases } from '../data/demo.js';
import { applyCatalyst,applyOrb,previewCurrency,validateStart } from '../src/engine.js';
import { catalysts } from '../data/catalysts.js';
import { qualityCap,slotLimits,augmentSocketCap } from '../src/equipment-rules.js';
import { serializeSession,parseSession } from '../src/session.js';

const base=category=>bases.find(x=>x.category===category&&x.requiredLevel>=1);
const state=(b,rarity='normal')=>({baseId:b.id,itemLevel:Math.max(1,b.requiredLevel),rarity,
  mods:[],goals:[],catalystType:null,catalystQuality:0,quality:0,sockets:0,
  locked:true,omenId:null,usage:{},log:[],attempts:0});

test('반지 기폭제는 사용마다 품질과 재료 소모량을 갱신하고 다른 유형이면 교체한다',()=>{
  const ring=base('ring');const first=catalysts[0],second=catalysts[1];
  let s=applyCatalyst(state(ring),first.id).state;
  assert.equal(s.catalystType,first.id);assert.ok(s.catalystQuality>0);
  assert.equal(s.usage[first.id],1);
  const initialGain=s.catalystQuality;
  const a=applyCatalyst(s,first.id);assert.ok(a.ok);
  s=applyCatalyst(a.state,second.id).state;
  assert.equal(s.catalystType,second.id);
  assert.equal(s.usage[second.id],1);
  assert.equal(s.catalystQuality,initialGain);
  assert.deepEqual(parseSession(serializeSession(s)).usage,s.usage);
});

test('반지가 아닌 장비는 기폭제를 거절하고 사용량을 늘리지 않는다',()=>{
  const result=applyCatalyst(state(base('boots')),catalysts[0].id);
  assert.equal(result.ok,false);assert.deepEqual(result.state.usage,{});
});

test('방어구 장인의 고철과 숙련공의 오브는 대상과 최대 홈을 검사한다',()=>{
  const boots=base('boots');let s=state(boots);
  const quality=applyOrb(s,'armour-scrap');assert.equal(quality.ok,true);
  assert.ok(quality.state.quality>0);
  assert.equal(applyOrb(s,'whetstone').ok,false);
  const socket=applyOrb(s,'artificer');assert.equal(socket.ok,true);
  assert.equal(socket.state.sockets,1);
  assert.equal(applyOrb(socket.state,'artificer').ok,false);
  assert.equal(augmentSocketCap(boots),1);
});

test('두손 장비 및 갑옷은 일반 증강물 홈 2개까지 추가한다',()=>{
  const armour=base('body');let s=state(armour);
  assert.equal(augmentSocketCap(armour),2);
  s=applyOrb(s,'artificer').state;
  s=applyOrb(s,'artificer').state;
  assert.equal(s.sockets,2);assert.equal(s.usage.artificer,2);
  assert.equal(applyOrb(s,'artificer').ok,false);
  assert.equal(qualityCap(bases.find(x=>x.sourceName==='Breach Ring')),40);
});

test('특수 반지 고정 속성이 접두·접미 개수 제한을 변경한다',()=>{
  const dusk=bases.find(x=>x.sourceName==='Dusk Ring');
  const penumbra=bases.find(x=>x.sourceName==='Penumbra Ring');
  assert.deepEqual(slotLimits(dusk,'rare'),{prefix:4,suffix:2});
  assert.deepEqual(slotLimits(penumbra,'rare'),{prefix:5,suffix:1});
  assert.equal(validateStart(state(penumbra,'rare')),null);
});

test('칼란드라의 거울은 원본을 유지하고 변경 불가능한 복제본을 생성한다',()=>{
  const s=state(base('boots'));
  const result=applyOrb(s,'mirror');
  assert.equal(result.ok,true);
  assert.deepEqual(result.state.mods,s.mods);
  assert.equal(result.state.mirroredCopies.length,1);
  assert.equal(result.state.mirroredCopies[0].mirrored,true);
  assert.equal(result.state.usage.mirror,1);
  assert.deepEqual(parseSession(serializeSession(result.state)).mirroredCopies,result.state.mirroredCopies);
  const bad=applyOrb({...s,corrupted:true},'mirror');assert.equal(bad.ok,false);
});

test('히네코라의 머리카락으로 예측한 결과가 다음 동일 오브에 재현된다',()=>{
  const s=state(base('boots'));
  const future=previewCurrency(s,'transmute',123456);
  assert.equal(future.ok,true);
  assert.equal(future.state.usage['hinekoras-lock'],1);
  assert.ok(future.state.prediction);
  const preserved=parseSession(serializeSession(future.state));
  const applied=applyOrb(preserved,'transmute',()=>0.99);
  assert.equal(applied.ok,true);
  assert.equal(applied.state.prediction,null);
  assert.equal(applied.state.log.at(-1).detail,future.state.prediction.detail);
  assert.equal(applied.state.usage.transmute,1);
  assert.equal(previewCurrency(future.state,'transmute').ok,false);
});

test('바알 오브가 타락 부여, 속성 재추첨, 홈 추가 경로를 구분한다',()=>{
  const s=state(base('boots'));
  const unchanged=applyOrb(s,'vaal',()=>0);
  assert.equal(unchanged.state.corrupted,true);
  assert.match(unchanged.state.notice,/추가 변화 없이 타락/);
  const sockets=applyOrb(s,'vaal',()=>0.99);
  assert.equal(sockets.state.sockets,1);
  assert.equal(sockets.state.corrupted,true);
  assert.equal(applyOrb(sockets.state,'vaal').ok,false);
});
