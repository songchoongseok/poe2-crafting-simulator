import { bases, modifiers, orbs, omens } from '../data/demo.js';
import { supportsDemoCrafting } from './catalogue.js';
import { allRealMods, modsForBase, allowedMod, groupsOf, hasGroupConflict, rollAffixText } from './affixes.js';
import { abyssMods, hiddenMods, hasDesecration } from './abyss.js';
import { essenceById, essenceModFor, essenceMods } from './essences.js';
import { catalysts } from '../data/catalysts.js';

export const modById = { ...Object.fromEntries(modifiers.map(m => [m.id, m])), ...allRealMods,
  ...abyssMods,...hiddenMods,...essenceMods };
export const orbById = Object.fromEntries(orbs.map(o => [o.id, o]));
export const omenById = Object.fromEntries(omens.map(o => [o.id, o]));
export const baseById = Object.fromEntries(bases.map(b => [b.id, b]));
export const SLOT_LIMITS = Object.freeze({ normal: 0, magic: 1, rare: 3, unique: 3 });

export const clone = obj => JSON.parse(JSON.stringify(obj));
export const makeInitial = () => ({
  baseId: 'daggerfoot', itemLevel: 82, rarity: 'magic',
  mods: [{ id: 'fire42', fractured: false }], goals: ['movement35', 'life135', 'fire42', 'cold38', 'light41'], omenId: null,
  catalystType:null,catalystQuality:0,
  usage: {}, log: [], attempts: 0, locked: false, notice: '확장의 오브를 클릭해보세요.'
});

export function validateStart({ baseId, itemLevel, rarity, mods, catalystType=null, catalystQuality=0 }) {
  if (!baseById[baseId]) return '지원하지 않는 베이스입니다.';
  // Korean per-item modifier pools are checked below, including legacy demo-session mods.
  if (!Number.isInteger(itemLevel) || itemLevel < 1 || itemLevel > 100) return '아이템 레벨은 1~100 정수로 설정해 주세요.';
  if (!Object.hasOwn(SLOT_LIMITS, rarity)) return '존재하지 않는 아이템 등급입니다.';
  if(!Number.isInteger(catalystQuality)||catalystQuality<0||catalystQuality>20)
    return '기폭제 퀄리티는 0~20 사이의 정수여야 합니다.';
  if(catalystQuality>0&&(!['ring','amulet'].includes(baseById[baseId].category)||
    !catalysts.some(x=>x.id===catalystType)))
    return '기폭제 퀄리티는 종류를 지정한 반지나 목걸이에서만 사용할 수 있습니다.';
  if (rarity === 'normal' && mods.length) return '일반 아이템에는 일반 속성을 입력할 수 없습니다.';
  if (rarity === 'magic' && mods.length > 2) return '마법 아이템의 속성은 최대 2개입니다.';
  if (rarity === 'rare' && mods.length > 6) return '희귀 아이템의 일반 속성은 최대 6개입니다.';
  const keys = new Set(); const groups = new Set();
  for (const mod of mods) {
    const m = modById[mod.id], abyssal=Boolean(abyssMods[mod.id]||hiddenMods[mod.id]);
    if (!m) return `알 수 없는 속성: ${mod.id}`;
    if (!abyssal && m.level > itemLevel) return `${m.name}: 요구 아이템 레벨 ${m.level} 미달입니다.`;
    const legacy = modifiers.some(d => d.id === m.id);
    const fromEssence=Boolean(essenceMods[m.id]);
    if (!abyssal && !fromEssence && (legacy ? !supportsDemoCrafting(baseById[baseId]) : !allowedMod(baseById[baseId],m,itemLevel)))
      return `${m.name}: 해당 베이스에 부여할 수 없는 속성입니다.`;
    if(fromEssence && essenceModFor(baseById[baseId],essenceById[m.essenceId])?.id!==m.id)
      return `${m.name}: 이 베이스에 맞는 에센스 속성이 아닙니다.`;
    if (keys.has(m.id) || groupsOf(m).some(g => groups.has(g)))
      return `속성 중복 또는 그룹 충돌: ${m.name}`;
    if (rarity !== 'rare' && mod.fractured) return '시연에서는 희귀 아이템에만 분열 속성 지정이 가능합니다.';
    if(abyssal && rarity!=='rare')return '훼손 속성은 희귀 아이템에서만 유지할 수 있습니다.';
    keys.add(m.id); groupsOf(m).forEach(g => groups.add(g));
  }
  for (const kind of ['prefix', 'suffix']) {
    if (mods.filter(x => modById[x.id]?.kind === kind).length > SLOT_LIMITS[rarity]) {
      return `${kind === 'prefix' ? '접두어' : '접미어'} 자리가 가득 찼습니다.`;
    }
  }
  return null;
}

