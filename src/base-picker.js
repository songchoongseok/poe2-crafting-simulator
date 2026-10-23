import { baseById } from './engine.js';
import { CATEGORY_LABELS,GROUP_ORDER,DEFENCE_LABELS,categoryOptions,subtypeOptions,filterBases } from './catalogue.js';

const $=id=>document.getElementById(id);
const choose=(items,label='전체')=>{const o=new Option(label,'');return [o,...items.map(x=>new Option(x.label,x.value))]};
const fill=(element,options,value)=>{element.replaceChildren(...options);element.value=value;};

export function createBasePicker(onSelect) {
  const group=$('base-group'),category=$('base-category'),subType=$('base-subtype');
  const query=$('base-search'),base=$('base'),count=$('base-count');
  let selectedId='';
  function updateCategories() {
    const cats=categoryOptions(group.value);
    fill(category,cats.map(c=>({value:c,label:CATEGORY_LABELS[c]||c})).map(x=>new Option(x.label,x.value)),cats[0]||'');
    updateSubtypes();
  }
  function updateSubtypes() {
    const types=subtypeOptions(group.value,category.value);
    fill(subType,choose(types.map(t=>({value:t,label:DEFENCE_LABELS[t]||t})),'전체 세부 유형'),'');
    refresh();
  }
  function refresh() {
    const results=filterBases({group:group.value,category:category.value,subType:subType.value,query:query.value});
    const opts=[new Option('베이스 선택', ''),...results.map(b=>new Option(
      `${b.name}${b.name!==b.sourceName?' ('+b.sourceName+')':''} · 요구 Lv.${b.requiredLevel}`,b.id))];
    base.replaceChildren(...opts);
    base.value=results.some(b=>b.id===selectedId)?selectedId:'';
    count.textContent=`검색 결과 ${results.length.toLocaleString('ko-KR')}개 · PoB2 원본 기반`;
  }
  fill(group,GROUP_ORDER.map(v=>new Option(v,v)),'방어구');
  group.addEventListener('change',()=>{query.value='';updateCategories()});
  category.addEventListener('change',()=>{query.value='';updateSubtypes()});
  subType.addEventListener('change',refresh);
  query.addEventListener('input',refresh);
  base.addEventListener('change',()=>{
    if(!base.value)return;
    if(onSelect(base.value)!==false)selectedId=base.value;
    refresh();
  });
  function sync(id) {
    const b=baseById[id];if(!b)return;
    selectedId=id;
    group.value=b.group;
    query.value='';
    updateCategories();
    category.value=b.category;
    updateSubtypes();
    base.value=id;
  }
  function setLocked(locked){
    [group,category,subType,query,base].forEach(e=>e.disabled=locked);
  }
  return {sync,setLocked,refresh};
}
