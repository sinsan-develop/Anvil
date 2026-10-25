import {ApiError} from '../../api/errors.ts';
import type {ControlRequestCommand,ControlRequestStoreResult} from '../../../../server/modules/control-handoff/control-request-store.ts';
import type {ControlRequestReadResult,ControlRequestListResult} from '../../../../server/modules/control-handoff/control-request-read.ts';
import type {PrepareControlHandoffCommand,HandoffSummaryReadResult,HandoffSummaryResult} from '../../../../server/modules/control-handoff/control-handoff-summary-store.ts';
import type {ControlStateResult,HandoffSummaryHeadResult} from '../../../../server/modules/control-handoff/control-discovery-read.ts';
import type {ControlRequestInput} from '../../../../server/modules/control-handoff/control-request-input.ts';
import type {ControlRequestCurrentState} from '../../../../server/modules/control-handoff/control-request-read.ts';
import type {ControlRequestSnapshot} from '../../../../server/modules/control-handoff/control-request-snapshot.ts';
import type {HandoffSummaryBody,HandoffBasis,HandoffCollection} from '../../../../server/modules/control-handoff/control-handoff-summary.ts';
export type {ControlStateResult,ControlRequestReadResult,ControlRequestListResult,HandoffSummaryReadResult};
export type ControlCommand=ControlRequestCommand|PrepareControlHandoffCommand;
export type ControlResult=ControlRequestStoreResult|HandoffSummaryResult;
export interface ControlSession {user:{id:string;displayName:string};clientId:string;csrfToken:string}
export interface ControlRef {id:string;version:number;contentHash:string}
const invalid=():never=>{throw new ApiError('RESPONSE_INVALID');};
export function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 return Object.keys(descriptors).sort().join(',')===[...keys].sort().join(',')&&Object.values(descriptors).every(d=>d.enumerable&&'value'in d);
}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export const iso=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const ref=(v:unknown):v is ControlRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&positive(v.version)&&hash(v.contentHash);
function readRef(v:unknown):ControlRef{if(!ref(v))return invalid();return v;}
export const basis=(v:unknown):v is HandoffBasis=>exact(v,['actorId','clientId','generation','version'])&&uuid(v.actorId)&&uuid(v.clientId)&&positive(v.generation)&&positive(v.version);
export const same=(a:unknown,b:unknown)=>browserCanonical(a)===browserCanonical(b);
export async function wireHash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(browserCanonical(value));return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
function parseWire(raw:string):unknown{
 let value:unknown;try{value=JSON.parse(raw);}catch{return invalid();}
 const stack:{keys:Set<string>|null;expectKey:boolean}[]=[];
 const tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[];
 for(const token of tokens){if(token==='{'||token==='[')stack.push({keys:token==='{'?new Set():null,expectKey:token==='{'});else if(token==='}'||token===']')stack.pop();else{const frame=stack.at(-1);if(!frame?.keys)continue;if(token===',')frame.expectKey=true;else if(token===':')frame.expectKey=false;else if(frame.expectKey&&token.startsWith('"')){const key:string=JSON.parse(token);if(frame.keys.has(key))return invalid();frame.keys.add(key);}}}
 browserCanonical(value);return value;
}
function flags(v:Record<string,unknown>){return v.executionAuthorized===false&&v.controlTransferred===false;}
function current(v:unknown):v is ControlRequestCurrentState{return exact(v,['expired','baseControlState'])&&typeof v.expired==='boolean'&&['MATCHED','CHANGED','UNVERIFIED'].includes(String(v.baseControlState));}
function inputShape(v:unknown):v is ControlRequestInput{
 if(!exact(v,['targetActorRef','targetClientRef','baseControl','reason','expiresAt'])||!exact(v.targetActorRef,['userId'])||!uuid(v.targetActorRef.userId)||!exact(v.targetClientRef,['userId','clientId'])||v.targetClientRef.userId!==v.targetActorRef.userId||!uuid(v.targetClientRef.clientId)||!basis(v.baseControl)||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>20000||!iso(v.expiresAt))return false;
 return true;
}
function input(v:unknown,observedAt:string):v is ControlRequestInput{
 if(!inputShape(v))return false;const ttl=Date.parse(v.expiresAt)-Date.parse(observedAt);return ttl>0&&ttl<=30*60000;
}
const requestKeys=['id','version','projectId','requestedBy','targetActorRef','targetClientRef','baseControl','reason','createdAt','expiresAt','storedState','executionAuthorized','controlTransferred'];
function assertSnapshot(v:unknown,want:ControlRef,projectId:string):asserts v is ControlRequestSnapshot{
 if(!ref(want)||want.version!==1||!exact(v,requestKeys)||v.id!==want.id||v.version!==1||v.projectId!==projectId||!exact(v.requestedBy,['actorId','clientId'])||!uuid(v.requestedBy.actorId)||!uuid(v.requestedBy.clientId)||!iso(v.createdAt)||v.storedState!=='PENDING'||!flags(v)||!input({targetActorRef:v.targetActorRef,targetClientRef:v.targetClientRef,baseControl:v.baseControl,reason:v.reason,expiresAt:v.expiresAt},v.createdAt)||!exact(v.targetActorRef,['userId'])||!exact(v.targetClientRef,['userId','clientId'])||v.requestedBy.actorId!==v.targetActorRef.userId||v.requestedBy.actorId!==v.targetClientRef.userId||v.requestedBy.clientId!==v.targetClientRef.clientId)return invalid();
}
async function snapshot(v:unknown,want:ControlRef,projectId:string):Promise<ControlRequestSnapshot>{
 assertSnapshot(v,want,projectId);if(await wireHash(v)!==want.contentHash)return invalid();return v;
}
const categories=['activeExecutions','pendingCommands','pendingApprovals','sourceCheckpointRefs'] as const;
const summaryKeys=['projectId','requestRef','version','controller','baseControl','observedAt','validUntil',...categories,'gaps','safetyState','sourceMode','realCollectorsConnected','acceptanceEnabled','executionAuthorized','controlTransferred'];
function collection(v:unknown,projectId:string,observedAt:string):v is HandoffCollection{
 if(!exact(v,['status','observedAt','reasonCode','refs'])||!iso(v.observedAt)||Date.parse(v.observedAt)>Date.parse(observedAt)||!Array.isArray(v.refs)||v.refs.length>200)return false;
 for(const item of v.refs)if(!exact(item,['projectId','ref'])||item.projectId!==projectId||!ref(item.ref))return false;
 if(v.status==='EMPTY_SYNTHETIC')return v.refs.length===0&&v.reasonCode==='SYNTHETIC_EMPTY';
 if(v.status==='SYNTHETIC_OBSERVED')return v.refs.length>0&&v.reasonCode==='SYNTHETIC_REFS';
 return v.status==='UNVERIFIED'&&['COLLECTOR_NOT_CONNECTED','COLLECTOR_MISSING','COLLECTOR_ERROR','COLLECTION_LIMIT_EXCEEDED','COLLECTION_PARTIAL'].includes(String(v.reasonCode))&&(v.refs.length===0||v.reasonCode==='COLLECTION_PARTIAL');
}
function assertSummary(v:unknown,requestRef:ControlRef,summaryRef:ControlRef,projectId:string,expiresAt:string):asserts v is HandoffSummaryBody{
 if(!ref(requestRef)||requestRef.version!==1||!ref(summaryRef)||summaryRef.id!==requestRef.id||!iso(expiresAt)||!exact(v,summaryKeys)||v.projectId!==projectId||!same(v.requestRef,requestRef)||v.version!==summaryRef.version||!basis(v.controller)||!basis(v.baseControl)||!same(v.controller,v.baseControl)||!iso(v.observedAt)||!iso(v.validUntil)||v.validUntil!==new Date(Math.min(Date.parse(v.observedAt)+30000,Date.parse(expiresAt))).toISOString()||Date.parse(v.observedAt)>=Date.parse(expiresAt)||v.sourceMode!=='SYNTHETIC_ONLY'||v.realCollectorsConnected!==false||v.acceptanceEnabled!==false||!flags(v))return invalid();
 const gaps=['REAL_COLLECTOR_NOT_CONNECTED','TARGET_ELIGIBILITY_UNVERIFIED'];let waiting=false;
 for(const category of categories){const part=v[category];if(!collection(part,projectId,v.observedAt))return invalid();if(part.status==='UNVERIFIED')gaps.push(part.reasonCode);if(category!=='sourceCheckpointRefs'&&part.refs.length>0)waiting=true;}
 if(!same(v.gaps,gaps)||v.safetyState!==(waiting?'WAITING':'UNVERIFIED'))return invalid();
}
async function summaryBody(v:unknown,requestRef:ControlRef,summaryRef:ControlRef,projectId:string,expiresAt:string):Promise<HandoffSummaryBody>{
 assertSummary(v,requestRef,summaryRef,projectId,expiresAt);if(await wireHash(v)!==summaryRef.contentHash)return invalid();return v;
}
function assertState(v:unknown,projectId:string,session:ControlSession):asserts v is ControlStateResult{
 if(!exact(v,['schemaVersion','projectId','observedAt','actorId','clientId','participation','control','executionAuthorized','controlTransferred'])||v.schemaVersion!==1||v.projectId!==projectId||v.actorId!==session.user.id||v.clientId!==session.clientId||!iso(v.observedAt)||!['OWNER','HANDOFF_ELIGIBLE'].includes(String(v.participation))||!exact(v.control,['state','basis'])||!flags(v))return invalid();
 const c=v.control;if(c.state==='HELD'||c.state==='OTHER_CLIENT'){if(!basis(c.basis)||(c.state==='HELD')!==(c.basis.actorId===v.actorId&&c.basis.clientId===v.clientId))return invalid();}else if(!['UNASSIGNED','UNVERIFIED'].includes(String(c.state))||c.basis!==null)return invalid();
}
function assertList(v:unknown,projectId:string,view:'OWN'|'CONTROLLER'):asserts v is ControlRequestListResult{
 if(!exact(v,['projectId','view','limit','observedAt','items','hasMore','nextCursor','executionAuthorized','controlTransferred'])||v.projectId!==projectId||v.view!==view||v.limit!==50||!iso(v.observedAt)||!Array.isArray(v.items)||v.items.length>50||typeof v.hasMore!=='boolean'||!flags(v)||v.hasMore!==(typeof v.nextCursor==='string'&&v.nextCursor.length>0)||!v.hasMore&&v.nextCursor!==null||typeof v.nextCursor==='string'&&v.nextCursor.length>4096)return invalid();
 const ids=new Set<string>();for(const row of v.items){if(!exact(row,['requestRef','createdAt','expiresAt','storedState','current','executionAuthorized','controlTransferred'])||!ref(row.requestRef)||row.requestRef.version!==1||ids.has(row.requestRef.id)||!iso(row.createdAt)||!iso(row.expiresAt)||Date.parse(row.expiresAt)<=Date.parse(row.createdAt)||Date.parse(row.expiresAt)-Date.parse(row.createdAt)>30*60000||row.storedState!=='PENDING'||!current(row.current)||!flags(row))return invalid();ids.add(row.requestRef.id);}
}
export class ControlApi{
 transport:typeof fetch;session:ControlSession;projectId:string;
 constructor(transport:typeof fetch,session:ControlSession,projectId:string){this.transport=transport;this.session=session;this.projectId=projectId;}
 private base():string{if(!uuid(this.projectId)||!uuid(this.session.user.id)||!uuid(this.session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(this.session.csrfToken))throw new ApiError('AUTH_REQUIRED',401);return '/api/v1/projects/'+this.projectId;}
 private path(request:ControlRef):string{if(!ref(request)||request.version!==1)return invalid();return this.base()+'/control-requests/'+request.id+'/versions/'+request.version;}
 private async wire(path:string,command?:ControlCommand):Promise<unknown>{
 const headers:Record<string,string>={Accept:'application/json','X-Anvil-CSRF':this.session.csrfToken};if(command){headers['Content-Type']='application/json';headers['Idempotency-Key']=command.commandId;}
 let response:Response;try{response=await this.transport.call(globalThis,path,{method:command?'POST':'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers,...(command?{body:browserCanonical(command)}:{})});}catch{throw new ApiError('CONNECTION_LOST');}
 // A default-OFF 404 may be a non-JSON framework response. Preserve its denial status.
 if(!response.ok){throw new ApiError(response.status===401?'AUTH_REQUIRED':response.status===404?'NOT_FOUND':response.status===503?'NOT_CONNECTED':'REQUEST_FAILED',response.status);}
 if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))return invalid();
 let raw:string;try{raw=await response.text();}catch{return invalid();}if(new TextEncoder().encode(raw).length>2*1024*1024)return invalid();return parseWire(raw);
 }
 async state():Promise<ControlStateResult>{
 const v=await this.wire(this.base()+'/control-state');
 assertState(v,this.projectId,this.session);
 return v;
 }
 async list(view:'OWN'|'CONTROLLER',cursor:string|null=null):Promise<ControlRequestListResult>{
 if(view!=='OWN'&&view!=='CONTROLLER'||cursor!==null&&(!cursor||cursor.length>4096))return invalid();
 const query=new URLSearchParams({view,limit:'50'});if(cursor)query.set('cursor',cursor);
 const v=await this.wire(this.base()+'/control-requests?'+query);
 assertList(v,this.projectId,view);
 return v;
 }
 async request(requestRef:ControlRef):Promise<ControlRequestReadResult>{
 const v=await this.wire(this.path(requestRef)+'?contentHash='+requestRef.contentHash);
 if(!exact(v,['projectId','requestRef','snapshot','observedAt','current','executionAuthorized','controlTransferred'])||v.projectId!==this.projectId||!same(v.requestRef,requestRef)||!iso(v.observedAt)||!current(v.current)||!flags(v))return invalid();const body=await snapshot(v.snapshot,requestRef,this.projectId);return {projectId:this.projectId,requestRef,snapshot:body,observedAt:v.observedAt,current:v.current,executionAuthorized:false,controlTransferred:false};
 }
 async head(requestRef:ControlRef):Promise<HandoffSummaryHeadResult>{
 const v=await this.wire(this.path(requestRef)+'/handoff-summaries/head?requestHash='+requestRef.contentHash);
 if(!exact(v,['schemaVersion','projectId','requestRef','observedAt','head','executionAuthorized','controlTransferred'])||v.schemaVersion!==1||v.projectId!==this.projectId||!same(v.requestRef,requestRef)||!iso(v.observedAt)||!exact(v.head,['state','summaryRef'])||!flags(v))return invalid();
 if(v.head.state==='NONE'){if(v.head.summaryRef!==null)return invalid();}else if(v.head.state!=='AVAILABLE'||!ref(v.head.summaryRef)||v.head.summaryRef.id!==requestRef.id)return invalid();return {schemaVersion:1,projectId:this.projectId,requestRef,observedAt:v.observedAt,head:v.head.state==='NONE'?{state:'NONE',summaryRef:null}:{state:'AVAILABLE',summaryRef:readRef(v.head.summaryRef)},executionAuthorized:false,controlTransferred:false};
 }
 async summary(requestRef:ControlRef,summaryRef:ControlRef,expiresAt:string):Promise<HandoffSummaryReadResult>{
 if(!ref(summaryRef)||summaryRef.id!==requestRef.id)return invalid();const v=await this.wire(this.path(requestRef)+'/handoff-summaries/'+summaryRef.version+'?requestHash='+requestRef.contentHash+'&summaryHash='+summaryRef.contentHash);
 if(!exact(v,['projectId','requestRef','summaryRef','body','observedAt','current','executionAuthorized','controlTransferred'])||v.projectId!==this.projectId||!same(v.requestRef,requestRef)||!same(v.summaryRef,summaryRef)||!iso(v.observedAt)||!current(v.current)||!flags(v))return invalid();const body=await summaryBody(v.body,requestRef,summaryRef,this.projectId,expiresAt);return {projectId:this.projectId,requestRef,summaryRef,body,observedAt:v.observedAt,current:v.current,executionAuthorized:false,controlTransferred:false};
 }
 async send(command:ControlCommand):Promise<ControlResult>{
 if(!exact(command,['schemaVersion','operation','commandId','projectId','clientId','payload'])||command.schemaVersion!==1||!uuid(command.commandId)||command.projectId!==this.projectId||command.clientId!==this.session.clientId)return invalid();
 let path=this.base()+'/control-requests';if(command.operation==='prepareControlHandoff'){if(!exact(command.payload,['requestRef'])||!ref(command.payload.requestRef)||command.payload.requestRef.version!==1)return invalid();path=this.path(command.payload.requestRef)+'/handoff-summaries';}else if(command.operation!=='requestControl'||!inputShape(command.payload)||!exact(command.payload.targetActorRef,['userId'])||!exact(command.payload.targetClientRef,['userId','clientId'])||command.payload.targetActorRef.userId!==this.session.user.id||command.payload.targetClientRef.userId!==this.session.user.id||command.payload.targetClientRef.clientId!==this.session.clientId)return invalid();
 const v=await this.wire(path,command),prepare=command.operation==='prepareControlHandoff';
 if(!exact(v,prepare?['summaryRef','body','receipt']:['requestRef','snapshot','receipt'])||!exact(v.receipt,prepare?['schemaVersion','commandId','commandHash','projectId','actorId','clientId','requestRef','summaryRef','outcome']:['schemaVersion','commandId','commandHash','projectId','actorId','clientId','requestRef','outcome']))return invalid();
 const r=v.receipt;if(r.schemaVersion!==1||r.commandId!==command.commandId||!hash(r.commandHash)||r.commandHash!==await wireHash(command)||r.projectId!==this.projectId||r.actorId!==this.session.user.id||r.clientId!==this.session.clientId||r.outcome!==(prepare?'SUMMARY_STORED':'REQUEST_STORED'))return invalid();
 if(command.operation==='requestControl'){if(!ref(v.requestRef)||!same(r.requestRef,v.requestRef))return invalid();const body=await snapshot(v.snapshot,v.requestRef,this.projectId);if(body.requestedBy.actorId!==this.session.user.id||body.requestedBy.clientId!==this.session.clientId||!same({targetActorRef:body.targetActorRef,targetClientRef:body.targetClientRef,baseControl:body.baseControl,reason:body.reason,expiresAt:body.expiresAt},command.payload))return invalid();return {requestRef:v.requestRef,snapshot:body,receipt:{schemaVersion:1,commandId:command.commandId,commandHash:r.commandHash,projectId:this.projectId,actorId:this.session.user.id,clientId:this.session.clientId,requestRef:v.requestRef,outcome:'REQUEST_STORED'}};}
 if(!ref(v.summaryRef)||!same(r.summaryRef,v.summaryRef)||!same(r.requestRef,command.payload.requestRef)||!exact(v.body,summaryKeys)||!iso(v.body.observedAt)||!iso(v.body.validUntil))return invalid();
 // Prepare does not carry request expiry. Validate against a bounded observedAt+30s;
 // the selected fixed request is re-read by the UI before the result is displayed.
 const body=await summaryBody(v.body,command.payload.requestRef,v.summaryRef,this.projectId,v.body.validUntil);
 return {summaryRef:v.summaryRef,body,receipt:{schemaVersion:1,commandId:command.commandId,commandHash:r.commandHash,projectId:this.projectId,actorId:this.session.user.id,clientId:this.session.clientId,requestRef:command.payload.requestRef,summaryRef:v.summaryRef,outcome:'SUMMARY_STORED'}};
 }
}

/** Server canonical JSON algorithm, browser-only; exact equivalence is tested. */
export function browserCanonical(value: unknown): string {
  const active = new Set<object>();
  function encode(item: unknown, depth: number): string {
    if (depth > 64) return invalid();
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'string') return item.isWellFormed() ? JSON.stringify(item) : invalid();
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) return invalid();
      return JSON.stringify(item);
    }
    if (typeof item !== 'object' || active.has(item) || Object.getOwnPropertySymbols(item).length) return invalid();
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) return invalid();
    active.add(item);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Array.isArray(item)) {
        if (Object.keys(descriptors).length !== item.length + 1) return invalid();
        const parts = [];
        for (let n = 0; n < item.length; n++) {
          const descriptor = descriptors[String(n)];
          if (!descriptor || !('value' in descriptor)) return invalid();
          parts.push(encode(descriptor.value, depth + 1));
        }
        return '[' + parts.join(',') + ']';
      }
      const parts = Object.keys(descriptors).sort().map(key => {
        const descriptor = descriptors[key]!;
        if (!key.isWellFormed() || !descriptor.enumerable || !('value' in descriptor)) return invalid();
        return JSON.stringify(key) + ':' + encode(descriptor.value, depth + 1);
      });
      return '{' + parts.join(',') + '}';
    } finally { active.delete(item); }
  }
  return encode(value, 0);
}
