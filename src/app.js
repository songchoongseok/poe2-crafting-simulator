import { orbs, omens, abyssCraftingMaterials, DEMO_NOTICE } from '../data/demo.js';
import { modById, omenById, baseById, makeInitial, validateStart, setInitial, setGoals, goalProgress, applyOrb, applyEssence, applyCatalyst, previewCurrency, toggleOmen } from './engine.js';
import { slotLimits,qualityCap,augmentSocketCap } from './equipment-rules.js';
import { essenceCatalogue } from '../data/poe2db-essences.js';
import { essenceById, essenceOptionFor } from './essences.js';
import { catalysts } from '../data/catalysts.js';

import { parseSession, serializeSession } from './session.js';
import { createBasePicker } from './base-picker.js';
import { CATEGORY_LABELS, describeBase } from './catalogue.js';
import { modsForBase } from './affixes.js';
import { affixFamilies } from './affix-options.js';
import { applyBone, revealDesecration,rerollDesecration,abyssMods,isBoneForBase } from './abyss.js';

const $ = selector => document.querySelector(selector);
function newDraft(baseId='daggerfoot'){
  const base=baseById[baseId] || baseById.daggerfoot;
  return {...makeInitial(),baseId:base.id,itemLevel:Math.max(1,base.requiredLevel||1),
    rarity:'normal',mods:[],goals:[],omenId:null,usage:{},log:[],attempts:0,
    locked:false,desecration:null,desecrations:null,corrupted:false,notice:'옵션과 티어를 설정한 뒤 가운데 제작하기 버튼을 누르세요.'};
}
let state=newDraft(),picker,affixCache=[];
const ARCHIVE_KEY='poe2-crafting-sessions-v1';
function loadArchives(){
  try{
    const parsed=JSON.parse(localStorage.getItem(ARCHIVE_KEY)||'[]');
    return Array.isArray(parsed)?parsed.slice(0,60):[];
  }catch{return [];}
}
let archives=loadArchives();
function archiveCurrent(){
  if(!state.locked || (!state.attempts && !state.log.length))return;
  const base=baseById[state.baseId];
  archives.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2),baseId:state.baseId,
    name:base?.name||'알 수 없는 아이템',createdAt:new Date().toLocaleString('ko-KR'),
    rarity:state.rarity,mods:state.mods,usage:{...state.usage},logs:[...state.log],attempts:state.attempts});
  archives=archives.slice(0,60);
  try{localStorage.setItem(ARCHIVE_KEY,JSON.stringify(archives));}catch{}
}
function prepareNew(baseId=state.baseId){
  archiveCurrent();
  state=newDraft(baseId);
  picker.sync(baseId);
  render();
}
const plain = document.createElement('span');
const escapeHTML = value => { plain.textContent = String(value); return plain.innerHTML; };
const showError = reason => { state = { ...state, notice: `사용 불가: ${reason}` }; render(); };

