import { essenceCatalogue } from '../data/poe2db-essences.js';
import { essenceVerifiedKinds } from '../data/poe2db-essence-affixes.js';
import { tagsForBase } from './affixes.js';
import { isMartialWeapon,isMeleeWeapon } from './equipment-rules.js';

export const essenceById=Object.fromEntries(essenceCatalogue.map(e=>[e.id,e]));
const categoryByNoun={
  '갑옷':'body','장화':'boots','장갑':'gloves','투구':'helmet',
  '방패':'shield','집중구':'focus','목걸이':'amulet','반지':'ring',
  '허리띠':'belt','화살통':'quiver','활':'bow','석궁':'crossbow',
  '마법봉':'wand','지팡이':'staff','셉터':'sceptre'
};
const armour=new Set(['body','boots','gloves','helmet','shield','focus']);
const jewellery=new Set(['ring','amulet','belt']);
function targetMatches(base,token){
  if(!base)return false;
  if(token==='장비')return true;
  if(token==='방어구')return armour.has(base.category);
  if(token==='장신구')return jewellery.has(base.category);
  if(token==='무도 무기')return isMartialWeapon(base);
  if(token==='근접 무기')return isMeleeWeapon(base);
  if(token==='한손 근접 무기')return isMeleeWeapon(base)&&tagsForBase(base).includes('one_hand_weapon');
  if(token==='양손 근접 무기')return isMeleeWeapon(base)&&tagsForBase(base).includes('two_hand_weapon');
  return base.category===categoryByNoun[token];
}
export function essenceOptionFor(base,essence){
  return essence.options.find(option=>option.target.split(/\s*또는\s*|,\s*/)
    .some(token=>targetMatches(base,token.trim())))||null;
}
function groupFor(effect){
  const rules=[
    [/생명력 최대치|최대 생명력/, 'IncreasedLife'],
    [/마나 최대치|최대 마나/, 'IncreasedMana'],
    [/화염 저항/,'FireResistance'],[/냉기 저항/,'ColdResistance'],
    [/번개 저항/,'LightningResistance'],[/카오스 저항/,'ChaosResistance'],
    [/공격 속도/,'AttackSpeed'],[/시전 속도/,'CastSpeed'],[/이동 속도/,'MovementVelocity'],
    [/주문 피해/,'SpellDamage'],[/물리 피해.*추가/,'AddedPhysicalDamage'],
    [/화염 피해.*추가/,'AddedFireDamage'],[/냉기 피해.*추가/,'AddedColdDamage'],
    [/번개 피해.*추가/,'AddedLightningDamage'],[/정확도/,'Accuracy'],
    [/치명타 확률|치명타 명중 확률/,'CriticalStrikeChance'],
    [/힘, 민첩|힘 \+/,'Strength'],[/민첩 \+/,'Dexterity'],[/지능 \+/,'Intelligence']
  ];
  return rules.find(([re])=>re.test(effect))?.[1]||null;
}
// All 130 imported options have verified prefix/suffix rules from individual
// PoE2DB modifier tables. An essence such as Essence of the Abyss can use both
// sides, so distinct affix IDs must exist for the same Korean tooltip option.
export const essenceMods=Object.fromEntries(essenceCatalogue.flatMap(e=>e.options.flatMap((o,i)=>{
  const verified=essenceVerifiedKinds[e.id]?.[i];
  if(!verified)throw Error(`검증된 에센스 접두·접미 데이터 누락: ${e.name} / ${i}`);
  const kinds=Array.isArray(verified)?verified:[verified];
  return kinds.map(kind=>{
    const id=`essence::${e.id}::${i}${kinds.length>1?'::'+kind:''}`;
    return [id,{id,name:e.name,effect:o.effect,kind,
      group:groupFor(o.effect)||`EssenceExclusive:${e.id}`,level:1,levelGroup:'고정',
      essenceId:e.id,source:'PoE2DB',target:o.target}];
  });
})));
export function essenceModsFor(base,essence){
  if(!base||!essence)return [];
  const i=essence.options.findIndex(o=>o===essenceOptionFor(base,essence));
  if(i<0)return [];
  const verified=essenceVerifiedKinds[essence.id]?.[i];
  const kinds=Array.isArray(verified)?verified:[verified];
  return kinds.map(kind=>essenceMods[`essence::${essence.id}::${i}${kinds.length>1?'::'+kind:''}`]);
}
export function essenceModFor(base,essence){
  return essenceModsFor(base,essence)[0]||null;
}
