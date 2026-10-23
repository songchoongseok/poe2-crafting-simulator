// Equipment-wide rules shared by the editor, currency actions and session validator.
export function slotLimits(base,rarity){
  if(rarity==='normal')return {prefix:0,suffix:0};
  if(rarity==='magic')return {prefix:1,suffix:1};
  const implicit=base?.implicit||'';
  const plusPrefix=Number(implicit.match(/\+(\d+) Prefix Modifiers? allowed/)?.[1]||0);
  const minusPrefix=Number(implicit.match(/-(\d+) Prefix Modifiers? allowed/)?.[1]||0);
  const plusSuffix=Number(implicit.match(/\+(\d+) Suffix Modifiers? allowed/)?.[1]||0);
  const minusSuffix=Number(implicit.match(/-(\d+) Suffix Modifiers? allowed/)?.[1]||0);
  return {prefix:Math.max(0,3+plusPrefix-minusPrefix),suffix:Math.max(0,3+plusSuffix-minusSuffix)};
}
export function qualityCap(base){
  if(base?.sourceName==='Refined Breach Ring')return 45;
  if(base?.sourceName==='Breach Ring')return 40;
  return 20;
}
export function augmentSocketCap(base){
  if(!base||base.group==='장신구'||['belt','quiver'].includes(base.category))return 0;
  if(base.category==='body')return 2;
  if(base.group==='방어구')return 1;
  const type=(base.subType||'').toLowerCase();
  return /two.hand|two hand|warstaff|staff|longbow|bow|crossbow/.test(type)||
    ['bow','crossbow','staff'].includes(base.category)?2:1;
}
// The exact quality gain per currency depends on item level; this provisional
// progression is deliberately isolated until its level breakpoints are sourced.
export function approximateQualityGain(level){
  if(level>=70)return 1;
  if(level>=40)return 2;
  if(level>=20)return 3;
  return 4;
}
