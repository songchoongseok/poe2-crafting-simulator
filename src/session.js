import { makeInitial, validateStart, modById, orbById, omenById, setGoals } from './engine.js';
export const SESSION_VERSION = 1;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const counter = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;
export function serializeSession(state) {
  return JSON.stringify({schema:'poe2-craft-session',version:SESSION_VERSION,mode:'UNVERIFIED_DEMO',state},null,2);
}
export function parseSession(text) {
  if (typeof text !== 'string' || text.length > 2000000) throw Error('세션 파일이 비어 있거나 너무 큽니다.');
  let payload; try { payload=JSON.parse(text); } catch { throw Error('올바른 JSON 세션 파일이 아닙니다.'); }
  if (!object(payload)||payload.schema!=='poe2-craft-session'||payload.version!==SESSION_VERSION||!object(payload.state)) throw Error('지원하지 않는 세션 형식입니다.');
  const raw=payload.state;
  if (!Array.isArray(raw.mods)||raw.mods.length>6||raw.mods.some(m=>!object(m)||typeof m.id!=='string'||typeof m.fractured!=='boolean'||(m.valueText!==undefined&&(typeof m.valueText!=='string'||m.valueText.length>1000)))) throw Error('잘못된 속성 목록입니다.');
  const state={...makeInitial(),baseId:raw.baseId,itemLevel:raw.itemLevel,rarity:raw.rarity,
    mods:raw.mods.map(m=>({id:m.id,fractured:m.fractured,...(m.valueText===undefined?{}:{valueText:m.valueText})})),goals:[],
    omenId:raw.omenId,locked:raw.locked,attempts:raw.attempts,notice:'세션을 불러왔습니다.'};
  const invalid=validateStart(state); if(invalid)throw Error(invalid);
  if (state.omenId!==null&&!Object.hasOwn(omenById,state.omenId))throw Error('잘못된 징조입니다.');
  if(typeof state.locked!=='boolean'||!counter(state.attempts))throw Error('제작 진행 상태가 잘못됐습니다.');
  if(!object(raw.usage)||Object.entries(raw.usage).some(([id,n])=>!(Object.hasOwn(orbById,id)||Object.hasOwn(omenById,id))||!counter(n)))throw Error('사용량이 잘못됐습니다.');
  if(!Array.isArray(raw.log)||raw.log.length>10000||raw.log.some(e=>!object(e)||!counter(e.order)||typeof e.success!=='boolean'||typeof e.action!=='string'||e.action.length>100||typeof e.detail!=='string'||e.detail.length>1000||
      (e.omen!=null&&(typeof e.omen!=='string'||e.omen.length>100))||
      (e.stateAfter!==undefined&&(!object(e.stateAfter)||!['normal','magic','rare'].includes(e.stateAfter.rarity)||!Array.isArray(e.stateAfter.mods)||e.stateAfter.mods.length>6||e.stateAfter.mods.some(m=>!object(m)||!Object.hasOwn(modById,m.id)||typeof m.fractured!=='boolean'||(m.valueText!==undefined&&(typeof m.valueText!=='string'||m.valueText.length>1000))))))) throw Error('제작 로그가 잘못됐습니다.');
  state.usage=Object.fromEntries(Object.entries(raw.usage));
  state.log=raw.log.map(e=>({order:e.order,success:e.success,action:e.action,detail:e.detail,
    ...(Object.hasOwn(e,'omen')?{omen:e.omen}:{}),
    ...(e.stateAfter!==undefined?{stateAfter:{rarity:e.stateAfter.rarity,mods:e.stateAfter.mods.map(m=>({id:m.id,fractured:m.fractured,...(m.valueText===undefined?{}:{valueText:m.valueText})}))}}:{})}));
  const goals=setGoals(state,raw.goals??[]);if(!goals.ok)throw Error(goals.reason);
  return goals.state;
}
