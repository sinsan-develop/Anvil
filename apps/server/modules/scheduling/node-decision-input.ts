import {isProxy} from 'node:util/types';
import {AuthFailure} from '../access/repository.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {validateMethodologyGraph} from '../methodologies/service.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {GraphCondition,MethodologyEdge} from '../../../../contracts/methodologies.ts';

function invalid():never{throw new AuthFailure('INPUT_INVALID',422);}
function unsupported():never{throw new AuthFailure('NODE_DECISION_DECLARATION_UNSUPPORTED',412);}
const H=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const forbidden=new Set(['__proto__','prototype','constructor']);
/** 외부 코드가 있는 객체는 기존 validator가 순회하기 전에 거절한다. */
function copy(raw:unknown):any{
 const active=new Set<object>();
 function inspect(v:unknown,depth:number):void{
  if(depth>64)invalid();if(v===null||typeof v!=='object')return;if(isProxy(v)||active.has(v)||Object.getOwnPropertySymbols(v).length)invalid();
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)invalid();
  const d=Object.getOwnPropertyDescriptors(v);active.add(v);try{
   if(array){if(Object.keys(d).length!==(v as unknown[]).length+1)invalid();for(let i=0;i<(v as unknown[]).length;i++){const field=d[String(i)];if(!field||!field.enumerable||!('value'in field))invalid();inspect(field.value,depth+1);}}
   else for(const key of Object.keys(d)){const field=d[key]!;if(forbidden.has(key)||!field.enumerable||!('value'in field))invalid();inspect(field.value,depth+1);}
  }finally{active.delete(v);}
 }
 try{inspect(raw,0);return JSON.parse(canonicalJson(raw));}catch{return invalid();}
}
function frozen<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;}
function text(v:unknown,max?:number):v is string{return typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&(max===undefined||v.length<=max);}
function safeText(v:unknown,max?:number){if(!text(v,max))invalid();try{assertKnowledgeTextSafe(v);}catch{return invalid();}return v;}
function nodeRef(v:unknown){if(!recordV1(v,['applicationRef','nodeId'])||!refV1(v.applicationRef)||!text(v.nodeId))invalid();return v as {applicationRef:VersionRef;nodeId:string};}
function basis(v:unknown){if(!recordV1(v,['applicationRef','designRef','planRef'])||!Object.values(v).every(refV1))invalid();return v as {applicationRef:VersionRef;designRef:VersionRef;planRef:VersionRef};}
function scalarOrder(a:string,b:string){const x=Array.from(a),y=Array.from(b);for(let i=0;i<Math.min(x.length,y.length);i++){const diff=x[i]!.codePointAt(0)!-y[i]!.codePointAt(0)!;if(diff)return diff;}return x.length-y.length;}
function value(v:unknown):string{const s=safeText(v);if(Buffer.byteLength(s,'utf8')>200||/[\u0000-\u001f\u007f-\u009f]/.test(s)||forbidden.has(s))invalid();return s;}
function choices(branches:MethodologyEdge[],nodeId:string){
 const found=new Set<string>();
 function visit(c:GraphCondition){
  if('all'in c){for(const part of c.all)visit(part);return;}if('any'in c){for(const part of c.any)visit(part);return;}if('not'in c){visit(c.not);return;}
  if(c.fieldRef.nodeId!==nodeId||c.fieldRef.field!=='USER_DECISION')return;
  if(c.operator==='EQ'||c.operator==='NE')found.add(value(c.value));else if(c.operator==='IN')for(const item of c.value)found.add(value(item));
 }
 for(const b of branches)if(b.condition)visit(b.condition);if(!found.size)unsupported();if(found.size>32)invalid();return [...found].sort(scalarOrder);
}
// 완료되지 않은 보호출처가 아니라, 전달된 선언의 닫힌 AST 원형만 검사한다.
function conditionShape(c:unknown):boolean{
 if(recordV1(c,['all']))return Array.isArray(c.all)&&c.all.length>0&&c.all.every(conditionShape);
 if(recordV1(c,['any']))return Array.isArray(c.any)&&c.any.length>0&&c.any.every(conditionShape);
 if(recordV1(c,['not']))return conditionShape(c.not);
 if(!recordV1(c,['fieldRef','operator','value'])||!recordV1(c.fieldRef,['nodeId','field'])||!text(c.fieldRef.nodeId)||!['USER_DECISION','REVIEW_OUTCOME'].includes(c.fieldRef.field))return false;
 const item=(v:unknown)=>text(v)&&(c.fieldRef.field==='USER_DECISION'||['ACCEPTED','REWORK','BLOCKED'].includes(v));
 return c.operator==='IS_PRESENT'?c.value===null:c.operator==='IN'?Array.isArray(c.value)&&c.value.length>0&&c.value.every(item):['EQ','NE'].includes(c.operator)&&item(c.value);
}
const declarationKeys=['schemaVersion','purpose','applicationRef','nodeId','decisionType','values','outgoingBranches','declarationHash'];
function declaration(raw:unknown){
 const d=copy(raw);if(!recordV1(d,declarationKeys)||d.schemaVersion!==1||d.purpose!=='HUMAN_NODE_DECISION_DECLARATION'||d.decisionType!=='ENUM_STRING_V1'||!refV1(d.applicationRef)||!text(d.nodeId)||!Array.isArray(d.values)||!Array.isArray(d.outgoingBranches)||!hashV1(d.declarationHash))invalid();
 const {declarationHash,...body}=d;if(H(body)!==declarationHash)invalid();const ids=new Set<string>();
 // 이 검사도 형상/봉인 일치일 뿐 원 graph의 보호 출처를 발급하지 않는다.
 for(const b of d.outgoingBranches){if(!recordV1(b,['edgeId','fromNodeId','toNodeId','kind','condition','reason'])||!text(b.edgeId)||!text(b.toNodeId)||b.fromNodeId!==d.nodeId||b.kind!=='BRANCH'||!conditionShape(b.condition)||typeof b.reason!=='string'||ids.has(b.edgeId))invalid();ids.add(b.edgeId);}
 if(!same(d.outgoingBranches,[...d.outgoingBranches].sort((a,b)=>scalarOrder(a.edgeId,b.edgeId))))invalid();
 try{if(!same(d.values,choices(d.outgoingBranches,d.nodeId)))invalid();}catch{return invalid();}return d;
}
/** 선언 데이터의 무결성만 검산한다. 실제 적용/확정·form 허가/current와 저장은 검산하지 않는다. */
export function deriveNodeDecisionDeclaration(raw:unknown){
 const v=copy(raw);if(!recordV1(v,['applicationRef','applicationSnapshot','nodeId','formRefs'])||!refV1(v.applicationRef)||!text(v.nodeId)||!Array.isArray(v.formRefs)||!v.formRefs.every(refV1))invalid();
 const s=v.applicationSnapshot,keys=['name','purpose','graph','sourceRef',...(Object.hasOwn(s??{},'draftConfirmationRef')?['draftConfirmationRef']:[])];
 if(!recordV1(s,keys)||typeof s.name!=='string'||s.name.length>200||typeof s.purpose!=='string'||s.purpose.length>20000||!refV1(s.sourceRef)||H(s)!==v.applicationRef.contentHash||H(s.graph)!==s.sourceRef.contentHash)invalid();
 if(Object.hasOwn(s,'draftConfirmationRef')){const d=s.draftConfirmationRef;if(!recordV1(d,['draftRef','confirmationId'])||!refV1(d.draftRef)||d.draftRef.contentHash!==s.sourceRef.contentHash||!uuidV1(d.confirmationId))invalid();}
 const validation=validateMethodologyGraph(s.graph,v.formRefs);if(!validation.validForConfirmation)invalid();const nodes=s.graph.nodes.filter((n:{nodeId:string})=>n.nodeId===v.nodeId);if(nodes.length!==1||!['HUMAN','DECISION'].includes(nodes[0].kind)||nodes[0].role!=='USER')unsupported();
 const outgoingBranches:MethodologyEdge[]=s.graph.edges.filter((e:MethodologyEdge)=>e.fromNodeId===v.nodeId&&e.kind==='BRANCH').sort((a:MethodologyEdge,b:MethodologyEdge)=>scalarOrder(a.edgeId,b.edgeId));
 const body={schemaVersion:1,purpose:'HUMAN_NODE_DECISION_DECLARATION',applicationRef:v.applicationRef,nodeId:v.nodeId,decisionType:'ENUM_STRING_V1',values:choices(outgoingBranches,v.nodeId),outgoingBranches};return frozen({...body,declarationHash:H(body)});
}
export function readNodeDecisionRecordInput(raw:unknown,rawDeclaration:unknown){
 const v=copy(raw),d=declaration(rawDeclaration);if(!recordV1(v,['nodeRef','declarationHash','basisSelection','decisionBaseRef','value','reason','sourceDocumentRefs']))invalid();const n=nodeRef(v.nodeRef),b=basis(v.basisSelection);
 if(!same(n.applicationRef,d.applicationRef)||n.nodeId!==d.nodeId||v.declarationHash!==d.declarationHash||!same(b.applicationRef,n.applicationRef)||v.decisionBaseRef!==null&&!refV1(v.decisionBaseRef)||!d.values.includes(value(v.value))||!Array.isArray(v.sourceDocumentRefs)||v.sourceDocumentRefs.length<1||v.sourceDocumentRefs.length>20||!v.sourceDocumentRefs.every(refV1)||new Set(v.sourceDocumentRefs.map((r:unknown)=>canonicalJson(r))).size!==v.sourceDocumentRefs.length)invalid();safeText(v.reason,20000);return frozen(v);
}
export function readNodeDecisionRevokeInput(raw:unknown){const v=copy(raw);if(!recordV1(v,['decisionRef','basisSelection','reason'])||!refV1(v.decisionRef))invalid();basis(v.basisSelection);safeText(v.reason,20000);return frozen(v);}
export function readNodeDecisionCommand(raw:unknown,rawDeclaration?:unknown){
 const v=copy(raw);if(!recordV1(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||v.schemaVersion!==1||![v.projectId,v.commandId,v.clientId].every(uuidV1)||!Number.isSafeInteger(v.controlGeneration)||v.controlGeneration<1||!Number.isSafeInteger(v.expectedVersion)||v.expectedVersion<0||v.targetId!==null&&!uuidV1(v.targetId)||!Array.isArray(v.baselineRefs)||v.baselineRefs.length||!['recordNodeDecision','revokeNodeDecision'].includes(v.operation))invalid();
 if(v.approvalRef!==null)throw new AuthFailure('NODE_DECISION_APPROVAL_NOT_CONNECTED',412);
 if(v.operation==='recordNodeDecision'){v.payload=readNodeDecisionRecordInput(v.payload,rawDeclaration);const base=v.payload.decisionBaseRef;if(v.targetId!==(base?.id??null)||v.expectedVersion!==(base?.version??0))invalid();}
 else{v.payload=readNodeDecisionRevokeInput(v.payload);if(v.targetId!==v.payload.decisionRef.id||v.expectedVersion!==v.payload.decisionRef.version)invalid();}
 return frozen(v);
}
