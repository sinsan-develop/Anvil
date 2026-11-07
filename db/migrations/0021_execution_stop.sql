-- P1 C3 합성 중지 명령/보류 outbox의 forward 후보. 정식 DB 미적용.
-- 기존 0016~0020과 초기 EXECUTION/RECOVERY grant 의미·writer/ACK는 보존한다.
-- 현재 target/ownership/host는 필수 합성 제공자의 주장이다. 이 SQL은 실제 중지/회수 증거가 아니다.
CREATE FUNCTION anvil.stop_policy_deadline(rules jsonb,pid uuid,eid uuid,generation bigint,actor uuid,op text,budget_ref jsonb,scopes jsonb,at_time timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rule jsonb;scope jsonb;requested jsonb;target jsonb;base jsonb;allowed_scopes jsonb='[]'::jsonb;rule_deadline timestamptz;deadline timestamptz;overlap boolean;
BEGIN
 IF rules IS NULL OR pid IS NULL OR eid IS NULL OR actor IS NULL OR at_time IS NULL OR generation IS NULL OR generation NOT BETWEEN 1 AND 9007199254740991
  OR op IS NULL OR op NOT IN('requestExecutionStop') OR jsonb_typeof(rules) IS DISTINCT FROM 'array' OR jsonb_array_length(rules)>200
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

CREATE FUNCTION anvil.check_stop_command(pid uuid,cid uuid,row_json jsonb,require_outbox boolean) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;g anvil.execution_grants%ROWTYPE;original anvil.execution_grants%ROWTYPE;h anvil.auth_sessions%ROWTYPE;
 policy anvil.permission_policy_versions%ROWTYPE;budget anvil.limit_policy_versions%ROWTYPE;o anvil.delivery_outbox%ROWTYPE;
 s jsonb;intent jsonb;req jsonb;p jsonb;r jsonb;b jsonb;e jsonb;scope jsonb;expected jsonb;auth_ref jsonb;subject jsonb;context_without_auth jsonb;destination jsonb;payload jsonb;
 digest text;delivery_digest text;deadline timestamptz;grant_deadline timestamptz;at_time timestamptz=clock_timestamp();
BEGIN
 PERFORM id FROM anvil.projects WHERE id=pid AND archived_at IS NULL FOR UPDATE;IF NOT FOUND THEN RETURN false;END IF;
 s=row_json->'snapshot_json';intent=s-ARRAY['request','envelope'];req=s->'request';p=req->'payload';r=s->'requestedBy';b=s->'currentBinding';e=s->'envelope';
 scope=jsonb_build_object('projectId',pid,'executionId',row_json->'execution_id','executionGeneration',row_json->'generation');
 expected=jsonb_build_object('id',row_json->'id','version',1,'contentHash',row_json->'content_hash');
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF c.id IS NULL OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR c.actor_id::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR c.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
  OR c.operation IS DISTINCT FROM 'requestExecutionStop' OR c.state IS DISTINCT FROM 'APPLIED' OR c.scope_kind IS DISTINCT FROM 'PROJECT' OR c.scope_id IS DISTINCT FROM pid OR c.approval_consumption_id IS NOT NULL OR c.payload_ref IS NOT NULL
  OR row_json->'project_id' IS DISTINCT FROM to_jsonb(pid) OR row_json->'created_command_id' IS DISTINCT FROM to_jsonb(cid) OR row_json->'version' IS DISTINCT FROM '1'::jsonb OR row_json->'generation' IS DISTINCT FROM to_jsonb(c.expected_version)
  OR NOT anvil.execution_preparation_ref_valid(expected) OR row_json->>'content_hash' IS DISTINCT FROM anvil.execution_json_hash(intent)
  OR NOT anvil.execution_json_shape(s,ARRAY['transport','state','scope','requestHash','requestedBy','currentBinding','reason','requestedAt','expiresAt','executionAuthorized','dispatchPerformed','writerReleaseVerified','request','envelope'])
  OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->>'state' IS DISTINCT FROM 'STOP_REQUEST_STORED' OR s->'scope' IS DISTINCT FROM scope
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb OR s->'writerReleaseVerified' IS DISTINCT FROM 'false'::jsonb
  OR octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR NOT anvil.execution_json_shape(req,ARRAY['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  OR req->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR req->'projectId' IS DISTINCT FROM to_jsonb(pid) OR req->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR req->'clientId' IS DISTINCT FROM to_jsonb(c.client_id)
  OR req->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation) OR req->>'operation' IS DISTINCT FROM 'requestExecutionStop' OR req->'targetId' IS DISTINCT FROM row_json->'execution_id' OR req->'expectedVersion' IS DISTINCT FROM row_json->'generation'
  OR req->'baselineRefs' IS DISTINCT FROM '[]'::jsonb OR req->'approvalRef' IS DISTINCT FROM 'null'::jsonb OR s->>'requestHash' IS DISTINCT FROM c.request_hash OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(req)
  OR NOT anvil.execution_json_shape(p,ARRAY['grantRef','sessionBindingRef','stopScopeRef','permissionPolicyRef','budgetPolicyRef','reason']) OR jsonb_typeof(p->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(p->>'reason') OR s->'reason' IS DISTINCT FROM p->'reason'
  OR NOT anvil.execution_json_shape(r,ARRAY['userId','clientId','humanSessionId','credentialGeneration','controlGeneration']) OR r->'userId' IS DISTINCT FROM to_jsonb(c.actor_id) OR r->'clientId' IS DISTINCT FROM to_jsonb(c.client_id) OR r->'controlGeneration' IS DISTINCT FROM to_jsonb(c.control_generation)
  OR NOT anvil.execution_json_shape(b,ARRAY['transport','scope','grantRef','grantKind','grantExpiresAt','grantSubject','grantAllowedOperations','sessionBindingRef','stopScopeRef','executorRegistrationRef','context','ownershipRef','targetState','permissionPolicyRef','budgetPolicyRef','budgetReservationRef'])
  OR b->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR b->'scope' IS DISTINCT FROM scope OR b->>'targetState' IS DISTINCT FROM 'VERIFIED_CURRENT'
  OR NOT anvil.execution_preparation_ref_valid(b->'ownershipRef') OR NOT anvil.execution_preparation_ref_valid(b->'sessionBindingRef') OR NOT anvil.execution_preparation_ref_valid(b->'stopScopeRef')
  OR NOT anvil.execution_preparation_ref_valid(b->'executorRegistrationRef') OR NOT anvil.execution_preparation_ref_valid(b->'budgetReservationRef')
  OR p->'grantRef' IS DISTINCT FROM b->'grantRef' OR p->'sessionBindingRef' IS DISTINCT FROM b->'sessionBindingRef' OR p->'stopScopeRef' IS DISTINCT FROM b->'stopScopeRef' OR p->'permissionPolicyRef' IS DISTINCT FROM b->'permissionPolicyRef' OR p->'budgetPolicyRef' IS DISTINCT FROM b->'budgetPolicyRef'
  OR c.policy_ref IS DISTINCT FROM b->'permissionPolicyRef' OR b->'grantSubject' IS DISTINCT FROM r
  OR NOT anvil.execution_iso_valid(s->'requestedAt') OR NOT anvil.execution_iso_valid(s->'expiresAt') OR (s->>'requestedAt')::timestamptz>at_time OR (s->>'requestedAt')::timestamptz<at_time-interval '30 seconds'
  OR (s->>'expiresAt')::timestamptz<=at_time OR (s->>'expiresAt')::timestamptz>(s->>'requestedAt')::timestamptz+interval '30 seconds'
  OR NOT anvil.execution_json_shape(e,ARRAY['schemaVersion','commandId','issuedAt','expiresAt','executorRegistrationRef','context','operation','payload','envelopeHash'])
  OR e->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR e->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR e->>'operation' IS DISTINCT FROM 'REQUEST_STOP' OR e->'issuedAt' IS DISTINCT FROM s->'requestedAt' OR e->'expiresAt' IS DISTINCT FROM s->'expiresAt'
  OR e->>'envelopeHash' IS DISTINCT FROM anvil.execution_json_hash(e-'envelopeHash') OR row_json->'envelope_hash' IS DISTINCT FROM e->'envelopeHash'
  OR e->'executorRegistrationRef' IS DISTINCT FROM b->'executorRegistrationRef' OR e->'payload' IS DISTINCT FROM jsonb_build_object('sessionBindingRef',b->'sessionBindingRef','stopScopeRef',b->'stopScopeRef')
  OR c.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR c.result_ref->'projectId' IS DISTINCT FROM to_jsonb(pid) OR c.result_ref->'commandId' IS DISTINCT FROM to_jsonb(c.command_id) OR c.result_ref->'operationId' IS DISTINCT FROM to_jsonb(c.operation_id)
  OR c.result_ref->'targetId' IS DISTINCT FROM row_json->'id' OR c.result_ref->'version' IS DISTINCT FROM '1'::jsonb OR c.result_ref->'data'->'ref' IS DISTINCT FROM expected OR c.result_ref->'data'->'snapshot' IS DISTINCT FROM intent OR c.result_ref->'data'->>'status' IS DISTINCT FROM 'SYNTHETIC_STOP_STORED'
  OR c.result_ref->'data'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb OR c.result_ref->'data'->'writerReleaseVerified' IS DISTINCT FROM 'false'::jsonb THEN RETURN false;END IF;
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=pid AND id=(row_json->>'grant_id')::uuid AND version=(row_json->>'grant_version')::bigint;
 IF g.id IS NULL OR g.execution_id::text IS DISTINCT FROM row_json->>'execution_id' OR to_jsonb(g.generation) IS DISTINCT FROM row_json->'generation'
  OR b->'grantRef' IS DISTINCT FROM jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash) OR b->'grantKind' IS DISTINCT FROM g.snapshot_json->'kind'
  OR g.snapshot_json->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json)
  OR b->'grantExpiresAt' IS DISTINCT FROM g.snapshot_json->'expiresAt' OR NOT anvil.execution_iso_valid(b->'grantExpiresAt') OR (s->>'expiresAt')::timestamptz>(b->>'grantExpiresAt')::timestamptz
  OR b->'grantAllowedOperations' IS DISTINCT FROM g.snapshot_json->'allowedOperations' THEN RETURN false;END IF;
 IF g.snapshot_json->>'kind'='EXECUTION' THEN
  original=g;subject=g.snapshot_json->'binding'->'subject';grant_deadline=anvil.synthetic_grant_deadline(pid,g.id,g.version,g.content_hash);
  IF grant_deadline IS NULL OR (s->>'expiresAt')::timestamptz>grant_deadline OR NOT((g.snapshot_json->'allowedOperations') ? 'REQUEST_STOP') THEN RETURN false;END IF;
 ELSIF g.snapshot_json->>'kind'='RECOVERY' THEN
  SELECT * INTO original FROM anvil.execution_grants WHERE project_id=pid AND id::text=g.snapshot_json->'binding'->'originalGrantRef'->>'id' AND version::text=g.snapshot_json->'binding'->'originalGrantRef'->>'version' AND content_hash=g.snapshot_json->'binding'->'originalGrantRef'->>'contentHash';
  subject=(g.snapshot_json->'reviewer')-'kind';
  IF g.snapshot_json->'allowedOperations' IS DISTINCT FROM '["SYNC_OBSERVATIONS","READ_STOP_INSTRUCTION","REPORT_STOP","HEARTBEAT"]'::jsonb OR g.snapshot_json->'binding'->'permissionPolicyRef' IS DISTINCT FROM c.policy_ref OR g.snapshot_json->'binding'->'budgetPolicyRef' IS DISTINCT FROM b->'budgetPolicyRef' THEN RETURN false;END IF;
 ELSE RETURN false;END IF;
 IF original.id IS NULL OR original.execution_id IS DISTINCT FROM g.execution_id OR original.generation IS DISTINCT FROM g.generation OR original.snapshot_json->>'kind' IS DISTINCT FROM 'EXECUTION' OR original.content_hash IS DISTINCT FROM anvil.execution_json_hash(original.snapshot_json)
  OR subject IS DISTINCT FROM r OR b->'budgetReservationRef' IS DISTINCT FROM original.snapshot_json->'binding'->'budgetReservationRef'
  OR b->'executorRegistrationRef' IS DISTINCT FROM original.snapshot_json->'binding'->'registration'->'ref' OR b->'sessionBindingRef' IS DISTINCT FROM original.snapshot_json->'binding'->'agentSession'->'sessionRef' THEN RETURN false;END IF;
 context_without_auth=jsonb_build_object('projectId',pid,'assignmentId',original.snapshot_json->'binding'->'intent'->'assignmentRef'->'id','executionId',g.execution_id,'executionGeneration',g.generation,
  'connectionRef',original.snapshot_json->'binding'->'intent'->'connectionRef','environmentRef',original.snapshot_json->'binding'->'intent'->'environmentRef','capabilityRef',original.snapshot_json->'binding'->'intent'->'capabilityRef','budgetRef',b->'budgetReservationRef','sourceScopes',original.snapshot_json->'binding'->'intent'->'sourceScopes');
 IF (b->'context')-'authorizationReceiptRef' IS DISTINCT FROM context_without_auth OR (e->'context')-'authorizationReceiptRef' IS DISTINCT FROM context_without_auth
  OR NOT anvil.execution_json_shape(b->'context',ARRAY['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef','sourceScopes'])
  OR NOT anvil.execution_json_shape(e->'context',ARRAY['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef','sourceScopes'])
  OR NOT anvil.execution_preparation_ref_valid(b->'context'->'authorizationReceiptRef') THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id WHERE pc.project_id=pid AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL AND m.participation='OWNER' AND m.revoked_at IS NULL) THEN RETURN false;END IF;
 SELECT hs.* INTO h FROM anvil.auth_sessions hs JOIN anvil.users u ON u.id=hs.user_id JOIN anvil.clients cl ON cl.id=hs.client_id AND cl.user_id=hs.user_id WHERE hs.id::text=r->>'humanSessionId' AND hs.user_id=c.actor_id AND hs.client_id=c.client_id AND hs.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL AND hs.credential_generation=u.credential_generation AND to_jsonb(u.credential_generation)=r->'credentialGeneration' AND hs.idle_expires_at>at_time AND hs.absolute_expires_at>at_time FOR SHARE OF hs,u,cl;
 IF h.id IS NULL OR (s->>'expiresAt')::timestamptz>LEAST(h.idle_expires_at,h.absolute_expires_at)
  OR (g.snapshot_json->>'kind'='RECOVERY' AND (h.reauth_until IS NULL OR h.reauth_until<=at_time OR (s->>'expiresAt')::timestamptz>h.reauth_until)) THEN RETURN false;END IF;
 SELECT v.* INTO policy FROM anvil.permission_policies pp JOIN anvil.permission_policy_versions v ON v.project_id=pp.project_id AND v.policy_id=pp.id AND v.version=pp.head_version WHERE pp.project_id=pid AND jsonb_build_object('id',pp.id,'version',pp.head_version,'contentHash',v.content_hash)=c.policy_ref FOR SHARE OF pp;
 IF policy.policy_id IS NULL OR policy.content_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('rules',policy.rules_json,'reason',policy.reason,'reviewRefs',policy.review_refs)) THEN RETURN false;END IF;
 SELECT * INTO budget FROM anvil.limit_policy_versions WHERE project_id=pid AND scope_json=jsonb_build_object('kind','PROJECT','projectId',pid) ORDER BY version DESC LIMIT 1;
 IF budget.policy_id IS NULL OR b->'budgetPolicyRef' IS DISTINCT FROM jsonb_build_object('id',budget.policy_id,'version',budget.version,'contentHash',budget.content_hash) OR budget.content_hash IS DISTINCT FROM anvil.execution_json_hash(budget.snapshot_json) OR budget.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR NOT anvil.limit_policy_limits_valid(budget.snapshot_json->'limits') OR (budget.snapshot_json->>'decidedAt')::timestamptz>at_time THEN RETURN false;END IF;
 deadline=anvil.stop_policy_deadline(policy.rules_json,pid,g.execution_id,g.generation,c.actor_id,'requestExecutionStop',b->'budgetPolicyRef',b->'context'->'sourceScopes',at_time);
 IF deadline IS NULL OR (s->>'expiresAt')::timestamptz>LEAST(deadline,(budget.snapshot_json->>'expiresAt')::timestamptz) THEN RETURN false;END IF;
 digest=anvil.execution_json_hash(jsonb_build_object('projectId',pid,'actorId',c.actor_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'requestHash',c.request_hash,'policyRef',c.policy_ref,'targetRef',expected));
 auth_ref=jsonb_build_object('id',c.authorization_receipt_id,'version',1,'contentHash',digest);
 IF row_json->'authorization_ref' IS DISTINCT FROM auth_ref OR e->'context'->'authorizationReceiptRef' IS DISTINCT FROM auth_ref
  OR NOT EXISTS(SELECT 1 FROM anvil.authorization_receipts ar JOIN anvil.audit_events a ON a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=pid AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref IS NULL AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id) AND ar.scope_digest=digest AND a.scope_digest=digest AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id AND a.target_ref=expected AND a.policy_ref=c.policy_ref AND a.approval_ref IS NULL) THEN RETURN false;END IF;
 IF (SELECT count(*) FROM anvil.execution_commands WHERE project_id=pid AND execution_id=g.execution_id AND generation=g.generation AND snapshot_json->>'state'='STOP_REQUEST_STORED' AND created_command_id<>cid)>=100
  OR (SELECT COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',x.id,'version',x.version,'contentHash',x.content_hash),'snapshot',x.snapshot_json)))),0) FROM anvil.execution_commands x WHERE x.project_id=pid AND x.execution_id=g.execution_id AND x.generation=g.generation AND x.snapshot_json->>'state'='STOP_REQUEST_STORED' AND x.created_command_id<>cid)+octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',expected,'snapshot',s)))>2097152
  OR EXISTS(SELECT 1 FROM anvil.execution_grants WHERE project_id=pid AND command_id=cid) OR EXISTS(SELECT 1 FROM anvil.writer_claims WHERE project_id=pid AND created_command_id=cid) OR EXISTS(SELECT 1 FROM anvil.usage_reservations WHERE project_id=pid AND created_command_id=cid) THEN RETURN false;END IF;
 IF require_outbox THEN
  IF (SELECT count(*) FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid)<>1 THEN RETURN false;END IF;
  SELECT * INTO o FROM anvil.delivery_outbox WHERE project_id=pid AND command_id=cid;
  destination=jsonb_build_object('transport','SYNTHETIC_ONLY','registrationRef',b->'executorRegistrationRef','executionId',g.execution_id,'generation',g.generation,'grantKind',b->'grantKind');
  payload=jsonb_build_object('commandRef',expected,'grantRef',b->'grantRef','envelopeHash',e->'envelopeHash');
  delivery_digest=anvil.execution_json_hash(jsonb_build_object('scope',scope,'commandRef',expected,'grantRef',b->'grantRef','envelopeHash',e->'envelopeHash'));
  IF o.kind IS DISTINCT FROM 'EXECUTION_STOP_SYNTHETIC_ONLY' OR o.state IS DISTINCT FROM 'HELD_SYNTHETIC_ONLY' OR o.destination_ref IS DISTINCT FROM destination OR o.payload_ref IS DISTINCT FROM payload OR o.scope_digest IS DISTINCT FROM delivery_digest OR o.attempt_count<>0 OR o.next_attempt_at IS NOT NULL OR o.last_error_code IS NOT NULL THEN RETURN false;END IF;
 END IF;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_execution_command_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_COMMAND_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.snapshot_json->>'state'='STOP_REQUEST_STORED' THEN
  IF NOT anvil.check_stop_command(NEW.project_id,NEW.created_command_id,to_jsonb(NEW),false) THEN RAISE EXCEPTION 'STOP_EXACT_HUMAN_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT anvil.execution_queue_authorized(NEW.project_id,NEW.created_command_id) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END;
