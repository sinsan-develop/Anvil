import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const load=()=>import('../../../apps/server/modules/control-handoff/control-grant.ts');
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const input=()=>({projectId:id(1),command:{schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(2),projectId:id(1),clientId:id(4),payload:{requestRef:ref(3),summaryVersion:1,reason:'수락 원문'}},requestRef:ref(3),summaryRef:ref(5),before:{actorId:id(6),clientId:id(7),generation:8,version:9},targetActorId:id(8),recordedAt:'2026-11-03T00:00:00.000Z',ids:{acceptance:id(10),revocation:id(11),grant:id(12),receipt:id(13),audit:id(14)}});
test('수락 DAG는 비순환 exact refs와 현재 tuple로만 현재 grant를 검산한다',async()=>{
 const m=await load(),v=input(),c=m.createControlAcceptanceChain(v);
 assert.equal(c.result.nextControl.generation,9);assert.equal(c.result.nextControl.actorId,id(8));
 assert.equal(c.acceptance.ref.contentHash,contentHash(canonicalJson(c.acceptance.snapshot)));
 assert.equal('grantRef' in c.acceptance.snapshot,false);
 const proof=m.verifyControlAcceptanceChain(c);assert.deepEqual(proof.result,c.result);assert.ok(Object.isFrozen(proof));
 const copy=structuredClone(c);copy.grant.snapshot.basis.clientId=id(99);assert.throws(()=>m.verifyControlAcceptanceChain(copy));
});
test('과거 summary/원 세션 기한을 새 grant TTL로 만들지 않으며 구generation은 거절한다',async()=>{
 const m=await load(),c=m.createControlAcceptanceChain(input());let queries=0;
 const db={query:async()=>{queries++;return{rows:[{bundle_json:c,next_generation:9,project_id:id(1),content_hash:c.acceptance.ref.contentHash,grant_rows:[c.grant,c.revocation],command_rows:[{command:c.command,result:c.result,commandHash:contentHash(canonicalJson(c.command)),resultHash:contentHash(canonicalJson(c.result))}],receipt_rows:[c.receipt],audit_rows:[c.audit],revoked_count:'0'}]};}};
 const p=await m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,revoked_at:null});assert.equal(p.result.grantRef.id,id(12));assert.equal(queries,1);
 await assert.rejects(()=>m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,generation:10,revoked_at:null}));
});
test('Proxy/getter 원형은 실행하지 않고 거절한다',async()=>{
 const m=await load();let calls=0;const proxy=new Proxy(input(),{get(){calls++;throw Error('실행 금지');}});assert.throws(()=>m.createControlAcceptanceChain(proxy));assert.equal(calls,0);
 const getter={...input()};Object.defineProperty(getter,'projectId',{enumerable:true,get(){calls++;return id(1);}});assert.throws(()=>m.createControlAcceptanceChain(getter));assert.equal(calls,0);
});

test('그럴듯한 bundle만 있고 물리 grant/command/receipt/audit가 없으면 현재 권위를 열지 않는다',async()=>{
 const m=await load(),c=m.createControlAcceptanceChain(input());
 const db={query:async()=>({rows:[{bundle_json:c,next_generation:9,project_id:id(1),content_hash:c.acceptance.ref.contentHash}]})};
 await assert.rejects(()=>m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,revoked_at:null}));
});