function setup() {
  $('#disclaimer').textContent = DEMO_NOTICE;
  // Pools are populated for each newly selected equipment base in render().
  $('#omen-select').replaceChildren(...omens.map(o=>new Option(`${o.name}${o.implemented?'':' · 미구현'}`,o.id)));
  $('#essence-select').replaceChildren(...essenceCatalogue.map(x=>new Option(x.name,x.id)));
  $('#catalyst-type').replaceChildren(new Option('없음',''),...catalysts.map(x=>new Option(x.name,x.id)));
  $('#abyss-select').replaceChildren(...abyssCraftingMaterials.filter(x=>x.id!=='essence-of-the-abyss').map(x=>new Option(x.name,x.id)));
  $('#orb-buttons').innerHTML = orbs.map(o => `<button data-orb="${o.id}" type="button">${escapeHTML(o.name)}</button>`).join('');
  $('#preview-orb').replaceChildren(...orbs.filter(x=>x.action!=='mirror').map(x=>new Option(x.name,x.id)));
  $('#catalyst-buttons').innerHTML=catalysts.map(o=>`<button data-catalyst="${o.id}" type="button">${escapeHTML(o.name)}</button>`).join('');
  $('#omen-buttons').innerHTML = omens.filter(o=>o.implemented).map(o => `<button data-omen="${o.id}" type="button">${escapeHTML(o.name)}</button>`).join('');
  picker = createBasePicker(id => {prepareNew(id);return true;});
  picker.sync(state.baseId);
  $('#rarity').addEventListener('change', e => {
    const result = setInitial(state, { rarity: e.target.value, mods: [] });
    if (result.ok) state = result.state; else showError(result.reason); render();
  });
  $('#level').addEventListener('change',e=>{
    const result=setInitial(state,{itemLevel:Number(e.target.value)});
    if(result.ok)state=result.state;else showError(result.reason);render();
  });
  $('#initial-quality').addEventListener('change',e=>{
    const result=setInitial(state,{quality:Number(e.target.value)});
    if(result.ok)state=result.state;else showError(result.reason);render();
  });
  $('#initial-sockets').addEventListener('change',e=>{
    const result=setInitial(state,{sockets:Number(e.target.value)});
    if(result.ok)state=result.state;else showError(result.reason);render();
  });
  $('#catalyst-type').addEventListener('change',e=>{
    const result=setInitial(state,{catalystType:e.target.value||null,
      catalystQuality:e.target.value?state.catalystQuality:0});
    if(result.ok)state=result.state;else showError(result.reason);render();
  });
  $('#catalyst-quality').addEventListener('change',e=>{
    const result=setInitial(state,{catalystQuality:Number(e.target.value)});
    if(result.ok)state=result.state;else showError(result.reason);render();
  });

  $('#add-mod').addEventListener('click', () => {
    const newMod = { id: $('#modifier').value, fractured: $('#fractured').checked };
    const result = setInitial(state, { mods: [...state.mods, newMod] });
    if (result.ok) { state = result.state; state.notice = `기존 속성 추가: ${modById[newMod.id].name}`; }
    else showError(result.reason);
    render();
  });
  $('#orb-buttons').addEventListener('click', e => {
    const b=e.target.closest('button[data-orb]');if(!b)return;
    if(!state.locked)return showError('먼저 제작하기 버튼으로 시작 아이템 설정을 확정하세요.');
    state=applyOrb(state,b.dataset.orb).state;render();
  });
  $('#catalyst-buttons').addEventListener('click',e=>{
    const b=e.target.closest('button[data-catalyst]');if(!b)return;
    if(!state.locked)return showError('먼저 제작하기 버튼을 눌러주세요.');
    state=applyCatalyst(state,b.dataset.catalyst).state;render();
  });
  $('#preview-apply').addEventListener('click',()=>{
    state=previewCurrency(state,$('#preview-orb').value).state;render();
  });
  $('#omen-buttons').addEventListener('click', e => {
    const b=e.target.closest('button[data-omen]');if(!b)return;
    activateOmen(b.dataset.omen);
  });
  $('#omen-select').addEventListener('change', updateOmenDescription);
  $('#omen-activate').addEventListener('click',()=>activateOmen($('#omen-select').value));
  $('#essence-select').addEventListener('change',updateEssenceDescription);
  $('#essence-apply').addEventListener('click',()=>{
    if(!state.locked)return showError('먼저 제작하기 버튼을 누르세요.');
    state=applyEssence(state,$('#essence-select').value).state;render();
  });
  $('#abyss-select').addEventListener('change',updateAbyssDescription);
  $('#abyss-apply').addEventListener('click',()=>{
    if(!state.locked)return showError('먼저 제작하기 버튼으로 시작 아이템을 확정하세요.');
    state=applyBone(state,baseById[state.baseId],$('#abyss-select').value).state;render();
  });
  $('#abyss-reveal').addEventListener('click',e=>{
    const b=e.target.closest('button[data-reveal]');if(!b)return;
    state=revealDesecration(state,b.dataset.reveal).state;render();
  });
  $('#abyss-reroll').addEventListener('click',()=>{
    state=rerollDesecration(state).state;render();
  });
  $('#mod-family').addEventListener('change',()=>renderTierOptions('mod'));
  $('#goal-family').addEventListener('change',()=>renderTierOptions('goal'));
  $('#start-craft').addEventListener('click',()=>{
    if(state.locked)return;
    const error=validateStart(state);if(error)return showError(error);
    state={...state,locked:true,usage:{},log:[],attempts:0,omenId:null,
      notice:'제작이 시작됐습니다. 오브를 누르면 즉시 사용되고 로그와 사용량에 기록됩니다.'};
    render();
  });
  $('#prepare-craft').addEventListener('click',()=>prepareNew());
  updateOmenDescription();updateAbyssDescription();updateEssenceDescription();
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
  $('#reset').addEventListener('click',()=>prepareNew());
  $('#prefix-list').addEventListener('click', deleteMod);
  $('#suffix-list').addEventListener('click', deleteMod);
  render();
}

