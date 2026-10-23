import { bases, modifiers, orbs, omens } from '../data/demo.js';
import { supportsDemoCrafting } from './catalogue.js';
import { allRealMods, modsForBase, allowedMod, groupsOf, hasGroupConflict, rollAffixText } from './affixes.js';
import { abyssMods, hiddenMods, hasDesecration } from './abyss.js';

export const modById = { ...Object.fromEntries(modifiers.map(m => [m.id, m])), ...allRealMods,
  ...abyssMods,...hiddenMods };
export const orbById = Object.fromEntries(orbs.map(o => [o.id, o]));
export const omenById = Object.fromEntries(omens.map(o => [o.id, o]));
export const baseById = Object.fromEntries(bases.map(b => [b.id, b]));
export const SLOT_LIMITS = Object.freeze({ normal: 0, magic: 1, rare: 3 });

export const clone = obj => JSON.parse(JSON.stringify(obj));
export const makeInitial = () => ({
  baseId: 'daggerfoot', itemLevel: 82, rarity: 'magic',
  mods: [{ id: 'fire42', fractured: false }], goals: ['movement35', 'life135', 'fire42', 'cold38', 'light41'], omenId: null,
  usage: {}, log: [], attempts: 0, locked: false, notice: '확장의 오브를 클릭해보세요.'
});

export function validateStart({ baseId, itemLevel, rarity, mods }) {
  if (!baseById[baseId]) return '지원하지 않는 베이스입니다.';
  // Korean per-item modifier pools are checked below, including legacy demo-session mods.
  if (!Number.isInteger(itemLevel) || itemLevel < 1 || itemLevel > 100) return '아이템 레벨은 1~100 정수로 설정해 주세요.';
  if (!Object.hasOwn(SLOT_LIMITS, rarity)) return '존재하지 않는 아이템 등급입니다.';
  if (rarity === 'normal' && mods.length) return '일반 아이템에는 일반 속성을 입력할 수 없습니다.';
  if (rarity === 'magic' && mods.length > 2) return '마법 아이템의 속성은 최대 2개입니다.';
  if (rarity === 'rare' && mods.length > 6) return '희귀 아이템의 일반 속성은 최대 6개입니다.';
  const keys = new Set(); const groups = new Set();
  for (const mod of mods) {
    const m = modById[mod.id], abyssal=Boolean(abyssMods[mod.id]||hiddenMods[mod.id]);
    if (!m) return `알 수 없는 속성: ${mod.id}`;
    if (!abyssal && m.level > itemLevel) return `${m.name}: 요구 아이템 레벨 ${m.level} 미달입니다.`;
    const legacy = modifiers.some(d => d.id === m.id);
    if (!abyssal && (legacy ? !supportsDemoCrafting(baseById[baseId]) : !allowedMod(baseById[baseId],m,itemLevel)))
      return `${m.name}: 해당 베이스에 부여할 수 없는 속성입니다.`;
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

export function candidateMods(mods, itemLevel, rarity, baseId='daggerfoot') {
  const max=SLOT_LIMITS[rarity], base=baseById[baseId];
  const pool=modsForBase(base,itemLevel);
  return pool.filter(m=>!mods.some(x=>x.id===m.id || hasGroupConflict(modById[x.id],m)) &&
    mods.filter(x=>modById[x.id].kind===m.kind).length<max);
}

function pick(list, rng) {
  if (!list.length) return null;
  // Uniform weights for UI demonstration ONLY.
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(rng() * list.length)))];
}

function fail(state, action, reason) {
  const s = clone(state);
  s.notice = `사용 불가: ${reason}`;
  s.log.push({ order: s.log.length + 1, action, success: false, detail: reason });
  return { state: s, ok: false, reason };
}

