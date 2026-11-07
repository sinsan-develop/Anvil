import type{PlanRef}from'./work-plan-api.ts';
export interface DesignAnchorContext{projectId:string;documentRef:PlanRef;bodyHash:string}
export interface DesignAnchorSelection extends DesignAnchorContext{anchor:string}
export type DesignAnchorResult={kind:'IDLE'}|{kind:'UNVERIFIED';reason:'CONTEXT_CHANGED'|'INVALID_ANCHOR'|'LINE_NOT_FOUND'|'DISPLAY_LIMIT'}|{kind:'READY';lineNumber:number;before:string;line:string;after:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[a-f0-9]{64}$/;
function valid(c:DesignAnchorContext){return c&&uuid.test(c.projectId)&&c.documentRef&&uuid.test(c.documentRef.id)&&Number.isSafeInteger(c.documentRef.version)&&c.documentRef.version>0&&hash.test(c.documentRef.contentHash)&&hash.test(c.bodyHash);}
/** 본문은 기존 readDocument에서 hash 확인됨. 여기서는 선택과 현재 버전만 대조하고 원문은 바꾸지 않는다. */
export function resolveDesignAnchor(body:string,context:DesignAnchorContext,selection:DesignAnchorSelection|null):DesignAnchorResult{
 if(!selection)return{kind:'IDLE'};
 if(!valid(context)||!valid(selection)||selection.projectId!==context.projectId||selection.documentRef.id!==context.documentRef.id||selection.documentRef.version!==context.documentRef.version||selection.documentRef.contentHash!==context.documentRef.contentHash||selection.bodyHash!==context.bodyHash)return{kind:'UNVERIFIED',reason:'CONTEXT_CHANGED'};
 if(typeof selection.anchor!=='string'||!/^line:[1-9][0-9]{0,7}$/.test(selection.anchor))return{kind:'UNVERIFIED',reason:'INVALID_ANCHOR'};
 if(body.length>131072)return{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'};
 const starts=[0],ends:number[]=[];
 for(let i=0;i<body.length;i++)if(body[i]==='\r'||body[i]==='\n'){
  ends.push(i);if(body[i]==='\r'&&body[i+1]==='\n')i++;starts.push(i+1);
  if(starts.length>4000)return{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'};
 }
 ends.push(body.length);const lineNumber=Number(selection.anchor.slice(5)),start=starts[lineNumber-1],end=ends[lineNumber-1];
 if(start===undefined||end===undefined)return{kind:'UNVERIFIED',reason:'LINE_NOT_FOUND'};
 return{kind:'READY',lineNumber,before:body.slice(0,start),line:body.slice(start,end),after:body.slice(end)};
}