export function candidateMods(mods, itemLevel, rarity, baseId='daggerfoot', minModLevel=1) {
  const max=SLOT_LIMITS[rarity], base=baseById[baseId];
  const pool=modsForBase(base,itemLevel);
  return pool.filter(m=>m.level>=minModLevel && !mods.some(x=>x.id===m.id || hasGroupConflict(modById[x.id],m)) &&
    mods.filter(x=>modById[x.id].kind===m.kind).length<max);
}

function pick(list, rng) {
  if (!list.length) return null;
  // Uniform weights for UI demonstration ONLY.
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(rng() * list.length)))];
}
const familyPatterns=[
  ['화염',/화염|fire/i],['냉기',/냉기|cold/i],['번개',/번개|lightning/i],
  ['카오스',/카오스|chaos/i],['물리',/물리|physical/i],
  ['생명력',/생명력|life/i],['마나',/마나|mana/i],
  ['방어',/방어도|회피|에너지 보호막|armour|evasion|energyshield/i],
  ['속도',/속도|speed|velocity/i],['치명타',/치명타|critical/i]
  ,['능력치',/힘|민첩|지능|attribute|strength|dexterity|intelligence/i]
  ,['소환수',/소환수|minion/i]
];
function familyOf(mod){
  const value=(mod?.effect||mod?.name||'')+' '+(mod?.group||'');
  return familyPatterns.find(([,re])=>re.test(value))?.[0]||null;
}
function homogenisedPool(pool,existing,rng){
  const families=existing.map(m=>familyOf(modById[m.id])).filter(Boolean);
  const family=pick(families,rng);
  return family?pool.filter(m=>familyOf(m)===family):[];
}

function fail(state, action, reason) {
  const s = clone(state);
  s.notice = `사용 불가: ${reason}`;
  s.log.push({ order: s.log.length + 1, action, success: false, detail: reason });
  return { state: s, ok: false, reason };
}

function finish(state, orb, mods, rarity, detail, omenUsed, patch={}) {
  const s = clone(state);
  s.mods = mods; s.rarity = rarity;
  Object.assign(s,patch);
  if (!hasDesecration(mods)) s.desecration=null;
  s.locked = true; s.attempts++;
  s.usage[orb.id] = (s.usage[orb.id] || 0) + 1;
  if (omenUsed) {
    s.usage[omenUsed] = (s.usage[omenUsed] || 0) + 1;
    s.omenId = null;
  }
  s.log.push({ order: s.log.length + 1, action: orb.name, success: true, detail,
    omen: omenUsed ? omenById[omenUsed].name : null, stateAfter: { rarity, mods: clone(mods) } });
  s.notice = `${orb.name}: ${detail}`;
  return { state: s, ok: true };
}

