import {documentTextDiff} from '../../../../server/modules/documents/document-diff.ts';

interface Fields {title:string;body:string;reason:string}
type Change='UNCHANGED'|'ADDED'|'REMOVED'|'CHANGED';
interface FieldComparison {change:Change;before:string;after:string}
interface BodyComparison {change:Change;detail?:'FULL'|'LIMITED';diff?:ReturnType<typeof documentTextDiff>;reason?:'SIZE_LIMIT'|'LINE_LIMIT'}
const maxChars=65536,maxLines=2000;
function change(before:string,after:string):Change{return before===after?'UNCHANGED':before===''?'ADDED':after===''?'REMOVED':'CHANGED';}
function tooManyLines(text:string):boolean{
 let lines=0;
 for(let n=0;n<text.length;n++){
  const c=text.charCodeAt(n);
  if(c===13||c===10){if(++lines>maxLines)return true;if(c===13&&text.charCodeAt(n+1)===10)n++;}
 }
 return lines+(text&&!/[\r\n]$/.test(text)?1:0)>maxLines;
}
export function compareKnowledgeCorrection(base:Fields,current:Fields):{title:FieldComparison;reason:FieldComparison;body:BodyComparison}{
 const field=(before:string,after:string):FieldComparison=>({change:change(before,after),before,after});
 const bodyChange=change(base.body,current.body);let body:BodyComparison;
 if(bodyChange==='UNCHANGED')body={change:bodyChange};
 else if(base.body.length>maxChars||current.body.length>maxChars)body={change:bodyChange,detail:'LIMITED',reason:'SIZE_LIMIT'};
 else if(tooManyLines(base.body)||tooManyLines(current.body))body={change:bodyChange,detail:'LIMITED',reason:'LINE_LIMIT'};
 else body={change:bodyChange,detail:'FULL',diff:documentTextDiff(base.body,current.body)};
 return {title:field(base.title,current.title),reason:field(base.reason,current.reason),body};
}