function activateOmen(id){
  if(!state.locked)return showError('제작하기 버튼을 누른 뒤 징조를 활성화하세요.');
  const res=toggleOmen(state,id);
  if(!res.ok)return showError(res.reason||'이 징조를 활성화할 수 없습니다.');
  state=res.state;render();
}
function updateOmenDescription(){
  const o=omens.find(x=>x.id===$('#omen-select').value);
  $('#omen-description').textContent=o?o.description+(o.implemented?' · 효과 구현':' · 제작 효과 미구현'):'';
}
function updateEssenceDescription(){
  const essence=essenceById[$('#essence-select').value];
  const option=essence&&essenceOptionFor(baseById[state.baseId],essence);
  $('#essence-description').textContent=essence?
    (option?`${essence.action}\n${option.target}: ${option.effect}`:
      `${essence.action}\n이 베이스에는 확정 속성 대상이 없어 사용할 수 없습니다.`):'';
}
function updateAbyssDescription(){
  const o=abyssCraftingMaterials.find(x=>x.id===$('#abyss-select').value);
  $('#abyss-description').textContent=o?(o.description+
    (isBoneForBase(baseById[state.baseId],o.id)?' · 이 장비에 사용 가능':' · 해당 장비에는 사용 불가')):'';
}
function renderTierOptions(which){
  const family=$(`#${which}-family`), tier=$(`#${which==='mod'?'modifier':'goal-modifier'}`);
  const choice=affixCache.find(x=>x.key===family.value);
  tier.replaceChildren(...(choice?.tiers||[]).map(t=>new Option(t.label,t.id)));
  tier.disabled=!choice || (which==='mod' && state.locked);
}
function renderFamilies(){
  affixCache=affixFamilies(baseById[state.baseId],state.itemLevel);
  for(const [prefix,prev] of [['mod',$('#mod-family').value],['goal',$('#goal-family').value]]){
    const family=$(`#${prefix}-family`);
    family.replaceChildren(...affixCache.map(f=>new Option(f.label,f.key)));
    if(affixCache.some(f=>f.key===prev))family.value=prev;
    family.disabled=!affixCache.length || (prefix==='mod'&&state.locked);
    renderTierOptions(prefix);
  }
}
function renderArchive(){
  const groups=new Map();
  for(const entry of archives){
    if(!groups.has(entry.baseId))groups.set(entry.baseId,[]);
    groups.get(entry.baseId).push(entry);
  }
  $('#archive-list').innerHTML=[...groups.entries()].map(([id,sessions])=>{
    const name=escapeHTML(sessions[0].name);
    return `<details class="archive-card"><summary>${name} <span>${sessions.length}회 제작</span></summary>
      ${sessions.map(a=>`<details class="archive-session"><summary>${escapeHTML(a.createdAt)} · ${a.attempts}회 오브 사용</summary>
      <div class="archive-usage">${Object.entries(a.usage).map(([k,n])=>`${escapeHTML(orbs.find(o=>o.id===k)?.name||omenById[k]?.name||abyssCraftingMaterials.find(o=>o.id===k)?.name||essenceById[k]?.name||catalysts.find(o=>o.id===k)?.name||(k==='hinekoras-lock'?'히네코라의 머리카락':k))} ×${n}`).join(' · ')||'재료 사용 없음'}</div>
      <ol class="logs">${a.logs.map(l=>`<li><b>#${l.order} ${escapeHTML(l.action)}</b>${escapeHTML(l.detail)}</li>`).join('')}</ol>
      </details>`).join('')}</details>`;
  }).join('')||'<p class="subtle">보관된 제작 이력이 없습니다.</p>';
}

function deleteMod(e) {
  const b = e.target.closest('[data-remove]'); if (!b || state.locked) return;
  const idx = Number(b.dataset.remove);
  const result = setInitial(state, { mods: state.mods.filter((_, i) => i !== idx) });
  if (result.ok) state = result.state; else showError(result.reason);
  render();
}
function renderMods(kind) {
  const selected=state.mods.map((m,index)=>({...m,index,definition:modById[m.id]}))
    .filter(m=>m.definition?.kind===kind);
  const available=slotLimits(baseById[state.baseId],state.rarity)[kind];
  // Regular equipment uses three slots per side. Exceptional ring implicits
  // permit more on one side; keep those visible instead of hiding real mods.
  return Array.from({length:Math.max(3,available)},(_,slot)=>{
    const m=selected[slot];
    if(!m) return `<div class="mod-row empty-slot ${slot>=available?'locked-slot':''}"><span>${slot>=available?'잠긴 칸':'빈 '+(kind==='prefix'?'접두어':'접미어')+' 칸'}</span></div>`;
    const value=m.valueText||m.definition.effect||m.definition.name;
    return `<div class="mod-row occupied-slot"><div class="mod-text" title="${escapeHTML(value)}"><span>${escapeHTML(value)}</span>${m.fractured?'<span class="tag">◆ 분열</span>':''}${m.desecrated?'<span class="tag abyss-tag">✧ 훼손</span>':''}</div>
      <span class="tier">T${escapeHTML(m.definition.levelGroup??m.definition.tier??'?')}</span>
      ${!state.locked?`<button type="button" class="secondary remove-mod" data-remove="${m.index}">삭제</button>`:''}</div>`;
  }).join('');
}

