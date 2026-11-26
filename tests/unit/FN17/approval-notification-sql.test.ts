import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
async function source(){const file=new URL('../../../db/migrations/0052_approval_in_app_notifications.sql.pending',import.meta.url);const raw=await readFile(file,'utf8').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});assert.ok(raw,'미적용 forward notification 저장 source가 필요하다');return raw.replace(/--[^\n]*/g,'').replace(/\s+/g,' ');}
// 정적 source 계약이다. PG compile/DML/COMMIT/RLS/GRANT 검증으로 승격하지 않는다.
test('새두표는원request/receipt/member/client의복합FK·중복방지·최초readPK를고정한다',async()=>{const s=await source();for(const table of ['notifications','notification_reads'])assert.match(s,new RegExp('CREATE TABLE anvil\\.'+table+'\\b','i'));for(const target of ['commands','approval_requests','project_members','users','clients'])assert.match(s,new RegExp('REFERENCES anvil\\.'+target+'\\s*\\(','i'));assert.match(s,/UNIQUE\s*\(project_id\s*,\s*source_command_id\s*,\s*event_kind\s*,\s*recipient_user_id\s*,\s*channel\)/i);assert.match(s,/UNIQUE\s*\(project_id\s*,\s*approval_request_id\s*,\s*recipient_user_id\s*,\s*channel\)/i);assert.match(s,/PRIMARY KEY\s*\(project_id\s*,\s*notification_id\s*,\s*recipient_user_id\)/i);assert.match(s,/FOREIGN KEY\s*\(project_id\s*,\s*notification_id\s*,\s*recipient_user_id\)\s*REFERENCES anvil.notifications\s*\(project_id\s*,\s*id\s*,\s*recipient_user_id\)/i);assert.match(s,/ON DELETE RESTRICT/i);});
test('guard는v1원snapshot/receipt·현재GUC·audit/hash를결박하고결정후v2v3원본도보존한다',async()=>{const s=await source();for(const text of ['request_json','result_ref','requiredDecider','requestedBy','anvil.actor_id','anvil.client_id','anvil.command_id','requestApproval','markNotificationRead','authorization_receipts','audit_events','execution_json_hash','notification_content_hash'])assert.ok(s.includes(text),text);assert.match(s,/BEFORE UPDATE OR DELETE ON anvil.notifications/i);assert.match(s,/BEFORE UPDATE OR DELETE ON anvil.notification_reads/i);assert.doesNotMatch(s,/\br\.version\s*(?:<>|!=|=)\s*1\b/i,'현재approval row version을원v1로오인하지않는다');assert.doesNotMatch(s,/DELETE FROM anvil\.(?:notifications|notification_reads)/i);});
test('FORCE RLS에서app은자기행 SELECT/INSERT만·기존owner한정cap통로외전역조회권한0이다',async()=>{const s=await source();for(const table of ['notifications','notification_reads']){assert.match(s,new RegExp('ALTER TABLE anvil\\.'+table+' ENABLE ROW LEVEL SECURITY','i'));assert.match(s,new RegExp('ALTER TABLE anvil\\.'+table+' FORCE ROW LEVEL SECURITY','i'));assert.match(s,new RegExp('REVOKE ALL ON (?:TABLE )?anvil\\.'+table+' FROM PUBLIC\\s*,\\s*anvil_v3_app','i'));assert.match(s,new RegExp('GRANT SELECT\\s*,\\s*INSERT ON (?:TABLE )?anvil\\.'+table+' TO anvil_v3_app','i'));}assert.match(s,/CREATE POLICY/i);assert.ok(s.includes('recipient_user_id')&&s.includes("current_setting('anvil.actor_id'"));assert.doesNotMatch(s,/CREATE (?:ROLE|USER)|BYPASSRLS|DISABLE ROW LEVEL SECURITY|NO FORCE ROW LEVEL SECURITY/i);assert.doesNotMatch(s,/GRANT[^;]*(?:UPDATE|DELETE|TRUNCATE)[^;]*TO anvil_v3_app/i);assert.doesNotMatch(s,/FOR (?:SHARE|UPDATE) OF n\b/i,'불변notification행의UPDATE권한을요구하지않는다');});
test('내부cap은10000전체project·원command잠금문맥의void검사이며다른수신자건수공개0이다',async()=>{const s=await source();assert.match(s,/FUNCTION anvil.assert_approval_notification_capacity\s*\([^)]*uuid[^)]*\)\s*RETURNS void/i);assert.match(s,/SECURITY DEFINER SET search_path\s*=\s*pg_catalog/i);assert.match(s,/count\s*\(\*\)[^;]*FROM anvil.notifications[^;]*project_id/i);assert.match(s,/>=\s*10000/);assert.ok(s.includes('NOTIFICATION_CAPACITY_EXCEEDED'));assert.match(s,/FOR UPDATE/i);assert.ok(s.includes('current_user'),'FORCE RLS 아래 owner 통로는 기존 migration owner를 명시한다');assert.match(s,/GRANT EXECUTE ON FUNCTION anvil.assert_approval_notification_capacity\s*\(uuid\) TO anvil_v3_app/i);assert.match(s,/REVOKE ALL ON FUNCTION/i);assert.doesNotMatch(s,/GRANT[^;]*TO PUBLIC/i);});

