-- FN12 계획된 별도 검수 이력. 실제 증거 검증 전에는 보완/차단만 저장한다.
-- 정식 DB 자동 적용/합격·업무완료·실패집계·보완 실행/기존 공용 guard 변경은 없다.
CREATE TABLE anvil.result_reviews(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid PRIMARY KEY,result_id uuid NOT NULL,criteria_id uuid NOT NULL,criteria_version bigint NOT NULL,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL,
 UNIQUE(project_id,id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,result_id) REFERENCES anvil.result_submissions(project_id,id),
 FOREIGN KEY(project_id,criteria_id,criteria_version) REFERENCES anvil.result_criteria_versions(project_id,criteria_id,version),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.result_reviews TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.result_reviews FROM anvil_v3_app;

CREATE FUNCTION anvil.result_review_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='evaluateResult' AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'evaluateResult' AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'evaluateResult' AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;


CREATE FUNCTION anvil.result_review_payload_valid(input jsonb,criteria jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;seen text[]='{}';outcomes text[]='{}';
BEGIN
 IF NOT anvil.execution_json_shape(input,ARRAY['resultRef','criteriaRef','outcome','items','reason'])
  OR NOT anvil.execution_preparation_ref_valid(input->'resultRef') OR NOT anvil.execution_preparation_ref_valid(input->'criteriaRef')
  OR input->>'outcome' IS NULL OR input->>'outcome' NOT IN('REWORK','BLOCKED')
  OR NOT anvil.result_text_valid(input->'reason',20000) OR NOT anvil.assignment_content_reason(input->>'reason')
  OR NOT anvil.result_texts_safe(input) OR jsonb_typeof(input->'items') IS DISTINCT FROM 'array'
  OR jsonb_array_length(input->'items') NOT BETWEEN 1 AND 100 OR octet_length(anvil.execution_authority_canonical(input))>2097152
  OR jsonb_array_length(input->'items')<>jsonb_array_length(criteria->'items') THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(input->'items') LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['criterionId','outcome','evidenceRefs','reason'])
   OR jsonb_typeof(item->'criterionId') IS DISTINCT FROM 'string' OR item->>'criterionId'=ANY(seen)
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(criteria->'items') c WHERE c->>'criterionId'=item->>'criterionId')
   OR item->>'outcome' IS NULL OR item->>'outcome' NOT IN('REWORK','BLOCKED') OR item->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb
   OR NOT anvil.result_text_valid(item->'reason',20000) OR NOT anvil.assignment_content_reason(item->>'reason')
   THEN RETURN false;END IF;
  seen=array_append(seen,item->>'criterionId');outcomes=array_append(outcomes,item->>'outcome');
 END LOOP;
 RETURN input->>'outcome'=ANY(outcomes);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_result_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;r anvil.result_submissions%ROWTYPE;c anvil.result_criteria_versions%ROWTYPE;
 session anvil.auth_sessions%ROWTYPE;generation bigint;s jsonb;reference jsonb;input jsonb;expected jsonb;
BEGIN
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE project_id=NEW.project_id AND id=NEW.command_id;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE command_id=cmd.id AND id=cmd.authorization_receipt_id;
 SELECT * INTO session FROM anvil.auth_sessions WHERE id::text=current_setting('anvil.result_review_session_id',true) AND user_id=cmd.actor_id AND client_id=cmd.client_id;
 SELECT credential_generation INTO generation FROM anvil.users WHERE id=cmd.actor_id;
 SELECT * INTO r FROM anvil.result_submissions WHERE project_id=NEW.project_id AND id=NEW.result_id;
 SELECT * INTO c FROM anvil.result_criteria_versions WHERE project_id=NEW.project_id AND criteria_id=NEW.criteria_id AND version=NEW.criteria_version;
 s=NEW.snapshot_json;input=s->'input';reference=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash);
 IF input->>'outcome'='ACCEPTED' OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(input->'items')='array' THEN input->'items' ELSE '[]'::jsonb END) item WHERE item->>'outcome' IN('ACCEPTED','NOT_APPLICABLE') OR item->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb)
  THEN RAISE EXCEPTION 'RESULT_REVIEW_EVIDENCE_VERIFICATION_REQUIRED' USING ERRCODE='42501';END IF;
 expected=jsonb_build_object('scope',r.snapshot_json->'scope','input',input,'reviewedBy',jsonb_build_object('kind','HUMAN','userId',NEW.created_by,'clientId',NEW.client_id),
  'sameAsSubmitter',NEW.created_by=r.submitted_by,'reviewedAt',to_char(NEW.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'evidenceProvenanceVerified',false,'completionAccepted',false,'formalFailureCounted',false,'executionAuthorized',false,'dispatchPerformed',false);
 IF cmd.id IS NULL OR ar.id IS NULL OR r.id IS NULL OR c.criteria_id IS NULL OR session.id IS NULL OR session.revoked_at IS NOT NULL
  OR session.credential_generation IS DISTINCT FROM generation OR session.idle_expires_at<=clock_timestamp() OR session.absolute_expires_at<=clock_timestamp()
  OR NOT COALESCE(anvil.result_review_authorized(NEW.project_id),false) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR cmd.expected_version<>0
  OR s IS DISTINCT FROM expected OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s)
  OR r.content_hash IS DISTINCT FROM anvil.execution_json_hash(r.snapshot_json) OR c.content_hash IS DISTINCT FROM anvil.execution_json_hash(c.criteria_json)
  OR input->'resultRef' IS DISTINCT FROM jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash)
  OR input->'criteriaRef' IS DISTINCT FROM jsonb_build_object('id',c.criteria_id,'version',c.version,'contentHash',c.content_hash)
  OR r.assignment_ref IS DISTINCT FROM c.assignment_ref OR s->'scope'->'assignmentRef' IS DISTINCT FROM r.assignment_ref
  OR (r.submitted_at>NEW.created_at OR c.created_at>NEW.created_at)
  OR NOT COALESCE(anvil.result_review_payload_valid(input,c.criteria_json),false)
  OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR cmd.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','evaluateResult','targetId','null'::jsonb,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',input))
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'commandId' IS DISTINCT FROM cmd.command_id::text OR cmd.result_ref->>'operationId' IS DISTINCT FROM cmd.operation_id::text
  OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR cmd.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',reference,'status','RESULT_REVIEW_RECORDED','snapshot',s,'reviewStored',true,'completionAccepted',false,'formalFailureCounted',false,'evidenceProvenanceVerified',false,'executionAuthorized',false,'dispatchPerformed',false)
  OR ar.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('projectId',NEW.project_id,'actorId',cmd.actor_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',reference))
  OR NEW.created_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) OR (cmd.result_ref->>'serverReceivedAt')::timestamptz IS DISTINCT FROM NEW.created_at
  THEN RAISE EXCEPTION 'RESULT_REVIEW_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_review_insert BEFORE INSERT ON anvil.result_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_insert();