test('actual generic Repo는 수락 grant의 HE 일반문서만 원 명시정책 아래 dispatch하고 OWNER 관리는 거절한다',async()=>{
 const m=await load(),{ProjectPolicyRepository}=await import('../../../apps/server/modules/access/project-command.ts'),c=m.createControlAcceptanceChain(input()),actor={actorId:id(8),clientId:id(4),credentialGeneration:1,serverOwner:false},physical={bundle_json:c,next_generation:9,project_id:id(1),content_hash:c.acceptance.ref.contentHash,grant_rows:[c.grant,c.revocation],command_rows:[{command:c.command,result:c.result,commandHash:contentHash(canonicalJson(c.command)),resultHash:contentHash(canonicalJson(c.result))}],receipt_rows:[c.receipt],audit_rows:[c.audit],revoked_count:'0'};
 let denied=false,configured=true,calls=0;const rules=()=>[{ruleId:'ordinary',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:id(1)}],disposition:denied?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
 const db={query:async(sql:string)=>{if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:id(1),participation:'HANDOFF_ELIGIBLE',archived_at:null}]};if(sql.includes('FROM anvil.project_control'))return{rows:[{project_id:id(1),actor_id:actor.actorId,client_id:actor.clientId,generation:9,version:10,revoked_at:null}]};if(sql.includes('FROM anvil.control_handoffs'))return{rows:[physical]};if(sql.includes('FROM anvil.permission_policies p JOIN')){const snapshot={rules:rules(),reason:'일반 문서 명시 정책',reviewRefs:[]};return{rows:configured?[{id:id(40),head_version:1,rules_json:snapshot.rules,content_hash:contentHash(canonicalJson(snapshot)),reason:snapshot.reason,review_refs:[],createdAt:new Date('2026-11-03T00:00:00.000Z'),created_at:new Date('2026-11-03T00:00:00.000Z')}]:[]};}if(sql.includes('FROM anvil.commands')||sql.includes('INSERT INTO anvil.audit_events'))return{rows:[]};throw Error('UNMODELED_SQL '+sql);}};
 const access={authenticated:async(_token:string,_csrf:string|null,work:Function)=>work(db,actor)},repo=new ProjectPolicyRepository(access as never),command={schemaVersion:1,projectId:id(1),commandId:id(41),clientId:actor.clientId,controlGeneration:9,operation:'saveDocumentDraft',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
 const result=await repo.command('memory','csrf',command as never,async()=>{calls++;return{status:'NORMAL_HANDLER_CALLED'};});assert.equal(result.status,'NORMAL_HANDLER_CALLED');assert.equal(calls,1);
 denied=true;await assert.rejects(()=>repo.command('memory','csrf',command as never,async()=>{calls++;}));denied=false;configured=false;await assert.rejects(()=>repo.command('memory','csrf',command as never,async()=>{calls++;}));configured=true;
 await assert.rejects(()=>repo.command('memory','csrf',{...command,operation:'savePermissionPolicy'}as never,async()=>{calls++;}));assert.equal(calls,1);
});

test('project 상세 HELD는 HE에게 실제 수락 grant가 있을 때만 표시하고 OWNER/VIEWER는 원동작을 유지한다',async()=>{
 const {ProjectsRepository}=await import('../../../apps/server/modules/projects/repository.ts'),m=await load(),chain=m.createControlAcceptanceChain(input());let participation='HANDOFF_ELIGIBLE',present=false;const actor={actorId:id(8),clientId:id(4)},at=new Date('2026-11-03T00:00:00.000Z');
 const db={query:async(sql:string)=>{if(sql.includes('FROM anvil.project_source_declarations'))return{rows:[]};if(sql.includes('FROM anvil.control_handoffs'))return{rows:present?[{project_id:id(1),next_generation:9,content_hash:chain.acceptance.ref.contentHash,bundle_json:chain,grant_rows:[chain.grant,chain.revocation],command_rows:[{command:chain.command,result:chain.result,commandHash:contentHash(canonicalJson(chain.command)),resultHash:contentHash(canonicalJson(chain.result))}],receipt_rows:[chain.receipt],audit_rows:[chain.audit],revoked_count:'0'}]:[]};if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:id(1),name:'프로젝트',purpose:'원문',desired_outcome:'유지',version:1,created_at:at,updated_at:at,participation,actor_id:actor.actorId,client_id:actor.clientId,generation:9,control_version:10,control_revoked_at:null,controller_status:'ACTIVE',controller_revoked_at:null,controller_client_revoked_at:null,policy_id:null,application_id:null}]};throw Error('UNMODELED_SQL '+sql);}};
 const access={authenticated:async(_t:string,_c:null,work:Function)=>work(db,actor),signProjectCursor:()=>{throw Error('UNSELECTED_CURSOR');}},repo=new ProjectsRepository(access as never);
 const denied=await repo.detail('memory',id(1));assert.deepEqual(denied.controlState,{actorId:null,clientId:null,generation:null,status:'UNASSIGNED'});
 present=true;assert.equal((await repo.detail('memory',id(1))).controlState.status,'HELD');present=false; participation='OWNER';assert.equal((await repo.detail('memory',id(1))).controlState.status,'HELD');participation='VIEWER';assert.equal((await repo.detail('memory',id(1))).controlState.status,'HELD');
});
