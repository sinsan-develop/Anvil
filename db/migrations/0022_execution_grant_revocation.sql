-- P1 C3 합성 grant 회수 불변기록. 정식 DB/실제 credential·OS·Agent는 활성화하지 않는다.
-- 기존 파일/원 grant·writer·ACK는 보존한다. 회수기록 자체는 프로세스 종료나 writer 해제 증거가 아니다.
CREATE TABLE anvil.execution_grant_revocations (
 project_id uuid NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 execution_id uuid NOT NULL,generation bigint NOT NULL,grant_id uuid NOT NULL,grant_version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,created_command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,grant_id,grant_version),UNIQUE(project_id,created_command_id),
 FOREIGN KEY(project_id,grant_id,grant_version,execution_id,generation) REFERENCES anvil.execution_grants(project_id,id,version,execution_id,generation),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),
 FOREIGN KEY(project_id,created_command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.execution_grant_revocations TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.execution_grant_revocations FROM anvil_v3_app;

CREATE FUNCTION anvil.grant_revocation_policy_deadline(rules jsonb,pid uuid,eid uuid,generation bigint,actor uuid,op text,budget_ref jsonb,scopes jsonb,at_time timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rule jsonb;scope jsonb;requested jsonb;target jsonb;base jsonb;allowed_scopes jsonb='[]'::jsonb;rule_deadline timestamptz;deadline timestamptz;overlap boolean;
BEGIN
 IF rules IS NULL OR pid IS NULL OR eid IS NULL OR actor IS NULL OR at_time IS NULL OR generation IS NULL OR generation NOT BETWEEN 1 AND 9007199254740991
  OR op IS NULL OR op NOT IN('revokeExecutionGrant') OR jsonb_typeof(rules) IS DISTINCT FROM 'array' OR jsonb_array_length(rules)>200
  OR NOT anvil.execution_preparation_ref_valid(budget_ref) OR NOT anvil.execution_source_scopes_valid(scopes) THEN RETURN NULL;END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(rules) LOOP
  IF jsonb_typeof(rule) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(rule))<>7
   OR NOT(rule ?& ARRAY['ruleId','subjectRef','operations','targetScopes','disposition','limitPolicyRef','expiresAt'])
   OR jsonb_typeof(rule->'disposition') IS DISTINCT FROM 'string' OR rule->>'disposition' NOT IN('AUTO','DENY','REQUIRE_APPROVAL')
   OR jsonb_typeof(rule->'operations') IS DISTINCT FROM 'array' OR jsonb_array_length(rule->'operations') NOT BETWEEN 1 AND 200
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(rule->'operations') x WHERE jsonb_typeof(x)<>'string')
   OR jsonb_typeof(rule->'targetScopes') IS DISTINCT FROM 'array' OR jsonb_array_length(rule->'targetScopes')<>1 THEN RETURN NULL;END IF;
  scope=rule->'targetScopes'->0;
  IF scope->>'kind'='PROJECT' THEN
   IF rule->'limitPolicyRef' IS DISTINCT FROM 'null'::jsonb OR (rule->'operations') ?| ARRAY['authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery'] THEN RETURN NULL;END IF;
   CONTINUE;
  END IF;
  IF jsonb_typeof(scope) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(scope))<>5
   OR NOT(scope ?& ARRAY['kind','projectId','executionId','executionGeneration','sourceScopes']) OR scope->'kind' IS DISTINCT FROM '"EXECUTION"'::jsonb
   OR NOT anvil.execution_preparation_ref_valid(rule->'limitPolicyRef') OR NOT anvil.execution_source_scopes_valid(scope->'sourceScopes')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(rule->'operations') x WHERE x NOT IN('authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery')) THEN RETURN NULL;END IF;
  IF rule->'subjectRef' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',actor) OR scope->'projectId' IS DISTINCT FROM to_jsonb(pid)
   OR scope->'executionId' IS DISTINCT FROM to_jsonb(eid) OR scope->'executionGeneration' IS DISTINCT FROM to_jsonb(generation) OR NOT((rule->'operations') ? op) THEN CONTINUE;END IF;
  IF jsonb_typeof(rule->'expiresAt') IS DISTINCT FROM 'string' OR rule->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' THEN RETURN NULL;END IF;
  rule_deadline=(rule->>'expiresAt')::timestamptz;IF rule_deadline<=at_time THEN CONTINUE;END IF;
  overlap=false;
  FOR requested IN SELECT value FROM jsonb_array_elements(scopes) LOOP
   FOR target IN SELECT value FROM jsonb_array_elements(requested->'targets') LOOP
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'sourceScopes') b WHERE anvil.execution_source_target_matches(b,requested,target,true)) THEN overlap=true;END IF;
   END LOOP;
  END LOOP;
  IF rule->>'disposition'='DENY' AND overlap THEN RETURN NULL;END IF;
  IF rule->'limitPolicyRef' IS DISTINCT FROM budget_ref THEN CONTINUE;END IF;
  IF rule->>'disposition'='REQUIRE_APPROVAL' AND overlap THEN RETURN NULL;END IF;
  IF rule->>'disposition' IN('AUTO','REQUIRE_APPROVAL') THEN
   deadline=CASE WHEN deadline IS NULL THEN rule_deadline ELSE LEAST(deadline,rule_deadline) END;
   IF rule->>'disposition'='AUTO' THEN allowed_scopes=allowed_scopes||(scope->'sourceScopes');END IF;
  END IF;
 END LOOP;
 FOR requested IN SELECT value FROM jsonb_array_elements(scopes) LOOP
  FOR target IN SELECT value FROM jsonb_array_elements(requested->'targets') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(allowed_scopes) b WHERE anvil.execution_source_target_matches(b,requested,target,false)) THEN RETURN NULL;END IF;
  END LOOP;
 END LOOP;
 RETURN deadline;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;


