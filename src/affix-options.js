import { modsForBase } from './affixes.js';

export function affixFamilies(base,itemLevel) {
  const available=modsForBase(base,itemLevel);
  const all=modsForBase(base,100);
  const families=new Map();
  for(const m of all){
    const stem=m.id.replace(/\d+$/,'');
    const key=`${m.kind}:${stem}`;
    if(!families.has(key))families.set(key,[]);
    families.get(key).push(m);
  }
  const availableIds=new Set(available.map(m=>m.id));
  return [...families.entries()].map(([key,rows])=>{
    rows.sort((a,b)=>b.level-a.level||b.levelGroup-a.levelGroup);
    const unlocked=rows.filter(m=>availableIds.has(m.id));
    if(!unlocked.length)return null;
    return {key,label:`${rows[0].kind==='prefix'?'접두':'접미'} · ${unlocked[0].effect}`,
      kind:rows[0].kind,
      tiers:unlocked.map(m=>({
        id:m.id,level:m.level,
        label:`T${rows.findIndex(x=>x.id===m.id)+1} · ${m.effect} (요구 Lv.${m.level})`
      }))};
  }).filter(Boolean).sort((a,b)=>a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label,'ko'));
}
