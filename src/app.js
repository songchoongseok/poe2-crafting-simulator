import { bases, modifiers, orbs, omens, DEMO_NOTICE } from '../data/demo.js';
import { modById, omenById, baseById, SLOT_LIMITS, makeInitial, setInitial, setGoals, goalProgress, applyOrb, toggleOmen } from './engine.js';

import { parseSession, serializeSession } from './session.js';
import { createBasePicker } from './base-picker.js';
import { CATEGORY_LABELS, describeBase, supportsDemoCrafting } from './catalogue.js';

const $ = selector => document.querySelector(selector);
let state = makeInitial();
let picker;
const plain = document.createElement('span');
const escapeHTML = value => { plain.textContent = String(value); return plain.innerHTML; };
const showError = reason => { state = { ...state, notice: `사용 불가: ${reason}` }; render(); };

function setup() {
  $('#disclaimer').textContent = DEMO_NOTICE;
  $('#modifier').innerHTML = modifiers.map(m => `<option value="${m.id}">${m.kind === 'prefix' ? '접두' : '접미'} · ${escapeHTML(m.name)} (${m.tier})</option>`).join('');
  $('#goal-modifier').innerHTML = modifiers.map(m => `<option value="${m.id}">${m.kind === 'prefix' ? '접두' : '접미'} · ${escapeHTML(m.name)} (${m.tier})</option>`).join('');
  $('#orb-buttons').innerHTML = orbs.map(o => `<button data-orb="${o.id}" type="button">${escapeHTML(o.name)}</button>`).join('');
  $('#omen-buttons').innerHTML = omens.map(o => `<button data-omen="${o.id}" type="button">${escapeHTML(o.name)}</button>`).join('');
  picker = createBasePicker(id => {
    const chosen = baseById[id];
    const result = setInitial(state, {
      baseId: id, mods: [],
      goals: supportsDemoCrafting(chosen) ? state.goals : []
    });
    if (result.ok) {
      state = { ...result.state, notice: `베이스 변경: ${chosen.name} · 기존 속성 초기화` };
    } else { showError(result.reason); }
    render();
    return result.ok;
  });
  picker.sync(state.baseId);
  $('#rarity').addEventListener('change', e => {
    const result = setInitial(state, { rarity: e.target.value, mods: [] });
    if (result.ok) state = result.state; else showError(result.reason); render();
  });
  $('#level').addEventListener('change', e => {
    const result = setInitial(state, { itemLevel: Number(e.target.value), mods: [] });
    if (result.ok) state = result.state; else showError(result.reason); render();
  });
  $('#add-mod').addEventListener('click', () => {
    const newMod = { id: $('#modifier').value, fractured: $('#fractured').checked };
    const result = setInitial(state, { mods: [...state.mods, newMod] });
    if (result.ok) { state = result.state; state.notice = `기존 속성 추가: ${modById[newMod.id].name}`; }
    else showError(result.reason);
    render();
  });
  $('#orb-buttons').addEventListener('click', e => {
    const b = e.target.closest('button[data-orb]'); if (!b) return;
    state = applyOrb(state, b.dataset.orb).state; render();
  });
  $('#omen-buttons').addEventListener('click', e => {
    const b = e.target.closest('button[data-omen]'); if (!b) return;
    state = toggleOmen(state, b.dataset.omen).state; render();
  });
  $('#goal-add').addEventListener('click', () => {
    const result = setGoals(state, [...(state.goals || []), $('#goal-modifier').value]);
    if (result.ok) state = result.state; else showError(result.reason);
    render();
  });
  $('#goal-list').addEventListener('click', e => {
    const remove = e.target.closest('button[data-goal-remove]');
    if (!remove) return;
    const result = setGoals(state, state.goals.filter(id => id !== remove.dataset.goalRemove));
    if (result.ok) state = result.state; else showError(result.reason);
    render();
  });
  $('#export-session').addEventListener('click', () => {
    const blob = new Blob([serializeSession(state)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'poe2-crafting-session.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#import-session').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try { state = parseSession(await file.text()); }
    catch (err) { showError(err.message); }
    e.target.value = ''; picker.sync(state.baseId); render();
  });
  $('#reset').addEventListener('click', () => { state = makeInitial(); picker.sync(state.baseId); render(); });
  $('#prefix-list').addEventListener('click', deleteMod);
  $('#suffix-list').addEventListener('click', deleteMod);
  render();
}

function deleteMod(e) {
  const b = e.target.closest('[data-remove]'); if (!b || state.locked) return;
  const idx = Number(b.dataset.remove);
  const result = setInitial(state, { mods: state.mods.filter((_, i) => i !== idx) });
  if (result.ok) state = result.state; else showError(result.reason);
  render();
}
function renderMods(kind) {
  const list = state.mods.map((m, index) => ({ ...m, index, ...modById[m.id] })).filter(m => m.kind === kind);
  const vacant = SLOT_LIMITS[state.rarity] - list.length;
  return list.map(m => `<div class="mod-row"><div>${escapeHTML(m.name)} ${m.fractured ? '<span class="tag">◆ 분열</span>' : ''}</div><span class="tier">${escapeHTML(m.tier)}</span>${!state.locked ? `<button class="secondary remove-mod" data-remove="${m.index}">삭제</button>` : ''}</div>`).join('') + (vacant > 0 ? `<div class="empty">빈 ${kind === 'prefix' ? '접두어' : '접미어'} ${vacant}칸</div>` : '');
}
function render() {
  const base = baseById[state.baseId];
  $('#rarity').value = state.rarity; $('#level').value = state.itemLevel;
  picker.setLocked(state.locked);
  ['#rarity','#level','#modifier','#fractured','#add-mod'].forEach(id => $(id).disabled = state.locked || (['#modifier','#fractured','#add-mod'].includes(id) && !supportsDemoCrafting(base)));
  ['#goal-modifier','#goal-add'].forEach(id => $(id).disabled = !supportsDemoCrafting(base));
  $('#setup-hint').textContent = state.locked ? '제작 중: 시작 아이템 설정 잠김. 새 제작 시작을 누르면 초기화됩니다.' : '최초 오브 사용 시 설정이 잠깁니다.';
  $('#item-name').textContent = base.name;
  $('#base-category-label').textContent = `${base.group} / ${CATEGORY_LABELS[base.category] || base.category} / ${base.subType || '기본 유형'}`;
  $('#base-stats').textContent = `아이템 레벨 ${state.itemLevel} · ${describeBase(base)}`;
  $('#craft-support-note').textContent = supportsDemoCrafting(base)
    ? '시연용 오브 동작 지원 · 속성 확률과 장비 조건은 아직 미검증'
    : '베이스 탐색 가능 · 해당 장비의 실제 속성 풀이 미연동되어 오브 제작을 차단합니다.';
  $('#rarity-label').textContent = ({ normal:'일반', magic:'마법', rare:'희귀' })[state.rarity];
  const progress = goalProgress(state);
  $('#goal-progress').textContent = `달성 ${progress.achieved.length}/${progress.total}${progress.complete ? ' · 목표 완료' : ''}`;
  $('#goal-list').innerHTML = (state.goals || []).map(id => {
    const achieved = progress.achieved.includes(id);
    return `<div class="goal-row"><span class="${achieved ? 'achieved' : ''}">${achieved ? '✓ ' : '○ '}${escapeHTML(modById[id].name)}</span><button type="button" class="secondary remove-mod" data-goal-remove="${escapeHTML(id)}" aria-label="목표 삭제">삭제</button></div>`;
  }).join('') || '<p class="subtle">목표 속성을 추가해 주세요.</p>';
  $('#prefix-list').innerHTML = renderMods('prefix');
  $('#suffix-list').innerHTML = renderMods('suffix');
  $('#prefix-count').textContent = `${state.mods.filter(m => modById[m.id].kind === 'prefix').length}/${SLOT_LIMITS[state.rarity]}`;
  $('#suffix-count').textContent = `${state.mods.filter(m => modById[m.id].kind === 'suffix').length}/${SLOT_LIMITS[state.rarity]}`;
  document.querySelectorAll('[data-omen]').forEach(el => el.classList.toggle('active', el.dataset.omen === state.omenId));
  $('#notice').textContent = state.notice; $('#notice').classList.toggle('error',state.notice.startsWith('사용 불가'));
  const used = Object.entries(state.usage).filter(([_, amount])=>amount>0);
  $('#usage').innerHTML = used.length ? used.map(([id, amount]) => `<div class="usage-row"><span>${escapeHTML(orbs.find(o=>o.id===id)?.name || omenById[id]?.name || id)}</span><strong>×${amount}</strong></div>`).join('') : '<p class="subtle">아직 사용한 재료가 없습니다.</p>';
  $('#logs').innerHTML = [...state.log].reverse().map(entry=>`<li class="${entry.success?'':'failed'}"><b>#${entry.order} ${escapeHTML(entry.action)}${entry.success?'':' · 오류'}</b>${escapeHTML(entry.detail)}${entry.omen ? '<br>징조 소모: ' + escapeHTML(entry.omen) : ''}</li>`).join('');
}
setup();
