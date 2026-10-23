import { abyssPools1 } from '../data/abyss-pools-1.js';
import { abyssPools2 } from '../data/abyss-pools-2.js';
import { abyssPools3 } from '../data/abyss-pools-3.js';
import { abyssPools4 } from '../data/abyss-pools-4.js';
import { abyssCraftingMaterials, omens } from '../data/demo.js';
import { modClassOf, groupsOf, allRealMods, modsForBase } from './affixes.js';
import { modifiers as legacyMods } from '../data/demo.js';

const pools={...abyssPools1,...abyssPools2,...abyssPools3,...abyssPools4};
export const boneById=Object.fromEntries(abyssCraftingMaterials.map(x=>[x.id,x]));
const omenNames=Object.fromEntries(omens.map(x=>[x.id,x.name]));
export const abyssMods=Object.values(pools).flatMap(group=>[...group.normal,...group.breach])
  .reduce((acc,m)=>{acc[m.id]={...m,desecrated:true,source:'GGPK-Abyss'};return acc},Object.create(null));
export const HIDDEN_PREFIX='abyss:hidden:prefix',HIDDEN_SUFFIX='abyss:hidden:suffix';
export const hiddenMods={
  [HIDDEN_PREFIX]:{id:HIDDEN_PREFIX,kind:'prefix',level:1,name:'미공개 훼손 접두어',
    effect:'미공개 훼손 접두어 · 영혼의 우물에서 공개',group:['abyss_hidden']},
  [HIDDEN_SUFFIX]:{id:HIDDEN_SUFFIX,kind:'suffix',level:1,name:'미공개 훼손 접미어',
    effect:'미공개 훼손 접미어 · 영혼의 우물에서 공개',group:['abyss_hidden']}
};
for(const kind of ['prefix','suffix'])for(let n=1;n<=3;n++){
  const id=`abyss:hidden:${kind}:${n}`;
  hiddenMods[id]={id,kind,level:1,name:`미공개 훼손 ${kind==='prefix'?'접두어':'접미어'} ${n}`,
    effect:`미공개 훼손 ${kind==='prefix'?'접두어':'접미어'} · 영혼의 우물에서 공개`,group:[id]};
}
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=(items,rng)=>items[Math.min(items.length-1,Math.max(0,Math.floor(rng()*items.length)))];
function fail(state,name,reason){
  const next=clone(state);next.notice='사용 불가: '+reason;
  next.log.push({order:next.log.length+1,action:name,success:false,detail:reason});
  return {state:next,ok:false,reason};
}
function success(state,name,mods,detail,spent,omenUsed,patch={}){
  const s=clone(state);s.mods=mods;s.attempts=(s.attempts||0)+1;s.locked=true;s.prediction=null;
  s.usage[spent]=(s.usage[spent]||0)+1;
  if(omenUsed){s.usage[omenUsed]=(s.usage[omenUsed]||0)+1;s.omenId=null}
  Object.assign(s,patch);
  s.log.push({order:s.log.length+1,action:name,success:true,detail,
    omen:omenUsed?omenNames[omenUsed]:null,stateAfter:{rarity:s.rarity,mods:clone(mods)}});
  s.notice=name+': '+detail;return {state:s,ok:true};
}
export function isBoneForBase(base,boneId){
  if(!base || !boneId)return false;
  if(boneId==='essence-of-the-abyss')return false;
  if(boneId.includes('jawbone'))return base.group==='무기'||base.category==='quiver';
  if(boneId.includes('rib'))return base.group==='방어구';
  if(boneId.includes('collarbone'))return ['ring','amulet','belt'].includes(base.category);
  return false;
}
export function abyssPoolFor(base,boneId){
  const group=pools[modClassOf(base)];
  if(!group)return [];
  return [...group.normal,...(boneId==='altered-collarbone'?group.breach:[])];
}
export function hasDesecration(mods){
  return mods.some(m=>m.desecrated||m.id.startsWith('abyss:hidden:')||
    Boolean(abyssMods[m.id]));
}
export function hiddenKind(mod){
  return mod.id.startsWith('abyss:hidden:prefix')?'prefix':
    mod.id.startsWith('abyss:hidden:suffix')?'suffix':null;
}
const kindOf=m=>m.kind||hiddenKind(m)||abyssMods[m.id]?.kind||allRealMods[m.id]?.kind||legacyMods.find(x=>x.id===m.id)?.kind||null;
const necromancy={ 'omen-of-sinistral-necromancy':'prefix','omen-of-dextral-necromancy':'suffix' };
const factions={'omen-of-the-sovereign':'ulaman','omen-of-the-liege':'amanamu',
  'omen-of-the-blackblooded':'kurgal'};
