// PoE2DB (Korean Currency page): names and minimum modifier levels.
const tiered = [
  ['transmute','진화의 오브',44,70],
  ['augment','확장의 오브',44,70],
  ['regal','제왕의 오브',35,50],
  ['exalt','엑잘티드 오브',35,50],
  ['chaos','카오스 오브',35,50]
];
export const currencies = [
  ...tiered.flatMap(([id,name,greater,perfect])=>[
    {id,name,action:id,minModLevel:1},
    {id:id+'-greater',name:'상위 '+name,action:id,minModLevel:greater},
    {id:id+'-perfect',name:'완벽한 '+name,action:id,minModLevel:perfect}
  ]),
  {id:'alchemy',name:'연금술의 오브',action:'alchemy'},
  {id:'chance',name:'기회의 오브',action:'chance'},
  {id:'annul',name:'소멸의 오브',action:'annul'},
  {id:'fracture',name:'분열의 오브',action:'fracture'},
  {id:'divine',name:'신성한 오브',action:'divine'},
  {id:'vaal',name:'바알 오브',action:'vaal'}
];
