import { omenCatalogue } from './omen-catalogue.js';
import { abyssMaterials } from './abyss-catalogue.js';
import { koreanBaseNames } from './kr-base-names.js';
import { currencies } from './currencies.js';
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

export const orbs = currencies;

const extraOmenEffects={
  'omen-of-sinistral-alchemy':{orbId:'alchemy',effectId:'alchemyPrefix'},
  'omen-of-dextral-alchemy':{orbId:'alchemy',effectId:'alchemySuffix'},
  'omen-of-corruption':{orbId:'vaal',effectId:'alwaysChange'},
  'omen-of-homogenising-exaltation':{orbId:'exalt',effectId:'homogenise'},
  'omen-of-homogenising-coronation':{orbId:'regal',effectId:'homogenise'},
  'omen-of-chance':{orbId:'chance',effectId:'protectChance'},
  'omen-of-the-ancients':{orbId:'chance',effectId:'guaranteeUnique'},
  'omen-of-sanctification':{orbId:'divine',effectId:'sanctify'},
  'omen-of-the-blessed':{orbId:'divine',effectId:'divineImplicit'},
  'omen-of-putrefaction':{effectId:'putrefaction'},
  'omen-of-catalysing-exaltation':{orbId:'exalt',effectId:'catalyse'},
  'omen-of-sinistral-crystallisation':{effectId:'essencePrefix'},
  'omen-of-dextral-crystallisation':{effectId:'essenceSuffix'},
  'omen-of-sinistral-erasure':{orbId:'chaos',kind:'prefix'},
  'omen-of-dextral-erasure':{orbId:'chaos',kind:'suffix'},
  'omen-of-whittling':{orbId:'chaos',effectId:'lowestLevel'},
  'omen-of-greater-exaltation':{orbId:'exalt',effectId:'addTwo'},
  'omen-of-greater-annulment':{orbId:'annul',effectId:'removeTwo'},
  'omen-of-light':{orbId:'annul',effectId:'removeDesecrated'},
  'omen-of-sinistral-necromancy':{effectId:'bonePrefix'},
  'omen-of-dextral-necromancy':{effectId:'boneSuffix'},
  'omen-of-abyssal-echoes':{effectId:'rerollReveal'},
  'omen-of-the-sovereign':{effectId:'boneUlaman'},
  'omen-of-the-liege':{effectId:'boneAmanamu'},
  'omen-of-the-blackblooded':{effectId:'boneKurgal'}
};
export const omens=omenCatalogue.map(o=>extraOmenEffects[o.id]
  ?{...o,...extraOmenEffects[o.id],implemented:true}:o);
export const abyssCraftingMaterials = abyssMaterials;

export const DEMO_NOTICE = 'POE2 한국어 일반 속성·PoE2DB 에센스/오브 데이터 사용. 속성 가중치와 일부 특수 결과는 아직 미검증입니다. 일반 장비 제작용 징조 31종의 조건·소모를 연결했지만, 실제 게임과 동일한 확률 또는 완전한 고유/바알 결과를 보장하지 않습니다.';
