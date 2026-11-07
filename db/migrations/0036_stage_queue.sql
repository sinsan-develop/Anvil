-- FN10 승인 계획의 WAITING 시작요청/미시작취소 후보. 실제 DB 적용/권한 부여/예약/dispatch 아님.
CREATE TABLE anvil.stage_runs(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,sequence bigint NOT NULL CHECK(sequence BETWEEN 1 AND 9007199254740991),
 input_json jsonb NOT NULL,created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(project_id,id),UNIQUE(project_id,sequence),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
CREATE TABLE anvil.queue_requests(
 project_id uuid NOT NULL,request_id uuid NOT NULL,version bigint NOT NULL CHECK(version IN(1,2)),sequence bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,command_id uuid NOT NULL,
 PRIMARY KEY(project_id,request_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,request_id) REFERENCES anvil.stage_runs(project_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.stage_runs,anvil.queue_requests TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.stage_runs,anvil.queue_requests FROM anvil_v3_app;

CREATE FUNCTION anvil.stage_queue_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op IN('startStage','cancelQueuedRequest') AND EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation=op AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref' AND a.policy_ref=c.policy_ref AND a.approval_ref IS NULL AND a.actor_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND a.client_ref=c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.stage_queue_input_valid(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text;n jsonb;
BEGIN
 IF NOT anvil.execution_json_shape(p,ARRAY['stageRef','methodologyApplicationRef','mode','startNodeRef','endBoundaryRef','baselineRefs','budgetRef','reason'])
  OR NOT anvil.execution_preparation_ref_valid(p->'methodologyApplicationRef') OR NOT anvil.execution_preparation_ref_valid(p->'budgetRef')
  OR NOT anvil.result_refs_valid(p->'baselineRefs') OR jsonb_array_length(p->'baselineRefs')<1
  OR jsonb_typeof(p->'mode') IS DISTINCT FROM 'string' OR p->>'mode' NOT IN('AUTO','CASE_BY_CASE') OR NOT anvil.assignment_content_reason(p->>'reason')
  OR NOT anvil.result_texts_safe(p) OR octet_length(anvil.execution_authority_canonical(p))>2097152 THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['stageRef','startNodeRef','endBoundaryRef'] LOOP
  n=p->k;
  IF NOT anvil.execution_json_shape(n,ARRAY['applicationRef','nodeId']) OR n->'applicationRef' IS DISTINCT FROM p->'methodologyApplicationRef'
   OR jsonb_typeof(n->'nodeId') IS DISTINCT FROM 'string' OR n->>'nodeId' !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' THEN RETURN false;END IF;
 END LOOP;
 RETURN p->'stageRef'=p->'startNodeRef' AND (p->>'mode'<>'CASE_BY_CASE' OR p->'startNodeRef'=p->'endBoundaryRef');
EXCEPTION WHEN OTHERS THEN RETURN false;
END;$$;

CREATE FUNCTION anvil.guard_stage_run_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;app anvil.project_methodologies%ROWTYPE;budget anvil.limit_policy_versions%ROWTYPE;p jsonb;reachable boolean;
BEGIN
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO c FROM anvil.commands WHERE id=NEW.command_id;
 p=NEW.input_json;
 IF c.id IS NULL OR NOT COALESCE(anvil.stage_queue_authorized(NEW.project_id,'startStage'),false)
  OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR c.actor_id IS DISTINCT FROM NEW.created_by OR c.client_id IS DISTINCT FROM NEW.client_id
  OR c.expected_version<>0 OR NEW.created_at<transaction_timestamp()-interval '1 millisecond' OR NEW.created_at>clock_timestamp() OR c.result_ref->'data'->'snapshot'->'input' IS DISTINCT FROM p
  OR c.result_ref->'data'->'ref'->>'id' IS DISTINCT FROM NEW.id::text OR NOT anvil.stage_queue_input_valid(p)
  OR NEW.sequence IS DISTINCT FROM (SELECT COALESCE(MAX(sequence),0)+1 FROM anvil.stage_runs WHERE project_id=NEW.project_id)
 THEN RAISE EXCEPTION 'STAGE_RUN_EXACT_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO app FROM anvil.project_methodologies WHERE project_id=NEW.project_id ORDER BY application_version DESC LIMIT 1;
 IF app.id IS NULL OR p->'methodologyApplicationRef' IS DISTINCT FROM jsonb_build_object('id',app.id,'version',app.application_version,'contentHash',app.snapshot_hash)
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(app.snapshot_json->'graph'->'nodes') n WHERE n->>'nodeId'=p->'startNodeRef'->>'nodeId' AND (p->>'mode'='CASE_BY_CASE' OR n->>'mode'='AUTO'))
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(app.snapshot_json->'graph'->'nodes') n WHERE n->>'nodeId'=p->'endBoundaryRef'->>'nodeId')
 THEN RAISE EXCEPTION 'STAGE_APPLICATION_NOT_CURRENT' USING ERRCODE='42501';END IF;
 WITH RECURSIVE reached(id) AS(
  SELECT p->'startNodeRef'->>'nodeId'
  UNION SELECT e->>'toNodeId' FROM reached r CROSS JOIN jsonb_array_elements(app.snapshot_json->'graph'->'edges') e WHERE e->>'fromNodeId'=r.id
 )SELECT EXISTS(SELECT 1 FROM reached WHERE id=p->'endBoundaryRef'->>'nodeId') INTO reachable;
 IF NOT reachable THEN RAISE EXCEPTION 'STAGE_END_UNREACHABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO budget FROM anvil.limit_policy_versions WHERE project_id=NEW.project_id AND scope_json=jsonb_build_object('kind','PROJECT','projectId',NEW.project_id) ORDER BY version DESC LIMIT 1;
 IF budget.policy_id IS NULL OR p->'budgetRef' IS DISTINCT FROM jsonb_build_object('id',budget.policy_id,'version',budget.version,'contentHash',budget.content_hash)
  OR budget.snapshot_json->>'state' IS DISTINCT FROM 'APPLIED' OR (budget.snapshot_json->>'expiresAt')::timestamptz<=clock_timestamp()
 THEN RAISE EXCEPTION 'STAGE_BUDGET_NOT_CURRENT' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER stage_run_insert BEFORE INSERT ON anvil.stage_runs FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_run_insert();

CREATE FUNCTION anvil.guard_stage_queue_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;run anvil.stage_runs%ROWTYPE;old anvil.queue_requests%ROWTYPE;s jsonb;ref jsonb;op text;payload jsonb;
BEGIN
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO c FROM anvil.commands WHERE id=NEW.command_id;
 SELECT * INTO run FROM anvil.stage_runs WHERE project_id=NEW.project_id AND id=NEW.request_id;
 s=NEW.snapshot_json;ref=jsonb_build_object('id',NEW.request_id,'version',NEW.version,'contentHash',NEW.content_hash);
 op=CASE WHEN NEW.version=1 THEN 'startStage' ELSE 'cancelQueuedRequest' END;
 IF run.id IS NULL OR c.id IS NULL OR NOT COALESCE(anvil.stage_queue_authorized(NEW.project_id,op),false)
  OR c.id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.sequence IS DISTINCT FROM run.sequence
  OR NOT anvil.execution_json_shape(s,ARRAY['projectId','requestId','version','sequence','state','input','assignmentRef','readinessIssues','queuedAt','cancelledAt','cancelledBy','cancellationReason','requestedBy','previousRef','slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'])
  OR s->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id) OR s->'requestId' IS DISTINCT FROM to_jsonb(NEW.request_id) OR s->'version' IS DISTINCT FROM to_jsonb(NEW.version) OR s->'sequence' IS DISTINCT FROM to_jsonb(run.sequence)
  OR s->'input' IS DISTINCT FROM run.input_json OR s->'assignmentRef' IS DISTINCT FROM 'null'::jsonb
  OR s->'readinessIssues' IS DISTINCT FROM '["ASSIGNMENT_BINDING_UNVERIFIED","BASELINE_STATE_UNVERIFIED","EXECUTION_STATE_UNVERIFIED","DISPATCH_NOT_CONNECTED"]'::jsonb
  OR s->'slotReserved' IS DISTINCT FROM 'false'::jsonb OR s->'writerReservationPerformed' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'requestedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',run.created_by,'clientId',run.client_id)
  OR (s->>'queuedAt')::timestamptz IS DISTINCT FROM run.created_at
  OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.execution_authority_canonical(s),'UTF8')),'hex')
  OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR c.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',ref,'queueState',s->'state','snapshot',s)
  OR c.result_ref->'targetId' IS DISTINCT FROM to_jsonb(NEW.request_id) OR c.result_ref->'version' IS DISTINCT FROM to_jsonb(NEW.version)
 THEN RAISE EXCEPTION 'STAGE_QUEUE_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF NEW.version=1 THEN
  IF s->>'state' IS DISTINCT FROM 'WAITING' OR s->'previousRef'<>'null'::jsonb OR s->'cancelledAt'<>'null'::jsonb OR s->'cancelledBy'<>'null'::jsonb OR s->'cancellationReason'<>'null'::jsonb OR c.expected_version<>0 OR run.command_id<>c.id
  THEN RAISE EXCEPTION 'STAGE_QUEUE_WAITING_REQUIRED' USING ERRCODE='42501';END IF;
  payload=run.input_json;
 ELSE
  SELECT * INTO old FROM anvil.queue_requests WHERE project_id=NEW.project_id AND request_id=NEW.request_id AND version=1;
  IF old.request_id IS NULL OR old.snapshot_json->>'state' IS DISTINCT FROM 'WAITING' OR s->>'state' IS DISTINCT FROM 'CANCELLED' OR c.expected_version<>1
   OR s->'previousRef' IS DISTINCT FROM jsonb_build_object('id',old.request_id,'version',1,'contentHash',old.content_hash)
   OR (s-ARRAY['version','state','cancelledAt','cancelledBy','cancellationReason','previousRef']) IS DISTINCT FROM (old.snapshot_json-ARRAY['version','state','cancelledAt','cancelledBy','cancellationReason','previousRef'])
   OR s->'cancelledBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
   OR jsonb_typeof(s->'cancellationReason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(s->>'cancellationReason')
   OR jsonb_typeof(s->'cancelledAt') IS DISTINCT FROM 'string' OR s->>'cancelledAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
   OR (s->>'cancelledAt')::timestamptz<run.created_at OR (s->>'cancelledAt')::timestamptz>clock_timestamp()
  THEN RAISE EXCEPTION 'STAGE_QUEUE_NOT_CANCELLABLE' USING ERRCODE='42501';END IF;
  payload=jsonb_build_object('requestRef',s->'previousRef','reason',s->'cancellationReason');
 END IF;
 IF c.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.execution_authority_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation',op,'targetId',CASE WHEN NEW.version=1 THEN 'null'::jsonb ELSE to_jsonb(NEW.request_id) END,'expectedVersion',NEW.version-1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload)),'UTF8')),'hex')
 THEN RAISE EXCEPTION 'STAGE_QUEUE_EXACT_INPUT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER stage_queue_insert BEFORE INSERT ON anvil.queue_requests FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_insert();

CREATE FUNCTION anvil.guard_stage_queue_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'STAGE_QUEUE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END;$$;
CREATE TRIGGER stage_runs_immutable BEFORE UPDATE OR DELETE ON anvil.stage_runs FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_immutable();
CREATE TRIGGER stage_queue_immutable BEFORE UPDATE OR DELETE ON anvil.queue_requests FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_immutable();
CREATE FUNCTION anvil.guard_stage_queue_receipt_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation IN('startStage','cancelQueuedRequest')
  AND NOT EXISTS(SELECT 1 FROM anvil.queue_requests q JOIN anvil.stage_runs r ON r.project_id=q.project_id AND r.id=q.request_id
   WHERE q.project_id=NEW.project_id AND q.command_id=NEW.id AND NEW.result_ref->'data'->'snapshot'=q.snapshot_json
    AND NEW.result_ref->'data'->'ref'=jsonb_build_object('id',q.request_id,'version',q.version,'contentHash',q.content_hash))
 THEN RAISE EXCEPTION 'STAGE_QUEUE_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NULL;
END;$$;
CREATE CONSTRAINT TRIGGER stage_queue_receipt_commit AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_receipt_commit();
CREATE FUNCTION anvil.guard_stage_queue_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF OLD.operation IN('startStage','cancelQueuedRequest') OR (TG_OP='UPDATE' AND NEW.operation IN('startStage','cancelQueuedRequest')) THEN RAISE EXCEPTION 'STAGE_QUEUE_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSIF EXISTS(SELECT 1 FROM anvil.commands WHERE id=OLD.command_id AND operation IN('startStage','cancelQueuedRequest')) THEN
  RAISE EXCEPTION 'STAGE_QUEUE_HISTORY_IMMUTABLE' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;$$;
CREATE TRIGGER stage_queue_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_shared_history();
CREATE TRIGGER stage_queue_receipt_history BEFORE UPDATE OR DELETE ON anvil.authorization_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_shared_history();
CREATE TRIGGER stage_queue_audit_history BEFORE UPDATE OR DELETE ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_shared_history();

CREATE FUNCTION anvil.guard_stage_queue_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM anvil.commands WHERE id=NEW.command_id;
 IF c.operation NOT IN('startStage','cancelQueuedRequest') OR c.operation IS NULL THEN RETURN NEW;END IF;
 PERFORM id FROM anvil.projects WHERE id=c.project_id FOR UPDATE;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE id=c.authorization_receipt_id AND command_id=c.id;
 IF ar.id IS NULL OR NEW.project_id IS DISTINCT FROM c.project_id OR NEW.operation_id IS DISTINCT FROM c.operation_id
  OR NEW.outcome IS DISTINCT FROM 'APPLIED' OR NEW.source_kind IS DISTINCT FROM 'HUMAN_COMMAND' OR NEW.scope_digest IS DISTINCT FROM ar.scope_digest
  OR NEW.target_ref IS DISTINCT FROM c.result_ref->'data'->'ref' OR NEW.policy_ref IS DISTINCT FROM c.policy_ref OR NEW.approval_ref IS NOT NULL
  OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',c.actor_id) OR NEW.client_ref IS DISTINCT FROM c.client_id
  OR EXISTS(SELECT 1 FROM anvil.audit_events WHERE command_id=c.id) OR EXISTS(SELECT 1 FROM anvil.queue_requests WHERE command_id=c.id)
 THEN RAISE EXCEPTION 'STAGE_QUEUE_AUDIT_EXACT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER stage_queue_audit_insert BEFORE INSERT ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_stage_queue_audit_insert();