CREATE FUNCTION anvil.check_execution_grant_revocation(pid uuid,cid uuid,row_json jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;g anvil.execution_grants%ROWTYPE;h anvil.auth_sessions%ROWTYPE;
 policy anvil.permission_policy_versions%ROWTYPE;budget anvil.limit_policy_versions%ROWTYPE;
 s jsonb;req jsonb;p jsonb;r jsonb;b jsonb;scope jsonb;expected jsonb;subject jsonb;scopes jsonb;digest text;deadline timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 PERFORM id FROM anvil.projects WHERE id=pid AND archived_at IS NULL FOR UPDATE;IF NOT FOUND THEN RETURN false;END IF;
 s=row_json->'snapshot_json';req=s->'request';p=req->'payload';r=s->'requestedBy';b=s->'currentBinding';
 scope=jsonb_build_object('projectId',pid,'executionId',row_json->'execution_id','executionGeneration',row_json->'generation');
 expected=jsonb_build_object('id',row_json->'id','version',1,'contentHash',row_json->'content_hash');
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.id IS NULL OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR c.actor_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR c.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
  OR c.operation IS DISTINCT FROM 'revokeExecutionGrant' OR c.state IS DISTINCT FROM 'APPLIED' OR c.scope_kind IS DISTINCT FROM 'PROJECT' OR c.scope_id IS DISTINCT FROM pid OR c.approval_consumption_id IS NOT NULL OR c.payload_ref IS NOT NULL
  OR row_json->'project_id' IS DISTINCT FROM to_jsonb(pid) OR row_json->'created_command_id' IS DISTINCT FROM to_jsonb(cid) OR row_json->'version' IS DISTINCT FROM '1'::jsonb OR row_json->'generation' IS DISTINCT FROM to_jsonb(c.expected_version)
  OR row_json->'created_by' IS DISTINCT FROM to_jsonb(c.actor_id) OR row_json->'client_id' IS DISTINCT FROM to_jsonb(c.client_id)
  OR NOT anvil.execution_preparation_ref_valid(expected) OR row_json->>'content_hash' IS DISTINCT FROM anvil.execution_json_hash(s)
  OR NOT anvil.execution_json_shape(s,ARRAY['transport','state','scope','request','requestHash','requestedBy','currentBinding','reason','recordedAt','authorityExpiresAt','revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed'])
  OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->>'state' IS DISTINCT FROM 'SYNTHETIC_REVOCATION_STORED' OR s->'scope' IS DISTINCT FROM scope
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed']) k WHERE s->k IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->k IS DISTINCT FROM 'false'::jsonb)
  OR octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR NOT anvil.execution_json_shape(req,ARRAY['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  OR req->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR req->'projectId' IS DISTINCT FROM to_jsonb(pid) OR req->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR req->'clientId' IS DISTINCT FROM to_jsonb(c.client_id)
  OR req->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation) OR req->>'operation' IS DISTINCT FROM 'revokeExecutionGrant' OR req->'targetId' IS DISTINCT FROM row_json->'execution_id' OR req->'expectedVersion' IS DISTINCT FROM row_json->'generation'
  OR req->'baselineRefs' IS DISTINCT FROM '[]'::jsonb OR req->'approvalRef' IS DISTINCT FROM 'null'::jsonb OR s->>'requestHash' IS DISTINCT FROM c.request_hash OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(req)
  OR NOT anvil.execution_json_shape(p,ARRAY['grantRef','permissionPolicyRef','budgetPolicyRef','reason']) OR jsonb_typeof(p->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(p->>'reason') OR s->'reason' IS DISTINCT FROM p->'reason'
  OR NOT anvil.execution_json_shape(r,ARRAY['userId','clientId','humanSessionId','credentialGeneration','controlGeneration']) OR r->'userId' IS DISTINCT FROM to_jsonb(c.actor_id) OR r->'clientId' IS DISTINCT FROM to_jsonb(c.client_id) OR r->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation)
  OR NOT anvil.execution_json_shape(b,ARRAY['transport','scope','grantRef','grantKind','grantSubject','grantState','sourceScopes','permissionPolicyRef','budgetPolicyRef'])
  OR b->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR b->'scope' IS DISTINCT FROM scope OR jsonb_typeof(b->'grantState') IS DISTINCT FROM 'string' OR b->>'grantState' NOT IN('ACTIVE','EXPIRED')
  OR NOT anvil.execution_preparation_ref_valid(b->'grantRef') OR NOT anvil.execution_preparation_ref_valid(b->'permissionPolicyRef') OR NOT anvil.execution_preparation_ref_valid(b->'budgetPolicyRef') OR NOT anvil.execution_source_scopes_valid(b->'sourceScopes')
  OR p->'grantRef' IS DISTINCT FROM b->'grantRef' OR p->'permissionPolicyRef' IS DISTINCT FROM b->'permissionPolicyRef' OR p->'budgetPolicyRef' IS DISTINCT FROM b->'budgetPolicyRef' OR c.policy_ref IS DISTINCT FROM b->'permissionPolicyRef'
  OR NOT anvil.execution_iso_valid(s->'recordedAt') OR NOT anvil.execution_iso_valid(s->'authorityExpiresAt') OR (s->>'recordedAt')::timestamptz>at_time OR (s->>'recordedAt')::timestamptz<at_time-interval '30 seconds'
  OR (s->>'authorityExpiresAt')::timestamptz<=at_time OR (s->>'authorityExpiresAt')::timestamptz>(s->>'recordedAt')::timestamptz+interval '30 seconds'
  OR c.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR c.result_ref->'projectId' IS DISTINCT FROM to_jsonb(pid) OR c.result_ref->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR c.result_ref->'operationId' IS DISTINCT FROM to_jsonb(c.operation_id)
  OR c.result_ref->'targetId' IS DISTINCT FROM row_json->'id' OR c.result_ref->'version' IS DISTINCT FROM '1'::jsonb OR c.result_ref->'data'->'ref' IS DISTINCT FROM expected OR c.result_ref->'data'->'snapshot' IS DISTINCT FROM s OR c.result_ref->'data'->>'status' IS DISTINCT FROM 'SYNTHETIC_GRANT_REVOCATION_STORED' THEN RETURN false;END IF;
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND id=(row_json->>'grant_id')::uuid AND version=(row_json->>'grant_version')::bigint;
 IF g.id IS NULL OR g.execution_id::text IS DISTINCT FROM row_json->>'execution_id' OR to_jsonb(g.generation) IS DISTINCT FROM row_json->'generation'
  OR b->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash) OR b->'grantKind' IS DISTINCT FROM g.snapshot_json->'kind'
  OR g.snapshot_json->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json)
  OR NOT anvil.execution_iso_valid(g.snapshot_json->'expiresAt')
  OR b->>'grantState' IS DISTINCT FROM CASE WHEN (g.snapshot_json->>'expiresAt')::timestamptz<=(s->>'recordedAt')::timestamptz THEN 'EXPIRED' ELSE 'ACTIVE' END THEN RETURN false;END IF;
 IF g.snapshot_json->>'kind'='EXECUTION' THEN subject=g.snapshot_json->'binding'->'subject';scopes=g.snapshot_json->'binding'->'intent'->'sourceScopes';
 ELSIF g.snapshot_json->>'kind'='RECOVERY' THEN subject=(g.snapshot_json->'reviewer')-'kind';scopes=g.snapshot_json->'binding'->'sourceScopes';
 ELSE RETURN false;END IF;
 -- 현재 OWNER는 과거 다른 HUMAN이 발급한 grant도 명시 회수 정책으로 회수할 수 있다.
 IF b->'grantSubject' IS DISTINCT FROM subject OR b->'sourceScopes' IS DISTINCT FROM scopes THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id WHERE pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL AND m.participation='OWNER' AND m.revoked_at IS NULL) THEN RETURN false;END IF;
 SELECT hs.* INTO h FROM anvil.auth_sessions hs JOIN anvil.users u ON u.id=hs.user_id JOIN anvil.clients cl ON cl.id=hs.client_id AND cl.user_id=hs.user_id WHERE hs.id::text=r->>'humanSessionId' AND hs.user_id=c.actor_id AND hs.client_id=c.client_id AND hs.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND hs.credential_generation=u.credential_generation AND to_jsonb(u.credential_generation)=r->'credentialGeneration' AND hs.idle_expires_at>at_time AND hs.absolute_expires_at>at_time FOR SHARE OF hs,u,cl;
 IF h.id IS NULL OR (s->>'authorityExpiresAt')::timestamptz>LEAST(h.idle_expires_at,h.absolute_expires_at) THEN RETURN false;END IF;
 SELECT v.* INTO policy FROM anvil.permission_policies pp JOIN anvil.permission_policy_versions v ON v.project_id=pp.project_id AND v.policy_id=pp.id AND v.version=pp.head_version WHERE pp.project_id=pid AND jsonb_build_object('id',pp.id,'version',pp.head_version,'contentHash',v.content_hash)=c.policy_ref FOR SHARE OF pp;
 IF policy.policy_id IS NULL OR policy.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',policy.rules_json,'reason',policy.reason,'reviewRefs',policy.review_refs)) THEN RETURN false;END IF;
 SELECT * INTO budget FROM anvil.limit_policy_versions WHERE project_id=pid AND scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF budget.policy_id IS NULL OR b->'budgetPolicyRef' IS DISTINCT FROM jsonb_build_object('id',budget.policy_id,'version',budget.version,'contentHash',budget.content_hash) OR budget.content_hash IS DISTINCT FROM anvil.execution_json_hash(budget.snapshot_json) OR budget.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR NOT anvil.limit_policy_limits_valid(budget.snapshot_json->'limits')
  OR NOT anvil.execution_iso_valid(budget.snapshot_json->'decidedAt') OR NOT anvil.execution_iso_valid(budget.snapshot_json->'expiresAt') OR (budget.snapshot_json->>'decidedAt')::timestamptz>at_time THEN RETURN false;END IF;
 deadline=anvil.grant_revocation_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,c.actor_id,'revokeExecutionGrant',b->'budgetPolicyRef',scopes,at_time);
 IF deadline IS NULL OR (s->>'authorityExpiresAt')::timestamptz>LEAST(deadline,(budget.snapshot_json->>'expiresAt')::timestamptz) THEN RETURN false;END IF;
 digest=anvil.execution_json_hash(jsonb_build_object('projectId',pid,'actorId',c.actor_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'requestHash',c.request_hash,'policyRef',c.policy_ref,'targetRef',expected));
 IF NOT EXISTS(SELECT 1 FROM anvil.authorization_receipts ar JOIN anvil.audit_events a ON a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref IS NULL AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id) AND ar.scope_digest=digest AND a.scope_digest=digest AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id AND a.target_ref=expected AND a.policy_ref=c.policy_ref AND a.approval_ref IS NULL) THEN RETURN false;END IF;
 IF (SELECT count(*) FROM anvil.execution_grant_revocations WHERE project_id=pid AND execution_id=g.execution_id AND generation=g.generation AND id::text IS DISTINCT FROM row_json->>'id')>=100
  OR (SELECT COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',x.id,'version',x.version,'contentHash',x.content_hash),'snapshot',x.snapshot_json)))),0) FROM anvil.execution_grant_revocations x WHERE x.project_id=pid AND x.execution_id=g.execution_id AND x.generation=g.generation AND x.id::text IS DISTINCT FROM row_json->>'id')+octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR EXISTS(SELECT 1 FROM anvil.executions WHERE project_id=pid AND command_id=cid) OR EXISTS(SELECT 1 FROM anvil.execution_grants WHERE project_id=pid AND command_id=cid)
  OR EXISTS(SELECT 1 FROM anvil.writer_claims WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.usage_reservations WHERE project_id=pid AND created_command_id=cid)
  OR EXISTS(SELECT 1 FROM anvil.execution_commands WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid) THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_execution_grant_revocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'GRANT_REVOCATION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NOT anvil.check_execution_grant_revocation(NEW.project_id,NEW.created_command_id,to_jsonb(NEW)) THEN RAISE EXCEPTION 'GRANT_REVOCATION_EXACT_CURRENT_HUMAN_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER execution_grant_revocation_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_grant_revocations FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_grant_revocation();
CREATE FUNCTION anvil.guard_execution_grant_revocation_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;r anvil.execution_grant_revocations%ROWTYPE;cid uuid;pid uuid;
BEGIN
 IF TG_TABLE_NAME='commands' THEN cid=NEW.id;pid=NEW.project_id;ELSE cid=NEW.created_command_id;pid=NEW.project_id;END IF;
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.operation='revokeExecutionGrant' THEN
  SELECT * INTO r FROM anvil.execution_grant_revocations WHERE project_id=pid AND created_command_id=cid;
  IF r.id IS NULL OR NOT anvil.check_execution_grant_revocation(pid,cid,to_jsonb(r)) THEN RAISE EXCEPTION 'GRANT_REVOCATION_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER execution_grant_revocation_complete AFTER INSERT ON anvil.execution_grant_revocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_grant_revocation_complete();
CREATE CONSTRAINT TRIGGER execution_grant_revocation_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_grant_revocation_complete();
CREATE FUNCTION anvil.guard_grant_revocation_command_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.operation='revokeExecutionGrant' OR (TG_OP='UPDATE' AND NEW.operation='revokeExecutionGrant') THEN RAISE EXCEPTION 'GRANT_REVOCATION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER grant_revocation_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_grant_revocation_command_history();

-- 同一 project 잠금 뒤 검사한다. 대기 전 snapshot에서만 검사하면 회수와 전달 사이에 경합 우회가 생긴다.
CREATE FUNCTION anvil.guard_no_revoked_execution_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'EXECUTION_PROJECT_NOT_CURRENT' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM anvil.execution_grant_revocations WHERE project_id=NEW.project_id AND grant_id=NEW.grant_id AND grant_version=NEW.grant_version) THEN RAISE EXCEPTION 'EXECUTION_GRANT_REVOKED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_credentials FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_challenges FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_observations FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();
CREATE TRIGGER a_grant_revocation_delivery_guard BEFORE INSERT ON anvil.execution_acknowledgements FOR EACH ROW EXECUTE FUNCTION anvil.guard_no_revoked_execution_grant();

