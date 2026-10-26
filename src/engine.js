import { bases, modifiers, orbs, omens } from '../data/demo.js';
import { supportsDemoCrafting } from './catalogue.js';
import { allRealMods, modsForBase, allowedMod, groupsOf, hasGroupConflict, rollAffixText } from './affixes.js';
import { abyssMods, hiddenMods, hasDesecration } from './abyss.js';
import { essenceById, essenceModsFor, essenceMods } from './essences.js';
import { catalysts } from '../data/catalysts.js';
import { slotLimits,qualityCap,augmentSocketCap,approximateQualityGain,isMartialWeapon,isCasterWeapon } from './equipment-rules.js';

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
  quality:0,sockets:0,
  mirroredCopies:[],prediction:null,
  usage: {}, log: [], attempts: 0, locked: false, notice: '확장의 오브를 클릭해보세요.'
});

export function validateStart({ baseId, itemLevel, rarity, mods, catalystType=null, catalystQuality=0,quality=0,sockets=0 }) {
  if (!baseById[baseId]) return '지원하지 않는 베이스입니다.';
  // Korean per-item modifier pools are checked below, including legacy demo-session mods.
  if (!Number.isInteger(itemLevel) || itemLevel < 1 || itemLevel > 100) return '아이템 레벨은 1~100 정수로 설정해 주세요.';
  if (!Object.hasOwn(SLOT_LIMITS, rarity)) return '존재하지 않는 아이템 등급입니다.';
  if(!Number.isInteger(catalystQuality)||catalystQuality<0||catalystQuality>qualityCap(baseById[baseId]))
    return `기폭제 퀄리티는 0~${qualityCap(baseById[baseId])} 사이의 정수여야 합니다.`;
  if(!Number.isInteger(quality)||quality<0||quality>30)return '일반 장비 퀄리티는 0~30 사이로 입력해 주세요.';
  if(!Number.isInteger(sockets)||sockets<0||sockets>augmentSocketCap(baseById[baseId])+1)
    return '장비 종류에 맞지 않는 증강물 홈 개수입니다.';
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
    if(fromEssence && !essenceModsFor(baseById[baseId],essenceById[m.essenceId]).some(x=>x.id===m.id))
      return `${m.name}: 이 베이스에 맞는 에센스 속성이 아닙니다.`;
    if (keys.has(m.id) || groupsOf(m).some(g => groups.has(g)))
      return `속성 중복 또는 그룹 충돌: ${m.name}`;
    if (rarity !== 'rare' && mod.fractured) return '시연에서는 희귀 아이템에만 분열 속성 지정이 가능합니다.';
    if(abyssal && rarity!=='rare')return '훼손 속성은 희귀 아이템에서만 유지할 수 있습니다.';
    keys.add(m.id); groupsOf(m).forEach(g => groups.add(g));
  }
  const limits=slotLimits(baseById[baseId],rarity);
  for (const kind of ['prefix', 'suffix']) {
    if (mods.filter(x => modById[x.id]?.kind === kind).length > limits[kind]) {
      return `${kind === 'prefix' ? '접두어' : '접미어'} 자리가 가득 찼습니다.`;
    }
  }
  return null;
}

