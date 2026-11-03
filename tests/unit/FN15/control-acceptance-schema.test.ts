import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const sql=()=>readFile(new URL('../../../db/migrations/0073_control_handoff_acceptance.sql.pending',import.meta.url),'utf8');
test('0073 미적용 source는 FN15 전용 SELECT 역할/명시 RLS·fixed reader와 postflight를 닫는다',async()=>{
 const s=await sql();assert.match(s,/BEGIN;/);assert.match(s,/NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/);assert.match(s,/session_user<>'anvil_v3_app'/);assert.match(s,/fn01_active/);assert.match(s,/fn15_handoff_facts/);assert.match(s,/fn15_handoff_writer_command/);assert.match(s,/fn15_reader_postflight/);assert.doesNotMatch(s,/ALTER TABLE[^;]+DISABLE ROW LEVEL SECURITY/);assert.doesNotMatch(s,/GRANT[^;]+reader_owner TO anvil_v3_app/);
});
test('F complete는 legacy/실제새행/미생성예약/최초control anchor를 disjoint 검산한다',async()=>{
 const s=await sql();for(const name of ['fn15_storage_actual','fn15_storage_future','fn15_legacy_projection','fn15_storage_anchor','quota_complete_before_source','quota_adopt_creation','fn15_creation_anchor_guard'])assert.ok(s.includes(name),name);
 assert.match(s,/initial_manifest_json/);assert.match(s,/Factual/);assert.match(s,/Ffuture/);assert.match(s,/DEFERRABLE INITIALLY DEFERRED/);assert.match(s,/next_generation/);assert.match(s,/CONTROL_ACCEPTANCE_BASIS/);
});


test('정적: reader 소유역할의 열별 SELECT 권한은 실제 scope projection과 일치한다',async()=>{
 const text=await sql(),scope=text.slice(text.indexOf('CREATE FUNCTION anvil.fn15_handoff_scope('),text.indexOf('ALTER FUNCTION anvil.fn15_handoff_scope('));
 assert.doesNotMatch(scope,/SELECT \* INTO (?:session|member) FROM anvil\.(?:auth_sessions|project_members)/);
 assert.match(scope,/SELECT id,user_id,client_id,reauth_until INTO session FROM anvil.auth_sessions/);
 assert.match(scope,/SELECT project_id,user_id,participation,revoked_at INTO member FROM anvil.project_members/);
 assert.match(scope,/member record;session record/);
});


test('정적: 0073은 단일 COMMIT 전 postflight를 닫고 service가 실제 raw LF checksum을 소비한다',async()=>{
 const {createHash}=await import('node:crypto'),raw=await readFile(new URL('../../../db/migrations/0073_control_handoff_acceptance.sql.pending',import.meta.url)),text=raw.toString('utf8'),service=await readFile(new URL('../../../apps/server/modules/control-handoff/control-acceptance.ts',import.meta.url),'utf8');
 assert.equal(text.includes('\r'),false);assert.match(text,/END;\$fn15_reader_postflight\$;\nCOMMIT;\n$/);assert.equal((text.match(/^COMMIT;$/gm)??[]).length,1);
 const checksum=createHash('sha256').update(raw).digest('hex');assert.ok(service.includes("controlAcceptanceChecksum='"+checksum+"'"));assert.equal(service.includes('UNWRITTEN_SOURCE'),false);
});

