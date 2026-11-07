import type {DocumentVersion} from './api.ts';

export const documentDefinitionLabels={title:'제목',formRef:'양식 참조',stageNodeRef:'방법론 단계 참조',sections:'목차 위치',attachments:'첨부 참조',sourceRefs:'출처 참조'} as const;
type DefinitionField=keyof typeof documentDefinitionLabels;
type Definition=Pick<DocumentVersion,'title'|'formRef'|'stageNodeRef'>&{content:Pick<DocumentVersion['content'],'sections'|'attachments'|'sourceRefs'>};
type DefinitionDifference={field:DefinitionField}&({kind:'IDENTICAL'}|{kind:'CHANGED';before:string;after:string}|{kind:'UNVERIFIED';reason:'DISPLAY_LIMIT'});
function displayValue(value:unknown):string|null{
 let units=0,nodes=0;
 const spend=(n:number)=>{units+=n;if(units>131072)throw new RangeError('DISPLAY_LIMIT');};
 function visit(v:unknown,depth:number):unknown{
  if(depth>32||++nodes>20000)throw new RangeError('DISPLAY_LIMIT');
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)){spend(JSON.stringify(v).length);return v;}
  if(typeof v==='string'){spend(JSON.stringify(v).length);return v;}
  if(Array.isArray(v)){if(v.length>20000)throw new RangeError('DISPLAY_LIMIT');spend(2+Math.max(0,v.length-1));return v.map(item=>visit(item,depth+1));}
  if(typeof v==='object'){
   const keys=Object.keys(v).sort();if(keys.length>20000)throw new RangeError('DISPLAY_LIMIT');spend(2+Math.max(0,keys.length-1));
   return Object.fromEntries(keys.map(key=>{spend(JSON.stringify(key).length+1);return[key,visit((v as Record<string,unknown>)[key],depth+1)];}));
  }
  throw new RangeError('DISPLAY_LIMIT');
 }
 try{return JSON.stringify(visit(value,0));}catch{return null;}
}
/** 기존 GET가 반환한 정의의 비교다. 참조 대상의 실제 파일/현재성을 검사하지 않는다. */
export function compareDocumentDefinitions(before:Definition,after:Definition):DefinitionDifference[]{
 const values=(d:Definition)=>({title:d.title,formRef:d.formRef,stageNodeRef:d.stageNodeRef??null,sections:d.content.sections,attachments:d.content.attachments,sourceRefs:d.content.sourceRefs});
 const left=values(before),right=values(after);
 return (Object.keys(documentDefinitionLabels) as DefinitionField[]).map(field=>{
  const a=displayValue(left[field]),b=displayValue(right[field]);
  if(a===null||b===null)return{field,kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'};
  if(a===b)return{field,kind:'IDENTICAL'};
  const textA=JSON.stringify(JSON.parse(a),null,2),textB=JSON.stringify(JSON.parse(b),null,2);
  if(textA.length>131072||textB.length>131072)return{field,kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'};
  return{field,kind:'CHANGED',before:textA,after:textB};
 });
}

export type DocumentBodyComparison =
  | { kind: 'IDENTICAL' }
  | { kind: 'CHANGED'; commonBeforeLines: number; commonAfterLines: number; before: string; after: string }
  | { kind: 'UNVERIFIED'; reason: 'DISPLAY_LIMIT' };

// 공통 양끝을 제외한 구간 비교다. 중간의 최소 편집 경로를 추정하지 않는다.
export function compareDocumentBodies(before: string, after: string): DocumentBodyComparison {
  if (before.length > 131072 || after.length > 131072) return { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' };
  const left = before.split(/(?<=\n)/), right = after.split(/(?<=\n)/);
  const lines = (value: string) => value.split('\n').length;
  if (lines(before) > 4000 || lines(after) > 4000) return { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' };
  if (before === after) return { kind: 'IDENTICAL' };
  if (!before) left.length = 0;
  if (!after) right.length = 0;
  let prefix = 0, suffix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
  return {
    kind: 'CHANGED', commonBeforeLines: prefix, commonAfterLines: suffix,
    before: left.slice(prefix, left.length - suffix).join(''),
    after: right.slice(prefix, right.length - suffix).join(''),
  };
}
