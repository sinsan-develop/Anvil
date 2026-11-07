-- FN12 보완 초안 불변 저장. 실제 새 임무/writer·실행·실패집계는 만들지 않는다.
-- 기존 SQL/공용 guard·정식 DB는 변경하지 않는 신규 forward 후보다.
CREATE TABLE anvil.result_rework_drafts(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid PRIMARY KEY,result_id uuid NOT NULL,review_id uuid NOT NULL,binding_id uuid NOT NULL,binding_version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL,
 UNIQUE(project_id,id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,result_id) REFERENCES anvil.result_submissions(project_id,id),
 FOREIGN KEY(project_id,review_id) REFERENCES anvil.result_reviews(project_id,id),
 FOREIGN KEY(project_id,binding_id,binding_version) REFERENCES anvil.role_bindings(project_id,binding_id,version),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.result_rework_drafts TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.result_rework_drafts FROM anvil_v3_app;

CREATE FUNCTION anvil.result_rework_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='requestRework' AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'requestRework' AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'requestRework' AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;


CREATE FUNCTION anvil.result_rework_scopes_within(child jsonb,parent jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s jsonb;t jsonb;
BEGIN
 IF NOT anvil.execution_source_scopes_valid(child) OR NOT anvil.execution_source_scopes_valid(parent) THEN RETURN false;END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(child) LOOP
  FOR t IN SELECT value FROM jsonb_array_elements(s->'targets') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(parent) p,jsonb_array_elements(p->'targets') q
    WHERE p-'targets'=s-'targets' AND q->'relativePath'=t->'relativePath' AND q->'kind'=t->'kind' AND q->'recursive'=t->'recursive'
    AND (q->'access'=t->'access' OR q->>'access'='WRITE' AND t->>'access'='READ')) THEN RETURN false;END IF;
  END LOOP;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.result_rework_payload_valid(input jsonb,review jsonb,assignment jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;seen text[]='{}';
BEGIN
 IF NOT anvil.execution_json_shape(input,ARRAY['resultRef','reviewRef','responsibleBindingRef','missingItems','sourceScopes','reason'])
  OR NOT anvil.execution_preparation_ref_valid(input->'resultRef') OR NOT anvil.execution_preparation_ref_valid(input->'reviewRef') OR NOT anvil.execution_preparation_ref_valid(input->'responsibleBindingRef')
  OR NOT anvil.result_text_valid(input->'reason',20000) OR NOT anvil.assignment_content_reason(input->>'reason') OR NOT anvil.result_texts_safe(input)
  OR jsonb_typeof(input->'missingItems') IS DISTINCT FROM 'array' OR jsonb_array_length(input->'missingItems') NOT BETWEEN 1 AND 100
  OR review->'input'->>'outcome' NOT IN('REWORK','BLOCKED') OR NOT anvil.result_rework_scopes_within(input->'sourceScopes',assignment->'definition'->'allowedScopes')
  OR octet_length(anvil.execution_authority_canonical(input))>2097152 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(input->'missingItems') LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR item#>>'{}'=ANY(seen)
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(review->'input'->'items') r WHERE r->'criterionId'=item AND r->>'outcome' IN('REWORK','BLOCKED')) THEN RETURN false;END IF;
  seen=array_append(seen,item#>>'{}');
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.result_rework_plan_current(pid uuid,reference jsonb,task_code text,expected_card_hash text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE w anvil.work_plans%ROWTYPE;v anvil.work_plan_versions%ROWTYPE;f anvil.work_plan_confirmations%ROWTYPE;source jsonb;chosen jsonb;latest uuid;outcome text;
BEGIN
 IF NOT anvil.execution_preparation_ref_valid(reference) THEN RETURN false;END IF;
 SELECT * INTO w FROM anvil.work_plans WHERE project_id=pid AND id::text=reference->>'id';
 SELECT * INTO v FROM anvil.work_plan_versions WHERE project_id=pid AND plan_id=w.id AND version=w.head_version;
 SELECT * INTO f FROM anvil.work_plan_confirmations WHERE project_id=pid AND plan_id=w.id AND version=w.head_version AND target_hash=v.content_hash;
 IF w.id IS NULL OR v.plan_id IS NULL OR f.id IS NULL OR w.head_version IS DISTINCT FROM w.confirmed_version
  OR reference IS DISTINCT FROM jsonb_build_object('id',w.id,'version',w.head_version,'contentHash',v.content_hash)
  OR v.content_hash IS DISTINCT FROM anvil.execution_json_hash(v.version_json-ARRAY['ref','status'])
  OR v.version_json->>'relationalProjection' IS DISTINCT FROM 'STORED' OR v.version_json->'issues' IS DISTINCT FROM '[]'::jsonb
  OR f.validation_json->'validForConfirmation' IS DISTINCT FROM 'true'::jsonb OR f.validation_json->'issues' IS DISTINCT FROM '[]'::jsonb
  OR f.validation_json->'sourceRefs' IS DISTINCT FROM jsonb_build_array(v.version_json->'documentRef',v.version_json->'designRef')
  OR f.validation_json->'screenReviewRefs' IS DISTINCT FROM v.screen_review_refs
  OR NOT EXISTS(SELECT 1 FROM anvil.plan_tasks pt WHERE pt.project_id=pid AND pt.plan_id=w.id AND pt.plan_version=w.head_version AND pt.task_code=result_rework_plan_current.task_code AND pt.card_hash=expected_card_hash AND pt.card_hash=anvil.execution_json_hash(pt.card_json))
  OR NOT EXISTS(SELECT 1 FROM anvil.commands c WHERE c.project_id=pid AND c.id=f.command_id AND c.operation='confirmWorkPlan' AND c.state='APPLIED'
    AND c.result_ref->'data'->>'confirmationId'=f.id::text AND c.result_ref->'data'->'ref'=reference AND c.result_ref->'data'->'validation'=f.validation_json)
  THEN RETURN false;END IF;
 SELECT r.id,r.outcome INTO latest,outcome FROM anvil.content_reviews r JOIN anvil.audit_events e ON e.command_id=r.command_id AND e.project_id=r.project_id
  WHERE r.project_id=pid AND r.scope_kind='PROJECT' AND r.target_kind='WORK_PLAN' AND r.target_id=w.id AND r.target_version=w.head_version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY e.server_sequence DESC LIMIT 1;
 IF latest IS NULL OR outcome IS DISTINCT FROM 'ACCEPTED' THEN RETURN false;END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(jsonb_build_array(v.version_json->'documentRef',v.version_json->'designRef')) LOOP
  IF NOT EXISTS(SELECT 1 FROM anvil.documents d JOIN anvil.document_versions dv ON dv.project_id=d.project_id AND dv.document_id=d.id AND dv.version=d.head_version
   WHERE d.project_id=pid AND d.id::text=source->>'id' AND d.head_version::text=source->>'version' AND d.confirmed_version=d.head_version AND dv.content_hash=source->>'contentHash'
   AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events e ON e.command_id=r.command_id AND e.project_id=r.project_id
    WHERE r.project_id=pid AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.target_id=d.id AND r.target_version=d.head_version AND r.target_hash=dv.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY e.server_sequence DESC LIMIT 1)='ACCEPTED') THEN RETURN false;END IF;
 END LOOP;
 FOR chosen IN SELECT value FROM jsonb_array_elements(v.screen_review_refs) LOOP
  IF NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.project_id=pid AND r.id::text=chosen->>'id' AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' AND r.outcome='ACCEPTED'
   AND chosen=jsonb_build_object('id',r.id,'targetRef',jsonb_build_object('id',r.target_id,'version',r.target_version,'contentHash',r.target_hash),'criteriaVersion',1,'outcome','ACCEPTED')
   AND r.id=(SELECT r2.id FROM anvil.content_reviews r2 JOIN anvil.audit_events e ON e.command_id=r2.command_id AND e.project_id=r2.project_id WHERE r2.project_id=pid AND r2.scope_kind='PROJECT' AND r2.target_kind='DOCUMENT' AND r2.target_id=r.target_id AND r2.target_version=r.target_version AND r2.target_hash=r.target_hash ORDER BY e.server_sequence DESC LIMIT 1)) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_result_rework_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;r anvil.result_submissions%ROWTYPE;rv anvil.result_reviews%ROWTYPE;
 b anvil.role_bindings%ROWTYPE;role anvil.project_roles%ROWTYPE;a anvil.assignment_versions%ROWTYPE;dv anvil.assignment_draft_versions%ROWTYPE;ad anvil.assignment_drafts%ROWTYPE;
 pm anvil.project_methodologies%ROWTYPE;session anvil.auth_sessions%ROWTYPE;generation bigint;s jsonb;reference jsonb;input jsonb;expected jsonb;remaining jsonb;task jsonb;
BEGIN
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE project_id=NEW.project_id AND id=NEW.command_id;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE command_id=cmd.id AND id=cmd.authorization_receipt_id;
 SELECT * INTO session FROM anvil.auth_sessions WHERE id::text=current_setting('anvil.result_rework_session_id',true) AND user_id=cmd.actor_id AND client_id=cmd.client_id;
 SELECT credential_generation INTO generation FROM anvil.users WHERE id=cmd.actor_id;
 SELECT * INTO r FROM anvil.result_submissions WHERE project_id=NEW.project_id AND id=NEW.result_id;
 SELECT * INTO rv FROM anvil.result_reviews WHERE project_id=NEW.project_id AND id=NEW.review_id;
 SELECT * INTO b FROM anvil.role_bindings WHERE project_id=NEW.project_id AND binding_id=NEW.binding_id AND version=NEW.binding_version;
 SELECT * INTO role FROM anvil.project_roles WHERE project_id=NEW.project_id AND role_id=b.role_id;
 SELECT * INTO a FROM anvil.assignment_versions WHERE project_id=NEW.project_id AND assignment_id::text=r.assignment_ref->>'id' AND version::text=r.assignment_ref->>'version';
 SELECT * INTO ad FROM anvil.assignment_drafts WHERE project_id=NEW.project_id AND id=a.assignment_id;
 SELECT * INTO dv FROM anvil.assignment_draft_versions WHERE project_id=NEW.project_id AND draft_id=ad.id AND version=ad.head_version;
 SELECT * INTO pm FROM anvil.project_methodologies WHERE project_id=NEW.project_id ORDER BY application_version DESC LIMIT 1;
 s=NEW.snapshot_json;input=s->'input';task=a.version_json->'definition'->'taskRef';reference=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash);
 IF NOT COALESCE(anvil.result_rework_plan_current(NEW.project_id,task->'planRef',task->>'taskCode',dv.version_json->'basis'->>'taskCardHash'),false)
  THEN RAISE EXCEPTION 'RESULT_REWORK_PLAN_NOT_CURRENT' USING ERRCODE='42501';END IF;
 SELECT COALESCE(jsonb_agg(i->'criterionId' ORDER BY ord),'[]'::jsonb) INTO remaining
 FROM jsonb_array_elements(rv.snapshot_json->'input'->'items') WITH ORDINALITY AS parts(i,ord)
 WHERE i->>'outcome' IN('REWORK','BLOCKED') AND NOT ((input->'missingItems') ? (i->>'criterionId'));
 expected=jsonb_build_object('scope',r.snapshot_json->'scope','input',input,'criteriaRef',rv.snapshot_json->'input'->'criteriaRef','roleRef',b.snapshot_json->'roleRef',
  'stageSessionRef',b.snapshot_json->'sessionRef','remainingMissingItems',remaining,'preservedItems','[]'::jsonb,
  'requestedBy',jsonb_build_object('kind','HUMAN','userId',NEW.created_by,'clientId',NEW.client_id),'requestedAt',to_char(NEW.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'scopeVerification','ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED','completionAccepted',false,'formalFailureCounted',false,'executionAuthorized',false,'dispatchPerformed',false);
 IF cmd.id IS NULL OR ar.id IS NULL OR r.id IS NULL OR rv.id IS NULL OR b.binding_id IS NULL OR role.role_id IS NULL OR a.assignment_id IS NULL OR dv.draft_id IS NULL OR pm.id IS NULL OR session.id IS NULL
  OR session.revoked_at IS NOT NULL OR session.credential_generation IS DISTINCT FROM generation OR session.idle_expires_at<=clock_timestamp() OR session.absolute_expires_at<=clock_timestamp()
  OR NOT COALESCE(anvil.result_rework_authorized(NEW.project_id),false) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR cmd.expected_version<>0
  OR s IS DISTINCT FROM expected OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s)
  OR r.content_hash IS DISTINCT FROM anvil.execution_json_hash(r.snapshot_json) OR rv.content_hash IS DISTINCT FROM anvil.execution_json_hash(rv.snapshot_json)
  OR b.content_hash IS DISTINCT FROM anvil.execution_json_hash(b.snapshot_json) OR role.content_hash IS DISTINCT FROM anvil.execution_json_hash(role.snapshot_json)
  OR a.content_hash IS DISTINCT FROM anvil.execution_json_hash(a.version_json) OR dv.content_hash IS DISTINCT FROM anvil.execution_json_hash(dv.version_json)
  OR input->'resultRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash)
  OR input->'reviewRef' IS DISTINCT FROM jsonb_build_object('id',rv.id,'version',1,'contentHash',rv.content_hash)
  OR input->'responsibleBindingRef' IS DISTINCT FROM jsonb_build_object('id',b.binding_id,'version',b.version,'contentHash',b.content_hash)
  OR rv.result_id IS DISTINCT FROM r.id OR rv.snapshot_json->'scope' IS DISTINCT FROM r.snapshot_json->'scope'
  OR rv.snapshot_json->'input'->'resultRef' IS DISTINCT FROM input->'resultRef'
  OR r.assignment_ref IS DISTINCT FROM b.snapshot_json->'assignmentRef' OR r.assignment_ref IS DISTINCT FROM jsonb_build_object('id',a.assignment_id,'version',a.version,'contentHash',a.content_hash)
  OR a.version_json->'draftRef' IS DISTINCT FROM jsonb_build_object('id',dv.draft_id,'version',dv.version,'contentHash',dv.content_hash)
  OR b.snapshot_json->'roleRef' IS DISTINCT FROM jsonb_build_object('id',role.role_id,'version',role.version,'contentHash',role.content_hash)
  OR role.snapshot_json->>'kind' IS DISTINCT FROM 'STAGE_OWNER' OR role.snapshot_json->'stageRef' IS DISTINCT FROM jsonb_build_object('applicationRef',task->'applicationRef','nodeId',task->'nodeId')
  OR task->'applicationRef' IS DISTINCT FROM jsonb_build_object('id',pm.id,'version',pm.application_version,'contentHash',pm.snapshot_hash)
  OR pm.snapshot_hash IS DISTINCT FROM anvil.execution_json_hash(pm.snapshot_json)
  OR EXISTS(SELECT 1 FROM anvil.role_bindings next WHERE next.project_id=NEW.project_id AND next.role_id=b.role_id AND next.version>b.version)
  OR b.snapshot_json->>'state' IS DISTINCT FROM 'RESERVED' OR b.snapshot_json->'externalSessionHandleRef' IS DISTINCT FROM 'null'::jsonb
  OR b.snapshot_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR b.snapshot_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR rv.created_at>NEW.created_at OR b.created_at>NEW.created_at OR r.submitted_at>NEW.created_at
  OR NOT COALESCE(anvil.result_rework_payload_valid(input,rv.snapshot_json,a.version_json),false)
  OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR cmd.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','requestRework','targetId','null'::jsonb,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',input))
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'commandId' IS DISTINCT FROM cmd.command_id::text OR cmd.result_ref->>'operationId' IS DISTINCT FROM cmd.operation_id::text
  OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR cmd.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',reference,'status','RESULT_REWORK_DRAFT_STORED','snapshot',s,'reworkStored',true,'currentBindingVerified',false,'currentAuthorityVerified',false,'completionAccepted',false,'formalFailureCounted',false,'executionAuthorized',false,'dispatchPerformed',false)
  OR ar.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('projectId',NEW.project_id,'actorId',cmd.actor_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',reference))
  OR NEW.created_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) OR (cmd.result_ref->>'serverReceivedAt')::timestamptz IS DISTINCT FROM NEW.created_at
  THEN RAISE EXCEPTION 'RESULT_REWORK_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_rework_insert BEFORE INSERT ON anvil.result_rework_drafts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_insert();