test('정적: 원자 수락은 실제 current tuple의 before/next와 handoff 역방향을 모두 검사한다',async()=>{
 const s=await sql();assert.match(s,/CREATE TRIGGER fn15_control_transition BEFORE UPDATE ON anvil.project_control/);assert.match(s,/CREATE CONSTRAINT TRIGGER fn15_control_transition_final AFTER UPDATE ON anvil.project_control DEFERRABLE INITIALLY DEFERRED/);
 const body=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_control_transition_guard('),s.indexOf('CREATE FUNCTION anvil.fn15_metadata_immutable('));
 for(const item of ["h.snapshot_json->'previousControl' IS NOT DISTINCT FROM anvil.fn15_basis(OLD)","h.snapshot_json->'nextControl' IS NOT DISTINCT FROM anvil.fn15_basis(NEW)",'h.accepted_at IS NOT DISTINCT FROM NEW.issued_at','NEW.generation IS DISTINCT FROM OLD.generation+1','NEW.version IS DISTINCT FROM OLD.version+1','anvil.fn15_command_complete(NEW.project_id,h.command_id)'])assert.ok(body.includes(item),item);
 const final=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_metadata_final('),s.indexOf('CREATE CONSTRAINT TRIGGER fn15_protected_summary_final'));
 assert.ok(final.includes("TG_TABLE_NAME='control_handoffs'"));assert.ok(final.includes("NEW.snapshot_json->'nextControl'"));assert.ok(final.includes('FN15_CONTROL_CAS_INCOMPLETE'));
});

test('정적: 구·신 FN15 namespace 충돌은 양 INSERT에서 동일 잠금/원행을 검사하고 reader 순수helper 권한도 닫는다',async()=>{
 const s=await sql();for(const name of ['fn15_source_command_namespace','fn15_accept_command_namespace'])assert.ok(s.includes('CREATE TRIGGER '+name+' BEFORE INSERT'));
 const body=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_command_namespace_guard('),s.indexOf('CREATE FUNCTION anvil.fn15_control_transition_guard('));
 assert.match(body,/pg_advisory_xact_lock/);assert.match(body,/FROM anvil.control_handoff_source_commands WHERE command_id=NEW.command_id/);assert.match(body,/FROM anvil.control_handoff_acceptance_commands WHERE command_id=NEW.command_id/);assert.match(body,/FN15_COMMAND_NAMESPACE_CONFLICT/);
 assert.match(s,/GRANT EXECUTE ON FUNCTION anvil.fn01_json\(jsonb\),anvil.fn01_hash\(jsonb\),anvil.fn15_basis\(anvil.project_control\) TO anvil_v3_fn15_reader_owner;/);
});


test('정적: namespace는 오래된 snapshot 격리를 거절하고 VOLATILE lock 뒤 조회로 제한한다',async()=>{
 const s=await sql(),body=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_command_namespace_guard('),s.indexOf('CREATE FUNCTION anvil.fn15_control_transition_guard('));
 assert.ok(body.includes("current_setting('transaction_isolation')<>'read committed'"));assert.ok(body.indexOf('FN15_NAMESPACE_ISOLATION_REQUIRED')<body.indexOf('pg_advisory_xact_lock'));assert.ok(body.indexOf('pg_advisory_xact_lock')<body.indexOf('FROM anvil.control_handoff_acceptance_commands'));assert.match(body,/RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER/);
});


test('정적: 문서 목적helper는 실session·고정purpose/상한·private grant를 소비하고 invoker 원조건을 보존한다',async()=>{
 const s=await sql();assert.ok(s.includes('CREATE FUNCTION anvil.fn15_ordinary_document_command_current(pid uuid,cid uuid,op text) RETURNS boolean'));
 const helper=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_ordinary_document_command_current('),s.indexOf('CREATE OR REPLACE FUNCTION anvil.document_command_authorized('));
 for(const part of ['SECURITY DEFINER','VOLATILE','SET search_path=pg_catalog','anvil.fn15_document_context','2097314','2097152','FN15_ORDINARY_DOCUMENT_WRITE','anvil.fn01_active(','anvil.fn15_grant_current('])assert.ok(helper.includes(part),part);
 assert.ok(s.includes('REVOKE ALL ON FUNCTION anvil.fn15_ordinary_document_command_current(uuid,uuid,text) FROM PUBLIC;'));assert.ok(s.includes('GRANT EXECUTE ON FUNCTION anvil.fn15_ordinary_document_command_current(uuid,uuid,text) TO anvil_v3_app;'));
 for(const name of ['document_command_authorized','guard_project_document_review']){const start=s.lastIndexOf('CREATE OR REPLACE FUNCTION anvil.'+name+'(');assert.ok(start>=0);const body=s.slice(start,s.indexOf('$$;',start)+3);assert.ok(body.includes("participation='OWNER'"));assert.ok(body.includes('anvil.fn15_ordinary_document_command_current('));assert.equal(body.includes('SECURITY DEFINER'),false);}
});


test('정적: 원 fn01_active의 정확 42501 거절만 false이며 query_cancel/다른DB오류는 재발생한다',async()=>{
 const s=await sql(),body=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_ordinary_document_command_current('),s.indexOf('ALTER FUNCTION anvil.fn15_ordinary_document_command_current(')),original=await readFile(new URL('../../../db/migrations/0042_draft_artifact_storage.sql.pending',import.meta.url),'utf8');
 const active=original.slice(original.indexOf('CREATE FUNCTION anvil.fn01_active('),original.indexOf('CREATE FUNCTION',original.indexOf('CREATE FUNCTION anvil.fn01_active(')+1));
 assert.match(active,/FN01_APP_SESSION_REQUIRED[^;]+42501/);assert.match(active,/FN01_ACTIVE_SESSION_REQUIRED[^;]+42501/);assert.match(body,/WHEN insufficient_privilege THEN/);assert.match(body,/IF SQLERRM IN\('FN01_ACTIVE_SESSION_REQUIRED','FN01_APP_SESSION_REQUIRED'\) THEN RETURN false;END IF;\s*RAISE;/);assert.doesNotMatch(body,/WHEN (?:OTHERS|query_canceled|raise_exception)/);
});


test('정적: 두 forward의 HE membership delta를 역치환하면 기존 invoker 함수 원문이 정확 복원된다',async()=>{
 const s=await sql();
 const cases=[{name:'document_command_authorized',file:'0003_document_confirmations.sql',replacement:"(m.participation='OWNER' OR(m.participation='HANDOFF_ELIGIBLE' AND op IN('saveDocumentDraft','confirmDocument','proposeDocumentChange') AND anvil.fn15_ordinary_document_command_current(pid,c.id,op)))"},{name:'guard_project_document_review',file:'0003_project_document_reviews.sql',replacement:"(m.participation='OWNER' OR(m.participation='HANDOFF_ELIGIBLE' AND anvil.fn15_ordinary_document_command_current(NEW.project_id,c.id,'recordContentReview')))"}];
 for(const item of cases){const original=(await readFile(new URL('../../../db/migrations/'+item.file,import.meta.url),'utf8')).replaceAll('\r\n','\n');const begin=original.indexOf('CREATE FUNCTION anvil.'+item.name+'('),expected=original.slice(begin,original.indexOf('$$;',begin)+3);const after=s.lastIndexOf('CREATE OR REPLACE FUNCTION anvil.'+item.name+'('),body=s.slice(after,s.indexOf('$$;',after)+3);assert.equal(body.split(item.replacement).length,2);assert.equal(body.replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION').replace(item.replacement,"m.participation='OWNER'"),expected);}
 const helper=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_ordinary_document_command_current('),s.indexOf('ALTER FUNCTION anvil.fn15_ordinary_document_command_current('));
 assert.ok(helper.indexOf('2097314')<helper.indexOf('context=raw::jsonb'));for(const required of ["anvil.fn01_json(context) IS DISTINCT FROM raw","c.request_hash IS DISTINCT FROM anvil.fn01_hash(q)","actual_generation IS DISTINCT FROM generation","pc.generation IS DISTINCT FROM c.control_generation","ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)"])assert.ok(helper.includes(required),required);
 assert.doesNotMatch(helper,/GRANT|CREATE POLICY|SET ROLE/);
});


test('정적 import 연결: 최종0072 regular membership delta만 forward하고 COLLECT/Owner/invoker 원문은 동일하다',async()=>{
 const s=await sql(),original=(await readFile(new URL('../../../db/migrations/0072_document_source_observation.sql.pending',import.meta.url),'utf8')).replaceAll('\r\n','\n'),head='CREATE OR REPLACE FUNCTION anvil.guard_document_import_write()',start=original.lastIndexOf(head),before=original.slice(start,original.indexOf('$$;',start)+3),at=s.lastIndexOf(head);assert.ok(at>=0,'최종0072 import guard forward 없음');
 const body=s.slice(at,s.indexOf('$$;',at)+3),delta="(m.participation='OWNER' OR(m.participation='HANDOFF_ELIGIBLE' AND c.operation IN('importDocument','saveDocumentDraft') AND anvil.fn15_ordinary_document_command_current(NEW.project_id,c.id,c.operation)))";
 assert.equal(body.split(delta).length,2);assert.equal(body.replace(delta,"m.participation='OWNER'"),before);const boundary="IF current_user<>'anvil_v3_app'";assert.equal(body.slice(0,body.indexOf(boundary)),before.slice(0,before.indexOf(boundary)));assert.doesNotMatch(body,/SECURITY DEFINER/);
 const helper=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_ordinary_document_command_current('),s.indexOf('ALTER FUNCTION anvil.fn15_ordinary_document_command_current('));assert.ok(helper.includes("op NOT IN('saveDocumentDraft','recordContentReview','confirmDocument','proposeDocumentChange','importDocument')"));
});


test('정적 import 연결: 원request file/form·null/0·save 선택과 receipt를 결박하며 FAILED/UNSUPPORTED 보관을 제한하지 않는다',async()=>{
 const s=await sql(),body=s.slice(s.indexOf('CREATE FUNCTION anvil.fn15_ordinary_document_command_current('),s.indexOf('ALTER FUNCTION anvil.fn15_ordinary_document_command_current('));
 for(const part of ["q->'targetId' IS DISTINCT FROM 'null'::jsonb","q->'expectedVersion' IS DISTINCT FROM '0'::jsonb","ARRAY['fileRef','intendedFormRef','sourceRefs']","q->'payload'->'sourceRefs' IS DISTINCT FROM '[]'::jsonb","q->'payload'->'fileRef' IS DISTINCT FROM c.result_ref->'data'->'candidate'->'originalRef'","q->'payload'->'intendedFormRef' IS DISTINCT FROM c.result_ref->'data'->'candidate'->'intendedFormRef'","q->'payload'->'importCandidateRef' IS DISTINCT FROM c.result_ref->'data'->'importCandidateRef'"])assert.ok(body.includes(part),part);
 const at=body.indexOf("IF op='importDocument'"),end=body.indexOf('END IF;',at);assert.doesNotMatch(body.slice(at,end),/candidate[^;]*status[^;]*READY/);assert.ok(body.includes("WHEN insufficient_privilege THEN"));assert.ok(body.includes("RAISE;"));
});
