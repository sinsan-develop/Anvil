import assert from 'node:assert/strict';
import test from 'node:test';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
import {criteriaFixture,criteriaHash as hash,criteriaId as id,criteriaRef as ref} from './result-criteria-fixture.ts';
const mod:any=await import('../../../apps/server/modules/results/project-result-criteria.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const f=criteriaFixture(),at='2026-10-19T10:02:00.000Z',actor:any={actorId:id(6),clientId:id(20),credentialGeneration:1,authSession:{id:id(21),idleExpiresAt:'2099-10-19T11:00:00.000Z',absoluteExpiresAt:'2099-10-19T12:00:00.000Z'}},request:any={schemaVersion:1,projectId:f.assignment.projectId,commandId:id(22),clientId:actor.clientId,controlGeneration:1,operation:'saveResultCriteria',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:structuredClone(f.input)};
 const rule={ruleId:'CRITERIA_ONLY',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['saveResultCriteria'],targetScopes:[{kind:'PROJECT',projectId:request.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-10-19T11:00:00.000Z'},policy:any={id:id(23),head_version:1,rules_json:[rule],reason:'기준 등록만',review_refs:[],created_at:new Date(at),content_hash:hash({rules:[rule],reason:'기준 등록만',reviewRefs:[]})},policyRef={id:policy.id,version:1,contentHash:policy.content_hash};
 const rows:any[]=[],commands=new Map<string,any>(),receipts=new Map<string,any>(),audits=new Set<string>(),calls:string[]=[];let member=true,controlled=true,afterRead=()=>{},now=at,head:any=policy;
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push(sql);
  if(sql.includes('JOIN anvil.project_members'))return{rows:member?[{id:request.projectId,participation:'OWNER',archived_at:null}]:[]};
  if(sql.includes('FROM anvil.project_control'))return{rows:controlled?[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]:[]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:head?[head]:[]};
  if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(now)}]};
  if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(p[0],{command_id:p[0],operation:p[4],actor_id:p[2],client_id:p[3],original_command_id:p[5],request_hash:p[6],state:'APPLIED',expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),result_ref:JSON.parse(p[14]),authorization_receipt_id:p[8]});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.set(p[0],{subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){audits.add(p[4]);return{rows:[]};}
  if(sql.startsWith('SELECT set_config'))return{rows:[]};
  if(sql.startsWith('INSERT INTO anvil.result_criteria_versions')){rows.push({project_id:p[0],criteria_id:p[1],version:p[2],assignment_ref:JSON.parse(p[3]),content_hash:p[4],criteria_json:JSON.parse(p[5]),input_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9],created_at:new Date(p[10])});return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.result_criteria_versions v'))return{rows:rows.filter(r=>r.project_id===p[0]&&r.criteria_id===p[1]&&r.version===p[2]).map(r=>{const c=structuredClone(commands.get(r.command_id)),ar=structuredClone(receipts.get(c.authorization_receipt_id));return{...structuredClone(r),...c,command_client_id:c.client_id,receipt_subject:ar.subject_ref,receipt_policy_ref:ar.policy_ref,scope_digest:ar.scope_digest,approval_decision_ref:ar.approval_decision_ref,audit_count:audits.has(r.command_id)?1:0};})};
  if(sql.includes('FROM anvil.result_criteria_versions'))return{rows:rows.filter(r=>r.project_id===p[0]&&r.criteria_id===p[1]).sort((a,b)=>b.version-a.version).slice(0,1).map(r=>structuredClone(r))};
  throw Error('UNEXPECTED_QUERY:'+sql);
 }};
 const assignments:any={read:async(_db:any,_actor:any,pid:string,aid:string,version:number)=>{assert.equal(pid,f.assignment.projectId);assert.equal(aid,f.assignment.ref.id);assert.equal(version,1);afterRead();return structuredClone(f.assignment);}};
 return{...f,actor,request,policy,policyRef,db,assignments,rows,calls,commands,member:(v:boolean)=>member=v,controlled:(v:boolean)=>controlled=v,policyHead:(v:any)=>head=v,afterRead:(fn:()=>void)=>afterRead=fn,now:(v:string)=>now=v};
}
function service(f:ReturnType<typeof fixture>){assert.equal(typeof mod.ProjectResultCriteria,'function','FN12 불변 검수 기준 저장 미구현');return new mod.ProjectResultCriteria(f.assignments);}
test('계획된기준등록은사용자자동부여가아닌별도명시정책연산이다',()=>{const f=fixture();assert.equal(materialRules(f.policy.rules_json,f.request.projectId,f.actor.actorId,new Date('2026-10-19T10:02:00.000Z'))[0]!.operations[0],'saveResultCriteria');});
test('확정임무의정확조건을영수증/감사와저장하고개정해도이전버전을보존한다',async()=>{
 const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef),first=structuredClone(saved.data.ref);assert.equal(saved.data.status,'RESULT_CRITERIA_STORED');assert.equal(saved.data.registryStored,true);assert.equal(saved.data.reviewStored,false);assert.equal(saved.data.completionAccepted,false);assert(f.rows[0].criteria_json.items.every((i:any)=>i.required===true));
 const read=await s.read(f.db,f.actor,f.request.projectId,first.id,1);assert.deepEqual(read.ref,first);assert.equal(read.input.items[0].sources[0].contentHash,hash('실제 저장'));assert.equal(f.rows.length,1);
 const revision={...structuredClone(f.request),commandId:id(25),targetId:first.id,expectedVersion:1,payload:{...structuredClone(f.input),baseRef:first}};revision.payload.items[0].kind='BROWSER';const next=await s.save(f.db,f.actor,revision,f.policyRef);assert.equal(next.data.ref.version,2);assert.notEqual(next.data.ref.contentHash,first.contentHash);assert.deepEqual((await s.read(f.db,f.actor,f.request.projectId,first.id,1)).ref,first);assert.equal(f.rows.length,2);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.authorization_receipts')).length,2);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.audit_events')).length,2);
});
test('현재제어/정책·세션/정확기준이없으면저장하지않고옛base개정도거절한다',async()=>{
 for(const alter of [(f:any)=>f.member(false),(f:any)=>f.controlled(false),(f:any)=>f.policyHead(null),(f:any)=>f.request.payload.assignmentRef.contentHash='f'.repeat(64),(f:any)=>f.request.payload.items.pop(),(f:any)=>f.actor.authSession.idleExpiresAt='2026-10-19T10:00:00.000Z',(f:any)=>f.afterRead(()=>f.controlled(false))]){const f=fixture();alter(f);await assert.rejects(service(f).save(f.db,f.actor,f.request,f.policyRef));assert.equal(f.rows.length,0);}
 const f=fixture(),s=service(f),first=await s.save(f.db,f.actor,f.request,f.policyRef);const req={...structuredClone(f.request),targetId:first.data.ref.id,expectedVersion:1,payload:{...structuredClone(f.input),baseRef:{...first.data.ref,contentHash:'f'.repeat(64)}}};await assert.rejects(s.save(f.db,f.actor,req,f.policyRef));assert.equal(f.rows.length,1);
});
test('다른프로젝트/멤버회수와행/명령대응손상은등록기준조회로노출하지않는다',async()=>{
 for(const alter of [(f:any)=>f.member(false),(f:any)=>f.rows[0].criteria_json.items[0].required=false,(f:any)=>f.rows[0].input_json.reason='다른 명령',(f:any)=>f.rows[0].project_id=id(90),(f:any)=>f.commands.values().next().value.result_ref.commandId=id(90)]){const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef);alter(f);await assert.rejects(s.read(f.db,f.actor,f.request.projectId,saved.data.ref.id,1));}
});