function pickOffers(pool,rng,count=3){
  const remaining=[...pool],chosen=[];
  while(remaining.length&&chosen.length<count){
    const selected=sample(remaining,rng);chosen.push(selected);
    remaining.splice(remaining.findIndex(m=>m.id===selected.id),1);
  }
  return chosen.map(m=>m.id);
}
export function applyBone(state,base,boneId,rng=Math.random){
  const material=boneById[boneId];
  if(!material)return fail(state,boneId,'등록되지 않은 심연 재료입니다.');
  if(boneId==='essence-of-the-abyss')
    return fail(state,material.name,'심연의 에센스는 에센스 제작 메뉴에서 사용하세요.');
  if(!isBoneForBase(base,boneId))
    return fail(state,material.name,'이 재료는 해당 장비 종류에 사용할 수 없습니다.');
  if(!state.locked)return fail(state,material.name,'제작하기 버튼으로 먼저 시작 아이템을 확정하세요.');
  if(state.rarity!=='rare')return fail(state,material.name,'심연 뼈는 희귀 장비에만 사용 가능합니다.');
  if(state.corrupted)return fail(state,material.name,'타락된 장비에는 이 작업을 지원하지 않습니다.');
  if(state.sanctified)return fail(state,material.name,'축성된 장비에는 더 이상 훼손 작업을 할 수 없습니다.');
  const omen=state.omenId;
  if(hasDesecration(state.mods)&&omen!=='omen-of-putrefaction')return fail(state,material.name,'이미 훼손 속성이 있는 장비에는 다시 훼손할 수 없습니다.');
  if(boneId.startsWith('gnawed-')&&state.itemLevel>64)
    return fail(state,material.name,'갉힌 뼈는 아이템 레벨 64 이하만 사용할 수 있습니다.');
  const kindRestriction=necromancy[omen]||null,faction=factions[omen]||null;
  if(omen==='omen-of-putrefaction'){
    const mods=clone(state.mods.filter(m=>m.fractured));
    const pool=modsForBase(base,state.itemLevel);
    const entries=[];
    for(const kind of ['prefix','suffix']){
      const reserved=mods.filter(m=>kindOf(m)===kind).length;
      for(let n=1;n<=3-reserved;n++){
        const id=`abyss:hidden:${kind}:${n}`;
        const candidates=pool.filter(m=>m.kind===kind&&!mods.some(x=>{
          const existing=allRealMods[x.id]||legacyMods.find(y=>y.id===x.id);
          return existing&&groupsOf(existing).some(g=>groupsOf(m).includes(g));
        }));
        if(candidates.length<3)return fail(state,material.name,'훼손 공개 후보가 3개보다 적어 실행할 수 없습니다.');
        mods.push({id,fractured:false,desecrated:true,unrevealed:true});
        entries.push({slotId:id,boneId,kind,offers:pickOffers(candidates,rng),
          allowedIds:candidates.map(m=>m.id),revealed:false,rerolled:false});
      }
    }
    return success(state,material.name,mods,`${entries.length}개 미공개 속성 생성 / 아이템 타락`,
      boneId,omen,{desecration:null,desecrations:entries,corrupted:true});
  }
  if(faction&&base.group==='방어구')
    return fail(state,material.name,'해당 징조의 세력 강제 효과는 이 방어구에 적용할 수 없습니다.');
  // At the Well of Souls both ordinary and abyss-exclusive affixes may be offered.
  // These are *unweighted* candidates; game-real probabilities are not yet known.
  const special=abyssPoolFor(base,boneId), normal=modsForBase(base,state.itemLevel);
  const available=[...special,...normal].filter(m=>
    (!kindRestriction||m.kind===kindRestriction)&&(!faction||m.faction===faction)&&
    (!boneId.startsWith('ancient-')||m.level>=40));
  const candidates=available.filter(m=>!state.mods.some(x=>{
    const def=abyssMods[x.id]||allRealMods[x.id]||legacyMods.find(row=>row.id===x.id);
    return def&&groupsOf(def).some(g=>groupsOf(m).includes(g));
  }));
  const kinds=[...new Set(candidates.map(m=>m.kind))].filter(kind=>
    state.mods.filter(m=>kindOf(m)===kind).length<3||
    state.mods.length>=6);
  if(!kinds.length)return fail(state,material.name,'훼손 속성을 추가할 수 있는 자리가 없습니다.');
  const kind=sample(kinds,rng);
  const pool=candidates.filter(m=>m.kind===kind);
  if(pool.length<3)return fail(state,material.name,'공개할 훼손 속성 후보가 세 가지보다 적습니다.');
  const mods=clone(state.mods);
  let removed=null;
  if(mods.filter(m=>kindOf(m)===kind).length>=3){
    // When the relevant side is full, a removable mod on that same side must make room.
    const valid=mods.filter(m=>!m.fractured&&!m.desecrated && kindOf(m)===kind);
    if(!valid.length)return fail(state,material.name,'해당 접두·접미 영역에 제거 가능한 속성이 없습니다.');
    removed=sample(valid,rng);mods.splice(mods.indexOf(removed),1);
  }
  mods.push({id:kind==='prefix'?HIDDEN_PREFIX:HIDDEN_SUFFIX,fractured:false,desecrated:true,unrevealed:true});
  const nextData={boneId,kind,offers:pickOffers(pool,rng),revealed:false,rerolled:false,
    allowedIds:pool.map(m=>m.id)};
  const consume=kindRestriction||faction?omen:null;
  const detail=[removed?'기존 속성 1개 제거':'',kind==='prefix'?'미공개 훼손 접두어 추가':'미공개 훼손 접미어 추가',
    '영혼의 우물에서 세 가지 중 하나를 선택하세요'].filter(Boolean).join(' / ');
  return success(state,material.name,mods,detail,boneId,consume,{desecration:nextData});
}
export function revealDesecration(state,optionId,rng=Math.random){
  if(state.desecrations?.some(d=>!d.revealed))return revealBatchDesecration(state,optionId,rng);
  if(!state.locked)return fail(state,'영혼의 우물','제작을 시작해야 합니다.');
  const data=state.desecration;
  if(!data||data.revealed||!Array.isArray(data.offers))
    return fail(state,'영혼의 우물','공개할 미공개 훼손 속성이 없습니다.');
  if(!data.offers.includes(optionId))return fail(state,'영혼의 우물','현재 선택지에 없는 속성입니다.');
  const mod=abyssMods[optionId]||allRealMods[optionId];if(!mod)return fail(state,'영혼의 우물','확인되지 않은 훼손 속성입니다.');
  const id=data.kind==='prefix'?HIDDEN_PREFIX:HIDDEN_SUFFIX,mods=clone(state.mods);
  const pos=mods.findIndex(x=>x.id===id);
  if(pos<0)return fail(state,'영혼의 우물','미공개 속성 자리를 찾지 못했습니다.');
  const shown=mod.effect.replace(/\((-?\d+)-(-?\d+)\)/g,(_,a,b)=>{
    const lo=Number(a),hi=Number(b);return String(Math.min(lo,hi)+Math.floor(rng()*(Math.abs(hi-lo)+1)));
  });
  mods[pos]={id:mod.id,fractured:false,desecrated:true,unrevealed:false,valueText:shown,kind:mod.kind};
  const s=clone(state);s.mods=mods;s.prediction=null;s.desecration={...data,revealed:true,offers:[]};
  s.log.push({order:s.log.length+1,action:'영혼의 우물',success:true,detail:'공개: '+shown,
    stateAfter:{rarity:s.rarity,mods:clone(mods)}});s.notice='훼손 속성 공개: '+shown;
  return {state:s,ok:true};
}
function revealBatchDesecration(state,optionId,rng){
  const s=clone(state),entries=s.desecrations;s.prediction=null;
  const entry=entries.find(d=>!d.revealed);
  if(!entry||!entry.offers.includes(optionId))return fail(state,'영혼의 우물','현재 선택지에 없는 속성입니다.');
  const mod=allRealMods[optionId]||abyssMods[optionId];
  if(!mod)return fail(state,'영혼의 우물','확인되지 않은 속성입니다.');
  const position=s.mods.findIndex(x=>x.id===entry.slotId);
  if(position<0)return fail(state,'영혼의 우물','미공개 속성 자리가 없습니다.');
  if(s.mods.some((x,i)=>i!==position&&groupsOf(allRealMods[x.id]||abyssMods[x.id]).some(g=>groupsOf(mod).includes(g))))
    return fail(state,'영혼의 우물','이미 공개된 속성과 그룹이 겹칩니다. 다른 선택지를 선택하세요.');
  const shown=mod.effect.replace(/\((-?\d+)[-—](-?\d+)\)/g,(_whole,a,b)=>
    String(Number(a)+Math.floor(rng()*(Number(b)-Number(a)+1))));
  s.mods[position]={id:mod.id,fractured:false,desecrated:true,unrevealed:false,
    valueText:shown,kind:mod.kind};
  entry.revealed=true;entry.offers=[];
  const next=entries.find(d=>!d.revealed);
  if(next){
    const candidates=next.allowedIds.map(id=>allRealMods[id]||abyssMods[id]).filter(m=>m&&
      !s.mods.some(x=>groupsOf(allRealMods[x.id]||abyssMods[x.id]).some(g=>groupsOf(m).includes(g))));
    next.offers=pickOffers(candidates,rng);
  }
  s.log.push({order:s.log.length+1,action:'영혼의 우물',success:true,detail:'공개: '+shown,
    stateAfter:{rarity:s.rarity,mods:clone(s.mods)}});
  s.notice=`훼손 속성 공개: ${shown} (남은 수 ${entries.filter(d=>!d.revealed).length})`;
  return {state:s,ok:true};
}
export function rerollDesecration(state,rng=Math.random){
  const d=state.desecrations?.find(x=>!x.revealed)||state.desecration,name='심연의 메아리의 징조';
  if(!d || d.revealed)return fail(state,name,'다시 추첨할 미공개 속성이 없습니다.');
  if(d.rerolled)return fail(state,name,'이 훼손 속성은 이미 한 번 다시 추첨했습니다.');
  if(state.omenId!=='omen-of-abyssal-echoes')
    return fail(state,name,'먼저 심연의 메아리의 징조를 활성화하세요.');
  const pool=d.allowedIds.map(id=>abyssMods[id]||allRealMods[id]).filter(Boolean);
  if(pool.length<3)return fail(state,name,'다시 추첨할 후보가 부족합니다.');
  const s=clone(state);
  if(s.desecrations?.some(x=>!x.revealed)){
    const active=s.desecrations.find(x=>!x.revealed);
    active.offers=pickOffers(pool,rng);active.rerolled=true;
  }else s.desecration={...d,offers:pickOffers(pool,rng),rerolled:true};
  s.usage[s.omenId]=(s.usage[s.omenId]||0)+1;s.omenId=null;
  s.log.push({order:s.log.length+1,action:name,success:true,detail:'훼손 공개 후보 세 가지 다시 추첨',omen:name});
  s.notice='훼손 공개 후보를 다시 추첨했습니다.';return {state:s,ok:true};
}