test('잠금획득후현재성statement와deferred최종정책검사는분리되고cap10000재검산은없다',async()=>{const s=await source(),current=s.slice(s.indexOf('CREATE FUNCTION anvil.fn17_notification_current('),s.indexOf('CREATE FUNCTION anvil.fn17_notification_new_origin('));const lock=current.indexOf('FOR UPDATE OF pr,m,pc;'),post=current.indexOf('PERFORM 1 FROM anvil.projects',current.indexOf('PERFORM 1 FROM anvil.projects')+1);assert.ok(lock>0&&post>lock);assert.ok(current.indexOf('a.idle_expires_at>clock_timestamp()',post)>post);assert.ok(current.includes("original_rule->>'expiresAt'"));const complete=s.slice(s.indexOf('CREATE FUNCTION anvil.fn17_notification_complete()'),s.indexOf('CREATE CONSTRAINT TRIGGER notification_request_complete'));assert.ok(complete.includes("fn17_notification_current(NEW.project_id,NEW.command_id,'requestApproval')"));assert.ok(complete.includes('fn17_notification_new_origin(NEW.project_id,NEW.id,NEW.command_id)'));assert.equal(complete.includes('assert_approval_notification_capacity'),false);});
test('쓰기cap은현재tx4원행xmin과불변원시각을함께결박하고역사조회에는소급하지않는다',async()=>{const s=await source(),fresh=s.slice(s.indexOf('CREATE FUNCTION anvil.fn17_notification_new_origin('),s.indexOf('CREATE FUNCTION anvil.assert_approval_notification_capacity('));for(const name of ['c','r','ar','e'])assert.ok(fresh.includes(name+'.xmin=pg_current_xact_id()::xid'));assert.ok(fresh.includes('c.received_at=transaction_timestamp()'));assert.ok(fresh.includes("r.created_at=date_trunc('milliseconds',transaction_timestamp())"));assert.ok(fresh.includes("r.request_json->>'createdAt'"));const cap=s.slice(s.indexOf('CREATE FUNCTION anvil.assert_approval_notification_capacity('),s.indexOf('CREATE FUNCTION anvil.fn17_notification_insert()'));assert.ok(cap.includes('fn17_notification_new_origin(pid,r.id,source_id)'));const history=s.slice(s.indexOf('CREATE FUNCTION anvil.fn17_notification_origin_valid('),s.indexOf('CREATE FUNCTION anvil.fn17_notification_current('));assert.equal(history.includes('xmin'),false);});