export function candidateMods(mods, itemLevel, rarity, baseId='daggerfoot', minModLevel=1) {
  const base=baseById[baseId],limits=slotLimits(base,rarity);
  const pool=modsForBase(base,itemLevel);
  return pool.filter(m=>m.level>=minModLevel && !mods.some(x=>x.id===m.id || hasGroupConflict(modById[x.id],m)) &&
    mods.filter(x=>modById[x.id].kind===m.kind).length<limits[m.kind]);
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
function magnifyNumbers(value,factor){
  return String(value).replace(/-?\d+(?:\.\d+)?/g,n=>String(Math.ceil(Number(n)*factor)));
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
  Object.assign(s,{prediction:null,...patch});
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
  if(state.prediction?.orbId===orbId)rng=seededRandom(state.prediction.seed);
  if (state.destroyed) return fail(state, orb.name, '이미 파괴된 아이템에는 제작할 수 없습니다.');
  if (state.corrupted) return fail(state, orb.name, '타락한 아이템에는 일반 오브 제작을 진행할 수 없습니다.');
  if(state.sanctified)return fail(state,orb.name,'축성된 아이템은 일반 화폐로 더 이상 제작할 수 없습니다.');
  if (state.rarity==='unique'&&!['quality','socket','vaal'].includes(orb.action)) return fail(state,orb.name,'고유 아이템에는 이 일반 제작 재료를 사용할 수 없습니다.');
  if(state.sanctified&&orb.action==='mirror')return fail(state,orb.name,'축성된 장비는 복제할 수 없습니다.');
  const valid = validateStart(state);
  if (valid) return fail(state, orb.name, `현재 아이템이 유효하지 않습니다: ${valid}`);
  // Every regular equipment class uses its PoB2 eligibility-filtered Korean affix pool.
  if(!['quality','socket','divine','vaal','chance','mirror'].includes(orb.action)&&!modsForBase(baseById[state.baseId],state.itemLevel).length)
    return fail(state, orb.name, '이 베이스의 해당 아이템 레벨에 부여 가능한 속성을 확인하지 못했습니다.');
  const mods = clone(state.mods);
  const activeOmen = omenById[state.omenId];
  if(activeOmen && activeOmen.implemented && activeOmen.orbId === (orb.action||orbId) && activeOmen.kind &&
    !['prefix','suffix'].includes(activeOmen.kind))
    return fail(state,orb.name,'징조 적용 조건이 불명확합니다.');
  const action=orb.action||orbId,minLevel=orb.minModLevel||1;
  let nextRarity = state.rarity;
  let added = null, removed = null, omenUsed = null;const changes=[],patch={};
  if(action==='mirror'){
    const snapshot={baseId:state.baseId,itemLevel:state.itemLevel,rarity:state.rarity,
      mods:clone(state.mods),quality:state.quality||0,catalystType:state.catalystType||null,
      catalystQuality:state.catalystQuality||0,sockets:state.sockets||0,mirrored:true};
    patch.mirroredCopies=[...(state.mirroredCopies||[]),snapshot];
    changes.push(`원본을 변경하지 않고 제작 불가 복제본 ${patch.mirroredCopies.length}개째 생성`);
  }else if(action==='quality'){
    const base=baseById[state.baseId];
    const valid=orb.qualityCategory==='armour'?base.group==='방어구':
      orb.qualityCategory==='caster'?isCasterWeapon(base):isMartialWeapon(base);
    if(!valid)return fail(state,orb.name,'선택한 숫돌·식각기·고철을 사용할 수 없는 장비 종류입니다.');
    if((state.quality||0)>=20)return fail(state,orb.name,'화폐로 올릴 수 있는 퀄리티 상한 20%에 도달했습니다.');
    const next=Math.min(20,(state.quality||0)+approximateQualityGain(state.itemLevel));
    patch.quality=next;
    changes.push(`퀄리티 ${state.quality||0}% → ${next}% (아이템 레벨별 증가량 임시 적용)`);
  } else if(action==='socket'){
    const cap=augmentSocketCap(baseById[state.baseId]);
    if(!cap)return fail(state,orb.name,'이 장비에는 증강물 홈을 추가할 수 없습니다.');
    if((state.sockets||0)>=cap)return fail(state,orb.name,`기본 증강물 홈 상한 ${cap}개에 도달했습니다.`);
    patch.sockets=(state.sockets||0)+1;
    changes.push(`증강물 홈 ${(state.sockets||0)}개 → ${patch.sockets}개`);
  } else if (action === 'transmute') {
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
    const sanctification=activeOmen?.id==='omen-of-sanctification'&&nextRarity==='rare';
    if(sanctification){
      if(!mods.length)return fail(state,orb.name,'배율을 적용할 명시 속성이 없습니다.');
      for(const m of mods){
        if(m.unrevealed)continue;
        const factor=(78+Math.floor(rng()*45))/100;
        const text=m.valueText||(modById[m.id]?.effect?rollAffixText(modById[m.id],rng):modById[m.id]?.name)||'';
        m.valueText=magnifyNumbers(text,factor);
        m.sanctificationMultiplier=factor;
      }
      omenUsed=activeOmen.id;patch.sanctified=true;
      changes.push('각 속성의 기존 수치를 개별 0.78~1.22배로 변경하고 축성됨 (이후 제작 불가)');
    }else if(implicitOnly){
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
    const outcome=activeOmen?.id==='omen-of-corruption'?1+Math.floor(rng()*3):Math.floor(rng()*4);
    if(outcome===0)changes.push('추가 변화 없이 타락');
    else if(outcome===1){
      if(nextRarity==='unique'){
        patch.vaalMagnitude=Math.round((.78+rng()*.44)*100)/100;
        changes.push(`고유 속성 크기 배율 ${patch.vaalMagnitude}배 (고유 상세 속성 데이터 미확인)`);
      }else{
        const eligible=mods.filter(x=>!x.fractured&&!x.unrevealed&&!x.desecrated);
        const max=Math.min(3,Math.ceil(eligible.length/2));
        const count=max?1+Math.floor(rng()*max):0;
        for(let i=0;i<count;i++){
          const old=pick(eligible.filter(m=>mods.some(x=>x.id===m.id)),rng);
          if(!old)break;
          mods.splice(mods.indexOf(old),1);
          const replacement=pick(candidateMods(mods,state.itemLevel,nextRarity,state.baseId),rng);
          if(replacement)mods.push({id:replacement.id,fractured:false,valueText:rollAffixText(replacement,rng)});
          changes.push('무작위 속성 재추첨 '+(old.valueText||modById[old.id]?.effect||modById[old.id]?.name));
        }
        if(!changes.length)changes.push('교체 가능한 속성이 없어 추가 변화 없음');
      }
    }else if(outcome===2){
      patch.vaalImplicit=true;
      changes.push('타락 전용 부여 속성 획득 (장비별 실제 속성 풀 확인 필요)');
    }else {
      const cap=augmentSocketCap(baseById[state.baseId]);
      if(cap>0){patch.sockets=(state.sockets||0)+1;changes.push(`기본 제한을 무시하고 증강물 홈 ${patch.sockets}개로 증가`);}
      else changes.push('증강물 홈이 없는 종류여서 추가 변화 없음');
    }
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
  const possible=essenceModsFor(baseById[state.baseId],essence);
  if(!possible.length)return fail(state,essence.name,'이 장비 종류에는 해당 에센스의 확정 속성이 없습니다. 다른 에센스나 베이스를 선택하세요.');
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
  const available=possible.filter(mod=>
    mods.filter(x=>modById[x.id]?.kind===mod.kind).length<slotLimits(baseById[state.baseId],'rare')[mod.kind]&&
    !mods.some(x=>hasGroupConflict(modById[x.id],mod)));
  if(!available.length)return fail(state,essence.name,'확정 속성이 들어갈 빈 접두어·접미어 자리 또는 호환되는 속성 그룹이 없습니다.');
  const mod=pick(available,rng);
  mods.push({id:mod.id,fractured:false,valueText:rollAffixText(mod,rng)});
  const changed=isReplacement?'속성 1개 교체':'희귀로 승급';
  return finish(state,{id:essence.id,name:essence.name},mods,'rare',
    `${changed} / 확정 ${mods.at(-1).valueText}`,crystallisation?.id||null);
}

export function applyCatalyst(state,catalystId){
  const catalyst=catalysts.find(x=>x.id===catalystId);
  if(!catalyst)return fail(state,catalystId,'등록되지 않은 기폭제입니다.');
  if(!state.locked)return fail(state,catalyst.name,'제작하기 버튼으로 아이템 설정을 확정해 주세요.');
  if(state.corrupted||state.destroyed)return fail(state,catalyst.name,'타락하거나 파괴된 아이템에는 기폭제를 사용할 수 없습니다.');
  const base=baseById[state.baseId];
  if(!['ring','amulet'].includes(base.category))return fail(state,catalyst.name,'반지와 목걸이에만 사용할 수 있는 기폭제입니다.');
  const err=validateStart(state);if(err)return fail(state,catalyst.name,err);
  const cap=qualityCap(base),same=state.catalystType===catalystId;
  const previous=same?(state.catalystQuality||0):0;
  if(previous>=cap)return fail(state,catalyst.name,`기폭제 퀄리티가 최대 ${cap}%입니다.`);
  const next=Math.min(cap,previous+approximateQualityGain(state.itemLevel));
  return finish(state,{id:catalyst.id,name:catalyst.name},clone(state.mods),state.rarity,
    `${same?'퀄리티 증가':'기존 기폭제 유형 대체'}: ${previous}% → ${next}% (아이템 레벨별 증가량 임시 적용)`,null,
    {catalystType:catalystId,catalystQuality:next});
}

function seededRandom(seed){
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
export function previewCurrency(state,orbId,seed=Math.floor(Math.random()*4294967296)){
  const name='히네코라의 머리카락',orb=orbById[orbId];
  if(!orb)return fail(state,name,'예측할 오브를 선택해 주세요.');
  if(orb.action==='mirror')return fail(state,name,'복제 전용 화폐는 예측할 대상에서 제외합니다.');
  if(!state.locked)return fail(state,name,'먼저 제작을 시작해 주세요.');
  if(state.destroyed||state.corrupted||state.sanctified||state.rarity==='unique')
    return fail(state,name,'타락·파괴·축성·고유 장비에는 이 예측을 지원하지 않습니다.');
  if(state.prediction)return fail(state,name,'이미 다음 화폐 결과를 예측하고 있습니다.');
  const result=applyOrb({...state,prediction:null},orbId,seededRandom(seed));
  if(!result.ok)return fail(state,name,'선택한 화폐가 현재 아이템에 적용되지 않습니다: '+result.reason);
  const detail=result.state.log.at(-1).detail;
  const s=clone(state);
  s.prediction={orbId,seed,detail};
  s.locked=true;s.attempts=(s.attempts||0)+1;
  s.usage['hinekoras-lock']=(s.usage['hinekoras-lock']||0)+1;
  s.log.push({order:s.log.length+1,action:name,success:true,
    detail:`다음 ${orb.name} 결과 예측: ${detail}`});
  s.notice=`${name}: ${orb.name} 사용 시 ${detail}`;
  return {state:s,ok:true};
}

export function toggleOmen(state, omenId) {
  const s = clone(state);
  if (!omenById[omenId]) return { state: s, ok: false, reason:'알 수 없는 징조입니다.' };
  if (!omenById[omenId].implemented) return { state:s, ok:false, reason:'이 징조는 이름과 효과 설명만 제공하며 실제 제작 효과는 아직 미구현입니다.' };
  s.omenId = s.omenId === omenId ? null : omenId;
  if(s.prediction)s.prediction=null;
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
