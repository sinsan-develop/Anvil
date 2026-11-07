import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {ProjectKnowledge} from '../../../apps/server/modules/knowledge/knowledge.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',at=new Date('2026-10-25T00:00:00Z');
const graph={nodes:[{nodeId:'N1',name:'설계',purpose:'고정 기준',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사람'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const snapshot={name:'보관 적용본',purpose:'관련성',graph,sourceRef:{id:uid,version:1,contentHash:contentHash(canonicalJson(graph))}},applicationRef={id:aid,version:2,contentHash:contentHash(canonicalJson(snapshot))};

// SQL 엔진·RLS·COMMIT을 모사하지 않는다. 실제 서비스가 내보낸 저장 필드를 같은 서비스의 조회에 연결한다.
test('서비스 저장 영수증→보관 행→정확조회는 관련성·원문·hash·사람 이력을 함께 보존한다',async()=>{
 const body='사용자 소유의 판단',entry={kind:'FACT',title:'관측',contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'고정 단계와 관련',scope:{projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[]},relatedRefs:[]};
 const commands=new Map<string,any>();let stored:any=null,head:any=null,event:any=null;
 let application:any={id:aid,project_id:pid,application_version:2,snapshot_json:snapshot,snapshot_hash:applicationRef.contentHash,source_definition_id:uid,source_version:1,source_hash:snapshot.sourceRef.contentHash};
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM anvil.project_methodologies')){assert.deepEqual(args,[pid,aid,2]);return{rows:application?[application]:[]};}
  if(sql==='SELECT transaction_timestamp() AS at')return{rows:[{at}]};
  if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(args[0],{actor:args[2],operation:args[4],result:JSON.parse(args[14])});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return{rows:[]};
  if(sql.startsWith('INSERT INTO anvil.knowledge_entries')){head={id:args[0],project_id:args[1],kind:args[2],head_version:1};return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.knowledge_versions')){stored={project_id:args[0],entry_id:args[1],version:1,title:args[2],content_artifact_id:args[3],content_hash:args[4],source_refs:JSON.parse(args[5]),reason:args[6],scope_json:JSON.parse(args[7]),related_refs:JSON.parse(args[8]),entry_json:JSON.parse(args[9]),created_by:args[10]};return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.knowledge_events')){const command=commands.get(args[6]);event={id:args[0],kind:'PROPOSED',reason:args[3],actor_ref:JSON.parse(args[4]),recorded_at:at,base_ref:null,change_sources:null,review_refs:null,command_actor_id:command.actor,command_operation:command.operation,command_result:command.result};return{rows:[]};}
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members')){assert.deepEqual(args,[pid,uid]);return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};}
  if(sql.startsWith('SELECT v.*,k.kind,k.head_version')){assert.deepEqual(args,[pid,head.id,1]);return{rows:[{...stored,kind:head.kind,head_version:head.head_version}]};}
  if(sql.includes('FROM anvil.knowledge_events e JOIN anvil.commands'))return{rows:[event]};
  if(sql.includes('FROM anvil.content_reviews')||sql.includes('FROM anvil.project_constitutions'))return{rows:[]};
  throw Error('UNEXPECTED_SQL_BOUNDARY');
 }};
 const service=new ProjectKnowledge({originalText:async(_db:any,projectId:string,ref:any)=>{assert.equal(projectId,pid);assert.deepEqual(ref,entry.contentRef);return body;}} as any);
 const result=await service.save(db as any,{actorId:uid,clientId:uid} as any,{schemaVersion:1,projectId:pid,clientId:uid,commandId:randomUUID(),controlGeneration:1,operation:'saveKnowledge',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{entry}} as any,{id:uid,version:1,contentHash:'a'.repeat(64)});
 const view=await service.read(db as any,{actorId:uid,clientId:uid} as any,pid,result.targetId,1);
 assert.ok('ref' in result.data);assert.ok('entry' in result.data);assert.ok(view.history[0]);
 assert.deepEqual(view.entry,entry);assert.deepEqual(view.ref,result.data.ref);assert.equal(view.ref.contentHash,contentHash(canonicalJson(entry)));assert.equal(view.body,body);assert.equal(view.state,'PROPOSED');assert.equal(view.currentConfirmationValid,false);assert.deepEqual(view.history[0].actorRef,{kind:'HUMAN',userId:uid});assert.equal(view.agentDelivery,'NOT_CONNECTED');
 stored.scope_json={projectId:pid,stageRefs:[],taskRefs:[]};await assert.rejects(service.read(db as any,{actorId:uid,clientId:uid} as any,pid,result.targetId,1),(e:any)=>e.message==='KNOWLEDGE_INTEGRITY_FAILED');stored.scope_json=structuredClone(entry.scope);
 application=null;await assert.rejects(service.read(db as any,{actorId:uid,clientId:uid} as any,pid,result.targetId,1),(e:any)=>e.message==='KNOWLEDGE_SCOPE_NOT_FOUND');assert.deepEqual(result.data.entry,entry);
});
