import { koreanBaseNames } from './kr-base-names.js';
// DEMO DATA ONLY. These are NOT verified official POE2 mod weights or recipes.
// Never relabel a demonstration probability as an in-game probability.
import { armourBases } from './pob2-armour.js';
import { weaponBasesA } from './pob2-weapons-a.js';
import { weaponBasesB } from './pob2-weapons-b.js';
import { accessoryBases } from './pob2-accessories.js';

// Some PoB2 entries share the same English name but differ in implicit or base stats.
 // Keep every distinct source entry, giving repeated names stable per-source variant IDs.
const rawBases = [...armourBases, ...weaponBasesA, ...weaponBasesB, ...accessoryBases];
const nameCounts = rawBases.reduce((all, b) => (all[b.id] = (all[b.id] || 0) + 1, all), Object.create(null));
const seenVariants = Object.create(null);
export const bases = [
  ...rawBases.map(b => {
    if (nameCounts[b.id] === 1) return { ...b, name: koreanBaseNames[b.sourceName] || b.name };
    const variant = (seenVariants[b.id] || 0) + 1;
    seenVariants[b.id] = variant;
    return { ...b, id: `${b.id}#variant-${variant}`,
      name: `${koreanBaseNames[b.sourceName] || b.name} (변형 ${variant})`, variant, variantCount: nameCounts[b.id] };
  }),
  { id:'custom_boots', name:'사용자 지정 신발 (시연)', sourceName:'Custom Boots (DEMO)',
    group:'방어구',category:'boots',subType:'Evasion/Energy Shield',
    requiredLevel:0,requirements:{},armour:{} }
];

export const modifiers = [
  { id: 'movement35', kind: 'prefix', group: 'movement', tier: 'T1', level: 82, name: '이동 속도 35% 증가' },
  { id: 'life135', kind: 'prefix', group: 'life', tier: 'T1', level: 60, name: '생명력 최대치 +135' },
  { id: 'defense65', kind: 'prefix', group: 'defenses', tier: 'T2', level: 1, name: '회피 및 에너지 보호막 65% 증가' },
  { id: 'mana65', kind: 'prefix', group: 'mana', tier: 'T3', level: 1, name: '마나 최대치 +65' },
  { id: 'fire42', kind: 'suffix', group: 'fire_res', tier: 'T1', level: 1, name: '화염 저항 +42%' },
  { id: 'cold38', kind: 'suffix', group: 'cold_res', tier: 'T2', level: 1, name: '냉기 저항 +38%' },
  { id: 'light41', kind: 'suffix', group: 'light_res', tier: 'T1', level: 1, name: '번개 저항 +41%' },
  { id: 'stun', kind: 'suffix', group: 'stun', tier: 'T4', level: 1, name: '기절 회복 증가' },
  { id: 'dex23', kind: 'suffix', group: 'dex', tier: 'T3', level: 1, name: '민첩 +23' }
];

export const orbs = [
  { id: 'transmute', name: '진화의 오브' },
  { id: 'augment', name: '확장의 오브' },
  { id: 'regal', name: '제왕의 오브' },
  { id: 'exalt', name: '엑잘티드 오브' },
  { id: 'chaos', name: '카오스 오브' },
  { id: 'annul', name: '소멸의 오브' }
];

export const omens = [
  { id: 'left_annul', name: '좌측 소멸의 징조', orbId: 'annul', kind: 'prefix' },
  { id: 'right_annul', name: '우측 소멸의 징조', orbId: 'annul', kind: 'suffix' }
];

export const DEMO_NOTICE = '시연용 가상 속성·동일 가중치. 실제 POE2 등장 확률 및 모든 오브 규칙은 미검증입니다.';