function render() {
  const base = baseById[state.baseId];
  $('#rarity').value = state.rarity; $('#level').value = state.itemLevel;
  $('#initial-quality').value=state.quality||0;
  $('#initial-sockets').value=state.sockets||0;
  $('#initial-sockets').max=augmentSocketCap(base)+1;
  $('#catalyst-type').value=state.catalystType||'';
  $('#catalyst-quality').value=state.catalystQuality||0;
  $('#catalyst-quality').max=qualityCap(base);
  $('#catalyst-type').disabled=state.locked||!['ring','amulet'].includes(base.category);
  $('#catalyst-quality').disabled=state.locked||!['ring','amulet'].includes(base.category);
  picker.setLocked(false); // Changing equipment opens a new draft and archives the prior session.
  $('#rarity').disabled=state.locked;
  $('#level').disabled=state.locked;
  $('#initial-quality').disabled=state.locked;
  $('#initial-sockets').disabled=state.locked||augmentSocketCap(base)===0;
  const pool=modsForBase(base,state.itemLevel);
  renderFamilies();
  $('#start-craft').disabled=state.locked || !pool.length;
  $('#craft-phase').textContent=state.locked?'제작 진행 중 · 오브 클릭 즉시 사용':'설정 중 · 제작하기를 눌러 확정';
  $('#fractured').disabled=state.locked || !pool.length;
  $('#add-mod').disabled=state.locked || !pool.length;
  $('#goal-add').disabled=!pool.length;
  $('#setup-hint').textContent = state.locked
    ? '제작 중에는 옵션 변경이 잠깁니다. 가운데 새 제작 준비 버튼을 누르세요.'
    : '설정을 모두 마쳤으면 가운데 제작하기 버튼을 누르세요.';
  $('#item-name').textContent = base.name;
  $('#base-category-label').textContent = `${base.group} / ${CATEGORY_LABELS[base.category] || base.category} / ${base.subType || '기본 유형'}`;
  $('#base-stats').textContent = `아이템 레벨 ${state.itemLevel} · ${describeBase(base)}`;
  if(state.sanctified)$('#base-stats').textContent+=' · 축성됨';
  if(state.corrupted)$('#base-stats').textContent+=' · 타락됨';
  if(state.implicitRoll!==undefined&&state.implicitRoll!==null)$('#base-stats').textContent+=' · 고정 속성 수치 재추첨됨';
  if(state.catalystQuality)$('#base-stats').textContent+=` · ${catalysts.find(c=>c.id===state.catalystType)?.name||'기폭제'} ${state.catalystQuality}%`;
  if(state.quality)$('#base-stats').textContent+=` · 장비 퀄리티 ${state.quality}%`;
  if(state.sockets)$('#base-stats').textContent+=` · 증강물 홈 ${state.sockets}개`;
  if(state.vaalMagnitude)$('#base-stats').textContent+=` · 타락 속성 배율 ${state.vaalMagnitude}배`;
  $('#craft-support-note').textContent = pool.length
    ? `한국어 일반 속성 후보 ${pool.length}종 · 등장 비율은 미검증, 현재 균등 추첨`
    : '이 베이스에 사용 가능한 일반 속성 후보가 확인되지 않아 제작을 차단합니다.';
  $('#rarity-label').textContent = ({ normal:'일반', magic:'마법', rare:'희귀' })[state.rarity];
  if(state.rarity==='unique')$('#rarity-label').textContent='고유';
  if(state.destroyed)$('#rarity-label').textContent='파괴됨';
  $('#item-card').dataset.rarity=state.rarity;
  $('#item-card').classList.toggle('has-desecration',state.mods.some(m=>m.desecrated));
  updateAbyssDescription();
  updateEssenceDescription();
  const d=state.desecrations?.find(x=>!x.revealed)||state.desecration;
  const awaiting=Boolean(d&&!d.revealed&&d.offers?.length);
  $('#abyss-reveal').innerHTML=awaiting
    ? '<strong>영혼의 우물 · 훼손 옵션 선택</strong><p>세 가지 중 하나를 선택해 훼손 속성을 공개합니다.'+
      (state.desecrations?' 남은 공개 '+state.desecrations.filter(x=>!x.revealed).length+'개':'')+'</p>'+
      d.offers.map((id,i)=>`<button type="button" data-reveal="${escapeHTML(id)}">${i+1}. ${escapeHTML(modById[id]?.effect||'알 수 없는 속성')}</button>`).join('')
    : '';
  $('#abyss-reroll').hidden=!awaiting||d.rerolled;
  $('#abyss-reroll').disabled=state.omenId!=='omen-of-abyssal-echoes';
  const progress = goalProgress(state);
  $('#goal-progress').textContent = `달성 ${progress.achieved.length}/${progress.total}${progress.complete ? ' · 목표 완료' : ''}`;
  $('#goal-list').innerHTML = (state.goals || []).map(id => {
    const achieved = progress.achieved.includes(id);
    return `<div class="goal-row"><span class="${achieved ? 'achieved' : ''}">${achieved ? '✓ ' : '○ '}${escapeHTML(modById[id].effect||modById[id].name)}</span><button type="button" class="secondary remove-mod" data-goal-remove="${escapeHTML(id)}" aria-label="목표 삭제">삭제</button></div>`;
  }).join('') || '<p class="subtle">목표 속성을 추가해 주세요.</p>';
  $('#prefix-list').innerHTML = renderMods('prefix');
  $('#suffix-list').innerHTML = renderMods('suffix');
  $('#prefix-count').textContent = `${state.mods.filter(m => modById[m.id].kind === 'prefix').length}/${slotLimits(base,state.rarity).prefix}`;
  $('#suffix-count').textContent = `${state.mods.filter(m => modById[m.id].kind === 'suffix').length}/${slotLimits(base,state.rarity).suffix}`;
  document.querySelectorAll('[data-omen]').forEach(el => el.classList.toggle('active', el.dataset.omen === state.omenId));
  $('#notice').textContent = state.notice; $('#notice').classList.toggle('error',state.notice.startsWith('사용 불가'));
  $('#prediction-result').textContent=state.prediction?
    `예측 적용 대기 중 · ${orbs.find(x=>x.id===state.prediction.orbId)?.name}: ${state.prediction.detail}`:
    '예측 후 해당 오브를 클릭하면 표시된 결과가 적용됩니다. 다른 제작을 하면 예측이 소멸합니다.';
  $('#mirror-copy-summary').textContent=(state.mirroredCopies?.length||0)?
    `칼란드라의 거울로 만든 복제본 ${state.mirroredCopies.length}개 · 복제본은 추가 제작 불가, 원본 제작은 계속 가능` : '';
  $('#mirror-copy-list').innerHTML=(state.mirroredCopies||[]).map((copy,i)=>
    `<details class="archive-card"><summary>복제본 ${i+1} · ${escapeHTML(baseById[copy.baseId]?.name||'알 수 없는 장비')} · ${escapeHTML(({normal:'일반',magic:'마법',rare:'희귀'})[copy.rarity]||'고유')}</summary>
    <p class="subtle">아이템 레벨 ${copy.itemLevel} · 품질 ${copy.quality||0}% · 증강물 홈 ${copy.sockets||0}개 · 복제됨</p>
    ${copy.mods.map(mod=>`<div class="mod-row occupied-slot">${escapeHTML(mod.valueText||modById[mod.id]?.effect||modById[mod.id]?.name||'미확인 속성')}</div>`).join('')}
    </details>`).join('');
  const used = Object.entries(state.usage).filter(([_, amount])=>amount>0);
  $('#usage').innerHTML = used.length ? used.map(([id, amount]) => `<div class="usage-row"><span>${escapeHTML(orbs.find(o=>o.id===id)?.name || omenById[id]?.name || abyssCraftingMaterials.find(o=>o.id===id)?.name || essenceById[id]?.name || catalysts.find(o=>o.id===id)?.name || (id==='hinekoras-lock'?'히네코라의 머리카락':id))}</span><strong>×${amount}</strong></div>`).join('') : '<p class="subtle">아직 사용한 재료가 없습니다.</p>';
  $('#logs').innerHTML = [...state.log].reverse().map(entry=>`<li class="${entry.success?'':'failed'}"><b>#${entry.order} ${escapeHTML(entry.action)}${entry.success?'':' · 오류'}</b>${escapeHTML(entry.detail)}${entry.omen ? '<br>징조 소모: ' + escapeHTML(entry.omen) : ''}</li>`).join('');
  renderArchive();
}
setup();
