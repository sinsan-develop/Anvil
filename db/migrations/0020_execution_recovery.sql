-- P1 C3 합성 RECOVERY grant의 forward 후보. 정식 DB 미적용.
-- 기존 0016~0019 파일/EXECUTION graph·writer·관측 ACK를 수정하지 않는다.
-- 현재 host/OS/원 grant 상태는 합성 provider 주장이다. 이 SQL은 credential/강제 중지 권한을 발급하지 않는다.
-- 회수만 허용하는 별도 정책 함수. 기존 두 실행 연산 함수/의미는 변경하지 않는다.
CREATE FUNCTION anvil.recovery_policy_deadline(rules jsonb,pid uuid,eid uuid,generation bigint,actor uuid,op text,budget_ref jsonb,scopes jsonb,at_time timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rule jsonb;scope jsonb;requested jsonb;target jsonb;base jsonb;allowed_scopes jsonb='[]'::jsonb;rule_deadline timestamptz;deadline timestamptz;overlap boolean;
BEGIN
 IF rules IS NULL OR pid IS NULL OR eid IS NULL OR actor IS NULL OR at_time IS NULL OR generation IS NULL OR generation NOT BETWEEN 1 AND 9007199254740991
  OR op IS NULL OR op NOT IN('authorizeExecutionRecovery') OR jsonb_typeof(rules) IS DISTINCT FROM 'array' OR jsonb_array_length(rules)>200
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

CREATE FUNCTION anvil.check_recovery_grant(pid uuid,cid uuid,row_json jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;g anvil.execution_grants%ROWTYPE;ack anvil.execution_acknowledgements%ROWTYPE;
 pv anvil.permission_policy_versions%ROWTYPE;budget anvil.limit_policy_versions%ROWTYPE;hs anvil.auth_sessions%ROWTYPE;
 s jsonb;req jsonb;p jsonb;r jsonb;b jsonb;scope jsonb;expected jsonb;expected_ack jsonb;digest text;policy_deadline timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 PERFORM id FROM anvil.projects WHERE id=pid AND archived_at IS NULL FOR UPDATE;IF NOT FOUND THEN RETURN false;END IF;
 s=row_json->'snapshot_json';req=s->'request';p=req->'payload';r=s->'reviewer';b=s->'binding';
 scope=jsonb_build_object('projectId',pid,'executionId',row_json->'execution_id','executionGeneration',row_json->'generation');
 expected=jsonb_build_object('id',row_json->'id','version',1,'contentHash',row_json->'content_hash');
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.id IS NULL OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR c.actor_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR c.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
  OR row_json->'project_id' IS DISTINCT FROM to_jsonb(pid) OR row_json->'command_id' IS DISTINCT FROM to_jsonb(cid) OR row_json->'version' IS DISTINCT FROM '1'::jsonb
  OR c.scope_kind IS DISTINCT FROM 'PROJECT' OR c.scope_id IS DISTINCT FROM pid OR c.operation IS DISTINCT FROM 'authorizeExecutionRecovery' OR c.state IS DISTINCT FROM 'APPLIED' OR c.approval_consumption_id IS NOT NULL OR c.payload_ref IS NOT NULL
  OR row_json->'created_by' IS DISTINCT FROM to_jsonb(c.actor_id) OR row_json->'client_id' IS DISTINCT FROM to_jsonb(c.client_id) OR row_json->'generation' IS DISTINCT FROM to_jsonb(c.expected_version)
  OR NOT anvil.execution_preparation_ref_valid(expected)
  OR NOT anvil.execution_json_shape(s,ARRAY['kind','state','transport','scope','request','requestHash','reviewer','binding','allowedOperations','plannedAt','expiresAt','scopeDigest','executionAuthorized','dispatchPerformed','writerReleaseVerified'])
  OR s->>'kind' IS DISTINCT FROM 'RECOVERY' OR s->>'state' IS DISTINCT FROM 'SYNTHETIC_PLAN' OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->'scope' IS DISTINCT FROM scope
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb OR s->'writerReleaseVerified' IS DISTINCT FROM 'false'::jsonb
  OR s->'allowedOperations' IS DISTINCT FROM '["SYNC_OBSERVATIONS","READ_STOP_INSTRUCTION","REPORT_STOP","HEARTBEAT"]'::jsonb
  OR row_json->>'content_hash' IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR NOT anvil.execution_json_shape(req,ARRAY['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  OR req->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR req->'projectId' IS DISTINCT FROM to_jsonb(pid) OR req->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR req->'clientId' IS DISTINCT FROM to_jsonb(c.client_id)
  OR req->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation) OR req->>'operation' IS DISTINCT FROM 'authorizeExecutionRecovery' OR req->'targetId' IS DISTINCT FROM row_json->'execution_id' OR req->'expectedVersion' IS DISTINCT FROM row_json->'generation'
  OR req->'baselineRefs' IS DISTINCT FROM '[]'::jsonb OR req->'approvalRef' IS DISTINCT FROM 'null'::jsonb OR s->>'requestHash' IS DISTINCT FROM c.request_hash OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(req)
  OR NOT anvil.execution_json_shape(p,ARRAY['lastServerAck','processIdentity','permissionPolicyRef','budgetPolicyRef','purpose','reason']) OR p->>'purpose' IS DISTINCT FROM 'RECOVER_OBSERVATIONS_AND_REQUEST_GRACEFUL_STOP'
  OR jsonb_typeof(p->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(p->>'reason')
  OR NOT anvil.execution_json_shape(r,ARRAY['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration']) OR r->>'kind' IS DISTINCT FROM 'HUMAN' OR r->'userId' IS DISTINCT FROM to_jsonb(c.actor_id) OR r->'clientId' IS DISTINCT FROM to_jsonb(c.client_id) OR r->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation)
  OR NOT anvil.execution_json_shape(b,ARRAY['transport','scope','originalGrantRef','originalGrantState','lastServerAck','processIdentity','responsibleSessionRef','registration','sourceScopes','permissionPolicyRef','budgetPolicyRef','hostTrustState','recoveryPathState'])
  OR b->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR b->'scope' IS DISTINCT FROM scope OR jsonb_typeof(b->'originalGrantState') IS DISTINCT FROM 'string' OR b->>'originalGrantState' NOT IN('ACTIVE','REVOKED','EXPIRED')
  OR b->>'hostTrustState' IS DISTINCT FROM 'TRUSTED' OR b->>'recoveryPathState' IS DISTINCT FROM 'VERIFIED_CURRENT' OR NOT anvil.execution_preparation_ref_valid(b->'originalGrantRef') OR NOT anvil.execution_preparation_ref_valid(b->'responsibleSessionRef')
  OR NOT anvil.execution_source_scopes_valid(b->'sourceScopes') OR NOT anvil.execution_preparation_ref_valid(b->'budgetPolicyRef') OR NOT anvil.execution_preparation_ref_valid(b->'permissionPolicyRef')
  OR NOT anvil.execution_json_shape(b->'registration',ARRAY['ref','connectorId','generation','hostPublicKeyFingerprint']) OR NOT anvil.execution_preparation_ref_valid(b->'registration'->'ref')
  OR p->'lastServerAck' IS DISTINCT FROM b->'lastServerAck' OR p->'processIdentity' IS DISTINCT FROM b->'processIdentity' OR p->'permissionPolicyRef' IS DISTINCT FROM b->'permissionPolicyRef' OR p->'budgetPolicyRef' IS DISTINCT FROM b->'budgetPolicyRef' OR c.policy_ref IS DISTINCT FROM b->'permissionPolicyRef'
  OR NOT anvil.execution_iso_valid(s->'plannedAt') OR NOT anvil.execution_iso_valid(s->'expiresAt') OR (s->>'plannedAt')::timestamptz>at_time OR (s->>'plannedAt')::timestamptz<at_time-interval '30 seconds'
  OR (s->>'expiresAt')::timestamptz<=at_time OR (s->>'expiresAt')::timestamptz>(s->>'plannedAt')::timestamptz+interval '10 minutes'
  OR s->>'scopeDigest' IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('binding',b,'requestHash',s->'requestHash','reviewer',r,'allowedOperations',s->'allowedOperations','expiresAt',s->'expiresAt'))
  OR c.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR c.result_ref->'projectId' IS DISTINCT FROM to_jsonb(pid) OR c.result_ref->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR c.result_ref->'operationId' IS DISTINCT FROM to_jsonb(c.operation_id)
  OR c.result_ref->'targetId' IS DISTINCT FROM row_json->'id' OR c.result_ref->'version' IS DISTINCT FROM '1'::jsonb OR c.result_ref->'data'->'ref' IS DISTINCT FROM expected OR c.result_ref->'data'->'snapshot' IS DISTINCT FROM s OR c.result_ref->'data'->>'status' IS DISTINCT FROM 'SYNTHETIC_RECOVERY_STORED'
  OR c.result_ref->'data'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->'writerReleaseVerified' IS DISTINCT FROM 'false'::jsonb THEN RETURN false;END IF;
 -- KNOWN도 불변 관측 ref만 받는다. PID/handle을 caller가 직접 조작하는 권한으로 쓰지 않는다.
 IF NOT(anvil.execution_json_shape(b->'processIdentity',ARRAY['state']) AND b->'processIdentity'->>'state' IS NOT DISTINCT FROM 'UNKNOWN'
  OR anvil.execution_json_shape(b->'processIdentity',ARRAY['state','ref']) AND b->'processIdentity'->>'state' IS NOT DISTINCT FROM 'KNOWN' AND anvil.execution_preparation_ref_valid(b->'processIdentity'->'ref')) THEN RETURN false;END IF;
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND id::text=b->'originalGrantRef'->>'id' AND version::text=b->'originalGrantRef'->>'version' AND content_hash=b->'originalGrantRef'->>'contentHash';
 IF g.id IS NULL OR g.execution_id::text IS DISTINCT FROM row_json->>'execution_id' OR to_jsonb(g.generation) IS DISTINCT FROM row_json->'generation' OR g.snapshot_json->>'kind' IS DISTINCT FROM 'EXECUTION' OR g.snapshot_json->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json)
  OR b->'registration' IS DISTINCT FROM g.snapshot_json->'binding'->'registration' OR b->'responsibleSessionRef' IS DISTINCT FROM g.snapshot_json->'binding'->'agentSession'->'sessionRef' OR b->'sourceScopes' IS DISTINCT FROM g.snapshot_json->'binding'->'intent'->'sourceScopes' THEN RETURN false;END IF;
 SELECT * INTO ack FROM anvil.execution_acknowledgements WHERE project_id=pid AND execution_id=g.execution_id AND generation=g.generation ORDER BY version DESC LIMIT 1;
 IF ack.id IS NULL THEN expected_ack=jsonb_build_object('sequence',0,'batchRef',NULL);
 ELSE
  IF ack.content_hash IS DISTINCT FROM anvil.execution_json_hash(ack.snapshot_json) THEN RETURN false;END IF;
  expected_ack=jsonb_build_object('sequence',ack.snapshot_json->'highestContiguous','batchRef',jsonb_build_object('id',ack.id,'version',ack.version,'contentHash',ack.content_hash));
 END IF;
 IF b->'lastServerAck' IS DISTINCT FROM expected_ack THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id WHERE pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL AND m.participation='OWNER' AND m.revoked_at IS NULL) THEN RETURN false;END IF;
 SELECT h.* INTO hs FROM anvil.auth_sessions h JOIN anvil.users u ON u.id=h.user_id JOIN anvil.clients cl ON cl.id=h.client_id AND cl.user_id=h.user_id
  WHERE h.id::text=r->>'humanSessionId' AND h.user_id=c.actor_id AND h.client_id=c.client_id AND h.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND h.credential_generation=u.credential_generation AND to_jsonb(u.credential_generation)=r->'credentialGeneration'
   AND h.idle_expires_at>at_time AND h.absolute_expires_at>at_time AND h.reauth_until>at_time FOR SHARE OF h,u,cl;
 IF hs.id IS NULL OR (s->>'expiresAt')::timestamptz>LEAST(hs.idle_expires_at,hs.absolute_expires_at,hs.reauth_until) THEN RETURN false;END IF;
 SELECT v.* INTO pv FROM anvil.permission_policies pp JOIN anvil.permission_policy_versions v ON v.project_id=pp.project_id AND v.policy_id=pp.id AND v.version=pp.head_version WHERE pp.project_id=pid AND jsonb_build_object('id',pp.id,'version',pp.head_version,'contentHash',v.content_hash)=c.policy_ref FOR SHARE OF pp;
 IF pv.policy_id IS NULL OR pv.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',pv.rules_json,'reason',pv.reason,'reviewRefs',pv.review_refs)) THEN RETURN false;END IF;
 SELECT * INTO budget FROM anvil.limit_policy_versions WHERE project_id=pid AND scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF budget.policy_id IS NULL OR b->'budgetPolicyRef' IS DISTINCT FROM jsonb_build_object('id',budget.policy_id,'version',budget.version,'contentHash',budget.content_hash) OR budget.content_hash IS DISTINCT FROM anvil.execution_json_hash(budget.snapshot_json) OR budget.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR NOT anvil.limit_policy_limits_valid(budget.snapshot_json->'limits') OR (budget.snapshot_json->>'decidedAt')::timestamptz>at_time THEN RETURN false;END IF;
 policy_deadline=anvil.recovery_policy_deadline(pv.rules_json,pid,g.execution_id,g.generation,c.actor_id,'authorizeExecutionRecovery',b->'budgetPolicyRef',b->'sourceScopes',at_time);
 IF policy_deadline IS NULL OR (s->>'expiresAt')::timestamptz>LEAST(policy_deadline,(budget.snapshot_json->>'expiresAt')::timestamptz) THEN RETURN false;END IF;
 digest=anvil.execution_json_hash(jsonb_build_object('projectId',pid,'actorId',c.actor_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'requestHash',c.request_hash,'policyRef',c.policy_ref,'targetRef',expected));
 IF NOT EXISTS(SELECT 1 FROM anvil.authorization_receipts ar JOIN anvil.audit_events a ON a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref IS NULL AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id) AND ar.scope_digest=digest AND a.scope_digest=digest AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id AND a.target_ref=expected AND a.policy_ref=c.policy_ref AND a.approval_ref IS NULL) THEN RETURN false;END IF;
 IF (SELECT count(*) FROM anvil.execution_grants WHERE project_id=pid AND execution_id=g.execution_id AND generation=g.generation AND snapshot_json->>'kind'='RECOVERY' AND command_id<>cid)>=100
  OR (SELECT COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',v.id,'version',v.version,'contentHash',v.content_hash),'snapshot',v.snapshot_json)))),0) FROM anvil.execution_grants v WHERE v.project_id=pid AND v.execution_id=g.execution_id AND v.generation=g.generation AND v.snapshot_json->>'kind'='RECOVERY' AND v.command_id<>cid)+octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR EXISTS(SELECT 1 FROM anvil.execution_commands WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.writer_claims WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.usage_reservations WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid) THEN RETURN false;END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_execution_grant_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_GRANT_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.snapshot_json->>'kind'='RECOVERY' THEN
  IF NOT anvil.check_recovery_grant(NEW.project_id,NEW.command_id,to_jsonb(NEW)) THEN RAISE EXCEPTION 'RECOVERY_EXACT_HUMAN_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT anvil.execution_queue_authorized(NEW.project_id,NEW.command_id) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END;
$$;
CREATE FUNCTION anvil.guard_execution_grant_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.snapshot_json->>'kind'='RECOVERY' THEN
  IF NOT anvil.check_recovery_grant(NEW.project_id,NEW.command_id,to_jsonb(NEW)) THEN RAISE EXCEPTION 'RECOVERY_COMPLETE_GRAPH_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT anvil.check_initial_execution_graph(NEW.project_id,NEW.command_id) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_COMPLETE_GRAPH_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
-- 정확 execution_grants 두 trigger만 분기한다. 다른 초기 queue graph와 불변 이력은 그대로 둔다.
DROP TRIGGER initial_execution_row_guard ON anvil.execution_grants;
DROP TRIGGER initial_execution_complete ON anvil.execution_grants;
CREATE TRIGGER execution_grant_kind_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_grants FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_grant_kind();
CREATE CONSTRAINT TRIGGER execution_grant_complete AFTER INSERT ON anvil.execution_grants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_grant_complete();
CREATE FUNCTION anvil.guard_recovery_command_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.operation='authorizeExecutionRecovery' OR (TG_OP='UPDATE' AND NEW.operation='authorizeExecutionRecovery') THEN RAISE EXCEPTION 'RECOVERY_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER recovery_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_recovery_command_history();
CREATE FUNCTION anvil.guard_recovery_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g anvil.execution_grants%ROWTYPE;
BEGIN
 IF NEW.operation='authorizeExecutionRecovery' THEN
  SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND command_id=NEW.id;
  IF g.id IS NULL OR NOT anvil.check_recovery_grant(NEW.project_id,NEW.id,to_jsonb(g)) THEN RAISE EXCEPTION 'RECOVERY_COMMAND_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER recovery_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_recovery_command_complete();
