import { bases } from '../data/demo.js';

export const CATEGORY_LABELS = Object.freeze({
  amulet:'목걸이',axe:'도끼',belt:'허리띠',body:'갑옷',boots:'신발',bow:'활',
  claw:'클로',crossbow:'쇠뇌',dagger:'단검',flail:'도리깨',focus:'집중구',
  gloves:'장갑',helmet:'투구',mace:'철퇴',quiver:'화살통',ring:'반지',
  sceptre:'셉터',shield:'방패',spear:'창',staff:'지팡이',sword:'검',
  talisman:'탈리스만',wand:'마법봉'
});
export const GROUP_ORDER = ['방어구','무기','장신구'];
export const DEFENCE_LABELS = Object.freeze({
  'Armour':'방어도','Evasion':'회피','Energy Shield':'에너지 보호막',
  'Armour/Evasion':'방어도/회피','Armour/Energy Shield':'방어도/에너지 보호막',
  'Evasion/Energy Shield':'회피/에너지 보호막',
  'Armour/Evasion/Energy Shield':'방어도/회피/에너지 보호막',
  'Warstaff':'전투 지팡이'
});
export function categoryOptions(group) {
  return [...new Set(bases.filter(b=>b.group===group).map(b=>b.category))]
    .sort((a,b)=>(CATEGORY_LABELS[a]||a).localeCompare(CATEGORY_LABELS[b]||b,'ko'));
}
export function subtypeOptions(group,category) {
  return [...new Set(bases.filter(b=>b.group===group&&b.category===category).map(b=>b.subType).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
}
export function filterBases({group,category,subType='',query=''}) {
  const term=query.normalize('NFKC').toLocaleLowerCase('ko').trim();
  return bases.filter(b=>(!group||b.group===group)&&(!category||b.category===category)&&
    (!subType||b.subType===subType)&&(!term||[b.name,b.sourceName,b.subType,CATEGORY_LABELS[b.category]||'']
      .some(v=>(v||'').normalize('NFKC').toLocaleLowerCase('ko').includes(term))))
    .sort((a,b)=>a.requiredLevel-b.requiredLevel||a.sourceName.localeCompare(b.sourceName));
}
export function supportsDemoCrafting(base) {
  // Only EV/ES boots have the same defence family as the original Daggerfoot UI demo.
  // This is a UI-test allowlist, NOT proof of valid PoE2 modifier spawn weights.
  return !!base && base.category==='boots' &&
    (base.id==='custom_boots'||base.subType==='Evasion/Energy Shield');
}
export function describeBase(base) {
  if(!base) return '베이스를 선택해 주세요.';
  const parts = [`요구 레벨 ${base.requiredLevel||0}`];
  const a=base.armour||{},w=base.weapon||{};
  for(const [key,label] of [['Armour','방어도'],['Evasion','회피'],['EnergyShield','에너지 보호막'],['Ward','보호막'],['BlockChance','막기 확률']]){
    if(a[key]!==undefined) parts.push(`${label} ${a[key]}`);
  }
  if(w.PhysicalMin!==undefined&&w.PhysicalMax!==undefined) parts.push(`물리 피해 ${w.PhysicalMin}–${w.PhysicalMax}`);
  if(w.AttackRateBase!==undefined)parts.push(`공격 속도 ${w.AttackRateBase}`);
  if(w.CritChanceBase!==undefined)parts.push(`기본 치명타 확률 ${w.CritChanceBase}`);
  if(base.implicit)parts.push(`고정 속성: ${base.implicit}`);
  return parts.join(' · ');
}
