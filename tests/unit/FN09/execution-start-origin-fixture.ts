import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nodeDecisionFixture,H,id,artifactCalls} from '../FN10/node-decision-fixture.ts';
export {H,id,artifactCalls};
export {installNodeDecisionMemoryFS as installExecutionStartOriginMemoryFS} from '../FN10/node-decision-fixture.ts';
/** 기존 순수 fixture의 실제 ArtifactStore/문서·계획을 재사용한다. 성공 보호 메서드는 바꾸지 않는다. */
export async function executionStartOriginFixture(options:{unrelatedStageBaseline?:boolean;clockOffsetMs?:number;budgetElapsedMs?:number;connectorEnvironment?:boolean;richContext?:boolean;environmentDependencies?:boolean;constitutionContext?:boolean;approvedContext?:boolean;snapshotRoot?:boolean;originRequestStorage?:boolean}={}){
 const f=await nodeDecisionFixture(),{db,access,documents,pid,uid,cid}=f,raw=db.query;
 if(options.clockOffsetMs)f.advance(options.clockOffsetMs);
 const {documentOperations,persistProjectReceipt,currentPolicy,ProjectPolicyRepository}=await import('../../../apps/server/modules/access/project-command.ts');
 const {ProjectMethodologies}=await import('../../../apps/server/modules/methodologies/project-methodologies.ts'),{ProjectWorkPlans}=await import('../../../apps/server/modules/traceability/work-plans.ts');
 const {ProjectAssignmentDrafts}=await import('../../../apps/server/modules/assignments/project-assignment-drafts.ts'),{ProjectAssignmentConfirmations}=await import('../../../apps/server/modules/assignments/project-assignment-confirmations.ts'),{ResponsibleSessions}=await import('../../../apps/server/modules/assignments/responsible-sessions.ts');
 const {ProjectConnectionDefinitions}=await import('../../../apps/server/modules/connections/project-connection-definitions.ts'),{ProjectEnvironments}=await import('../../../apps/server/modules/connections/project-environments.ts'),{ProjectConnectionCandidates}=await import('../../../apps/server/modules/connections/project-candidates.ts');
 const {ProjectContexts}=await import('../../../apps/server/modules/context/project-contexts.ts'),{ProjectContextSources}=await import('../../../apps/server/modules/context/context-sources.ts'),{contextSlotCodes}=await import('../../../apps/server/modules/context/context-input.ts');
 const {ProjectKnowledge}=await import('../../../apps/server/modules/knowledge/knowledge.ts'),{ProjectConversations}=await import('../../../apps/server/modules/knowledge/conversations.ts');
 const {ProjectStorageQuota}=await import('../../../apps/server/modules/projects/project-storage-quota.ts'),{ProjectExecutionPreparations}=await import('../../../apps/server/modules/executions/project-execution-preparations.ts'),{ProjectStageQueue}=await import('../../../apps/server/modules/scheduling/stage-queue.ts'),{ProjectLimitPolicies}=await import('../../../apps/server/modules/executions/runtime-policy.ts');
 const tables:Record<string,any[]>={drafts:[],draftVersions:[],reviews:[],confirmations:[],roles:[],bindings:[],sessions:[],contexts:[],contextItems:[],preparations:[],limits:[],queue:[],origins:[],reservations:[]},receipts=new Map<string,any>(),audits=new Map<string,any>(),metadata=new Map<string,any>(),trace:string[]=[];
 const richContext=options.connectorEnvironment===true&&options.richContext===true;
 if(richContext)Object.assign(tables,{knowledgeHeads:[],knowledgeVersions:[],knowledgeEvents:[],knowledgeReviews:[],conversations:[],messages:[]});
 const approvedContext=richContext&&options.approvedContext===true;
 if(approvedContext)Object.assign(tables,{approvalRequests:[],approvalDecisions:[],approvalConsumptions:[],notifications:[]});
 const constitutionContext=richContext&&options.constitutionContext===true;
 if(constitutionContext)Object.assign(tables,{constitutions:[],constitutionApplications:[]});
 const modes={readAllowed:true,sourceAllowed:true,sourceHead:1,commit:'NORMAL',settle:'NORMAL',tx:1,policyVersion:1,
  registrationAllowed:true,registrationUntil:null as string|null,runtimeRules:[] as any[],originReadDisposition:'AUTO' as 'AUTO'|'REQUIRE_APPROVAL'|'DENY',requestQuota:'VERIFIED',requestFault:'NORMAL',requestUsed:0,requestHeld:0,requestOther:0,requestReserveCalls:0,requestSettleCalls:0,hook:null as null|((sql:string)=>void)};let saved:any,sequence=0;
 let savedReceipts:typeof receipts,savedAudits:typeof audits,savedRequestUsed=0,savedRequestHeld=0;
 const reauthUntil=options.connectorEnvironment?new Date(f.actor.authSession.absoluteExpiresAt):null;
 let registration:{row:Record<string,any>;connector:Record<string,any>}|undefined;
 let snapshotEvidence:{grant:Record<string,unknown>;snapshot:Record<string,unknown>;credential:Record<string,unknown>;audit:readonly unknown[]}|undefined;
 const applicationSnapshot=structuredClone(f.applicationSnapshot);applicationSnapshot.graph.nodes[0]!.kind='AGENT';applicationSnapshot.graph.nodes[0]!.role='STAGE_OWNER';Object.assign(applicationSnapshot.graph.nodes[0]!,{requirements:{capabilities:['명시 능력 요구'],environment:['명시 환경 요구']}});applicationSnapshot.graph.edges[0]!.kind='SEQUENCE';applicationSnapshot.graph.edges[0]!.condition=null as any;
 const sourceRef={id:id(201),version:1,contentHash:H(applicationSnapshot.graph)};applicationSnapshot.sourceRef=sourceRef;const applicationRef={id:id(202),version:1,contentHash:H(applicationSnapshot)};
 const policy=()=>{
  const rules=documentOperations.filter(op=>modes.sourceAllowed||!['readConnectionDefinition','readEnvironmentVersion'].includes(op))
   .filter(op=>modes.readAllowed||op!=='readExecutionStartOrigins').filter(op=>modes.registrationAllowed||op!=='registerExecutionStartOrigin')
   .map(op=>({ruleId:op,subjectRef:{kind:'HUMAN',userId:uid},operations:[op],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:op==='readExecutionStartOrigins'?modes.originReadDisposition:approvedContext&&modes.policyVersion===1&&op==='buildTaskContext'?'REQUIRE_APPROVAL':'AUTO',limitPolicyRef:null,
    expiresAt:op==='registerExecutionStartOrigin'&&modes.registrationUntil?modes.registrationUntil:f.actor.authSession.idleExpiresAt})).concat(modes.runtimeRules);
  const reason=modes.policyVersion===1?'명시 원자료 정책':'명시 후속 실행 정책';
  return{id:id(50),head_version:modes.policyVersion,rules_json:rules,reason,review_refs:[],created_at:new Date(),content_hash:H({rules,reason,reviewRefs:[]})};
 };
 const command=(operation:string,payload:any,target:any=null)=>({schemaVersion:1 as const,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:1,operation,targetId:target?.id??null,expectedVersion:target?.version??0,baselineRefs:[],approvalRef:null,payload});
 const joined=(row:any)=>{const c=f.commands.get(row.command_id);if(!c)throw Error('MEMORY_COMMAND_RELATION_MISSING');const ar=receipts.get(c.id),au=audits.get(c.id);return{...row,...c,id:row.id,command_id:row.command_id,server_command_id:c.id,command_actor:c.actor_id,command_client:c.client_id,command_key:c.command_id,command_external_id:c.command_id,external_command_id:c.command_id,command_operation_id:c.operation_id,command_scope_kind:'PROJECT',command_scope_id:pid,receipt_rows:ar?[ar]:[],audit_rows:au?[au]:[],approval_rows:[],authorization_subject_ref:ar?.subject_ref,authorization_policy_ref:ar?.policy_ref,authorization_scope_digest:ar?.scope_digest,authorization_approval_decision:null,audit_scope_digest:au?.scope_digest,audit_outcome:au?.outcome,audit_source_kind:au?.source_kind,audit_actor_ref:au?.actor_ref,audit_client_ref:au?.client_ref,audit_target_ref:au?.target_ref,audit_policy_ref:au?.policy_ref,audit_approval_ref:null,audit_count:au?1:0,server_sequence:au?.server_sequence,draft_author:uid};};
 const rows=(values:any[])=>({rows:values,rowCount:values.length});
 db.query=async(sql:string,a:any[]=[])=>{
  trace.push(sql);modes.hook?.(sql);
  if(sql.startsWith('SELECT n.*,nr.read_at,nr.command_id read_command_id')){
   assert.equal(a[0],pid);assert.equal(a[1],uid);
   let selected=(tables.notifications??[]).filter(n=>n.project_id===a[0]&&n.recipient_user_id===a[1]);
   if(sql.includes('AND n.id=$3')){assert.equal(a.length,3);selected=selected.filter(n=>n.id===a[2]);}
   else{assert.equal(a.length,6);assert(['ALL','READ','UNREAD'].includes(a[2]));if(a[2]==='READ')selected=[];if(a[3]!==null)selected=selected.filter(n=>n.created_at<new Date(a[3])||n.created_at.getTime()===new Date(a[3]).getTime()&&n.id<a[4]);selected.sort((x,y)=>y.created_at-x.created_at||y.id.localeCompare(x.id));selected=selected.slice(0,a[5]);}
   return rows(selected.map(n=>({...n,read_at:null,read_command_id:null,read_content_hash:null,read_client_id:null,cursor_at:n.created_at.toISOString()})));
  }
  if(sql.startsWith('SELECT r.*,c.operation,c.scope_kind,c.state,c.project_id command_project')){
   assert.equal(a.length,2);return rows((tables.approvalRequests??[]).filter(r=>r.project_id===a[0]&&r.id===a[1]).flatMap(r=>{
    const c=f.commands.get(r.command_id);return c&&c.project_id===r.project_id?[{...r,operation:c.operation,scope_kind:c.scope_kind,state:c.state,command_project:c.project_id,actor_id:c.actor_id,command_client:c.client_id,source_control_generation:c.control_generation,caller_command_id:c.command_id,caller_request_hash:c.request_hash,result_ref:c.result_ref}]:[];
   }));
  }
  if(sql.startsWith('SELECT c.*, (SELECT jsonb_agg(to_jsonb(a)) FROM anvil.authorization_receipts')){
   assert.equal(a.length,2);const c=f.commands.get(a[1]);
   return rows(c&&c.project_id===a[0]?[{...c,reuse_receipts:receipts.has(c.id)?[receipts.get(c.id)]:[],reuse_audits:audits.has(c.id)?[audits.get(c.id)]:[],reuse_notifications:(tables.notifications??[]).filter(n=>n.project_id===a[0]&&n.source_command_id===c.id)}]:[]);
  }
  if(sql.startsWith('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS ')){
   const at=(await raw('SELECT clock_timestamp() AS at',[])).rows[0].at;
   return rows([{transaction_id:String(modes.tx),...(sql.endsWith('auth_observed_at')?{auth_observed_at:at}:{at})}]);
  }
  if(sql.includes('fn09_origin_reuse_request_reserve')){
   modes.requestReserveCalls++;
   if(!options.originRequestStorage||modes.requestQuota==='UNVERIFIED')throw Object.assign(Error('PROJECT_STORAGE_QUOTA_UNVERIFIED'),{code:'P0001'});
   assert.equal(a.length,11);assert.deepEqual(a.slice(0,4),[f.actor.authSession.id,uid,cid,pid]);assert.equal(a[9],String(modes.tx));
   const request=JSON.parse(a[4]),ref=JSON.parse(a[5]),record=JSON.parse(a[6]),p2=JSON.parse(a[7]),ids=JSON.parse(a[8]);
   assert.deepEqual(Object.keys(ids).sort(),['serverCommandId','operationId','authorizationReceiptId','auditEventId'].sort());
   assert.equal(request.operation,'requestApproval');assert.equal(record.id,ref.id);assert.equal(record.status,'PENDING');
   const {id:_id,version:_version,status:_status,createdAt:_createdAt,...snapshot}=record;assert.equal(H(snapshot),ref.contentHash);
   assert.deepEqual(record.details,request.payload.details);assert.deepEqual(record.originReuseEvidence.candidatePayload,request.payload.candidatePayload);
   assert.equal(record.originReuseEvidence.candidatePayloadHash,H(request.payload.candidatePayload));assert.deepEqual(record.policyRef,p2);
   assert.equal(record.originReuseEvidence.p2Ref.version,2);assert.equal(Date.parse(record.details.expiresAt)<=Date.parse(a[10]),true);
   assert(!tables.reservations!.some(row=>row.id===ids.serverCommandId));assert(!tables.approvalRequests!.some(row=>row.candidate_command_id===record.details.candidateCommandId));
   const reserved=1_000_000;
   if(modes.requestUsed+modes.requestHeld+modes.requestOther+reserved>10737418240)throw Object.assign(Error('PROJECT_STORAGE_LIMIT_EXCEEDED'),{code:'P0001'});
   const until=new Date(Math.min(Date.parse(a[10]),Date.parse(record.details.expiresAt))).toISOString();
   const plan={request,record,ref,ids,policyRef:p2,authorizedUntil:until,coverageGeneration:'1',purpose:'ORIGIN_REUSE_APPROVAL_REQUEST'},planHash=H(plan);
   tables.reservations!.push({id:ids.serverCommandId,part_kind:'ORIGIN_REUSE_APPROVAL_REQUEST',part_key:'origin_reuse_request',actor_id:uid,client_id:cid,phase:'IO_STARTED',start_fence:1,plan_json:plan,plan_hash:planHash,transaction_id:String(modes.tx),reserved_bytes:reserved,settled_bytes:0});
   modes.requestHeld+=reserved;
   const transaction_id=String(modes.tx);if(modes.requestFault==='XID_AFTER_RESERVE')modes.tx++;
   return rows([{reservation_id:ids.serverCommandId,transaction_id,record_hash:ref.contentHash,plan_hash:planHash,reserved_bytes:String(reserved),authorized_until:until}]);
  }
  if(sql.includes('fn09_origin_reuse_request_settle')){
   modes.requestSettleCalls++;assert.equal(a.length,10);assert.deepEqual(a.slice(0,4),[f.actor.authSession.id,uid,cid,pid]);assert.equal(a[9],String(modes.tx));
   const r=tables.reservations!.find(row=>row.id===a[5]),command=f.commands.get(a[7]),receipt=receipts.get(a[7]),audit=audits.get(a[7]);
   assert(r&&command&&receipt&&audit);assert.equal(r.transaction_id,String(modes.tx));assert.equal(r.part_kind,'ORIGIN_REUSE_APPROVAL_REQUEST');assert.equal(r.phase,'IO_STARTED');assert.equal(r.start_fence,1);assert.equal(r.plan_hash,a[6]);assert.equal(command.command_id,a[4]);assert.equal(command.id,r.id);
   assert.deepEqual(JSON.parse(a[8]),command.result_ref);assert.equal(receipt.id,r.plan_json.ids.authorizationReceiptId);assert.equal(audit.event_id,r.plan_json.ids.auditEventId);
   const requests=tables.approvalRequests!.filter(row=>row.command_id===command.id),notifications=tables.notifications!.filter(row=>row.source_command_id===command.id);
   assert.equal(requests.length,1);assert.equal(notifications.length,1);assert.deepEqual(requests[0]!.request_json,r.plan_json.record);
   assert.equal(command.actor_id,uid);assert.equal(command.client_id,cid);assert.equal(notifications[0]!.recipient_user_id,uid);
   if(modes.settle==='LOST')throw Error('SETTLE_LOST');
   const {canonicalJson}=await import('../../../contracts/canonical.ts');
   const actual=Buffer.byteLength(canonicalJson(JSON.parse(JSON.stringify([requests[0],command,receipt,audit,notifications[0],r]))));assert(actual<=r.reserved_bytes);
   r.phase='SETTLED';r.settled_bytes=actual;modes.requestUsed+=actual;modes.requestHeld-=r.reserved_bytes;
   return rows([{status:'SETTLED',reservation_id:r.id,transaction_id:String(modes.tx),settled_bytes:String(modes.requestFault==='OVERSIZED_SETTLE'?r.reserved_bytes+1:actual)}]);
  }
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   assert.equal(a.length,6);assert.equal(a[0],pid);assert.deepEqual(JSON.parse(a[2]),{kind:'HUMAN',userId:uid});
   assert.equal(a[3],cid);assert.deepEqual(JSON.parse(a[4]),{id:pid});assert.equal(typeof a[5],'string');
   (tables.denialAudits??=[]).push({project_id:a[0],event_id:a[1],actor_ref:JSON.parse(a[2]),client_ref:a[3],target_ref:JSON.parse(a[4]),outcome:'DENIED',reason_code:a[5],source_kind:'SERVER_DENIAL'});
   return rows([]);
  }
  if(sql==='BEGIN'){saved=structuredClone(tables);savedReceipts=structuredClone(receipts);savedAudits=structuredClone(audits);savedRequestUsed=modes.requestUsed;savedRequestHeld=modes.requestHeld;modes.tx++;return raw(sql,a);}if(sql==='COMMIT'&&modes.commit==='LOST')throw Error('COMMIT_LOST');if(sql==='ROLLBACK'){for(const k of Object.keys(tables))tables[k]!.splice(0,tables[k]!.length,...(saved?.[k]??[]));for(const[map,before]of[[receipts,savedReceipts],[audits,savedAudits]] as const){map.clear();for(const[key,value]of before)map.set(key,value);}modes.requestUsed=savedRequestUsed;modes.requestHeld=savedRequestHeld;return raw(sql,a);}
  if(options.connectorEnvironment&&sql.startsWith('SELECT s.*,u.id AS uid')){
   const result=await raw(sql,a);
   return rows(result.rows.map((row:any)=>({...row,reauth_until:reauthUntil})));
  }
  if(registration&&sql.startsWith('SELECT s.id,s.idle_expires_at,s.absolute_expires_at,s.reauth_until FROM anvil.auth_sessions')){
   assert.deepEqual(a,[f.actor.authSession.id,uid,cid,f.actor.credentialGeneration]);
   return rows(f.state.member?[{id:a[0],idle_expires_at:new Date(f.actor.authSession.idleExpiresAt),absolute_expires_at:new Date(f.actor.authSession.absoluteExpiresAt),reauth_until:reauthUntil}]:[]);
  }
  if(registration&&sql.includes('FROM anvil.connector_registrations r JOIN')){
   const {row,connector}=registration,c=f.commands.get(row.created_command_id);
   assert(c);
   if(sql.includes('JOIN anvil.connectors h')){
    assert.deepEqual(a,[pid,row.id,uid,cid]);
    return rows([{...row,...connector,created_operation:c.operation,created_actor:c.actor_id,created_client:c.client_id,created_state:c.state,created_result:c.result_ref}]);
   }
   assert.deepEqual(a,[pid,row.id]);
   return rows([{...row,original_server_id:c.id,original_project_id:c.project_id,original_actor:c.actor_id,original_client:c.client_id,original_operation:c.operation,original_external_id:c.command_id,original_operation_id:c.operation_id,original_state:c.state,original_expected_version:c.expected_version,original_control_generation:c.control_generation,original_policy_ref:c.policy_ref,original_request_hash:c.request_hash,original_result:c.result_ref,original_receipt_id:c.authorization_receipt_id,original_consumption_id:c.approval_consumption_id,original_completed_at:row.created_at}]);
  }
  if(registration&&sql.startsWith('SELECT issued_at,expires_at,revoked_at FROM anvil.connector_credentials')){
   assert.deepEqual(a,[pid,registration.row.id]);const r=registration.row;
   return rows([{issued_at:r.issued_at,expires_at:r.expires_at,revoked_at:r.revoked_at}]);
  }
  if(registration&&sql==='SELECT anvil.connector_basis_current($1,false) ok'){
   assert.deepEqual(a,[registration.row.id]);
   return rows([{ok:modes.policyVersion===1&&registration.row.revoked_at===null}]);
  }
  if(sql.startsWith('SELECT p.id,p.head_version,v.rules_json'))return rows([policy()]);
  if(sql.startsWith('SELECT p.*,m.participation,pc.actor_id')){assert.deepEqual(a,[pid,uid]);return rows(f.state.member?[{id:pid,name:'원자료 프로젝트',purpose:'명시 보관',desired_outcome:'실행 없이 원자료 보관',version:1,created_at:new Date(),updated_at:new Date(),participation:f.state.participation,actor_id:uid,client_id:cid,generation:f.state.current?1:2,control_version:1,control_revoked_at:null,controller_status:'ACTIVE',controller_revoked_at:null,controller_client_revoked_at:null,policy_id:policy().id,application_id:applicationRef.id,application_version:1,snapshot_hash:applicationRef.contentHash,setup_copy_records:0,setup_copy_candidates:null}]:[]);}
  if(sql.startsWith('SELECT b.*,c.operation,c.actor_id,c.client_id command_client FROM anvil.project_source_declarations')){assert.deepEqual(a,[pid]);return rows([]);}
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return rows([{actor_id:uid,client_id:cid,generation:f.state.current?1:2,revoked_at:null}]);
  if(sql.includes('txid_current()')){const time=(await raw('SELECT clock_timestamp() AS at',[])).rows[0].at;return rows([{transaction_id:String(modes.tx),observed_at:time,at:time}]);}
  if(sql.includes('FROM anvil.project_methodologies'))return rows([{id:applicationRef.id,project_id:pid,application_version:1,source_definition_id:sourceRef.id,source_version:1,source_hash:sourceRef.contentHash,snapshot_json:applicationSnapshot,snapshot_hash:applicationRef.contentHash}]);
  if(sql.includes('FROM anvil.methodology_definitions d JOIN anvil.methodology_versions'))return rows([{head_version:1,name:applicationSnapshot.name,purpose:applicationSnapshot.purpose,content_hash:sourceRef.contentHash,graph_json:applicationSnapshot.graph,origin_ref_json:{kind:'DRAFT_CONFIRMED_SOURCE'},reason:'원 방법론',created_at:new Date()}]);
  if(sql.startsWith('INSERT INTO anvil.commands')){f.commands.set(a[0],{id:a[0],project_id:a[1],actor_id:a[2],client_id:a[3],operation:a[4],command_id:a[5],request_hash:a[6],operation_id:a[7],authorization_receipt_id:a[8],approval_consumption_id:a[9],expected_version:a[10],control_generation:a[11],policy_ref:JSON.parse(a[12]),payload_ref:a[13]===null?null:JSON.parse(a[13]),result_ref:JSON.parse(a[14]),scope_kind:'PROJECT',scope_id:pid,state:'APPLIED'});f.state.effects.push('command');return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.set(a[2],{id:a[0],scope_kind:'PROJECT',scope_id:a[1],command_id:a[2],subject_ref:JSON.parse(a[3]),policy_ref:JSON.parse(a[4]),scope_digest:a[5],approval_decision_ref:a[6]});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){audits.set(a[4],{project_id:a[0],event_id:a[1],actor_ref:JSON.parse(a[2]),client_ref:a[3],command_id:a[4],operation_id:a[5],target_ref:JSON.parse(a[6]),policy_ref:JSON.parse(a[7]),approval_ref:a[8]?JSON.parse(a[8]):null,reason_code:a[9],scope_digest:a[10],outcome:'APPLIED',source_kind:'HUMAN_COMMAND',correction_of:null,server_sequence:++sequence});return rows([]);}
  if(sql.startsWith('SELECT * FROM anvil.authorization_receipts WHERE command_id='))return rows([...receipts.values()].filter(r=>r.command_id===a[0]));
  if(sql.startsWith('SELECT * FROM anvil.audit_events'))return rows([...audits.values()].filter(r=>r.project_id===a[0]&&r.command_id===a[1]));
  if(sql.startsWith('INSERT INTO anvil.assignment_drafts')){tables.drafts!.push({project_id:a[0],id:a[1],head_version:1});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.assignment_draft_versions')){tables.draftVersions!.push({project_id:a[0],draft_id:a[1],version:a[2],content_hash:a[3],version_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7]});return rows([]);}
  if(sql.startsWith('SELECT head_version FROM anvil.assignment_drafts'))return rows(tables.drafts!.filter(v=>v.id===a[1]));
  if(sql.includes('FROM anvil.assignment_draft_versions v'))return rows(tables.draftVersions!.filter(v=>v.project_id===a[0]&&v.draft_id===a[1]&&v.version===a[2]).map(v=>({...joined(v),head_version:tables.drafts!.find(d=>d.id===v.draft_id)!.head_version})));
  if(sql.startsWith('INSERT INTO anvil.assignment_content_reviews')){tables.reviews!.push({project_id:a[0],review_id:a[1],draft_id:a[2],draft_version:a[3],draft_hash:a[4],content_hash:a[5],review_json:JSON.parse(a[6]),created_by:a[7],client_id:a[8],command_id:a[9]});return rows([]);}
  if(sql.includes('FROM anvil.assignment_content_reviews r'))return rows(tables.reviews!.filter(v=>v.project_id===a[0]&&(sql.includes('r.review_id=$2')?v.review_id===a[1]:v.draft_id===a[1]&&v.draft_version===a[2])).map(joined).sort((a,b)=>b.server_sequence-a.server_sequence));
  if(sql==='SELECT content_hash FROM anvil.assignment_versions WHERE project_id=$1 AND assignment_id=$2 AND version=$3 LIMIT 2')return rows(tables.confirmations!.filter(v=>v.project_id===a[0]&&v.assignment_id===a[1]&&v.version===a[2]).slice(0,2).map(v=>({content_hash:v.content_hash})));
  if(sql===`SELECT *,to_char(submitted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.result_submissions WHERE project_id=$1 AND assignment_ref=$2::jsonb AND ($3::timestamptz IS NULL OR (submitted_at,id)<($3::timestamptz,$4::uuid)) ORDER BY submitted_at DESC,id DESC LIMIT 21`){assert.equal(a[0],pid);assert(tables.confirmations!.some(v=>JSON.stringify({id:v.assignment_id,version:v.version,contentHash:v.content_hash})===a[1]));return rows([]);}
  if(sql.startsWith('SELECT head.* FROM (SELECT DISTINCT ON (q.request_id)')){assert.equal(a[0],pid);const latest=new Map<string,any>();for(const v of [...tables.queue!].sort((x,y)=>y.version-x.version))if(v.project_id===a[0]&&!latest.has(v.request_id))latest.set(v.request_id,v);return rows([...latest.values()].filter(v=>v.snapshot_json.state==='WAITING').sort((x,y)=>x.sequence-y.sequence).slice(0,201).map(joined));}
  if(sql.startsWith('SELECT id,version,content_hash,to_char(created_at'))return rows(tables.preparations!.filter(v=>v.project_id===a[0]&&v.snapshot_json.intent.assignmentRef.id===a[1]&&v.snapshot_json.intent.assignmentRef.version===a[2]).map(v=>({id:v.id,version:v.version,content_hash:v.content_hash,created_position:new Date(v.snapshot_json.checkedAt).toISOString().replace(/Z$/,()=> '000Z')})).filter(v=>a[3]===null||v.created_position<a[3]||v.created_position===a[3]&&v.id<a[4]).sort((x,y)=>y.created_position.localeCompare(x.created_position)||y.id.localeCompare(x.id)).slice(0,21));
  if(sql.startsWith('INSERT INTO anvil.assignment_versions')){tables.confirmations!.push({project_id:a[0],assignment_id:a[1],version:a[2],content_hash:a[3],version_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7],confirmation_id:a[8]});return rows([]);}
  if(sql.includes('FROM anvil.assignment_versions v'))return rows(tables.confirmations!.filter(v=>v.project_id===a[0]&&v.assignment_id===a[1]&&v.version===a[2]).map(joined));
  if(sql.startsWith('INSERT INTO anvil.project_roles')){tables.roles!.push({project_id:a[0],role_id:a[1],version:a[2],content_hash:a[3],snapshot_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7]});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.agent_sessions')){tables.sessions!.push({project_id:a[0],session_id:a[1],version:a[2],content_hash:a[3],snapshot_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7]});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.role_bindings')){tables.bindings!.push({project_id:a[0],binding_id:a[1],version:a[2],role_id:a[3],session_id:a[4],content_hash:a[5],snapshot_json:JSON.parse(a[6]),created_by:a[7],client_id:a[8],command_id:a[9]});return rows([]);}
  if(sql==="SELECT role_id,version FROM anvil.project_roles WHERE project_id=$1 AND (snapshot_json->>'kind'='COORDINATOR' OR snapshot_json->'stageRef'=$2::jsonb) ORDER BY role_id LIMIT 3")return rows(tables.roles!.filter(v=>v.project_id===a[0]&&(v.snapshot_json.kind==='COORDINATOR'||JSON.stringify(v.snapshot_json.stageRef)===a[1])).sort((x,y)=>x.role_id.localeCompare(y.role_id)).slice(0,3).map(v=>({role_id:v.role_id,version:v.version})));
  if(sql==='SELECT DISTINCT ON(role_id) binding_id,version FROM anvil.role_bindings WHERE project_id=$1 AND role_id=ANY($2::uuid[]) ORDER BY role_id,version DESC'){const latest=new Map<string,any>();for(const v of [...tables.bindings!].sort((x,y)=>y.version-x.version))if(v.project_id===a[0]&&a[1].includes(v.role_id)&&!latest.has(v.role_id))latest.set(v.role_id,{binding_id:v.binding_id,version:v.version});return rows([...latest.values()]);}
  if(sql==='SELECT id,version FROM anvil.execution_preparations WHERE project_id=$1 AND assignment_id=$2 AND assignment_version=$3 ORDER BY created_at DESC,id DESC LIMIT 21')return rows(tables.preparations!.filter(v=>v.project_id===a[0]&&v.snapshot_json.intent.assignmentRef.id===a[1]&&v.snapshot_json.intent.assignmentRef.version===a[2]).slice().reverse().slice(0,21).map(v=>({id:v.id,version:v.version})));
  if(sql.includes('FROM anvil.project_roles r'))return rows(tables.roles!.filter(v=>v.project_id===a[0]&&(!sql.includes('r.role_id=$2')||v.role_id===a[1]&&v.version===a[2])).map(joined));
  if(sql.startsWith('SELECT binding_id,version,content_hash FROM anvil.role_bindings'))return rows(tables.bindings!.filter(v=>v.project_id===a[0]&&v.role_id===a[1]).sort((x,y)=>y.version-x.version).slice(0,1));
  if(sql.includes('FROM anvil.role_bindings b'))return rows(tables.bindings!.filter(v=>v.project_id===a[0]&&(sql.includes('b.binding_id=$2')?v.binding_id===a[1]&&v.version===a[2]:v.role_id===a[1])).sort((x,y)=>y.version-x.version).slice(0,1).map(joined));
  if(sql.includes('FROM anvil.agent_sessions s'))return rows(tables.sessions!.filter(v=>v.project_id===a[0]&&v.session_id===a[1]&&v.version===a[2]).map(joined));
  if(sql.startsWith('INSERT INTO anvil.limit_policy_versions')){tables.limits!.push({project_id:a[0],policy_id:a[1],version:a[2],content_hash:a[3],snapshot_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7]});return rows([]);}
  if(sql.includes('FROM anvil.limit_policy_versions v'))return rows(tables.limits!.filter(v=>v.project_id===a[0]&&(sql.includes('v.policy_id=$2')?v.policy_id===a[1]&&v.version===a[2]:JSON.stringify(v.snapshot_json.scope)===a[1])).sort((x,y)=>y.version-x.version).slice(0,1).map(joined));
  if(snapshotEvidence){
   const {grant,snapshot,credential,audit}=snapshotEvidence;
   if(sql==='SELECT * FROM anvil.source_snapshots WHERE project_id=$1 AND id=$2 AND version=1')return rows(snapshot.project_id===a[0]&&snapshot.id===a[1]?[snapshot]:[]);
   if(sql.startsWith('SELECT g.*,c.operation created_operation')&&sql.includes('FROM anvil.source_read_grants g')){
    if(grant.project_id!==a[0]||grant.id!==a[1]||typeof grant.created_command_id!=='string')return rows([]);
    const c=f.commands.get(grant.created_command_id),root=metadata.get('ROOT:'+grant.source_root_id);
    if(!c||c.project_id!==a[0]||!root||root.project_id!==a[0]||root.version!==grant.source_root_version)return rows([]);
    return rows([{...grant,created_operation:c.operation,created_state:c.state,created_actor:c.actor_id,created_client:c.client_id,created_expected_version:c.expected_version,created_result:c.result_ref,
     source_declaration_json:root.declaration_json,source_status:root.status,source_authority:root.authority,source_readiness:root.readiness,source_reason:root.reason,source_content_hash:root.content_hash,source_head_version:1}]);
   }
   if(sql.startsWith('SELECT id,project_id,grant_id,connector_id,connector_generation,scope,scope_digest,issued_at,expires_at,consumed_at FROM anvil.source_read_credentials'))return rows(credential.project_id===a[0]&&credential.grant_id===a[1]?[credential]:[]);
   if(sql.startsWith('SELECT EXISTS(SELECT 1 FROM anvil.audit_events')&&sql.includes("reason_code='SOURCE_READ_REPORT_STORED'")){
    const ok=a.length===audit.length&&a.every((value,index)=>[1,3,5].includes(index)
     ?H(JSON.parse(value))===H(audit[index]):value===audit[index]);
    return rows([{ok}]);
   }
  }
  if(approvedContext){
   if(sql==='SELECT 1 FROM anvil.approval_requests WHERE project_id=$1 AND candidate_command_id=$2')return rows(tables.approvalRequests!.filter(r=>r.project_id===a[0]&&r.candidate_command_id===a[1]).map(()=>({'?column?':1})));
   if(sql==='SELECT 1 FROM anvil.commands WHERE project_id=$1 AND actor_id=$2 AND command_id=$3')return rows([...f.commands.values()].filter(c=>c.project_id===a[0]&&c.actor_id===a[1]&&c.command_id===a[2]).map(()=>({'?column?':1})));
   if(sql==='SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1')return rows(a[0]===pid?[{actor_id:uid,client_id:cid,generation:f.state.current?1:2,revoked_at:null}]:[]);
   if(sql.startsWith('INSERT INTO anvil.approval_requests(')){
    tables.approvalRequests!.push({id:a[0],project_id:a[1],version:1,candidate_command_id:a[2],action_scope_json:JSON.parse(a[3]),scope_digest:a[4],details_json:JSON.parse(a[5]),required_decider_ref:JSON.parse(a[6]),status:'PENDING',expires_at:new Date(a[7]),created_by:a[8],client_id:a[9],command_id:a[10],policy_ref:JSON.parse(a[11]),content_hash:a[12],request_json:JSON.parse(a[13]),created_at:new Date(a[14])});return rows([]);
   }
   if(sql.startsWith('INSERT INTO anvil.approval_decisions(')){
    tables.approvalDecisions!.push({id:a[0],project_id:a[1],request_id:a[2],request_version:a[3],scope_digest:a[4],decision:a[5],reason:a[6],decided_by:a[7],client_id:a[8],control_generation:a[9],decided_at:new Date(a[10]),command_id:a[11],content_hash:a[12],decision_json:JSON.parse(a[13])});return rows([]);
   }
   if(sql.startsWith('INSERT INTO anvil.approval_consumptions(')){
    assert(!tables.approvalConsumptions!.some(r=>r.project_id===a[1]&&r.decision_id===a[2]));
    const command=f.commands.get(a[3]);assert(command);
    tables.approvalConsumptions!.push({id:a[0],project_id:a[1],decision_id:a[2],command_id:a[3],scope_digest:a[4],policy_id:a[5],policy_version:a[6],consumed_at:new Date(command.result_ref.serverReceivedAt)});return rows([]);
   }
   if(sql.startsWith('UPDATE anvil.approval_requests SET status=')){
    const consumed=sql.includes("status='CONSUMED'"),row=tables.approvalRequests!.find(r=>r.project_id===a[0]&&r.id===a[1]&&r.version===(consumed?2:a[3])&&r.status===(consumed?'APPROVED':'PENDING'));
    if(!row)return rows([]);
    row.status=consumed?'CONSUMED':a[2];row.version++;return rows([{}]);
   }
   if(sql.startsWith('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests'))return rows(tables.approvalRequests!.filter(r=>r.project_id===a[0]&&r.id===a[1]).flatMap(r=>{
    const c=f.commands.get(r.command_id);return c&&c.project_id===r.project_id?[{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,result_ref:c.result_ref}]:[];
   }));
   if(sql.startsWith('SELECT d.*,c.operation,c.actor_id,c.client_id command_client,c.expected_version,c.result_ref FROM anvil.approval_decisions'))return rows(tables.approvalDecisions!.filter(r=>r.project_id===a[0]&&r.request_id===a[1]).flatMap(r=>{
    const c=f.commands.get(r.command_id);return c&&c.project_id===r.project_id?[{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,result_ref:c.result_ref}]:[];
   }));
   if(sql.startsWith('SELECT ac.*,c.command_id candidate_command_id'))return rows(tables.approvalConsumptions!.filter(r=>r.project_id===a[0]&&r.decision_id===a[1]).flatMap(r=>{
    const c=f.commands.get(r.command_id),receipt=receipts.get(r.command_id);
    if(!c||c.project_id!==r.project_id||!receipt||receipt.id!==c.authorization_receipt_id||receipt.command_id!==c.id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==r.project_id)return [];
    return [{...r,candidate_command_id:c.command_id,request_hash:c.request_hash,actor_id:c.actor_id,client_id:c.client_id,control_generation:c.control_generation,policy_ref:c.policy_ref,payload_ref:c.payload_ref,state:c.state,result_ref:c.result_ref,operation:c.operation,expected_version:c.expected_version,approval_consumption_id:c.approval_consumption_id,approval_decision_ref:receipt.approval_decision_ref}];
   }));
   if(sql==='SELECT anvil.assert_approval_notification_capacity($1)'){assert.deepEqual(a,[pid]);return rows([{}]);}
   if(sql.startsWith('INSERT INTO anvil.notifications(')){
    const request=tables.approvalRequests!.find(r=>r.project_id===a[1]&&r.id===a[3]);assert(request&&request.command_id===a[2]&&request.content_hash===a[5]);
    if(options.originRequestStorage&&modes.requestFault==='MISSING_NOTIFICATION'&&request.action_scope_json.operation==='queueExecutionCommand')return rows([]);
    tables.notifications!.push({id:a[0],project_id:a[1],source_command_id:a[2],approval_request_id:a[3],request_version:a[4],request_content_hash:a[5],recipient_user_id:a[6],event_kind:a[7],channel:a[8],severity:a[9],reason_code:a[10],delivery_state:a[11],created_at:new Date(a[12]),content_hash:a[13]});return rows([]);
   }
  }
  if(constitutionContext){
   if(sql.startsWith('INSERT INTO anvil.constitution_applications(')){
    assert(!tables.constitutionApplications!.some(r=>r.project_id===a[0]&&r.application_version===a[1]));
    tables.constitutionApplications!.push({project_id:a[0],application_version:a[1],content_hash:a[2],entry_id:a[3],version:a[4],confirmation_id:a[5],snapshot_json:JSON.parse(a[6]),applied_by:a[7],client_id:a[8],command_id:a[9],created_at:new Date(a[10])});
    return rows([]);
   }
   if(sql.startsWith('INSERT INTO anvil.project_constitutions(')||sql.startsWith('UPDATE anvil.project_constitutions SET application_version=')){
    const heads=tables.constitutions!,head=heads.find(r=>r.project_id===a[0]);
    const pointer={project_id:a[0],application_version:a[1],application_hash:a[2],entry_id:a[3],version:a[4]};
    if(sql.startsWith('INSERT')){assert(!head&&a[1]===1);heads.push(pointer);}
    else{assert(head&&a[1]===head.application_version+1);Object.assign(head,pointer);}
    return rows([]);
   }
   if(sql==='SELECT application_version,application_hash,entry_id,version FROM anvil.project_constitutions WHERE project_id=$1')return rows(tables.constitutions!.filter(r=>r.project_id===a[0]));
   if(sql==='SELECT max(application_version) version FROM anvil.constitution_applications WHERE project_id=$1'){
    const versions=tables.constitutionApplications!.filter(r=>r.project_id===a[0]).map(r=>r.application_version);
    return rows([{version:versions.length?Math.max(...versions):null}]);
   }
   if(sql.startsWith('SELECT a.*,c.state command_state,c.operation,c.actor_id,c.client_id command_client,c.control_generation,c.expected_version,c.policy_ref,c.result_ref FROM anvil.constitution_applications'))return rows(tables.constitutionApplications!.filter(r=>r.project_id===a[0]&&r.application_version===a[1]).flatMap(r=>{
    const c=f.commands.get(r.command_id),receipt=receipts.get(r.command_id);
    if(!c||c.project_id!==r.project_id||!receipt||receipt.id!==c.authorization_receipt_id||receipt.command_id!==c.id||H(receipt.policy_ref)!==H(c.policy_ref))return [];
    return [{...r,command_state:c.state,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,control_generation:c.control_generation,expected_version:c.expected_version,policy_ref:c.policy_ref,result_ref:c.result_ref}];
   }));
  }else if(sql.includes('FROM anvil.constitution_applications')||sql.includes('FROM anvil.project_constitutions'))return rows([]);
  if(sql.startsWith('SELECT content_hash FROM anvil.document_versions')){const r=f.docRows.get(a[1]);return rows(r?[{content_hash:r.content_hash}]:[]);}
  if(richContext){
   if(sql.startsWith('INSERT INTO anvil.knowledge_entries')){tables.knowledgeHeads!.push({id:a[0],project_id:a[1],kind:a[2],head_version:1});return rows([]);}
   if(sql.startsWith('INSERT INTO anvil.knowledge_versions')){tables.knowledgeVersions!.push({project_id:a[0],entry_id:a[1],version:1,title:a[2],content_artifact_id:a[3],content_hash:a[4],source_refs:JSON.parse(a[5]),reason:a[6],scope_json:JSON.parse(a[7]),related_refs:JSON.parse(a[8]),entry_json:JSON.parse(a[9]),created_by:a[10]});return rows([]);}
   if(sql.startsWith('INSERT INTO anvil.knowledge_events')){
    const confirmed=sql.includes("'CONFIRMED'"),c=f.commands.get(a[6+(confirmed?1:0)]);assert(c);
    tables.knowledgeEvents!.push({id:a[0],project_id:a[1],entry_id:a[2],version:confirmed?a[3]:1,kind:confirmed?'CONFIRMED':'PROPOSED',
     reason:a[confirmed?4:3],actor_ref:JSON.parse(a[confirmed?5:4]),recorded_at:new Date(c.result_ref.serverReceivedAt),
     base_ref:null,change_sources:null,review_refs:confirmed?JSON.parse(a[8]):null,command_actor_id:c.actor_id,command_operation:c.operation,command_result:c.result_ref});
    return rows([]);
   }
   if(sql.includes('FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries k'))return rows(tables.knowledgeVersions!.filter(v=>v.project_id===a[0]&&v.entry_id===a[1]&&v.version===a[2]).map(v=>{
    const head=tables.knowledgeHeads!.find(k=>k.id===v.entry_id&&k.project_id===v.project_id);assert(head);return {...v,kind:head.kind,head_version:head.head_version};
   }));
   if(sql.includes('FROM anvil.knowledge_events e JOIN anvil.commands'))return rows(tables.knowledgeEvents!.filter(v=>v.project_id===a[0]&&v.entry_id===a[1]&&v.version===a[2]));
   if(sql.startsWith('SELECT k.head_version,v.created_by FROM anvil.knowledge_entries'))return rows(tables.knowledgeVersions!.filter(v=>v.project_id===a[0]&&v.entry_id===a[1]&&v.version===a[2]).map(v=>({created_by:v.created_by,head_version:tables.knowledgeHeads!.find(k=>k.id===v.entry_id)?.head_version})));
   if(sql.startsWith('SELECT head_version FROM anvil.knowledge_entries'))return rows(tables.knowledgeHeads!.filter(k=>k.project_id===a[0]&&k.id===a[1]));
   if(sql.startsWith('INSERT INTO anvil.content_reviews')&&sql.includes("'KNOWLEDGE'")){
    const c=f.commands.get(a[12]),audit=audits.get(a[12]);assert(c&&audit);
    tables.knowledgeReviews!.push({id:a[0],project_id:a[1],target_id:a[2],target_version:a[3],target_hash:a[4],criteria_version:1,
     criteria_snapshot_json:JSON.parse(a[5]),items_json:JSON.parse(a[6]),outcome:a[7],reviewer_user_id:a[8],client_id:a[9],reviewer_subject_ref:JSON.parse(a[10]),
     source_kind:'HUMAN_REVIEW',reason:a[11],created_at:new Date(c.result_ref.data.review.reviewedAt),server_sequence:audit.server_sequence,command_actor:c.actor_id,command_client:c.client_id,command_operation:c.operation,command_result:c.result_ref});
    return rows([]);
   }
   if(sql.includes('FROM anvil.content_reviews r')&&sql.includes("target_kind='KNOWLEDGE'"))return rows(tables.knowledgeReviews!.filter(r=>r.project_id===a[0]&&r.target_id===a[1]&&r.target_version===a[2]&&r.target_hash===a[3]&&(a[4]===null||a[4].includes(r.id))).sort((x,y)=>y.server_sequence-x.server_sequence));
   if(sql.startsWith('INSERT INTO anvil.conversations')){tables.conversations!.push({id:a[0],project_id:a[1],target_role_ref:null,head_sequence:1});return rows([]);}
   if(sql.startsWith('UPDATE anvil.conversations SET head_sequence')){const head=tables.conversations!.find(c=>c.project_id===a[0]&&c.id===a[1]);assert(head&&a[2]===head.head_sequence+1);head.head_sequence=a[2];return rows([]);}
   if(sql.startsWith('SELECT head_sequence,target_role_ref FROM anvil.conversations'))return rows(tables.conversations!.filter(c=>c.project_id===a[0]&&c.id===a[1]));
   if(sql.startsWith('INSERT INTO anvil.conversation_messages')){
    const c=f.commands.get(a[13]);assert(c);
    tables.messages!.push({project_id:a[0],conversation_id:a[1],sequence:a[2],id:a[3],author_ref:JSON.parse(a[4]),kind:a[5],body_artifact_id:a[6],source_refs:[],
     reply_to:a[7],supersedes_instruction_id:a[8],effective_scope:JSON.parse(a[9]),message_json:JSON.parse(a[10]),content_hash:a[11],redaction_state:'NOT_REDACTED',recorded_at:new Date(c.result_ref.serverReceivedAt)});
    return rows([]);
   }
   if(sql.startsWith('SELECT * FROM anvil.conversation_messages'))return rows(tables.messages!.filter(m=>m.project_id===a[0]&&m.conversation_id===a[1]&&m.id===a[2]));
   if(sql.startsWith('SELECT m.content_hash,m.kind,m.conversation_id,EXISTS'))return rows(tables.messages!.filter(m=>m.project_id===a[0]&&m.id===a[1]&&m.conversation_id===a[2]).map(m=>({...m,superseded:tables.messages!.some(n=>n.project_id===m.project_id&&n.conversation_id===m.conversation_id&&n.supersedes_instruction_id===m.id)})));
  }
  if(sql.startsWith('INSERT INTO anvil.context_bundles')){tables.contexts!.push({project_id:a[0],id:a[1],version:1,assignment_id:a[2],assignment_version:a[3],assignment_hash:a[4],assignment_ref:JSON.parse(a[5]),baseline_refs:JSON.parse(a[6]),budget_ref:JSON.parse(a[7]),manifest_json:JSON.parse(a[8]),content_hash:a[9],created_by:a[10],client_id:a[11],command_id:a[12],request_payload:JSON.parse(a[13])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.context_items')){tables.contextItems!.push({project_id:a[0],bundle_id:a[1],item_id:a[2],category:a[3],required:true,source_ref:JSON.parse(a[4]),source_hash:a[5],included_state:a[6],reason:a[7],delivery_parts:JSON.parse(a[8]),issue:a[9]});return rows([]);}
  if(sql.includes('FROM anvil.context_bundles b'))return rows(tables.contexts!.filter(v=>v.project_id===a[0]&&v.id===a[1]&&v.version===a[2]).map(v=>({
   ...joined(v),authorization_approval_decision:receipts.get(v.command_id)?.approval_decision_ref??null,audit_approval_ref:audits.get(v.command_id)?.approval_ref??null,
  })));
  if(sql.includes('FROM anvil.context_items'))return rows(tables.contextItems!.filter(v=>v.project_id===a[0]&&v.bundle_id===a[1]).sort((x,y)=>x.item_id.localeCompare(y.item_id)));
  if(sql==='SELECT anvil.environment_configuration_context($1,$2,$3,$4)'){assert.deepEqual(a,[f.actor.authSession.id,uid,cid,pid]);assert(f.state.member&&f.state.participation==='OWNER');return rows([{}]);}
  if(sql.startsWith('SELECT anvil.environment_configuration_history_proof')){const target=JSON.parse(a[5]),stored=[...metadata.values()].find(v=>v.id===target.id&&v.version===target.version&&v.content_hash===target.contentHash);assert(stored);assert(f.commands.has(stored.command_id));assert(receipts.has(stored.command_id));assert(audits.has(stored.command_id));return rows([{proof:{rootKind:a[4],rootRef:target,verified:true}}]);}
  if(sql==='SELECT head_version FROM anvil.agent_connections WHERE project_id=$1 AND id=$2'){assert.equal(a[0],pid);const v=metadata.get('DEFINITION:'+a[1]);return rows(v?[{head_version:modes.sourceHead}]:[]);}
  if(sql.startsWith('SELECT v.*,h.head_version,c.result_ref')&&sql.includes('connection_definition_versions')){const v=metadata.get('DEFINITION:'+a[1]);return rows(v?[{...joined(v),head_version:modes.sourceHead}]:[]);}
  if(sql.startsWith('SELECT v.*,h.head_version,c.operation original_operation')){const v=metadata.get(a[1]+':'+a[2]);if(!v)return rows([]);const c=f.commands.get(v.command_id)!;return rows([{...v,head_version:modes.sourceHead,original_operation:c.operation,original_actor:c.actor_id,original_client:c.client_id,original_external_id:c.command_id,original_operation_id:c.operation_id,original_state:c.state,original_request_hash:c.request_hash,original_control_generation:c.control_generation,original_expected_version:c.expected_version,original_policy_ref:c.policy_ref,original_result:c.result_ref,original_receipt_id:c.authorization_receipt_id,original_consumption_id:c.approval_consumption_id}]);}
  if(sql.startsWith('SELECT v.*,r.head_version,c.result_ref')){const v=metadata.get('ROOT:'+a[1]);return rows(v?[{...joined(v),head_version:1}]:[]);}
  if(sql.startsWith('INSERT INTO anvil.execution_preparations')){tables.preparations!.push({project_id:a[0],id:a[1],version:a[2],content_hash:a[3],snapshot_json:JSON.parse(a[4]),created_by:a[5],client_id:a[6],command_id:a[7]});return rows([]);}
  if(sql.includes('FROM anvil.execution_preparations p'))return rows(tables.preparations!.filter(v=>v.project_id===a[0]&&v.id===a[1]&&v.version===a[2]).map(joined));
  if(sql.startsWith('SELECT COALESCE(MAX(sequence),0)+1'))return rows([{sequence:tables.queue!.length+1}]);
  if(sql.startsWith('INSERT INTO anvil.stage_runs'))return rows([]);
  if(sql.startsWith('INSERT INTO anvil.queue_requests')){tables.queue!.push({project_id:a[0],request_id:a[1],version:a[2],sequence:a[3],content_hash:a[4],snapshot_json:JSON.parse(a[5]),command_id:a[6]});return rows([]);}
  if(sql.includes('FROM anvil.queue_requests q')&&!sql.startsWith('SELECT head.*'))return rows(tables.queue!.filter(v=>v.project_id===a[0]&&v.request_id===a[1]&&(!sql.includes('q.version=$3')||v.version===a[2])).sort((x,y)=>y.version-x.version).slice(0,sql.includes('LIMIT 1')?1:200).map(joined));
  if(sql.startsWith('INSERT INTO anvil.execution_start_origins')){tables.origins!.push({project_id:a[0],origin_id:a[1],version:1,content_hash:a[2],snapshot_json:JSON.parse(a[3]),stage_request_id:a[4],stage_request_version:a[5],stage_request_hash:a[6],execution_id:a[7],execution_generation:1,credential_id:a[8],credential_generation:1,reservation_hash:a[9],reservation_json:JSON.parse(a[10]),server_command_id:a[11],recorded_at:new Date(a[12])});return rows([]);}
  if(sql.startsWith('SELECT origin_id,version,content_hash FROM anvil.execution_start_origins'))return rows(tables.origins!.filter(v=>v.project_id===a[0]&&v.stage_request_id===a[1]));
  if(sql.startsWith('SELECT origin_id,version,recorded_at,to_char(recorded_at')){const ref=JSON.parse(a[1]);return rows(tables.origins!.filter(v=>v.project_id===a[0]&&H(v.snapshot_json.assignmentRef)===H(ref)&&(a[2]===null||v.recorded_at.getTime()<Date.parse(a[2])||v.recorded_at.getTime()===Date.parse(a[2])&&v.origin_id<a[3])).sort((x,y)=>y.recorded_at.getTime()-x.recorded_at.getTime()||y.origin_id.localeCompare(x.origin_id)).slice(0,21).map(v=>({...v,cursor_at:v.recorded_at.toISOString().replace(/(\.\d{3})Z$/,'$1000Z')})));}
  if(sql.includes('FROM anvil.execution_start_origins o'))return rows(tables.origins!.filter(v=>v.project_id===a[0]&&v.origin_id===a[1]&&v.version===a[2]).map(v=>{const c=f.commands.get(v.server_command_id)!,ar=receipts.get(c.id)!,e=audits.get(c.id)!,r=tables.reservations!.find(r=>r.id===c.id)!;assert(c&&ar&&e&&r);return{...v,operation:c.operation,external_command_id:c.command_id,command_actor_id:c.actor_id,command_client_id:c.client_id,operation_id:c.operation_id,control_generation:c.control_generation,expected_version:c.expected_version,policy_ref:c.policy_ref,request_hash:c.request_hash,result_ref:c.result_ref,command_state:c.state,authorization_receipt_id:ar.id,approval_consumption_id:c.approval_consumption_id,subject_ref:ar.subject_ref,receipt_policy_ref:ar.policy_ref,scope_digest:ar.scope_digest,approval_decision_ref:ar.approval_decision_ref,receipt_command_id:ar.command_id,receipt_scope_kind:ar.scope_kind,receipt_scope_id:ar.scope_id,event_id:e.event_id,audit_actor_ref:e.actor_ref,audit_client_ref:e.client_ref,audit_operation_id:e.operation_id,audit_target_ref:e.target_ref,audit_policy_ref:e.policy_ref,audit_scope_digest:e.scope_digest,audit_outcome:e.outcome,audit_source_kind:e.source_kind,audit_reason_code:e.reason_code,audit_approval_ref:e.approval_ref,correction_of:e.correction_of,reservation_phase:r.phase,reservation_operation:r.operation,part_kind:r.part_kind,plan_json:r.plan_json,reservation_plan_hash:r.plan_hash,reservation_actor_id:r.actor_id,reservation_client_id:r.client_id,reservation_external_id:r.external_command_id,reservation_command_hash:r.command_hash,reservation_authorized_until:r.authorized_until};}));
  if(sql.includes('fn09_execution_start_origin_reserve')){const request=JSON.parse(a[4]),ref=JSON.parse(a[5]),s=JSON.parse(a[6]),q=JSON.parse(a[7]),ids=JSON.parse(a[9]),pairs=JSON.parse(a[10]);assert.equal(a[11],String(modes.tx));assert.equal(H(s),ref.contentHash);assert.deepEqual(q.originRef,ref);assert.equal(pairs.originSnapshot,(await import('../../../contracts/canonical.ts')).canonicalJson(s));assert.equal(pairs.credentialReservation,(await import('../../../contracts/canonical.ts')).canonicalJson(q));assert.equal(request.operation,'registerExecutionStartOrigin');assert(!tables.origins!.some(v=>v.stage_request_id===s.stageRequestRef.id));const sealed={schemaVersion:1,purpose:'EXECUTION_START_ORIGIN',actorId:uid,coverageGeneration:1,originRef:ref,request,commandHash:H(request),policyRef:JSON.parse(a[8]),originSnapshot:s,credentialReservation:q,ids,canonicalPairs:pairs,authorizedUntil:a[12]},plan={...sealed,planHash:H(sealed)};tables.reservations!.push({id:ids.serverCommandId,phase:'IO_STARTED',operation:request.operation,part_kind:'EXECUTION_START_ORIGIN',plan_json:plan,plan_hash:plan.planHash,actor_id:uid,client_id:cid,external_command_id:request.commandId,command_hash:H(request),authorized_until:new Date(a[12])});return rows([{reservation_id:ids.serverCommandId,transaction_id:String(modes.tx),record_hash:ref.contentHash,plan_hash:plan.planHash,reserved_bytes:'200000',authorized_until:a[12]}]);}
  if(sql.includes('fn09_execution_start_origin_settle')){if(modes.settle==='LOST')throw Error('SETTLE_LOST');const r=tables.reservations!.find(v=>v.id===a[5]),o=tables.origins!.find(v=>v.server_command_id===a[5]);assert(r&&o&&f.commands.has(a[5])&&receipts.has(a[5])&&audits.has(a[5]));assert.equal(r.phase,'IO_STARTED');assert.equal(a[6],r.plan_json.planHash);assert.deepEqual(JSON.parse(a[7]),f.commands.get(a[5])!.result_ref);r.phase='SETTLED';return rows([{status:'SETTLED',reservation_id:r.id,transaction_id:String(modes.tx),settled_bytes:'190000'}]);}
  if(sql.includes('fn09_registered_prepare_reserve')){const ids=JSON.parse(a[8]),ref=JSON.parse(a[5]);assert.equal(a[10],String(modes.tx));tables.reservations!.push({id:ids.serverCommandId,phase:'IO_STARTED',ids,ref});return rows([{reservation_id:ids.serverCommandId,transaction_id:String(modes.tx),preparation_hash:ref.contentHash,plan_hash:'a'.repeat(64),reserved_bytes:'200000',authorized_until:f.actor.authSession.idleExpiresAt}]);}
  if(sql.includes('fn09_registered_prepare_settle')){const r=tables.reservations!.find(v=>v.id===a[5]);assert(r);r.phase='SETTLED';return rows([{status:'SETTLED',reservation_id:r.id,transaction_id:String(modes.tx),settled_bytes:'190000'}]);}
  return raw(sql,a);
 };
 const methods=new ProjectMethodologies(),plans=new ProjectWorkPlans(documents),drafts=new ProjectAssignmentDrafts(plans,methods),assignments=new ProjectAssignmentConfirmations(drafts),definitions=new ProjectConnectionDefinitions(access),environments=new ProjectEnvironments(access),candidates=new ProjectConnectionCandidates(access),limits=new ProjectLimitPolicies(),sessions=new ResponsibleSessions(methods,assignments,drafts,candidates,definitions),contexts=new ProjectContexts(new ProjectContextSources({confirmations:assignments,drafts,documents,knowledge:new ProjectKnowledge(documents),conversations:new ProjectConversations(documents)}),assignments),quota=new ProjectStorageQuota(access),preparations=new ProjectExecutionPreparations(assignments,drafts,sessions,contexts,candidates,{definitions,environments,quota}),queue=new ProjectStageQueue({applications:methods,budgets:limits});
 const policyRef={id:policy().id,version:1,contentHash:policy().content_hash},run=async(work:(a:any)=>Promise<any>)=>access.authenticated(f.token,f.csrf,(_db,a)=>work(a));
 const budget:any=await run(a=>limits.apply(db,a,command('applyLimitPolicy',{limits:{maxAttempts:3,maxElapsedMs:options.budgetElapsedMs??60000,maxCalls:10,maxConcurrentAssignments:1,maxSpoolBytes:2097152,maxOfflineMs:0},scope:{kind:'PROJECT',projectId:pid},reason:'원 한도 정책',policyBaseVersion:0}),policyRef));
 const storeMetadata=async(kind:string,operation:string,snapshot:any,payload:any,ref:any,data:any,reason:string,evidence:any[]=[])=>{const c=command(operation,payload),receipt:any=await run(a=>persistProjectReceipt(db,a,c,ref,data,policyRef,reason)),row={project_id:pid,id:ref.id,version:1,kind,snapshot_json:snapshot,canonical_json:JSON.stringify(snapshot),canonical_bytes:String(Buffer.byteLength(JSON.stringify(snapshot))),evidence_json:evidence,evidence_bytes:String(Buffer.byteLength(JSON.stringify(evidence))),request_json:c,created_by:uid,client_id:cid,command_id:receipt.id,created_at:new Date(),content_hash:ref.contentHash};row.canonical_json=(await import('../../../contracts/canonical.ts')).canonicalJson(snapshot);row.canonical_bytes=String(Buffer.byteLength(row.canonical_json));metadata.set(kind+':'+ref.id,row);return row;};
 const connectorHost=options.connectorEnvironment?await run(async actor=>{
  const {registrationRef,connectorRef}=await import('../../../apps/server/modules/connections/project-registrations.ts');
  const {publicKeyFingerprint}=await import('../../../apps/server/modules/connections/registration-proof.ts');
  const publicKey=Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5','hex').toString('base64url');
  const fingerprint=publicKeyFingerprint(publicKey),hostLabel='합성 등록 호스트';
  const expiresAt=f.actor.authSession.idleExpiresAt,createdAt=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at as Date;
  const scope={kind:'HOST_TRUST_REGISTRATION',installationId:access.installationId,projectId:pid,subject:{kind:'HUMAN',userId:uid,clientId:cid,credentialGeneration:actor.credentialGeneration,controlGeneration:1},policyRef,expectedHostFingerprint:fingerprint,hostLabel,expiresAt,credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
  const row={id:id(215),connector_id:id(216),project_id:pid,session_id:actor.authSession.id,requested_by:uid,client_id:cid,credential_generation:actor.credentialGeneration,control_generation:1,version:5,state:'ISSUED',scope_json:scope,scope_digest:H(scope),policy_ref:policyRef,expected_host_fingerprint:fingerprint,observed_host_fingerprint:fingerprint,created_at:createdAt,proofed_at:createdAt,issued_at:createdAt,expires_at:new Date(expiresAt),revoked_at:null as Date|null,failed_attempts:0,created_command_id:''};
  const created=registrationRef({...row,version:1,state:'CREATED'}),current=registrationRef(row),ref=connectorRef(row,1);
  // 등록 상태 전이는 합성 원행으로 준비한다. 원 command/receipt/audit는 실제 producer가 봉인한다.
  const receipt=await persistProjectReceipt(db,actor,command('registerConnector',{hostLabel,expectedHostFingerprint:fingerprint,reason:'합성 등록'}),created,{status:'REGISTRATION_CREATED',registrationRef:created,connectorRef:ref,scope,scopeDigest:row.scope_digest,oneTimeCode:null,secretDisposition:'ALREADY_ISSUED_RECONCILE',grants:[],executionAuthorized:false,previousRef:null},policyRef,'EXPLICIT_STATUS_ONLY_HOST_REGISTRATION');
  row.created_command_id=receipt.id;
  receipts.get(receipt.id).authorized_at=createdAt;
  audits.get(receipt.id).recorded_at=createdAt;
  registration={row,connector:{generation:1,owner_user_id:uid,host_client:cid,host_credential_generation:actor.credentialGeneration,host_label:hostLabel,host_fingerprint:fingerprint,public_key_spki:publicKey,connector_state:'TRUSTED',host_revoked_at:null}};
  return {kind:'CONNECTOR_STATUS' as const,connectorRef:ref,registrationRef:current};
 }):null;
 const withDependencies=connectorHost!==null&&options.environmentDependencies===true;
 const {readEnvironmentResourceDefinition}=await import('../../../contracts/runtime/environment-configuration-v1.ts');
 const hostDefinition={label:'원 선언',hostKind:'MACHINE',parentHostRef:null,endpointLabel:null,policyRef},hostSnapshot={id:id(210),version:1,status:'DECLARED',definition:hostDefinition},hostRef={id:hostSnapshot.id,version:1,contentHash:H(hostSnapshot)},declaredHost={kind:'HOST_DECLARATION' as const,ref:hostRef},host=connectorHost??declaredHost;if(!connectorHost||withDependencies){if(withDependencies)readEnvironmentResourceDefinition('ENVIRONMENT_HOST_DECLARATION',hostDefinition);await storeMetadata('ENVIRONMENT_HOST_DECLARATION','saveEnvironmentHostDeclaration',hostSnapshot,{definition:hostDefinition,baseRef:null,reason:'원 선언'},hostRef,{status:'ENVIRONMENT_METADATA_STORED',kind:'ENVIRONMENT_HOST_DECLARATION',snapshot:hostSnapshot,previousRef:null},'EXPLICIT_ENVIRONMENT_CONFIGURATION');}
 const secretRef=withDependencies?await (async()=>{
  const kind='SECRET_REFERENCE_METADATA' as const;
  const definition={label:'합성 실행기 관리 참조',hostRef:declaredHost,providerKind:'EXECUTOR_MANAGED',logicalName:'connector-metadata-only',purpose:'메타데이터 관계 검산',policyRef};
  readEnvironmentResourceDefinition(kind,definition);
  const evidence:unknown[]=[];
  await run(a=>environments.resources.references(db,a,pid,kind,definition,evidence));
  assert.deepEqual(evidence,[]);
  const snapshot={id:id(217),version:1,status:'DECLARED',definition},ref={id:snapshot.id,version:1,contentHash:H(snapshot)};
  await storeMetadata(kind,'saveSecretReferenceMetadata',snapshot,{definition,baseRef:null,reason:'원 선언'},ref,{status:'ENVIRONMENT_METADATA_STORED',kind,snapshot,previousRef:null},'EXPLICIT_ENVIRONMENT_CONFIGURATION',evidence);
  return {kind,ref};
 })():null;
 const snapshotTemplate=connectorHost&&options.snapshotRoot===true?(await import('../FN08/source-read-fixtures.ts')).sourceReadFixture():undefined;
 const rootSnapshot={declaration:{hostLabel:'원 선언',displayName:'원 소스',pathHint:snapshotTemplate?.permit.root.pathHint??'source-only-placeholder',reason:'원 선언',connectorId:snapshotTemplate&&connectorHost?connectorHost.connectorRef.id:null},status:'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',reason:'원 선언'},rootRef={id:id(211),version:1,contentHash:H(rootSnapshot)},root=await storeMetadata('ROOT','saveSourceRoot',rootSnapshot,{declaration:rootSnapshot.declaration,baseRef:null,reason:'원 선언'},rootRef,{status:'SOURCE_ROOT_VERSION_STORED',snapshot:rootSnapshot,previousRef:null,protectedRef:'db-source-root-version:'+rootRef.id+':1'},'EXPLICIT_UNVERIFIED_SOURCE_ROOT');Object.assign(root,{root_id:rootRef.id,declaration_json:rootSnapshot.declaration,status:'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',reason:'원 선언',actor_id:uid,connector_id:rootSnapshot.declaration.connectorId});
 const snapshotRef=snapshotTemplate&&connectorHost?await run(async actor=>{
  const {rehashReport}=await import('../FN08/source-read-fixtures.ts');
  const {contentHash}=await import('../../../contracts/canonical.ts');
  const observed=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at as Date;
  const time=(offset:number)=>new Date(observed.getTime()+offset),relativePath='src/a.ts';
  const request={...snapshotTemplate.request,sourceRootRef:rootRef,connectorRef:connectorHost.connectorRef,registrationRef:connectorHost.registrationRef,
   targets:[{...snapshotTemplate.request.targets[0],relativePath}],expiresAt:time(60_000).toISOString()};
  const scope={...snapshotTemplate.scope,...request,installationId:access.installationId,projectId:pid,pathHintHash:contentHash(rootSnapshot.declaration.pathHint),
   hostFingerprint:registration!.row.expected_host_fingerprint,userId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,controlGeneration:1,policyRef,requestedAt:observed.toISOString()};
  const grantRef={id:id(218),version:1,contentHash:H(scope)},receipt=await persistProjectReceipt(db,actor,command('requestSourceReadObservation',request),grantRef,{
   status:'GRANT_RECORDED',grantRef,scopeDigest:grantRef.contentHash,storedState:'CREATED',scope,observationPermit:'NOT_ISSUED',executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,
  },policyRef,'EXPLICIT_SOURCE_READ_OBSERVATION');
  const grant={id:grantRef.id,project_id:pid,version:1,source_root_id:rootRef.id,source_root_version:rootRef.version,source_root_hash:rootRef.contentHash,
   connector_id:scope.connectorRef.id,connector_generation:scope.connectorRef.version,registration_id:scope.registrationRef.id,registration_version:scope.registrationRef.version,
   requested_by:actor.actorId,client_id:actor.clientId,credential_generation:actor.credentialGeneration,control_generation:1,policy_ref:policyRef,scope_json:scope,scope_digest:grantRef.contentHash,
   created_command_id:receipt.id,created_at:observed,expires_at:time(60_000),revoked_at:null,revoke_command_id:null,exchange_failures:0};
  // 교환과 보고 제출은 실행하지 않는다. 서명은 기존 합성 형식값이며, 실제 읽기는 저장 관계와 보고 해시를 검산한다.
  const report=rehashReport({...snapshotTemplate.report,grantRef,scopeDigest:grantRef.contentHash,connectorRef:scope.connectorRef,hostFingerprint:scope.hostFingerprint,
   observedAt:time(2).toISOString(),finishedAt:time(3).toISOString(),root:{...snapshotTemplate.report.root,facts:{...snapshotTemplate.report.root.facts,declaredRootRef:rootRef}},
   files:snapshotTemplate.report.files.map(file=>({...file,relativePath}))});
  const ref={id:id(219),version:1,contentHash:report.contentHash};
  const credential={id:id(220),project_id:pid,grant_id:grantRef.id,connector_id:scope.connectorRef.id,connector_generation:scope.connectorRef.version,scope:'SOURCE_OBSERVE_READ_ONLY',
   scope_digest:grantRef.contentHash,issued_at:time(1),expires_at:time(30_000),consumed_at:time(4)};
  const snapshot={id:ref.id,project_id:pid,version:1,grant_id:grantRef.id,source_root_id:rootRef.id,source_root_version:rootRef.version,
   connector_id:scope.connectorRef.id,generation:scope.connectorRef.version,scope_digest:grantRef.contentHash,evidence_class:'CONNECTOR_REPORTED',os_verification:'UNVERIFIED',
   content_hash:ref.contentHash,report_json:report,signature:report.signature,report_command_id:report.commandId,observed_at:time(2),finished_at:time(3),received_at:time(4)};
  const audit=[pid,ref,grantRef.contentHash,{kind:'CONNECTOR',connectorId:scope.connectorRef.id,registrationId:scope.registrationRef.id},actor.clientId,policyRef];
  snapshotEvidence={grant,snapshot,credential,audit};
  return ref;
 }):undefined;
 const profileDefinition={label:'원 명령 선언',purpose:'실행0',hostRef:host,toolRequirements:[{product:'Claude Code',versionRequirement:'선언'}],program:'declared-program',argsTemplate:[],workingDirectory:{sourceRootRef:rootRef,relativeDirectory:null},secretSlots:[],policyRef},profileSnapshot={id:id(212),version:1,status:'DECLARED',definition:profileDefinition},profileRef={id:profileSnapshot.id,version:1,contentHash:H(profileSnapshot)};const profileEvidence:any[]=[];if(connectorHost)await run(a=>environments.resources.references(db,a,pid,'COMMAND_PROFILE_METADATA',profileDefinition,profileEvidence));await storeMetadata('COMMAND_PROFILE_METADATA','saveCommandProfileMetadata',profileSnapshot,{definition:profileDefinition,baseRef:null,reason:'원 선언'},profileRef,{status:'ENVIRONMENT_METADATA_STORED',kind:'COMMAND_PROFILE_METADATA',snapshot:profileSnapshot,previousRef:null},'EXPLICIT_ENVIRONMENT_CONFIGURATION',profileEvidence);
 const envInput={sourceRoots:[{sourceRootId:rootRef.id,hostId:connectorHost?.connectorRef.id??hostRef.id,displayLabel:'원 소스',registeredPathRef:snapshotRef?{kind:'SOURCE_SNAPSHOT_ROOT_PATH',snapshotRef,hostRef:host}:{kind:'SOURCE_ROOT_DECLARATION',sourceRootRef:rootRef,hostRef:host},identityRef:null,permissionScope:{kind:'REQUESTED_SCOPE',targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}}],executionHostRef:host,targetHostRefs:withDependencies?[declaredHost]:[],commandProfileRefs:[{kind:'COMMAND_PROFILE_METADATA',ref:profileRef}],secretRefs:secretRef?[secretRef]:[],policyRef},envBody={id:id(213),version:1,...envInput},environment={...envBody,contentHash:H(envBody)},environmentRef={id:environment.id,version:1,contentHash:environment.contentHash};const environmentEvidence:any[]=[];if(connectorHost)await run(a=>environments.references(db,a,pid,envInput as import('../../../contracts/runtime/environment-configuration-v1.ts').EnvironmentInput,true,environmentEvidence));await storeMetadata('ENVIRONMENT_VERSION','saveEnvironment',environment,{environment:envInput,baseRef:null,reason:'원 선언'},environmentRef,{status:'ENVIRONMENT_VERSION_STORED',kind:'ENVIRONMENT_VERSION',snapshot:environment,previousRef:null},'EXPLICIT_ENVIRONMENT_CONFIGURATION',environmentEvidence);
 const definitionFields={label:'원 등록',toolProduct:'Claude Code',toolVersion:'선언',adapterKind:'CLAUDE_AGENT_SDK',connectorId:null,accountRef:null,modelOptions:{claudeQueryParams:{model:'auto',maxTurns:2}},environmentRef,policyRef,capabilityReportRef:null},definition={id:id(214),version:1,status:'NOT_READY',...definitionFields},definitionRef={id:definition.id,version:1,contentHash:H(definition)},definitionRow=await storeMetadata('DEFINITION','registerConnection',definition,{definition:definitionFields,reason:'원 선언'},definitionRef,{status:'CONNECTION_DEFINITION_STORED',definition,previousRef:null},'EXPLICIT_UNVERIFIED_CONNECTION_DEFINITION');Object.assign(definitionRow,{connection_id:definitionRef.id,definition_json:definition});
 const scopes=[{sourceRootRef:rootRef,mappingRef:null,observationRef:f.design.ref,baselineRef:f.design.ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}],definitionInput={taskRef:{planRef:f.plan.ref,taskCode:'FN10',applicationRef,nodeId:'choose'},purpose:'원자료 결박',goal:'원자료 저장',baselineRefs:[f.plan.ref,applicationRef,f.design.ref],inputs:['원 문서'],outputs:['원본'],acceptanceCriteria:['관계 검산'],verificationRequirements:['보호 조회'],included:['기록'],excluded:['실행'],allowedScopes:scopes,environmentRef,requiredCapabilities:['미검증'],budgetRef:budget.data.ref,ownerRole:'STAGE_OWNER',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'원 기록 보존'};
 const draft:any=await run(a=>drafts.save(db,a,command('prepareAssignment',{baseRef:null,definition:definitionInput,reason:'원 임무'}),policyRef)),{assignmentContentCriteria}=await import('../../../apps/server/modules/assignments/assignment-confirmation-input.ts');
 const review:any=await run(a=>assignments.review(db,a,command('reviewAssignmentContent',{draftRef:draft.data.ref,criteriaVersion:1,items:assignmentContentCriteria.map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'내용 확인',evidenceRefs:[]})),outcome:'ACCEPTED',reason:'내용 확인'},draft.data.ref),policyRef)),confirmed:any=await run(a=>assignments.confirm(db,a,command('confirmAssignment',{draftRef:draft.data.ref,reviewRefs:[review.data.ref],reason:'명시 확정',acknowledged:true},draft.data.ref),policyRef));
 const coordinator:any=await run(a=>sessions.define(db,a,command('defineProjectRole',{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'원 총괄'}),policyRef)),role:any=await run(a=>sessions.define(db,a,command('defineProjectRole',{kind:'STAGE_OWNER',stageRef:{applicationRef,nodeId:'choose'},parentRoleRef:coordinator.data.ref,reason:'원 역할'}),policyRef));
 const binding:any=await run(a=>sessions.bind(db,a,command('bindResponsibleSession',{connectionKind:'REGISTERED_DEFINITION',assignmentRef:confirmed.data.ref,roleRef:role.data.ref,connectionRef:definitionRef,existingSessionBindingRef:null,reason:'논리 예약'}),policyRef));
 const richSources=richContext?await (async()=>{
  const knowledge=new ProjectKnowledge(documents),conversations=new ProjectConversations(documents);
  const {knowledgeContentReviewCriteria}=await import('../../../apps/server/modules/knowledge/knowledge-reviews.ts');
  const scope={projectId:pid,stageRefs:[],taskRefs:[]};
  const confirmKnowledge=async(kind:'PURPOSE'|'CONSTITUTION',title:string,bodyRef:typeof f.design.bodyRef,currentPolicyRef:typeof policyRef)=>{
   const subject=kind==='PURPOSE'?'목적':'헌법';
   const entry={kind,title,contentRef:bodyRef,sourceRefs:[{kind:'DOCUMENT_VERSION',...f.design.ref}],reason:'보호된 원문 근거',scope,relatedRefs:[]};
   const proposed=await run(actor=>knowledge.save(db,actor,command('saveKnowledge',{entry}),currentPolicyRef));
   const versionRef=proposed.data.ref;
   const reviewed=await run(actor=>knowledge.review(db,actor,command('recordContentReview',{
    targetKind:'KNOWLEDGE',targetRef:versionRef,criteriaVersion:1,items:knowledgeContentReviewCriteria.items.map(({criterionId})=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:`원 ${subject} 검토`})),
    outcome:'ACCEPTED',reason:`원 ${subject} 검토`,
   },versionRef),currentPolicyRef));
   const accepted=await run(actor=>knowledge.confirm(db,actor,command('confirmKnowledge',{versionRef,reviewRefs:[reviewed.data.reviewRef],reason:`원 ${subject} 확정`},versionRef),currentPolicyRef));
   assert.equal(accepted.data.status,'CONFIRMED');
   return {versionRef,confirmationId:accepted.data.confirmationId};
  };
  const {versionRef:knowledgeRef}=await confirmKnowledge('PURPOSE','같은 프로젝트의 원 목적',f.design.bodyRef,policyRef);
  const constitution=constitutionContext?await (async()=>{
   const {ProjectConstitutions}=await import('../../../apps/server/modules/knowledge/project-constitutions.ts');
   const constitutions=new ProjectConstitutions(knowledge);
   const apply=async(title:string,bodyRef:typeof f.design.bodyRef,currentPolicyRef:typeof policyRef,version:number)=>{
    const source=await confirmKnowledge('CONSTITUTION',title,bodyRef,currentPolicyRef);
    const result=await run(actor=>constitutions.apply(db,actor,command('applyConstitution',{
     ...source,reason:'명시 헌법 적용',acknowledged:true,
    },{id:pid,version}),currentPolicyRef));
    assert.equal(result.data.status,'CONSTITUTION_APPLIED');
    return result.data as {ref:typeof policyRef;application:{versionRef:typeof policyRef;previousApplicationRef:typeof policyRef|null}};
   };
   const current=await apply('원 헌법',f.design.bodyRef,policyRef,0);
   return {current,replace:(currentPolicyRef:typeof policyRef)=>apply('후속 헌법',f.planDoc.bodyRef,currentPolicyRef,current.ref.version)};
  })():undefined;
  const instruction=(conversationId:string|null,supersedesInstructionRef:unknown,bodyRef:typeof f.design.bodyRef)=>({
   conversationId,targetRoleRef:null,message:{kind:'USER_INSTRUCTION',bodyRef,attachmentRefs:[],replyTo:null,supersedesInstructionRef,effectiveScope:scope},sourceRefs:[],
  });
  const posted=await run(actor=>conversations.append(db,actor,command('appendConversation',instruction(null,null,f.planDoc.bodyRef)),policyRef));
  const {conversationId,sourceRef:messageRef}=posted.data;
  const supersede=(currentPolicyRef:typeof policyRef)=>run(actor=>conversations.append(db,actor,
   command('appendConversation',instruction(conversationId,messageRef,f.design.bodyRef),{id:conversationId,version:1}),currentPolicyRef));
  return {knowledgeRef,conversationId,messageRef,supersede,constitution};
 })():undefined;
 const contextCommand=command('buildTaskContext',{assignmentRef:confirmed.data.ref,budgetRef:budget.data.ref,slots:contextSlotCodes.map(code=>({code,sources:code==='CURRENT_POSITION'?[{kind:'DOCUMENT_VERSION',versionRef:f.design.ref}]:richSources&&code==='PURPOSE_REASON'?[{kind:'KNOWLEDGE_VERSION',versionRef:richSources.knowledgeRef}]:richSources?.constitution&&code==='RULES_SCOPE'?[{kind:'KNOWLEDGE_VERSION',versionRef:richSources.constitution.current.application.versionRef}]:richSources&&code==='LATEST_INSTRUCTIONS'?[{kind:'USER_INSTRUCTION',conversationId:richSources.conversationId,messageRef:richSources.messageRef}]:[],reason:'명시 원문 또는 미선택'})),limits:{maxPartBytes:1024,maxParts:200},reason:'원 맥락'});
 const context=approvedContext?await (async()=>{
  const {ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts');
  const approvals=new ProjectApprovals(documents),policies=new ProjectPolicyRepository(access);
  const scope={operation:contextCommand.operation,targetRef:null,expectedVersion:0,payloadHash:H(contextCommand.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,
   requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:contextCommand.controlGeneration};
  const details={reason:'원 맥락 1회 승인',risks:{data:'원본 유지',security:'보호',cost:'없음',interruption:'중단',unverified:'합성'},rollback:{method:'동일 거래',limitations:'원 명령만',evidenceRefs:[]},
   expiresAt:new Date(Date.now()+30_000).toISOString(),actionScope:scope,candidateCommandId:contextCommand.commandId};
  const requestCommand=command('requestApproval',{details});
  const requested:any=await policies.command(f.token,f.csrf,requestCommand,(db,actor,policy)=>approvals.request(db,actor,requestCommand,policy));
  const {id:requestId,scopeDigest}=requested.data.request;
  const decisionCommand=command('decideApproval',{requestId,expectedVersion:1,scopeDigest,decision:'APPROVE',reason:'명시 원 입력 승인'},requested.data.ref);
  const decided:any=await policies.command(f.token,f.csrf,decisionCommand,(db,actor,policy)=>approvals.decide(db,actor,decisionCommand,policy));
  const approvedCommand={...contextCommand,approvalRef:{requestId,decisionId:decided.data.decision.id,scopeDigest}};
  return policies.command(f.token,f.csrf,approvedCommand,(db,actor,policy)=>contexts.save(db,actor,approvedCommand,policy));
 })():await run(a=>contexts.save(db,a,contextCommand,policyRef));
 const preparation:any=await run(a=>preparations.save(db,a,command('prepareExecution',{projectId:pid,assignmentRef:confirmed.data.ref,roleBindingRef:binding.data.ref,contextBundleRef:context.data.ref,connectionRef:definitionRef,environmentRef,capabilityRef:f.design.ref,budgetPolicyRef:budget.data.ref,sourceScopes:scopes,mode:'CONTEXT_REVIEW',reason:'등록 준비',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'}),policyRef));
 const stage:any=await run(a=>queue.start(db,a,command('startStage',{stageRef:{applicationRef,nodeId:'choose'},methodologyApplicationRef:applicationRef,mode:'CASE_BY_CASE',startNodeRef:{applicationRef,nodeId:'choose'},endBoundaryRef:{applicationRef,nodeId:'choose'},baselineRefs:[f.plan.ref,applicationRef,f.design.ref,...(options.unrelatedStageBaseline?[f.planDoc.ref]:[])],budgetRef:budget.data.ref,reason:'원 대기 요청'}),policyRef));
 trace.length=0;const originCommand=()=>command('registerExecutionStartOrigin',{stageRequestRef:stage.data.ref,assignmentRef:confirmed.data.ref,preparationRef:preparation.data.ref,roleBindingRef:binding.data.ref,reason:'원자료 명시 결박'});
 return{...f,tables,receipts,audits,metadata,modes,trace,policy,policyRef,methods,plans,drafts,assignments,definitions,environments,candidates,limits,sessions,contexts,quota,preparations,queue,run,originCommand,stage,confirmed,binding,preparation,applicationRef,registration,...(richSources?{richSources}:{})};
}
