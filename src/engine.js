import { bases, modifiers, orbs, omens } from '../data/demo.js';

export const modById = Object.fromEntries(modifiers.map(m => [m.id, m]));
export const orbById = Object.fromEntries(orbs.map(o => [o.id, o]));
export const omenById = Object.fromEntries(omens.map(o => [o.id, o]));
export const baseById = Object.fromEntries(bases.map(b => [b.id, b]));
export const SLOT_LIMITS = Object.freeze({ normal: 0, magic: 1, rare: 3 });

export const clone = obj => JSON.parse(JSON.stringify(obj));
export const makeInitial = () => ({
  baseId: 'daggerfoot', itemLevel: 82, rarity: 'magic',
  mods: [{ id: 'fire42', fractured: false }], omenId: null,
  usage: {}, log: [], attempts: 0, locked: false, notice: '확장의 오브를 클릭해보세요.'
});

export function validateStart({ baseId, itemLevel, rarity, mods }) {
  if (!baseById[baseId]) return '지원하지 않는 베이스입니다.';
  if (!Number.isInteger(itemLevel) || itemLevel < 1 || itemLevel > 100) return '아이템 레벨은 1~100 정수로 설정해 주세요.';
  if (!Object.hasOwn(SLOT_LIMITS, rarity)) return '존재하지 않는 아이템 등급입니다.';
  if (rarity === 'normal' && mods.length) return '일반 아이템에는 일반 속성을 입력할 수 없습니다.';
  if (rarity === 'magic' && mods.length > 2) return '마법 아이템의 속성은 최대 2개입니다.';
  if (rarity === 'rare' && mods.length > 6) return '희귀 아이템의 일반 속성은 최대 6개입니다.';
  const keys = new Set(); const groups = new Set();
  for (const mod of mods) {
    const m = modById[mod.id];
    if (!m) return `알 수 없는 속성: ${mod.id}`;
    if (m.level > itemLevel) return `${m.name}: 요구 아이템 레벨 ${m.level} 미달입니다.`;
    if (keys.has(m.id) || groups.has(m.group)) return `속성 중복 또는 그룹 충돌: ${m.name}`;
    if (rarity !== 'rare' && mod.fractured) return '시연에서는 희귀 아이템에만 분열 속성 지정이 가능합니다.';
    keys.add(m.id); groups.add(m.group);
  }
  for (const kind of ['prefix', 'suffix']) {
    if (mods.filter(x => modById[x.id]?.kind === kind).length > SLOT_LIMITS[rarity]) {
      return `${kind === 'prefix' ? '접두어' : '접미어'} 자리가 가득 찼습니다.`;
    }
  }
  return null;
}

export function candidateMods(mods, itemLevel, rarity) {
  const max = SLOT_LIMITS[rarity];
  const existingGroups = new Set(mods.map(x => modById[x.id].group));
  return modifiers.filter(m => m.level <= itemLevel && !existingGroups.has(m.group) &&
    mods.filter(x => modById[x.id].kind === m.kind).length < max);
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
  const valid = validateStart(state);
  if (valid) return fail(state, orb.name, `현재 아이템이 유효하지 않습니다: ${valid}`);
  const mods = clone(state.mods);
  let nextRarity = state.rarity;
  let added = null, removed = null, omenUsed = null;
  if (orbId === 'transmute') {
    if (nextRarity !== 'normal') return fail(state, orb.name, '일반 아이템에만 사용할 수 있습니다.');
    nextRarity = 'magic';
    added = pick(candidateMods(mods, state.itemLevel, nextRarity), rng);
    if (!added) return fail(state, orb.name, '등장 가능한 속성이 없습니다.');
    mods.push({ id: added.id, fractured: false });
  } else if (orbId === 'augment') {
    if (nextRarity !== 'magic' || mods.length !== 1) return fail(state, orb.name, '속성이 1개인 마법 아이템에만 사용할 수 있습니다.');
    added = pick(candidateMods(mods, state.itemLevel, nextRarity), rng);
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false });
  } else if (orbId === 'regal') {
    if (nextRarity !== 'magic' || mods.length === 0) return fail(state, orb.name, '속성이 있는 마법 아이템에만 사용할 수 있습니다.');
    nextRarity = 'rare';
    added = pick(candidateMods(mods, state.itemLevel, nextRarity), rng);
    if (!added) return fail(state, orb.name, '추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false });
  } else if (orbId === 'exalt') {
    if (nextRarity !== 'rare') return fail(state, orb.name, '이 시연에서는 희귀 아이템에만 사용할 수 있습니다.');
    added = pick(candidateMods(mods, state.itemLevel, nextRarity), rng);
    if (!added) return fail(state, orb.name, '빈자리 또는 추가 가능한 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false });
  } else if (orbId === 'annul') {
    if (nextRarity === 'normal') return fail(state, orb.name, '제거할 속성이 없습니다.');
    const active = omenById[state.omenId];
    const candidates = mods.filter(x => !x.fractured && (!active || active.kind === modById[x.id].kind));
    if (!candidates.length) return fail(state, orb.name, active ? '징조 조건에 맞는 제거 가능한 속성이 없습니다.' : '제거 가능한 속성이 없습니다.');
    removed = pick(candidates, rng);
    mods.splice(mods.findIndex(x => x.id === removed.id), 1);
    if (active) omenUsed = active.id;
  } else if (orbId === 'chaos') {
    if (nextRarity !== 'rare') return fail(state, orb.name, '희귀 아이템에만 사용할 수 있습니다.');
    const candidates = mods.filter(x => !x.fractured);
    if (!candidates.length) return fail(state, orb.name, '교체 가능한 속성이 없습니다.');
    removed = pick(candidates, rng);
    mods.splice(mods.findIndex(x => x.id === removed.id), 1);
    added = pick(candidateMods(mods, state.itemLevel, nextRarity), rng);
    if (!added) return fail(state, orb.name, '교체할 새 속성 후보가 없습니다.');
    mods.push({ id: added.id, fractured: false });
  } else return fail(state, orb.name, '미구현 오브입니다.');
  const detail = [removed && `제거 ${modById[removed.id].name}`, added && `추가 ${added.name}`].filter(Boolean).join(' / ');
  return finish(state, orb, mods, nextRarity, detail, omenUsed);
}

export function toggleOmen(state, omenId) {
  const s = clone(state);
  if (!omenById[omenId]) return { state: s, ok: false };
  s.omenId = s.omenId === omenId ? null : omenId;
  s.log.push({ order: s.log.length + 1, action: omenById[omenId].name, success: true,
    detail: s.omenId ? '활성화(미소모)' : '활성화 해제' });
  s.notice = `${omenById[omenId].name}: ${s.omenId ? '활성화' : '해제'}`;
  return { state: s, ok: true };
}

export function setInitial(state, patch) {
  if (state.locked) return { state, ok: false, reason: '제작 이후에는 초기 설정을 변경할 수 없습니다. 초기화해 주세요.' };
  const candidate = { ...state, ...patch };
  const err = validateStart(candidate);
  return err ? { state, ok: false, reason: err } : { state: candidate, ok: true };
}