$$;
CREATE FUNCTION anvil.guard_execution_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.snapshot_json->>'state'='STOP_REQUEST_STORED' THEN
  IF NOT anvil.check_stop_command(NEW.project_id,NEW.created_command_id,to_jsonb(NEW),true) THEN RAISE EXCEPTION 'STOP_COMPLETE_GRAPH_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT anvil.check_initial_execution_graph(NEW.project_id,NEW.created_command_id) THEN RAISE EXCEPTION 'EXECUTION_QUEUE_COMPLETE_GRAPH_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
DROP TRIGGER initial_execution_row_guard ON anvil.execution_commands;
DROP TRIGGER initial_execution_complete ON anvil.execution_commands;
CREATE TRIGGER execution_command_kind_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_command_kind();
CREATE CONSTRAINT TRIGGER execution_command_complete AFTER INSERT ON anvil.execution_commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_command_complete();
CREATE FUNCTION anvil.guard_stop_command_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.operation='requestExecutionStop' OR (TG_OP='UPDATE' AND NEW.operation='requestExecutionStop') THEN RAISE EXCEPTION 'STOP_COMMAND_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER stop_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_stop_command_history();
CREATE FUNCTION anvil.guard_stop_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v jsonb=to_jsonb(NEW);old_value jsonb=to_jsonb(OLD);e anvil.execution_commands%ROWTYPE;c anvil.commands%ROWTYPE;b jsonb;expected jsonb;scope jsonb;pid uuid;cid uuid;
BEGIN
 pid=COALESCE(v->>'project_id',old_value->>'project_id')::uuid;cid=COALESCE(v->>'command_id',old_value->>'command_id')::uuid;
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=cid;
 IF v->>'kind'='EXECUTION_STOP_SYNTHETIC_ONLY' OR old_value->>'kind'='EXECUTION_STOP_SYNTHETIC_ONLY' OR c.operation='requestExecutionStop' THEN
  IF TG_OP<>'INSERT' OR c.operation IS DISTINCT FROM 'requestExecutionStop' THEN RAISE EXCEPTION 'STOP_OUTBOX_IMMUTABLE' USING ERRCODE='42501';END IF;
  SELECT * INTO e FROM anvil.execution_commands WHERE project_id=pid AND created_command_id=cid;
  IF e.id IS NULL OR NOT anvil.check_stop_command(pid,cid,to_jsonb(e),false) THEN RAISE EXCEPTION 'STOP_OUTBOX_EXACT_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
  b=e.snapshot_json->'currentBinding';expected=jsonb_build_object('id',e.id,'version',e.version,'contentHash',e.content_hash);scope=e.snapshot_json->'scope';
  IF NEW.state IS DISTINCT FROM 'HELD_SYNTHETIC_ONLY' OR NEW.kind IS DISTINCT FROM 'EXECUTION_STOP_SYNTHETIC_ONLY' OR NEW.attempt_count<>0 OR NEW.next_attempt_at IS NOT NULL OR NEW.last_error_code IS NOT NULL
   OR NEW.destination_ref IS DISTINCT FROM jsonb_build_object('transport','SYNTHETIC_ONLY','registrationRef',b->'executorRegistrationRef','executionId',e.execution_id,'generation',e.generation,'grantKind',b->'grantKind')
   OR NEW.payload_ref IS DISTINCT FROM jsonb_build_object('commandRef',expected,'grantRef',b->'grantRef','envelopeHash',e.envelope_hash)
   OR NEW.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('scope',scope,'commandRef',expected,'grantRef',b->'grantRef','envelopeHash',e.envelope_hash)) THEN RAISE EXCEPTION 'STOP_OUTBOX_EXACT_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER stop_outbox_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.delivery_outbox FOR EACH ROW EXECUTE FUNCTION anvil.guard_stop_outbox();
CREATE FUNCTION anvil.guard_stop_shared_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v jsonb=to_jsonb(NEW);c anvil.commands%ROWTYPE;e anvil.execution_commands%ROWTYPE;cid uuid;
BEGIN
 cid=(CASE WHEN TG_TABLE_NAME='commands' THEN v->>'id' ELSE v->>'command_id' END)::uuid;
 SELECT * INTO c FROM anvil.commands WHERE id=cid;
 IF c.operation='requestExecutionStop' THEN
  SELECT * INTO e FROM anvil.execution_commands WHERE project_id=c.project_id AND created_command_id=cid;
  IF e.id IS NULL OR NOT anvil.check_stop_command(c.project_id,cid,to_jsonb(e),true) THEN RAISE EXCEPTION 'STOP_COMMAND_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER stop_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_stop_shared_complete();
CREATE CONSTRAINT TRIGGER stop_outbox_complete AFTER INSERT ON anvil.delivery_outbox DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_stop_shared_complete();