CREATE CONSTRAINT TRIGGER result_rework_commit AFTER INSERT ON anvil.result_rework_drafts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_insert();
CREATE FUNCTION anvil.guard_result_rework_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RESULT_REWORK_HISTORY_IMMUTABLE' USING ERRCODE='42501';END;
$$;
CREATE TRIGGER result_rework_immutable BEFORE UPDATE OR DELETE ON anvil.result_rework_drafts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_immutable();
CREATE FUNCTION anvil.guard_result_rework_receipt_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation='requestRework' AND NOT EXISTS(SELECT 1 FROM anvil.result_rework_drafts r WHERE r.project_id=NEW.project_id AND r.command_id=NEW.id
  AND NEW.result_ref->'data'->'ref'=jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash) AND NEW.result_ref->'data'->'snapshot'=r.snapshot_json)
 THEN RAISE EXCEPTION 'RESULT_REWORK_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER result_rework_receipt_commit AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_receipt_commit();

CREATE FUNCTION anvil.guard_result_rework_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF OLD.operation='requestRework' THEN RAISE EXCEPTION 'RESULT_REWORK_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=OLD.command_id AND c.operation='requestRework') THEN RAISE EXCEPTION 'RESULT_REWORK_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER result_rework_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_shared_history();
CREATE TRIGGER result_rework_receipt_history BEFORE UPDATE OR DELETE ON anvil.authorization_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_shared_history();
CREATE TRIGGER result_rework_audit_history BEFORE UPDATE OR DELETE ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_shared_history();

