import {createHmac} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
export const id=(n:number)=>`a6170000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const pid=id(1),uid=id(2),cid=id(3),nid=id(4),rid=id(5),at='2026-10-27T00:00:00.000Z';
export const actor={actorId:uid,clientId:cid,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(6),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
export const sign=(s:string)=>createHmac('sha256','synthetic-test-key').update(s).digest('hex');
export function fixture(){
 const policyRef={id:id(8),version:1,contentHash:'a'.repeat(64)},actionScope={operation:'uploadArtifact',targetRef:null,expectedVersion:0,payloadHash:'b'.repeat(64),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1};
 const details={candidateCommandId:id(9),actionScope,expiresAt:'2099-01-01T00:00:00.000Z',reason:'합성 비공개 이유',risks:{data:'합성',security:'합성',cost:'없음',interruption:'없음',unverified:'실DB 미확인'},rollback:{method:'원자료 보존',limitations:'실DB 미확인',evidenceRefs:[]}},snapshot={projectId:pid,details,scopeDigest:contentHash(canonicalJson(actionScope)),requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1};
 const ref={id:rid,version:1,contentHash:contentHash(canonicalJson(snapshot))},request={id:rid,version:1,status:'PENDING',...snapshot,createdAt:at};
 const source:any={id:rid,project_id:pid,version:3,status:'CONSUMED',command_id:id(7),created_by:uid,client_id:cid,actor_id:uid,command_client:cid,operation:'requestApproval',state:'APPLIED',scope_kind:'PROJECT',command_project:pid,source_control_generation:1,caller_command_id:id(20),request_json:request,content_hash:ref.contentHash,created_at:new Date(at),policy_ref:policyRef,details_json:details,candidate_command_id:details.candidateCommandId,action_scope_json:actionScope,scope_digest:snapshot.scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(details.expiresAt),result_ref:{commandId:id(20),status:'APPLIED',projectId:pid,targetId:rid,version:1,data:{status:'APPROVAL_REQUESTED',ref,request}}};
 const body={id:nid,eventRef:{kind:'APPROVAL_REQUESTED',serverCommandId:id(7),requestRef:ref,channel:'IN_APP',occurredAt:at},recipientRef:{kind:'HUMAN',userId:uid},projectRef:{id:pid},severity:'ACTION_REQUIRED',reason:'APPROVAL_REQUESTED',authenticatedTarget:{kind:'APPROVAL_REQUEST',projectId:pid,approvalRequestId:rid},deliveryState:'STORED_IN_APP'};
 const row:any={id:nid,project_id:pid,source_command_id:id(7),approval_request_id:rid,recipient_user_id:uid,request_version:1,request_content_hash:ref.contentHash,event_kind:'APPROVAL_REQUESTED',channel:'IN_APP',severity:'ACTION_REQUIRED',reason_code:'APPROVAL_REQUESTED',delivery_state:'STORED_IN_APP',content_hash:contentHash(canonicalJson(body)),created_at:new Date(at),cursor_at:at,read_at:null};
 const rules=[{ruleId:'mark',subjectRef:{kind:'HUMAN',userId:uid},operations:['markNotificationRead'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
 const f={row,source,reads:[] as any[],commands:[] as any[],audits:0,receipts:0,queries:[] as string[],member:true,participation:'OWNER',control:true,clock:new Date(at),failRead:false,missing:false,policy:true,rules,policyHash:()=>contentHash(canonicalJson({rules,reason:'합성',reviewRefs:[]})),db:null as unknown as PoolClient};
 f.db={query:async(sql:string,p:any[]=[])=>{f.queries.push(sql);let rows:any[]=[];
 if(sql.includes('JOIN anvil.project_members m'))rows=f.member?[{id:pid,archived_at:null,participation:f.participation}]:[];
 else if(sql.includes('FROM anvil.project_control'))rows=f.control?[{project_id:pid,actor_id:uid,client_id:cid,generation:1,revoked_at:null}]:[];
 else if(sql.includes('FROM anvil.permission_policies'))rows=f.policy?[{id:id(8),head_version:1,rules_json:f.rules,content_hash:f.policyHash(),reason:'합성',review_refs:[],created_at:new Date(at)}]:[];
 else if(sql.includes('FROM anvil.notifications')){if(f.missing)throw Object.assign(Error('missing'),{code:'42P01'});rows=p[0]===pid&&p[1]===uid&&(!sql.includes('n.id=$3')||p[2]===nid)?[{...f.row,read_at:f.reads[0]?.read_at??null,read_command_id:f.reads[0]?.command_id,read_content_hash:f.reads[0]?.notification_content_hash,read_client_id:f.reads[0]?.client_id}]:[];if(p[2]==='UNREAD'&&f.reads.length)rows=[];if(p[2]==='READ'&&!f.reads.length)rows=[];}
 else if(sql.includes('FROM anvil.approval_requests'))rows=[f.source];
 else if(sql.includes('FROM anvil.notification_reads'))rows=f.reads;
 else if(sql.startsWith('INSERT INTO anvil.notification_reads')){if(f.failRead)throw Error('synthetic storage failure');f.reads.push({project_id:p[0],notification_id:p[1],recipient_user_id:p[2],client_id:p[3],command_id:p[4],notification_content_hash:p[5],read_at:new Date(p[6])});}
 else if(sql.includes('FROM anvil.commands c JOIN anvil.authorization_receipts'))rows=f.commands.filter(c=>c.id===p[1]);
 else if(sql.includes('FROM anvil.commands')&&sql.includes('command_id=$3'))rows=f.commands.filter(c=>c.command_id===p[2]);
 else if(sql.startsWith('INSERT INTO anvil.commands'))f.commands.push({id:p[0],scope_kind:'PROJECT',state:'APPLIED',operation_id:p[7],expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),actor_id:p[2],client_id:p[3],subject_ref:{kind:'HUMAN',userId:p[2],clientId:p[3]},operation:p[4],command_id:p[5],request_hash:p[6],result_ref:JSON.parse(p[14])});
 else if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){f.receipts++;f.commands.find(c=>c.id===p[2]).scope_digest=p[5];}
 else if(sql.startsWith('INSERT INTO anvil.audit_events')){if(sql.includes("'APPLIED'"))f.audits++;}
 else if(sql.includes('clock_timestamp')||sql.includes('transaction_timestamp'))rows=[{at:new Date(f.clock)}];
 else if(!sql.includes('set_config'))throw Error('unexpected synthetic SQL: '+sql);
 return {rows,rowCount:rows.length};}} as any;
 return f;
}
export function command(f:ReturnType<typeof fixture>,commandId=id(10)):any{return{schemaVersion:1,projectId:pid,commandId,clientId:cid,controlGeneration:1,operation:'markNotificationRead',targetId:nid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{notificationRef:{id:nid,version:1,contentHash:f.row.content_hash}}};}
export function access(f:ReturnType<typeof fixture>){return {signProjectCursor:sign,signMethodCursor:sign,authenticated:async(_t:string,_c:any,body:any)=>{const before={reads:structuredClone(f.reads),commands:structuredClone(f.commands),audits:f.audits,receipts:f.receipts};try{return await body(f.db,actor);}catch(e){Object.assign(f,before);throw e;}}} as unknown as AccessRepository;}
