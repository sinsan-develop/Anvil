import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';

/** 공식 공개 SDK 객체 기준이다. CLI wire·실행/서버 권위의 schema가 아니다. */
export const claudeSdkBaseline=Object.freeze({sdkVersion:'0.3.224',declaredClaudeCodeVersion:'2.1.224',typesSha256:'556277033B15112811922D84EC8DC846D446CCE7BD9AA27765C52A9C09869575'});
export const maxSdkObjectBytes=2097152;
export type JsonRecord=Record<string,any>;
export class SdkObjectFailure extends Error {readonly code:'INPUT_INVALID'|'MESSAGE_TOO_LARGE';constructor(code:'INPUT_INVALID'|'MESSAGE_TOO_LARGE'){super(code);this.code=code;}}
/** 직렬화/복제 전 제한. 이미 존재하는 객체/JS reflection·VM/OS 메모리 quota는 보증하지 않는다. */
export function boundedSdkObject(value:unknown,maxBytes:number):{value:JsonRecord;digest:string}{
 let bytes=0;const active=new Set<object>();const fail=():never=>{throw new SdkObjectFailure('INPUT_INVALID');};
 const add=(n:number)=>{bytes+=n;if(bytes>maxBytes)throw new SdkObjectFailure('MESSAGE_TOO_LARGE');};
 function text(s:string){add(2);for(let n=0;n<s.length;n++){const c=s.charCodeAt(n);if(c===34||c===92||[8,9,10,12,13].includes(c))add(2);else if(c<32)add(6);else if(c<128)add(1);else if(c<2048)add(2);else if(c>=0xd800&&c<=0xdbff){const lo=s.charCodeAt(++n);if(!(lo>=0xdc00&&lo<=0xdfff))fail();add(4);}else if(c>=0xdc00&&c<=0xdfff)fail();else add(3);}}
 function visit(v:unknown,depth:number):void{
  if(depth>64)fail();if(v===null){add(4);return;}if(typeof v==='string'){text(v);return;}if(typeof v==='boolean'){add(v?4:5);return;}if(typeof v==='number'){if(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))fail();add(JSON.stringify(v).length);return;}
  if(typeof v!=='object'||isProxy(v)||active.has(v))fail();const object=v as object,proto=Object.getPrototypeOf(object);if(!Array.isArray(v)&&proto!==Object.prototype&&proto!==null)fail();if(Object.getOwnPropertySymbols(object).length)fail();active.add(object);
  try{add(2);if(Array.isArray(v)){const names=Object.getOwnPropertyNames(v);if(names.length!==v.length+1)fail();for(let n=0;n<v.length;n++){if(n)add(1);const d=Object.getOwnPropertyDescriptor(v,String(n));if(!d||!d.enumerable||!('value'in d))fail();visit(d!.value,depth+1);}}
   else{let n=0;for(const key of Object.getOwnPropertyNames(object)){if(['__proto__','prototype','constructor','toJSON'].includes(key))fail();if(n++)add(1);text(key);add(1);const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!d.enumerable||!('value'in d))fail();visit(d!.value,depth+1);}}}
  finally{active.delete(object);}
 }
 visit(value,0);if(!value||typeof value!=='object'||Array.isArray(value))fail();const serialized=canonicalJson(value);if(Buffer.byteLength(serialized,'utf8')>maxBytes)throw new SdkObjectFailure('MESSAGE_TOO_LARGE');return{value:JSON.parse(serialized),digest:contentHash(serialized)};
}
export const sdkOpaqueId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=512&&v.isWellFormed()&&!/[\u0000-\u001f\u007f]/.test(v);
const record=(v:unknown):v is JsonRecord=>!!v&&typeof v==='object'&&!Array.isArray(v);
const string=(v:unknown):v is string=>typeof v==='string';
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(string);
const parent=(v:unknown)=>v===null||sdkOpaqueId(v);
const keys=(v:JsonRecord,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
export type SdkFamily='SYSTEM_INIT'|'ASSISTANT'|'RESULT_SUCCESS'|'RESULT_ERROR'|'STREAM_EVENT';
export type SdkMessageShape={state:'SUPPORTED';family:SdkFamily;sessionId:string;uuid:string;isErrorClaim?:boolean}|{state:'INVALID'|'UNSUPPORTED';code:string};
const assistantErrors=['authentication_failed','oauth_org_not_allowed','billing_error','rate_limit','overloaded','invalid_request','model_not_found','server_error','unknown','max_output_tokens'];
const errors=['error_during_execution','error_max_turns','error_max_budget_usd','error_max_structured_output_retries'];
/** envelope와 식별만 검증한다. 중첩 BetaMessage/usage/도구 내용은 전체 SDK validator가 아니다. */
export function sdkMessageShape(v:JsonRecord):SdkMessageShape{
 const invalid=():SdkMessageShape=>({state:'INVALID',code:'SDK_ENVELOPE_INVALID'}),unsupported=():SdkMessageShape=>({state:'UNSUPPORTED',code:'SDK_VARIANT_UNSUPPORTED'});
 if(!['system','assistant','result','stream_event'].includes(v.type))return unsupported();
 if(v.type==='system'&&v.subtype!=='init'||v.type==='result'&&v.subtype!=='success'&&!errors.includes(v.subtype))return unsupported();
 if(!sdkOpaqueId(v.session_id)||!sdkOpaqueId(v.uuid))return invalid();
 let family:SdkFamily;
 if(v.type==='system'){
  const required=['type','subtype','apiKeySource','claude_code_version','cwd','tools','mcp_servers','model','permissionMode','slash_commands','output_style','skills','plugins','uuid','session_id'];
  if(!keys(v,required,['agents','betas','fast_mode_state','fast_mode_disabled_reason','capabilities']))return invalid();
  if(!['apiKeySource','claude_code_version','cwd','model','permissionMode','output_style'].every(k=>string(v[k]))||!['tools','slash_commands','skills'].every(k=>strings(v[k]))||!Array.isArray(v.mcp_servers)||v.mcp_servers.some((m:unknown)=>!record(m)||!keys(m,['name','status'])||!string(m.name)||!string(m.status))||!Array.isArray(v.plugins)||v.plugins.some((p:unknown)=>!record(p)||!keys(p,['name','path'],['version'])||!string(p.name)||!string(p.path)||Object.hasOwn(p,'version')&&!string(p.version)))return invalid();
  if(v.claude_code_version!==claudeSdkBaseline.declaredClaudeCodeVersion)return{state:'UNSUPPORTED',code:'SDK_DECLARED_VERSION_UNSUPPORTED'};family='SYSTEM_INIT';
 }else if(v.type==='assistant'){
  if(!keys(v,['type','message','parent_tool_use_id','uuid','session_id'],['error','request_id','resumed_from_incomplete_thinking','supersedes','aborted','subagent_type','task_description','timestamp'])||!record(v.message)||!parent(v.parent_tool_use_id)||Object.hasOwn(v,'error')&&!assistantErrors.includes(v.error))return invalid();family='ASSISTANT';
 }else if(v.type==='stream_event'){
  if(!keys(v,['type','event','parent_tool_use_id','uuid','session_id'],['ttft_ms'])||!record(v.event)||!parent(v.parent_tool_use_id))return invalid();family='STREAM_EVENT';
 }else{
  const required=['type','subtype','duration_ms','duration_api_ms','is_error','num_turns','stop_reason','total_cost_usd','usage','modelUsage','permission_denials','uuid','session_id',v.subtype==='success'?'result':'errors'];
  const optional=['terminal_reason','fast_mode_state','fast_mode_disabled_reason','origin',...(v.subtype==='success'?['ttft_ms','ttft_stream_ms','time_to_request_ms','user_message_uuid','request_sent_wall_ms','time_to_request_from_spawn_ms','warm_spare_claimed','time_origin_ms','api_error_status','structured_output','deferred_tool_use']:[])];
  if(!keys(v,required,optional)||!['duration_ms','duration_api_ms','num_turns','total_cost_usd'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]))||typeof v.is_error!=='boolean'||!(v.stop_reason===null||string(v.stop_reason))||!record(v.usage)||!record(v.modelUsage)||!Array.isArray(v.permission_denials)||v.subtype==='success'&&!string(v.result)||v.subtype!=='success'&&!strings(v.errors))return invalid();family=v.subtype==='success'?'RESULT_SUCCESS':'RESULT_ERROR';
 }
 return{state:'SUPPORTED',family,sessionId:v.session_id,uuid:v.uuid,...(v.type==='result'?{isErrorClaim:v.is_error}:{})};
}
/** 현재 지원하는 SDKUserMessage 부분집합. SDK 선택 uuid/session을 필수로 만들지 않는다. */
export function supportedSdkUser(v:JsonRecord):'SUPPORTED'|'INVALID'|'UNSUPPORTED'{
 if(!keys(v,['type','message','parent_tool_use_id'],['uuid','session_id'])||v.type!=='user'||v.parent_tool_use_id!==null||!record(v.message)||!keys(v.message,['role','content'])||v.message.role!=='user'||typeof v.message.content!=='string')return'UNSUPPORTED';
 if(Object.hasOwn(v,'uuid')&&!sdkOpaqueId(v.uuid)||Object.hasOwn(v,'session_id')&&!sdkOpaqueId(v.session_id))return'INVALID';return'SUPPORTED';
}
