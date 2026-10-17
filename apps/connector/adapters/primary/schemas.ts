import {readFileSync} from 'node:fs';
import {Ajv} from 'ajv';
import type {ValidateFunction} from 'ajv';

// 고정 공개 JSON만 읽는다. caller 경로·외부 ref·계정/프로젝트 원문을 읽지 않는다.
const root=new URL('../../../../contracts/vendor/codex/0.161.0/schema/',import.meta.url);
const ajv=new Ajv({strict:true,allowUnionTypes:true,allErrors:false,messages:false});
for(const name of ['int64','uint64','uint','uint32','uint16','int32']){
 ajv.addFormat(name,{type:'number',validate:(v:number)=>Number.isSafeInteger(v)
  &&(!name.startsWith('u')||v>=0)
  &&(name!=='uint32'||v<=4294967295)&&(name!=='uint16'||v<=65535)
  &&(name!=='int32'||(v>=-2147483648&&v<=2147483647))});
}
ajv.addFormat('double',{type:'number',validate:Number.isFinite});
const documents=new Map<string,any>(),validators=new Map<string,ValidateFunction>();
function load(file:string):any{
 if(!documents.has(file))documents.set(file,JSON.parse(readFileSync(new URL(file,root),'utf8')));
 return documents.get(file);
}
function compile(key:string,schema:()=>any):ValidateFunction{
 if(!validators.has(key))validators.set(key,ajv.compile(schema()));
 return validators.get(key)!;
}
export const requestMethods=['initialize','thread/start','thread/resume','turn/start','turn/steer','turn/interrupt'] as const;
export type CodexMethod=typeof requestMethods[number];
export const approvalMethods=['item/commandExecution/requestApproval','item/fileChange/requestApproval','item/permissions/requestApproval'] as const;
export const notificationMethods=['thread/started','turn/started','turn/completed','item/started','item/completed','item/commandExecution/outputDelta','error'] as const;
export type InboundMethod=typeof approvalMethods[number]|typeof notificationMethods[number];
function branch(file:string,method:string,value:unknown):boolean{
 const validate=compile(file+':'+method,()=>{
  const doc=load(file),entry=(doc.oneOf??doc.anyOf??[]).find((v:any)=>v.properties?.method?.enum?.includes(method));
  if(!entry)throw Error('PINNED_SCHEMA_BRANCH_MISSING');
  return {...entry,$schema:doc.$schema,definitions:doc.definitions??{}};
 });
 return validate(value)===true;
}
export function validateRequest(method:CodexMethod,value:unknown):boolean{return branch('ClientRequest.json',method,value);}
export function validateInbound(method:InboundMethod,value:unknown,request:boolean):boolean{return branch(request?'ServerRequest.json':'ServerNotification.json',method,value);}
export function validateInitialized(value:unknown):boolean{return compile('initialized',()=>load('ClientNotification.json'))(value)===true;}
export function validateError(value:unknown):boolean{return compile('rpc-error',()=>load('JSONRPCError.json'))(value)===true;}
const responseFiles:Record<Exclude<CodexMethod,'initialize'>,string>={
 'thread/start':'v2/ThreadStartResponse.json','thread/resume':'v2/ThreadResumeResponse.json',
 'turn/start':'v2/TurnStartResponse.json','turn/steer':'v2/TurnSteerResponse.json','turn/interrupt':'v2/TurnInterruptResponse.json'
};
export function validateResult(method:CodexMethod,value:unknown):boolean{
 const validate=compile('result:'+method,()=>{
  if(method!=='initialize')return load(responseFiles[method]);
  const doc=load('codex_app_server_protocol.schemas.json');
  return {$schema:doc.$schema,$ref:'#/definitions/InitializeResponse',definitions:doc.definitions};
 });
 return validate(value)===true;
}