CREATE CONSTRAINT TRIGGER result_review_commit AFTER INSERT ON anvil.result_reviews DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_insert();
CREATE FUNCTION anvil.guard_result_review_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RESULT_REVIEW_HISTORY_IMMUTABLE' USING ERRCODE='42501';END;
$$;
CREATE TRIGGER result_review_immutable BEFORE UPDATE OR DELETE ON anvil.result_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_immutable();
CREATE FUNCTION anvil.guard_result_review_receipt_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation='evaluateResult' AND NOT EXISTS(SELECT 1 FROM anvil.result_reviews r WHERE r.project_id=NEW.project_id AND r.command_id=NEW.id
  AND NEW.result_ref->'data'->'ref'=jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash) AND NEW.result_ref->'data'->'snapshot'=r.snapshot_json)
 THEN RAISE EXCEPTION 'RESULT_REVIEW_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER result_review_receipt_commit AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_receipt_commit();

CREATE FUNCTION anvil.guard_result_review_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF OLD.operation='evaluateResult' THEN RAISE EXCEPTION 'RESULT_REVIEW_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=OLD.command_id AND c.operation='evaluateResult') THEN RAISE EXCEPTION 'RESULT_REVIEW_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER result_review_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_shared_history();
CREATE TRIGGER result_review_receipt_history BEFORE UPDATE OR DELETE ON anvil.authorization_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_shared_history();
CREATE TRIGGER result_review_audit_history BEFORE UPDATE OR DELETE ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_shared_history();

-- 原 감사는 receipt 직후/criteria 행과 GUC 설정 전에 들어온다. 기존 연산은 건드리지 않는다.
-- 최초 1행의 전체 대응과 이후 추가 금지를 같은 project 잠금으로 직렬화한다.
CREATE FUNCTION anvil.guard_result_review_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;
BEGIN
 SELECT * INTO cmd FROM anvil.commands WHERE id=NEW.command_id;
 IF cmd.operation IS DISTINCT FROM 'evaluateResult' THEN RETURN NEW;END IF;
 PERFORM id FROM anvil.projects WHERE id=cmd.project_id FOR UPDATE;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE id=cmd.authorization_receipt_id AND command_id=cmd.id;
 IF ar.id IS NULL OR NEW.project_id IS DISTINCT FROM cmd.project_id OR NEW.operation_id IS DISTINCT FROM cmd.operation_id
  OR NEW.outcome IS DISTINCT FROM 'APPLIED' OR NEW.source_kind IS DISTINCT FROM 'HUMAN_COMMAND'
  OR NEW.scope_digest IS DISTINCT FROM ar.scope_digest OR NEW.target_ref IS DISTINCT FROM cmd.result_ref->'data'->'ref'
  OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR NEW.client_ref IS DISTINCT FROM cmd.client_id
  OR NEW.policy_ref IS DISTINCT FROM cmd.policy_ref OR NEW.approval_ref IS NOT NULL
  OR EXISTS(SELECT 1 FROM anvil.audit_events WHERE command_id=cmd.id)
  OR EXISTS(SELECT 1 FROM anvil.result_reviews WHERE command_id=cmd.id)
 THEN RAISE EXCEPTION 'RESULT_REVIEW_AUDIT_EXACT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_review_audit_insert BEFORE INSERT ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_review_audit_insert();