test('0107은 기존 origin 함수 OID와 분기를 보존하고 이해 검토의 전체 후보 명령을 재검산한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0107_approval_notification_understanding_origin.sql.pending',import.meta.url),'utf8');
 const old=await readFile(new URL('../../../db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',import.meta.url),'utf8');
 const flat=(v:string)=>v.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim(),s=flat(sql),q=flat(old);
 assert.match(s,/^BEGIN; CREATE OR REPLACE FUNCTION anvil\.fn17_notification_origin_valid\(pid uuid,rid uuid,source_id uuid,recipient uuid,occurred timestamptz,request_hash text\) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS \$\$/);
 assert.match(s,/EXCEPTION WHEN OTHERS THEN RETURN false;END;\$\$; COMMIT;$/);
 assert.equal((s.match(/\bCREATE\b/g)??[]).length,1);
 assert.equal((s.match(/\bBEGIN;/g)??[]).length,1);assert.equal((s.match(/\bCOMMIT;/g)??[]).length,1);
 assert.doesNotMatch(s,/\b(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|EXECUTE)\b/);
 const arm="IF request.action_scope_json->>'operation'='queueExecutionCommand'",delegate='RETURN anvil.fn17_notification_origin_before_origin_reuse_request(pid,rid,source_id,recipient,occurred,request_hash);';
 assert.equal(s.slice(s.indexOf(arm),s.indexOf(' ELSIF request.action_scope_json')).trim(),q.slice(q.indexOf(arm),q.indexOf(delegate)).trim().replace(/ END IF;$/,''));
 assert.ok(s.includes(delegate));
 assert.match(s,/ELSIF request\.action_scope_json->>'operation'='reviewUnderstanding' THEN/);
 assert.match(s,/NOT COALESCE\(anvil\.fn09_understanding_candidate_valid\(pid,rid\),false\) THEN RETURN false;/);
 assert.match(s,/SELECT b\.payload_json INTO candidate FROM anvil\.understanding_review_approval_candidates b WHERE b\.project_id=pid AND b\.request_id=rid/);
 for(const fence of ['b.request_command_id=source_id','b.candidate_command_id=r.candidate_command_id','b.created_by=recipient','b.client_id=r.client_id','b.control_generation=c.control_generation','b.policy_ref=c.policy_ref',"b.payload_hash=scope->>'payloadHash'","anvil.execution_json_hash(candidate->'payload') IS DISTINCT FROM scope->>'payloadHash'","jsonb_build_object('details',q->'details','candidatePayload',candidate)"])assert.ok(s.includes(fence),fence);
 const legacy=await source(),sharedStart='IF (r.id IS NOT NULL AND c.id IS NOT NULL AND ar.id IS NOT NULL',sharedEnd='payload:=jsonb_build_object';
 assert.ok(s.includes(legacy.slice(legacy.indexOf(sharedStart),legacy.indexOf(sharedEnd,legacy.indexOf(sharedStart))).trim()),'기존 origin metadata/issuer/receipt 검산을 동일하게 유지한다');
 const finalStart="original:=jsonb_build_object('schemaVersion',1,'projectId',pid",finalEnd='EXCEPTION WHEN OTHERS';
 const originalGuard=legacy.slice(legacy.indexOf(finalStart),legacy.indexOf(finalEnd,legacy.indexOf(finalStart))).trim();
 const exactAuditStart='AND (SELECT count(*)=1 FROM anvil.audit_events e WHERE e.project_id=pid AND e.command_id=source_id AND e.operation_id=c.operation_id';
 const auditGuard=originalGuard
  .replace(exactAuditStart,'AND (SELECT count(*)=1 AND count(*) FILTER (WHERE e.operation_id=c.operation_id')
  .replace('AND e.approval_ref IS NULL AND e.scope_digest=digest))','AND e.approval_ref IS NULL AND e.scope_digest=digest)=1 FROM anvil.audit_events e WHERE e.project_id=pid AND e.command_id=source_id AND e.correction_of IS NULL))');
 assert.notEqual(auditGuard,originalGuard);
 assert.ok(s.includes(auditGuard),'명령/결과/hash 검산을 유지하고 정정 기록을 제외한 원감사의 총수와 일치 수가 각각 1이어야 한다');
});