function finish(state, orb, mods, rarity, detail, omenUsed) {
  const s = clone(state);
  s.mods = mods; s.rarity = rarity;
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
  if (state.corrupted) return fail(state, orb.name, '타락한 아이템에는 일반 오브 제작을 진행할 수 없습니다.');
  const valid = validateStart(state);
  if (valid) return fail(state, orb.name, `현재 아이템이 유효하지 않습니다: ${valid}`);
  // Every regular equipment class uses its PoB2 eligibility-filtered Korean affix pool.
  if(!modsForBase(baseById[state.baseId],state.itemLevel).length)
    return fail(state, orb.name, '이 베이스의 해당 아이템 레벨에 부여 가능한 속성을 확인하지 못했습니다.');
  const mods = clone(state.mods);
  const activeOmen = omenById[state.omenId];
  if(activeOmen && activeOmen.implemented && activeOmen.orbId === orbId && activeOmen.kind &&
    !['prefix','suffix'].includes(activeOmen.kind))
    return fail(state,orb.name,'징조 적용 조건이 불명확합니다.');
  let nextRarity = state.rarity;
  let added = null, removed = null, omenUsed = null;const changes=[];
  if (orbId === 'transmute') {
    if (nextRarity !== 'normal') return fail(state, orb.name, '일반 아이템에만 사용할 수 있습니다.');
    nextRarity = 'magic';
    added = pick(candidateMods(mods, state.itemLevel, nextRarity, state.baseId), rng);
    if (!added) return fail(state, orb.name, '등장 가능한 속성이 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (orbId === 'augment') {
    if (nextRarity !== 'magic' || mods.length !== 1) return fail(state, orb.name, '속성이 1개인 마법 아이템에만 사용할 수 있습니다.');
    added = pick(candidateMods(mods, state.itemLevel, nextRarity, state.baseId), rng);
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (orbId === 'regal') {
    if (nextRarity !== 'magic' || mods.length === 0) return fail(state, orb.name, '속성이 있는 마법 아이템에만 사용할 수 있습니다.');
    nextRarity = 'rare';
    const regalOmen=activeOmen?.implemented && activeOmen.orbId==='regal' ? activeOmen : null;
    const regalPool=candidateMods(mods, state.itemLevel, nextRarity, state.baseId)
      .filter(m=>!regalOmen || m.kind===regalOmen.kind);
    added=pick(regalPool,rng);
    if(regalOmen && added)omenUsed=regalOmen.id;
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false, valueText: rollAffixText(added,rng) });
  } else if (orbId === 'exalt') {
    if (nextRarity !== 'rare') return fail(state, orb.name, '희귀 아이템에만 사용할 수 있습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId==='exalt'?activeOmen:null;
    const count=omen?.effectId==='addTwo'?2:1;
    for(let i=0;i<count;i++){
      const pool=candidateMods(mods,state.itemLevel,nextRarity,state.baseId)
        .filter(m=>!omen?.kind||m.kind===omen.kind);
      const chosen=pick(pool,rng);
      if(!chosen)return fail(state,orb.name,
        count===2?'상위 찬미의 징조로 두 가지 속성을 추가할 후보/빈자리가 부족합니다.':'추가 가능한 속성이 없습니다.');
      added=chosen;
      const item={id:chosen.id,fractured:false,valueText:rollAffixText(chosen,rng)};
      mods.push(item);changes.push('추가 '+item.valueText);
    }
    if(omen)omenUsed=omen.id;
  } else if (orbId === 'annul') {
    if(nextRarity==='normal')return fail(state,orb.name,'제거할 속성이 없습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId==='annul'?activeOmen:null;
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
  } else if (orbId === 'chaos') {
    if(nextRarity!=='rare')return fail(state,orb.name,'희귀 아이템에만 사용할 수 있습니다.');
    const omen=activeOmen?.implemented&&activeOmen.orbId==='chaos'?activeOmen:null;
    let candidates=mods.filter(x=>!x.fractured && (!omen?.kind||modById[x.id].kind===omen.kind));
    if(omen?.effectId==='lowestLevel'&&candidates.length){
      const min=Math.min(...candidates.map(m=>modById[m.id].level??0));
      candidates=candidates.filter(m=>(modById[m.id].level??0)===min);
    }
    if(!candidates.length)return fail(state,orb.name,'징조 조건에 맞는 교체 가능한 속성이 없습니다.');
    removed=pick(candidates,rng);mods.splice(mods.findIndex(x=>x.id===removed.id),1);
    added=pick(candidateMods(mods,state.itemLevel,nextRarity,state.baseId),rng);
    if(!added)return fail(state,orb.name,'교체할 새 속성 후보가 없습니다.');
    const item={id:added.id,fractured:false,valueText:rollAffixText(added,rng)};
    mods.push(item);
    changes.push('제거 '+(removed.valueText||modById[removed.id]?.effect||modById[removed.id]?.name));
    changes.push('추가 '+item.valueText);
    if(omen)omenUsed=omen.id;
  } else return fail(state, orb.name, '미구현 오브입니다.');
  const detail=changes.length?changes.join(' / '):[
    removed && `제거 ${removed.valueText||modById[removed.id].effect||modById[removed.id].name}`,
    added && `추가 ${mods.find(x=>x.id===added.id)?.valueText||added.effect||added.name}`
  ].filter(Boolean).join(' / ');
  return finish(state, orb, mods, nextRarity, detail, omenUsed);
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