CREATE OR REPLACE FUNCTION anvil.synthetic_grant_deadline(pid uuid,gid uuid,ver bigint,digest text) RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE g anvil.execution_grants%ROWTYPE;f jsonb;policy anvil.permission_policy_versions%ROWTYPE;b anvil.limit_policy_versions%ROWTYPE;
 s anvil.auth_sessions%ROWTYPE;u anvil.usage_reservations%ROWTYPE;a timestamptz;q timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND id=gid AND version=ver AND content_hash=digest;
 IF g.id IS NULL OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json) OR g.snapshot_json->>'kind' IS DISTINCT FROM 'EXECUTION'
  OR g.snapshot_json->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR g.snapshot_json->>'state' IS DISTINCT FROM 'SYNTHETIC_PLAN'
  OR g.snapshot_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR g.snapshot_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT anvil.execution_iso_valid(g.snapshot_json->'expiresAt') OR (g.snapshot_json->>'expiresAt')::timestamptz<=at_time THEN RETURN NULL;END IF;
 f=g.snapshot_json->'binding';
 IF g.snapshot_json->>'factHash' IS DISTINCT FROM anvil.execution_json_hash(f) OR f->>'projectId' IS DISTINCT FROM pid::text
  OR f->>'executionId' IS DISTINCT FROM g.execution_id::text OR f->'executionGeneration' IS DISTINCT FROM to_jsonb(g.generation) THEN RETURN NULL;END IF;
 SELECT s0.* INTO s FROM anvil.auth_sessions s0 JOIN anvil.users usr ON usr.id=s0.user_id JOIN anvil.clients cl ON cl.id=s0.client_id AND cl.user_id=s0.user_id
  WHERE s0.id::text=f->'subject'->>'humanSessionId' AND s0.user_id::text=f->'subject'->>'userId' AND s0.client_id::text=f->'subject'->>'clientId'
  AND s0.revoked_at IS NULL AND usr.status='ACTIVE' AND usr.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s0.credential_generation=usr.credential_generation AND to_jsonb(usr.credential_generation)=f->'subject'->'credentialGeneration'
  AND s0.idle_expires_at>at_time AND s0.absolute_expires_at>at_time FOR SHARE OF s0,usr,cl;
 IF s.id IS NULL THEN RETURN NULL;END IF;
 PERFORM p.id FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id AND m.user_id=s.user_id
  JOIN anvil.project_control pc ON pc.project_id=p.id AND pc.actor_id=s.user_id AND pc.client_id=s.client_id
  WHERE p.id=pid AND p.archived_at IS NULL AND m.participation='OWNER' AND m.revoked_at IS NULL AND pc.revoked_at IS NULL
   AND to_jsonb(pc.generation)=f->'subject'->'controlGeneration' FOR UPDATE OF p;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM anvil.execution_grant_revocations WHERE project_id=pid AND grant_id=gid AND grant_version=ver) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.executions e JOIN anvil.writer_claims w ON w.project_id=e.project_id AND w.execution_id=e.id AND w.generation=e.generation
  WHERE e.project_id=pid AND e.id=g.execution_id AND e.generation=g.generation AND e.transport='SYNTHETIC_ONLY' AND e.state='SYNTHETIC_QUEUED'
  AND w.grant_id=gid AND w.grant_version=ver AND w.ownership_state='SYNTHETIC_CLAIM' AND w.reclaimed_at IS NULL AND w.expires_at>at_time
  AND w.scope_json=f->'intent'->'sourceScopes') THEN RETURN NULL;END IF;
 SELECT v.* INTO policy FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v ON v.project_id=p.project_id AND v.policy_id=p.id AND v.version=p.head_version
  WHERE p.project_id=pid AND jsonb_build_object('id',p.id,'version',p.head_version,'contentHash',v.content_hash)=f->'permissionPolicyRef' FOR SHARE OF p;
 IF policy.policy_id IS NULL OR policy.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',policy.rules_json,'reason',policy.reason,'reviewRefs',policy.review_refs)) THEN RETURN NULL;END IF;
 SELECT * INTO b FROM anvil.limit_policy_versions v WHERE v.project_id=pid AND v.scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF b.policy_id IS NULL OR jsonb_build_object('id',b.policy_id,'version',b.version,'contentHash',b.content_hash) IS DISTINCT FROM f->'intent'->'budgetPolicyRef'
  OR b.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR b.content_hash IS DISTINCT FROM anvil.execution_json_hash(b.snapshot_json)
  OR NOT anvil.limit_policy_limits_valid(b.snapshot_json->'limits') OR NOT anvil.execution_iso_valid(b.snapshot_json->'expiresAt')
  OR (b.snapshot_json->>'expiresAt')::timestamptz<=at_time THEN RETURN NULL;END IF;
 SELECT * INTO u FROM anvil.usage_reservations WHERE project_id=pid AND reservation_id::text=f->'budgetReservationRef'->>'id' ORDER BY version DESC LIMIT 1;
 IF u.reservation_id IS NULL OR jsonb_build_object('id',u.reservation_id,'version',u.version,'contentHash',u.content_hash) IS DISTINCT FROM f->'budgetReservationRef'
  OR u.content_hash IS DISTINCT FROM anvil.execution_json_hash(u.snapshot_json) OR u.snapshot_json->>'state' IS DISTINCT FROM 'RESERVED' THEN RETURN NULL;END IF;
 a=anvil.execution_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,s.user_id,'authorizeExecution',f->'intent'->'budgetPolicyRef',f->'intent'->'sourceScopes',at_time);
 q=anvil.execution_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,s.user_id,'queueExecutionCommand',f->'intent'->'budgetPolicyRef',f->'intent'->'sourceScopes',at_time);
 IF a IS NULL OR q IS NULL THEN RETURN NULL;END IF;
 RETURN LEAST(a,q,(g.snapshot_json->>'expiresAt')::timestamptz,s.idle_expires_at,s.absolute_expires_at,(b.snapshot_json->>'expiresAt')::timestamptz);
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
