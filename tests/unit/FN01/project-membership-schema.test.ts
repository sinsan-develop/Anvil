import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
test('0074는 기존회원 anchor/불변 version·양방향 완결/원명령보호·마지막OWNER와 checksum을 닫는다',async()=>{const raw=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url)).catch(e=>{if(e.code==='ENOENT')return null;throw e;});assert.ok(raw,'0074 미구현');const sql=raw.toString('utf8');for(const name of ['project_membership_versions','fn74_member_guard','fn74_membership_complete','fn74_version_final','fn74_command_final','fn74_creation_anchor','membershipCandidate','one_time_consumption_command_before_membership'])assert.ok(sql.includes(name),name);assert.equal(sql.includes('\r'),false);assert.match(sql,/COMMIT;\n$/);const service=await readFile(new URL('../../../apps/server/modules/projects/project-memberships.ts',import.meta.url),'utf8');assert.ok(service.includes("membershipChecksum='"+createHash('sha256').update(raw).digest('hex')+"'"));});

test('정적: 기존승인 연산은 원 helper로 위임하고 membership만 원문/현재성·정책 SELECT RLS를 소비한다',async()=>{const sql=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url),'utf8');for(const part of ["scope->>'operation' IS DISTINCT FROM 'saveProjectMembership' THEN RETURN anvil.connection_candidate_approval_target_before_membership(pid,scope)","c.operation IS DISTINCT FROM 'saveProjectMembership' THEN RETURN anvil.one_time_consumption_command_before_membership(pid,cid,did)",'anvil.one_time_decision_command_before_membership(pid,cid)','anvil.fn74_candidate_valid(pid,r.request_json','c.request_hash IS DISTINCT FROM anvil.fn01_hash(original_request)',"ELSIF NEW.request_json?'membershipCandidate'",'anvil.fn74_command_valid(v.project_id,NEW.id,v.snapshot_json)','FORCE ROW LEVEL SECURITY','TO anvil_v3_migrator USING(true) WITH CHECK(true)','MEMBERSHIP_FUNCTION_POSTFLIGHT_FAILED','MEMBERSHIP_PURPOSE_EXECUTE_POSTFLIGHT_FAILED'])assert.ok(sql.includes(part),part);const manager=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn74_manager'),sql.indexOf('REVOKE ALL ON FUNCTION anvil.fn74_manager'));for(const part of ['anvil.fn01_active','t.reauth_until>clock_timestamp()','permission_policy_versions',"r->>'disposition' IN('AUTO','REQUIRE_APPROVAL')","r->>'disposition'='DENY'"])assert.ok(manager.includes(part),part);assert.equal((sql.match(/^COMMIT;$/gm)??[]).length,1);assert.doesNotMatch(sql,/BYPASSRLS|CREATE ROLE|GRANT[^;]*TO PUBLIC/);});

