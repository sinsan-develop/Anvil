import {ApiError} from '../../api/client.ts';
import {emptyMethodBuffer,type MethodBuffer} from './common-api.ts';
import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
type Draft={name:string;purpose:string;scope:'USER_COMMON'|'PROJECT';graph:MethodologyGraph;reason:string};
const fail=():never=>{throw new ApiError('METHOD_DRAFT_FILE_INVALID');};
const exact=(v:any,keys:string[],optional:string[]=[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const text=(v:any,max=Number.MAX_SAFE_INTEGER)=>typeof v==='string'&&v.isWellFormed()&&v.length<=max;
const texts=(v:any)=>Array.isArray(v)&&v.every(i=>text(i));
const ref=(v:any)=>exact(v,['id','version','contentHash'])&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&/^[0-9a-f]{64}$/.test(v.contentHash);
function condition(v:any,depth=0):boolean{
 if(depth>64||!v||typeof v!=='object')return false;
 if(exact(v,['all'])||exact(v,['any'])){const a=v.all??v.any;return Array.isArray(a)&&a.length>0&&a.every(c=>condition(c,depth+1));}
 if(exact(v,['not']))return condition(v.not,depth+1);
 if(!exact(v,['fieldRef','operator','value'])||!exact(v.fieldRef,['nodeId','field'])||!text(v.fieldRef.nodeId)||!['USER_DECISION','REVIEW_OUTCOME'].includes(v.fieldRef.field))return false;
 const val=(x:any)=>text(x)&&!!x.trim()&&(v.fieldRef.field==='USER_DECISION'||['ACCEPTED','REWORK','BLOCKED'].includes(x));
 return v.operator==='IS_PRESENT'?v.value===null:v.operator==='IN'?Array.isArray(v.value)&&v.value.length>0&&v.value.every(val):['EQ','NE'].includes(v.operator)&&val(v.value);
}
function graph(v:any):v is MethodologyGraph{
 if(!exact(v,['nodes','edges','entryNodeId','terminalNodeIds'])||!Array.isArray(v.nodes)||!Array.isArray(v.edges)||!text(v.entryNodeId)||!texts(v.terminalNodeIds))return false;
 const doc=(d:any)=>exact(d,['itemId','formRef','required','reviewCriteria'],['sourceNodeId'])&&text(d.itemId)&&ref(d.formRef)&&typeof d.required==='boolean'&&texts(d.reviewCriteria)&&(d.sourceNodeId===undefined||text(d.sourceNodeId));
 return v.nodes.every((n:any)=>exact(n,['nodeId','name','purpose','kind','position','role','inputs','outputs','taskScope','completionCriteria','approvalBoundary','mode','limitPolicyRef','recordRequirements'],['requirements','joinRule'])
  &&text(n.nodeId)&&text(n.name)&&text(n.purpose)&&['HUMAN','AGENT','DECISION','JOIN'].includes(n.kind)&&['USER','COORDINATOR','STAGE_OWNER'].includes(n.role)
  &&exact(n.position,['x','y'])&&Number.isFinite(n.position.x)&&Number.isFinite(n.position.y)&&exact(n.taskScope,['included','excluded'])&&texts(n.taskScope.included)&&texts(n.taskScope.excluded)
  &&Array.isArray(n.inputs)&&n.inputs.every(doc)&&Array.isArray(n.outputs)&&n.outputs.every(doc)
  &&texts(n.completionCriteria)&&texts(n.approvalBoundary)&&texts(n.recordRequirements)&&['AUTO','CASE_BY_CASE'].includes(n.mode)&&(n.limitPolicyRef===null||ref(n.limitPolicyRef))
  &&(n.requirements===undefined||exact(n.requirements,['capabilities','environment'])&&texts(n.requirements.capabilities)&&texts(n.requirements.environment))
  &&(n.joinRule===undefined||exact(n.joinRule,['mode'],['condition'])&&['ALL','DECLARED_CONDITION'].includes(n.joinRule.mode)&&(n.joinRule.condition===undefined||condition(n.joinRule.condition))))
 &&v.edges.every((e:any)=>exact(e,['edgeId','fromNodeId','toNodeId','kind','condition','reason'],['retryPolicy'])&&text(e.edgeId)&&text(e.fromNodeId)&&text(e.toNodeId)&&text(e.reason)&&['SEQUENCE','BRANCH','JOIN','REWORK'].includes(e.kind)
  &&(e.condition===null||condition(e.condition))&&(e.retryPolicy===undefined||exact(e.retryPolicy,['maxAttempts','onExhausted','counting'])&&typeof e.retryPolicy.maxAttempts==='number'&&e.retryPolicy.onExhausted==='USER_DECISION'&&e.retryPolicy.counting==='SAME_FAILURE_FINGERPRINT'));
}
function parse(raw:string):any{
 const value=JSON.parse(raw),stack:{keys:Set<string>|null;key:boolean}[]=[];
 for(const token of raw.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){
  if(token==='{'||token==='['){if(stack.length>=64)fail();stack.push({keys:token==='{'?new Set():null,key:token==='{'});}
  else if(token==='}'||token===']')stack.pop();
  else{const frame=stack.at(-1);if(!frame?.keys)continue;if(token===',')frame.key=true;else if(token===':')frame.key=false;else if(frame.key&&token.startsWith('"')){const key=JSON.parse(token);if(frame.keys.has(key))fail();frame.keys.add(key);}}
 }
 return value;
}
/** 기존 저장 payload만 입력한다. 파일은 권한/확정/적용 증거가 아니며 구조 검사는 저장 시 서버가 다시 수행한다. */
export function readMethodDraftFile(raw:string,scope:string):Draft{
 try{
  if(typeof raw!=='string'||!raw.isWellFormed()||new TextEncoder().encode(raw).length>2097152||!['USER_COMMON','PROJECT'].includes(scope))fail();
  const value=parse(raw);
  const scan=(v:any,depth=0):void=>{if(depth>64)fail();if(typeof v==='string'&&!v.isWellFormed())fail();if(typeof v==='number'&&(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v)))fail();if(v&&typeof v==='object')for(const item of Object.values(v))scan(item,depth+1);};scan(value);
  if(!exact(value,['name','purpose','scope','graph','reason'])||value.scope!==scope||!text(value.name,200)||!value.name.trim()||!text(value.purpose,20000)||!value.purpose.trim()||!text(value.reason,20000)||!value.reason.trim()||!graph(value.graph))fail();
  if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(JSON.stringify(value)))throw new ApiError('METHOD_DRAFT_FILE_SENSITIVE');
  return structuredClone(value);
 }catch(e){if(e instanceof ApiError)throw e;return fail();}
}
export function importMethodDraft(current:MethodBuffer,userId:string,draft:Draft):MethodBuffer{
 if(current.ownerUserId!==null&&current.ownerUserId!==userId||current.pending||current.preparationId||current.review||current.application)throw new ApiError('METHOD_DRAFT_IMPORT_LOCKED');
 const value=readMethodDraftFile(JSON.stringify(draft),draft.scope);
 return {...emptyMethodBuffer(),ownerUserId:userId,name:value.name,purpose:value.purpose,reason:value.reason,graph:value.graph,nodeId:value.graph.entryNodeId,dirty:true};
}