export function applyOrb(state, orbId, rng = Math.random) {
  const orb = orbById[orbId];
  if (!orb) return fail(state, orbId, '알 수 없는 오브입니다.');
  if (state.destroyed) return fail(state, orb.name, '이미 파괴된 아이템에는 제작할 수 없습니다.');
  if (state.corrupted) return fail(state, orb.name, '타락한 아이템에는 일반 오브 제작을 진행할 수 없습니다.');
  if (state.rarity==='unique') return fail(state,orb.name,'고유 아이템에는 이 일반 제작 재료를 사용할 수 없습니다.');
  const valid = validateStart(state);
  if (valid) return fail(state, orb.name, `현재 아이템이 유효하지 않습니다: ${valid}`);
  // Every regular equipment class uses its PoB2 eligibility-filtered Korean affix pool.
  if(!modsForBase(baseById[state.baseId],state.itemLevel).length)
    return fail(state, orb.name, '이 베이스의 해당 아이템 레벨에 부여 가능한 속성을 확인하지 못했습니다.');
  const mods = clone(state.mods);
  const activeOmen = omenById[state.omenId];
  if(activeOmen && activeOmen.implemented && activeOmen.orbId === (orb.action||orbId) && activeOmen.kind &&
    !['prefix','suffix'].includes(activeOmen.kind))
    return fail(state,orb.name,'징조 적용 조건이 불명확합니다.');
  const action=orb.action||orbId,minLevel=orb.minModLevel||1;
  let nextRarity = state.rarity;
  let added = null, removed = null, omenUsed = null;const changes=[],patch={};
  if (action === 'transmute') {
    if (nextRarity !== 'normal') return fail(state, orb.name, '일반 아이템에만 사용할 수 있습니다.');
    nextRarity = 'magic';
    added = pick(candidateMods(mods, state.itemLevel, nextRarity, state.baseId,minLevel), rng);
    if (!added) return fail(state, orb.name, '등장 가능한 속성이 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (action === 'augment') {
    if (nextRarity !== 'magic' || mods.length !== 1) return fail(state, orb.name, '속성이 1개인 마법 아이템에만 사용할 수 있습니다.');
    added = pick(candidateMods(mods, state.itemLevel, nextRarity, state.baseId,minLevel), rng);
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (action === 'regal') {
    if (nextRarity !== 'magic' || mods.length === 0) return fail(state, orb.name, '속성이 있는 마법 아이템에만 사용할 수 있습니다.');
    nextRarity = 'rare';
    const regalOmen=activeOmen?.implemented && activeOmen.orbId===action ? activeOmen : null;
    let regalPool=candidateMods(mods, state.itemLevel, nextRarity, state.baseId,minLevel)
      .filter(m=>!regalOmen?.kind || m.kind===regalOmen.kind);
    if(regalOmen?.effectId==='homogenise')regalPool=homogenisedPool(regalPool,mods,rng);
    added=pick(regalPool,rng);
    if(regalOmen && added)omenUsed=regalOmen.id;
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (action === 'exalt') {
    if (nextRarity !== 'rare') return fail(state, orb.name, '희귀 아이템에만 사용할 수 있습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId===action?activeOmen:null;
    const catalyst=omen?.effectId==='catalyse'?catalysts.find(c=>c.id===state.catalystType):null;
    if(omen?.effectId==='catalyse'&&(!catalyst||!state.catalystQuality))
      return fail(state,orb.name,'촉진하는 찬미의 징조는 기폭제 퀄리티가 있는 반지·목걸이에 사용하세요.');
    const count=omen?.effectId==='addTwo'?2:1;
    for(let i=0;i<count;i++){
      let pool=candidateMods(mods,state.itemLevel,nextRarity,state.baseId,minLevel)
        .filter(m=>!omen?.kind||m.kind===omen.kind);
      if(omen?.effectId==='homogenise')pool=homogenisedPool(pool,mods,rng);
      if(catalyst){
        const preferred=pool.filter(m=>familyOf(m)===catalyst.family);
        if(preferred.length&&rng()<.75)pool=preferred; // illustrative tag bias, NOT verified game odds
      }
      const chosen=pick(pool,rng);
      if(!chosen)return fail(state,orb.name,
        count===2?'상위 찬미의 징조로 두 가지 속성을 추가할 후보/빈자리가 부족합니다.':'추가 가능한 속성이 없습니다.');
      added=chosen;
      const item={id:chosen.id,fractured:false,valueText:rollAffixText(chosen,rng)};
      mods.push(item);changes.push('추가 '+item.valueText);
    }
    if(omen)omenUsed=omen.id;
    if(catalyst)patch.catalystQuality=0;
  } else if (action === 'annul') {
    if(nextRarity==='normal')return fail(state,orb.name,'제거할 속성이 없습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId===action?activeOmen:null;
    const count=omen?.effectId==='removeTwo'?2:1;
    for(let i=0;i<count;i++){
      const eligible=mods.filter(x=>!x.fractured &&
        (!omen?.kind||modById[x.id].kind===omen.kind) &&
        (omen?.effectId!=='removeDesecrated'||x.desecrated));
      if(!eligible.length)return fail(state,orb.name,
        count===2?'상위 소멸의 징조로 제거할 속성 2개가 없습니다.':'징조 조건에 맞는 제거 가능한 속성이 없습니다.');
      removed=pick(eligible,rng);mods.splice(mods.findIndex(x=>x.id===removed.id),1);
      changes.push('제거 '+(removed.valueText||modById[removed.id]?.effect||modById[removed.id]?.name));
    }
    if(omen)omenUsed=omen.id;
  } else if (action === 'chaos') {
    if(nextRarity!=='rare')return fail(state,orb.name,'희귀 아이템에만 사용할 수 있습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId===action?activeOmen:null;
    let candidates=mods.filter(x=>!x.fractured && (!omen?.kind||modById[x.id].kind===omen.kind));
    if(omen?.effectId==='lowestLevel'&&candidates.length){
      const min=Math.min(...candidates.map(m=>modById[m.id].level??0));
      candidates=candidates.filter(m=>(modById[m.id].level??0)===min);
    }
    if(!candidates.length)return fail(state,orb.name,'징조 조건에 맞는 교체 가능한 속성이 없습니다.');
    removed=pick(candidates,rng);mods.splice(mods.findIndex(x=>x.id===removed.id),1);
    added=pick(candidateMods(mods,state.itemLevel,nextRarity,state.baseId,minLevel),rng);
    if(!added)return fail(state,orb.name,'교체할 새 속성 후보가 없습니다.');
    const item={id:added.id,fractured:false,valueText:rollAffixText(added,rng)};
    mods.push(item);
    changes.push('제거 '+(removed.valueText||modById[removed.id]?.effect||modById[removed.id]?.name));
    changes.push('추가 '+item.valueText);
    if(omen)omenUsed=omen.id;
  } else if(action==='alchemy'){
    if(!['normal','magic'].includes(nextRarity))return fail(state,orb.name,'일반 또는 마법 아이템에만 사용할 수 있습니다.');
    if(mods.some(x=>x.fractured||x.desecrated))return fail(state,orb.name,'분열 또는 훼손 속성이 있는 아이템에는 이 변환을 지원하지 않습니다.');
    mods.length=0;nextRarity='rare';
    const alchemyOmen=activeOmen?.orbId==='alchemy'&&activeOmen.implemented?activeOmen:null;
    const forcedKind=alchemyOmen?.effectId==='alchemyPrefix'?'prefix':
      alchemyOmen?.effectId==='alchemySuffix'?'suffix':null;
    for(let i=0;i<4;i++){
      const pool=candidateMods(mods,state.itemLevel,nextRarity,state.baseId)
        .filter(m=>!forcedKind || (i<3?m.kind===forcedKind:m.kind!==forcedKind));
      const chosen=pick(pool,rng);if(!chosen)return fail(state,orb.name,'서로 충돌하지 않는 속성 4개를 만들 수 없습니다.');
      mods.push({id:chosen.id,fractured:false,valueText:rollAffixText(chosen,rng)});
    }
    changes.push('기존 속성을 재설정하고 희귀 속성 4개 생성');
    if(alchemyOmen)omenUsed=alchemyOmen.id;
  } else if(action==='fracture'){
    if(nextRarity!=='rare'||mods.length<4)return fail(state,orb.name,'속성이 4개 이상인 희귀 아이템에만 사용할 수 있습니다.');
    if(mods.some(x=>x.fractured))return fail(state,orb.name,'이미 분열된 속성이 있습니다.');
    const pool=mods.filter(x=>!x.unrevealed&&!x.desecrated);
    if(!pool.length)return fail(state,orb.name,'분열할 수 있는 일반 속성이 없습니다.');
    const target=pick(pool,rng);target.fractured=true;
    changes.push('분열 고정 '+(target.valueText||modById[target.id].effect||modById[target.id].name));
  } else if(action==='divine'){
    const implicitOnly=activeOmen?.id==='omen-of-the-blessed';
    if(implicitOnly){
      if(!baseById[state.baseId]?.implicit)return fail(state,orb.name,'고정 속성이 없는 베이스라 축복받은 자의 징조를 사용할 수 없습니다.');
      patch.implicitRoll=rng();omenUsed=activeOmen.id;
      changes.push('고정 속성의 수치만 다시 추첨');
    }else{
      if(!mods.length)return fail(state,orb.name,'수치를 변경할 속성이 없습니다.');
      for(const m of mods){
        if(m.unrevealed)continue;
        const def=modById[m.id];
        if(def?.effect)m.valueText=rollAffixText(def,rng);
      }
      changes.push('모든 수치 범위를 다시 추첨');
    }
    if(activeOmen?.id==='omen-of-sanctification'&&nextRarity==='rare'){
      omenUsed=activeOmen.id;patch.sanctified=true;changes.push('축성됨');
    }
  } else if(action==='chance'){
    if(nextRarity!=='normal')return fail(state,orb.name,'일반 아이템에만 사용할 수 있습니다.');
    const guaranteed=activeOmen?.id==='omen-of-the-ancients';
    const protectedByOmen=activeOmen?.id==='omen-of-chance';
    const upgrade=guaranteed||rng()<0.5;
    if(upgrade){nextRarity='unique';patch.unique=true;changes.push('고유 아이템으로 변환 (정확한 고유 이름은 미확인)');}
    else if(protectedByOmen)changes.push('고유 변환에 실패했지만 아이템은 보존됨');
    else {patch.destroyed=true;changes.push('아이템 파괴');}
    if(guaranteed||protectedByOmen)omenUsed=activeOmen.id;
  } else if(action==='vaal'){
    if(state.corrupted)return fail(state,orb.name,'이미 타락된 아이템입니다.');
    patch.corrupted=true;
    const outcome=activeOmen?.id==='omen-of-corruption'?(rng()<.5?1:2):Math.floor(rng()*3);
    if(outcome===0)changes.push('추가 변화 없이 타락');
    else if(outcome===1){
      const removable=mods.filter(x=>!x.fractured&&!x.desecrated);
      if(removable.length){removed=pick(removable,rng);mods.splice(mods.indexOf(removed),1);changes.push('무작위 속성 제거');}
      else changes.push('변경 가능한 속성이 없어 타락 상태만 부여');
    }else {patch.vaalImplicit=true;changes.push('타락 고정 속성 변경 (수치 데이터 미확인)');}
    if(activeOmen?.id==='omen-of-corruption')omenUsed=activeOmen.id;
  } else return fail(state, orb.name, '미구현 오브입니다.');
  const detail=changes.length?changes.join(' / '):[
    removed && `제거 ${removed.valueText||modById[removed.id].effect||modById[removed.id].name}`,
    added && `추가 ${mods.find(x=>x.id===added.id)?.valueText||added.effect||added.name}`
  ].filter(Boolean).join(' / ');
  return finish(state, orb, mods, nextRarity, detail, omenUsed,patch);
}

export function applyEssence(state, essenceId, rng=Math.random){
  const essence=essenceById[essenceId];
  if(!essence)return fail(state,essenceId,'POE2 에센스 목록에 없는 재료입니다.');
  if(!state.locked)return fail(state,essence.name,'먼저 제작하기 버튼을 눌러주세요.');
  if(state.corrupted||state.destroyed||state.sanctified)return fail(state,essence.name,'타락·파괴·축성된 아이템에는 에센스를 사용할 수 없습니다.');
  const err=validateStart(state);if(err)return fail(state,essence.name,err);
  const mod=essenceModFor(baseById[state.baseId],essence);
  if(!mod)return fail(state,essence.name,'이 장비 종류에는 해당 에센스의 확정 속성이 없습니다. 다른 에센스나 베이스를 선택하세요.');
  const isReplacement=essence.action.includes('희귀 아이템에서');
  if(isReplacement&&state.rarity!=='rare')return fail(state,essence.name,'이 에센스는 희귀 장비에 사용합니다.');
  if(!isReplacement&&state.rarity!=='magic')return fail(state,essence.name,'이 에센스는 마법 장비를 희귀로 승급할 때 사용합니다.');
  const mods=clone(state.mods);
  const active=omenById[state.omenId];
  const crystallisation=isReplacement&&active?.implemented&&
    ['omen-of-sinistral-crystallisation','omen-of-dextral-crystallisation'].includes(active.id)?active:null;
  let removed=null;
  if(isReplacement){
    const kind=crystallisation?.id==='omen-of-sinistral-crystallisation'?'prefix':
      crystallisation?.id==='omen-of-dextral-crystallisation'?'suffix':null;
    const candidates=mods.filter(x=>!x.fractured&&(!kind||modById[x.id]?.kind===kind));
    if(!candidates.length)return fail(state,essence.name,'제거 조건에 맞는 비분열 속성이 없습니다.');
    removed=pick(candidates,rng);mods.splice(mods.indexOf(removed),1);
  }
  if(mods.filter(x=>modById[x.id]?.kind===mod.kind).length>=3)
    return fail(state,essence.name,'확정 속성이 들어갈 '+(mod.kind==='prefix'?'접두어':'접미어')+' 자리가 없습니다.');
  if(mods.some(x=>hasGroupConflict(modById[x.id],mod)))
    return fail(state,essence.name,'기존 속성과 확정 속성이 충돌합니다. 충돌 속성을 제거한 뒤 사용하세요.');
  mods.push({id:mod.id,fractured:false,valueText:rollAffixText(mod,rng)});
  const changed=isReplacement?'속성 1개 교체':'희귀로 승급';
  return finish(state,{id:essence.id,name:essence.name},mods,'rare',
    `${changed} / 확정 ${mods.at(-1).valueText}`,crystallisation?.id||null);
}

export function toggleOmen(state, omenId) {
  const s = clone(state);
  if (!omenById[omenId]) return { state: s, ok: false, reason:'알 수 없는 징조입니다.' };
  if (!omenById[omenId].implemented) return { state:s, ok:false, reason:'이 징조는 이름과 효과 설명만 제공하며 실제 제작 효과는 아직 미구현입니다.' };
  s.omenId = s.omenId === omenId ? null : omenId;
  s.log.push({ order: s.log.length + 1, action: omenById[omenId].name, success: true,
    detail: s.omenId ? '활성화(미소모)' : '활성화 해제' });
  s.notice = `${omenById[omenId].name}: ${s.omenId ? '활성화' : '해제'}`;
  return { state: s, ok: true };
}

export function setGoals(state, goalIds) {
  if (!Array.isArray(goalIds) || goalIds.length > 6 ||
    new Set(goalIds).size !== goalIds.length ||
    goalIds.some(id => typeof id !== 'string' || !modById[id])) {
    return { state, ok: false, reason: '목표 속성은 중복 없이 최대 6개까지 지정할 수 있습니다.' };
  }
  return { state: { ...state, goals: [...goalIds] }, ok: true };
}

export function goalProgress(state) {
  const goals = state.goals || [];
  const achieved = goals.filter(id => state.mods.some(m => m.id === id));
  return { achieved, total: goals.length, complete: goals.length > 0 && achieved.length === goals.length };
}

export function setInitial(state, patch) {
  if (state.locked) return { state, ok: false, reason: '제작 이후에는 초기 설정을 변경할 수 없습니다. 초기화해 주세요.' };
  const candidate = { ...state, ...patch };
  const err = validateStart(candidate);
  return err ? { state, ok: false, reason: err } : { state: candidate, ok: true };
}