-- 原 감사는 receipt 직후/criteria 행과 GUC 설정 전에 들어온다. 기존 연산은 건드리지 않는다.
-- 최초 1행의 전체 대응과 이후 추가 금지를 같은 project 잠금으로 직렬화한다.
CREATE FUNCTION anvil.guard_result_rework_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;
BEGIN
 SELECT * INTO cmd FROM anvil.commands WHERE id=NEW.command_id;
 IF cmd.operation IS DISTINCT FROM 'requestRework' THEN RETURN NEW;END IF;
 PERFORM id FROM anvil.projects WHERE id=cmd.project_id FOR UPDATE;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE id=cmd.authorization_receipt_id AND command_id=cmd.id;
 IF ar.id IS NULL OR NEW.project_id IS DISTINCT FROM cmd.project_id OR NEW.operation_id IS DISTINCT FROM cmd.operation_id
  OR NEW.outcome IS DISTINCT FROM 'APPLIED' OR NEW.source_kind IS DISTINCT FROM 'HUMAN_COMMAND'
  OR NEW.scope_digest IS DISTINCT FROM ar.scope_digest OR NEW.target_ref IS DISTINCT FROM cmd.result_ref->'data'->'ref'
  OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR NEW.client_ref IS DISTINCT FROM cmd.client_id
  OR NEW.policy_ref IS DISTINCT FROM cmd.policy_ref OR NEW.approval_ref IS NOT NULL
  OR EXISTS(SELECT 1 FROM anvil.audit_events WHERE command_id=cmd.id)
  OR EXISTS(SELECT 1 FROM anvil.result_rework_drafts WHERE command_id=cmd.id)
 THEN RAISE EXCEPTION 'RESULT_REWORK_AUDIT_EXACT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_rework_audit_insert BEFORE INSERT ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_rework_audit_insert();