test('정적: legacy/생성계보 anchor는 현재 관측시각을 기록하고 joined_at의 과거 역할로 소급하지 않는다',async()=>{const sql=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url),'utf8'),body=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn74_anchor('),sql.indexOf('REVOKE ALL ON FUNCTION anvil.fn74_anchor('));assert.match(body,/observed_at timestamptz=date_trunc\('milliseconds',clock_timestamp\(\)\)/);assert.ok(body.includes("'recordedAt',to_char(observed_at AT TIME ZONE 'UTC'"));assert.ok(body.includes('gen_random_uuid(),NULL,observed_at)'));assert.doesNotMatch(body,/m\.joined_at/);});


test('정적 역할폐쇄: 최초 policy없는 생성/legacy의 지연 version final만 비공개 integrity 소유자로 물리closure를 읽는다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url),'utf8');
 const final=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn74_version_final()'),sql.indexOf('CREATE CONSTRAINT TRIGGER fn74_version_final'));
 assert.match(final,/RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog/);
 assert.ok(sql.includes('ALTER FUNCTION anvil.fn74_version_final() OWNER TO anvil_v3_migrator;'));
 assert.match(sql,/REVOKE ALL ON FUNCTION [^;]*anvil\.fn74_version_final\(\)[^;]* FROM PUBLIC,anvil_v3_app;/);
 assert.ok(sql.includes("'anvil.fn74_version_final()'::regprocedure"));
 assert.ok(sql.includes("pg_catalog.has_function_privilege('anvil_v3_app','anvil.fn74_version_final()','EXECUTE')"));
 assert.doesNotMatch(final,/INSERT|UPDATE|DELETE|set_config|fn74_manager/);assert.ok(final.includes('anvil.fn74_membership_complete(NEW.project_id,NEW.user_id)'));assert.ok(final.includes('MEMBERSHIP_VERSION_ORPHAN'));
 const complete=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn74_membership_complete('),sql.indexOf('CREATE FUNCTION anvil.fn74_creation_anchor('));
 assert.ok(complete.includes('anvil.project_membership_versions'));assert.ok(complete.includes('anvil.project_members'));assert.ok(complete.includes('anvil.fn01_hash'));
 for(const name of ['fn74_version_guard','fn74_member_guard','fn74_command_final']){const f=sql.slice(sql.indexOf('CREATE FUNCTION anvil.'+name+'()'),sql.indexOf('$$;',sql.indexOf('CREATE FUNCTION anvil.'+name+'()'))+3);assert.doesNotMatch(f,/SECURITY DEFINER/);}
 // source로부터 고정한 역할/조회 모델이며 PostgreSQL trigger/RLS 실행 증거가 아니다.
 const integrityOwner=/SECURITY DEFINER/.test(final)&&sql.includes('ALTER FUNCTION anvil.fn74_version_final() OWNER TO anvil_v3_migrator;');
 const visible=(policy:boolean)=>integrityOwner||policy;
 const closure=(policy:boolean,versionPresent:boolean,memberVersion:number,snapshotVersion:number,hashMatches:boolean)=>visible(policy)&&versionPresent&&memberVersion===snapshotVersion&&hashMatches;
 assert.equal(closure(false,true,1,1,true),true,'firstCreateNoPolicy');assert.equal(closure(false,true,5,5,true),true,'LEGACY');
 assert.equal(closure(false,false,1,1,true),false,'missing physical version');assert.equal(closure(false,true,2,1,true),false,'forged member head');assert.equal(closure(false,true,1,1,false),false,'wrong snapshot hash');
});


test('정적: 회원 완결 SQL의 중첩 EXISTS 식은 문자열 밖 괄호가 대응한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url),'utf8');
 const from=sql.indexOf('CREATE FUNCTION anvil.fn74_membership_complete('),end=sql.indexOf('$$;',from);assert(from>=0&&end>from);
 const body=sql.slice(sql.indexOf('AS $$',from)+5,end).replace(/'(?:''|[^'])*'/g,"''");let depth=0;
 for(const char of body){if(char==='(')depth++;else if(char===')')depth--;assert(depth>=0,'회원 완결식에 대응하는 열기 없는 닫는 괄호가 있다');}
 assert.equal(depth,0);
});

test('정적: 회원 완결 SQL 한 문자 역삽입은 원 필드·guard·ACL 전체를 복원한다',async()=>{
 const raw=await readFile(new URL('../../../db/migrations/0074_project_membership_versions.sql.pending',import.meta.url)),sql=raw.toString('utf8'),fixed="'contentHash',old.content_hash))))));";
 assert.equal(sql.split(fixed).length,2);const parent=sql.replace(fixed,()=>"'contentHash',old.content_hash)))))));");
 assert.equal(raw.length,33601);assert.equal(Buffer.byteLength(parent),33602);
 assert.equal(createHash('sha256').update(parent,'utf8').digest('hex'),'67696fdd3695199e2be3450669d903bd286e6d87fe05361b7b2a75ce58a3eb96');
});
