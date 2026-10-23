import { modEligibility } from '../data/pob2-mod-eligibility.js';
import { modClassesArmour } from '../data/kr-mods-armour.js';
import { modClassesWeaponsA } from '../data/kr-mods-weapons-a.js';
import { modClassesWeaponsB } from '../data/kr-mods-weapons-b.js';
import { modClassesMisc } from '../data/kr-mods-misc.js';

const classes = {...modClassesArmour,...modClassesWeaponsA,...modClassesWeaponsB,...modClassesMisc};
const categoryClass = Object.freeze({
  amulet:'Amulet', belt:'Belt',body:'Body_Armour',boots:'Boots',
  bow:'Bow',claw:'Claw',crossbow:'Crossbow',dagger:'Dagger',flail:'Flail',
  focus:'Focus',gloves:'Gloves',helmet:'Helmet',quiver:'Quiver',
  ring:'Ring',sceptre:'Sceptre',spear:'Spear',talisman:'Talisman',wand:'Wand'
});
export const classModCounts = Object.fromEntries(Object.entries(classes).map(([id,mods])=>[id,mods.length]));
export const allRealMods = Object.values(classes).flat().reduce((out,row)=>{
  if(!Object.hasOwn(out,row.id))out[row.id]={
    ...row,level:modEligibility[row.id]?.level??-1,source:'GGPK/PoB2'
  };
  return out;
}, Object.create(null));
export function modClassOf(base) {
  if(!base)return null;
  if(base.category==='axe'||base.category==='mace'||base.category==='sword'){
    const two=/Two Hand|Two-Hand|TwoHand/i.test(base.subType||'');
    const prefix=two?'Two_Hand_':'One_Hand_';
    return prefix+base.category[0].toUpperCase()+base.category.slice(1);
  }
  if(base.category==='shield')return base.subType==='Evasion'?'Buckler':'Shield';
  if(base.category==='staff')return base.subType==='Warstaff'?'Warstaff':'Staff';
  return categoryClass[base.category]||null;
}
const defenceTag=Object.freeze({
 'Armour':'str_armour','Evasion':'dex_armour','Energy Shield':'int_armour',
 'Armour/Evasion':'str_dex_armour','Armour/Energy Shield':'str_int_armour',
 'Evasion/Energy Shield':'dex_int_armour',
 'Armour/Evasion/Energy Shield':'str_dex_int_armour'
});
export function tagsForBase(base){
  if(!base)return [];
  const tags=new Set([base.category]);
  if(base.category==='body')tags.add('body_armour');
  if(base.category==='shield'){
    tags.add('shield');
    if(base.subType==='Evasion')tags.add('buckler');
    const s=base.subType;
    if(s==='Armour')tags.add('str_shield');
    if(s==='Evasion')tags.add('dex_shield');
    if(s==='Armour/Evasion')tags.add('str_dex_shield');
    if(s==='Armour/Energy Shield')tags.add('str_int_shield');
  }
  if(['boots','gloves','helmet','body','focus'].includes(base.category)){
    const defence=defenceTag[base.subType]||'';
    if(defence)tags.add(defence);
    if(base.category==='focus')tags.add('int_armour');
  }
  if(['axe','mace','sword'].includes(base.category))tags.add(base.category);
  if(base.group==='무기'){
    tags.add('weapon');
    if(['One_Hand_Axe','One_Hand_Mace','One_Hand_Sword','Wand','Dagger','Claw','Flail','Sceptre'].includes(modClassOf(base)))tags.add('one_hand_weapon');
    else tags.add('two_hand_weapon');
  }
  return [...tags];
}
export function modsForBase(base,itemLevel=100){
  const classId=modClassOf(base), pool=classes[classId]||[],tags=tagsForBase(base);
  return pool.filter(m=>{
    const elig=modEligibility[m.id];
    return elig && elig.level<=itemLevel && elig.tags.some(t=>tags.includes(t));
  }).map(m=>allRealMods[m.id]);
}
export function allowedMod(base,mod,itemLevel){
  return modsForBase(base,itemLevel).some(m=>m.id===mod.id);
}
export function groupsOf(mod){
  return Array.isArray(mod?.group)?mod.group:(mod?.group?[mod.group]:[]);
}
export function hasGroupConflict(a,b){
  const bGroups=new Set(groupsOf(b));
  return groupsOf(a).some(g=>bGroups.has(g));
}
export function rollAffixText(mod,rng=Math.random){
  const effect=mod.effect||mod.name||'속성';
  // The GGPK text uses parenthesized (min-max) spans. This samples each span only
  // for UI presentation, independently; it does NOT imply official correlated rolls.
  const roll=(min,max)=>Math.min(max,Math.max(min,min+Math.floor(rng()*(max-min+1))));
  return effect.replace(/\((-?\d+)-(-?\d+)\)/g,(_whole,a,b)=>{
    const lo=Number(a),hi=Number(b);return String(roll(Math.min(lo,hi),Math.max(lo,hi)));
  });
}
export const affixDataMode='REAL_ELIGIBILITY_UNVERIFIED_WEIGHTS';