test('0108은 0107의 보호와 기존 분기를 유지하고 백업 정책 평면 후보만 추가한다',async()=>{
 const flat=(v:string)=>v.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
 const old=flat(await readFile(new URL('../../../db/migrations/0107_approval_notification_understanding_origin.sql.pending',import.meta.url),'utf8'));
 const next=flat(await readFile(new URL('../../../db/migrations/0108_approval_notification_backup_policy_origin.sql.pending',import.meta.url),'utf8'));
 const previousBranch="ELSIF request.action_scope_json->>'operation'='reviewUnderstanding' THEN";
 const newBranch="ELSIF request.action_scope_json->>'operation' IN('reviewUnderstanding','saveBackupPolicy') THEN";
 const validator="IF NOT COALESCE(anvil.fn09_understanding_candidate_valid(pid,rid),false) THEN RETURN false;END IF;";
 const envelope="payload:=jsonb_build_object('details',q->'details','candidatePayload',candidate);";
 const selector="IF request.action_scope_json->>'operation'='reviewUnderstanding' THEN";
 const start=next.indexOf(selector),middle=next.indexOf(' ELSE ',start),end=next.indexOf(' END IF; '+envelope,middle);
 assert.ok(start>0&&middle>start&&end>middle);
 const understanding=next.slice(start+selector.length,middle).trim();
 const expectedUnderstanding=old.slice(old.indexOf(validator),old.indexOf(envelope)).trim();
 assert.equal(understanding,expectedUnderstanding);
 assert.equal(next.slice(0,start).replace(newBranch,previousBranch)+understanding+' '+next.slice(end+' END IF; '.length),old);
 const backup=next.slice(middle,end);
 assert.match(backup,/NOT COALESCE\(anvil\.fn16_policy_candidate_valid\(pid,rid\),false\) THEN RETURN false;/);
 for(const fence of [
  'SELECT b.payload_json INTO candidate FROM anvil.backup_policy_approval_candidates b WHERE b.project_id=pid AND b.request_id=rid',
  'b.request_command_id=source_id','b.candidate_command_id=r.candidate_command_id','b.created_by=recipient','b.client_id=r.client_id','b.control_generation=c.control_generation','b.policy_ref=c.policy_ref',
  "b.payload_hash=scope->>'payloadHash'","candidate IS NULL OR anvil.execution_json_hash(candidate) IS DISTINCT FROM scope->>'payloadHash'"
 ])assert.ok(backup.includes(fence),fence);
 assert.doesNotMatch(backup,/\b(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|EXECUTE)\b/);
});

test('0109는 참여자 변경 후보와 당시 고정 버전만 추가하고 기존 원인 검산을 유지한다',async()=>{
 const flat=(v:string)=>v.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
 const old=flat(await readFile(new URL('../../../db/migrations/0108_approval_notification_backup_policy_origin.sql.pending',import.meta.url),'utf8'));
 const next=flat(await readFile(new URL('../../../db/migrations/0109_approval_notification_membership_origin.sql.pending',import.meta.url),'utf8'));
 const membership="IF request.action_scope_json->>'operation'='saveProjectMembership' THEN",understanding=" ELSIF request.action_scope_json->>'operation'='reviewUnderstanding' THEN";
 const begin=next.indexOf(membership),end=next.indexOf(understanding,begin);
 assert.ok(begin>0&&end>begin);
 const key="ARRAY['id','version','status','projectId','details','scopeDigest','requiredDecider','policyRef','requestedBy','controlGeneration','createdAt']";
 const membershipKey=" || CASE WHEN request.action_scope_json->>'operation'='saveProjectMembership' THEN ARRAY['membershipCandidate'] ELSE ARRAY[]::text[] END";
 assert.equal((next.slice(0,begin)+next.slice(end+1).replace('ELSIF','IF')).replace(",'saveProjectMembership') THEN",') THEN').replace(key+membershipKey,key),old);
 const branch=next.slice(begin,end);
 for(const fence of [
  "q->'membershipCandidate'", 'anvil.fn74_payload_valid(candidate)', "'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE'",
  "'commandId',r.candidate_command_id", 'r.candidate_command_id=c.command_id', "'clientId',c.client_id", "'controlGeneration',c.control_generation",
  "'payloadHash',anvil.fn01_hash(candidate)", "'requestedSubjectRef',q->'requestedBy'", "'targetRef',base_ref",
  "base->>'kind'='NEW'", "command->'targetId' IS DISTINCT FROM 'null'::jsonb", "command->'expectedVersion' IS DISTINCT FROM '0'::jsonb",
  "base->>'kind' IS DISTINCT FROM 'EXISTING'", 'FROM anvil.project_membership_versions', 'v.project_id=pid AND v.user_id=target AND v.version=',
  "version_snapshot->>'projectId' IS DISTINCT FROM pid::text", "version_snapshot->>'userId' IS DISTINCT FROM target::text",
  "version_snapshot->'version' IS DISTINCT FROM base_ref->'version'", "version_snapshot->'participation' IS DISTINCT FROM base->'participation'",
  "version_snapshot->'revokedAt' IS DISTINCT FROM 'null'::jsonb", "anvil.fn01_hash(version_snapshot) IS DISTINCT FROM base_ref->>'contentHash'"
 ])assert.ok(branch.includes(fence),fence);
 assert.doesNotMatch(branch,/fn74_candidate_valid|fn74_manager|current_setting|clock_timestamp|FROM anvil\.(?:project_members|project_control|users)\b/i);
 assert.doesNotMatch(branch,/\b(?:ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|EXECUTE)\b/i);
});
