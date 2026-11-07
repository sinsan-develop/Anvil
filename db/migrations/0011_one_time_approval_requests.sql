-- 승인 요청만 연결한다. 실제 결정/소비/실행은 후속 계약 전 fail-closed 유지한다.
ALTER TABLE anvil.approval_requests ADD COLUMN client_id uuid;
ALTER TABLE anvil.approval_requests ADD COLUMN command_id uuid UNIQUE REFERENCES anvil.commands(id);
ALTER TABLE anvil.approval_requests ADD COLUMN policy_ref jsonb;
ALTER TABLE anvil.approval_requests ADD COLUMN content_hash text CHECK(content_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE anvil.approval_requests ADD COLUMN request_json jsonb;
ALTER TABLE anvil.approval_requests ADD CONSTRAINT approval_request_client_fk FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id);
CREATE UNIQUE INDEX approval_candidate_once ON anvil.approval_requests(project_id,candidate_command_id) WHERE command_id IS NOT NULL;
CREATE FUNCTION anvil.guard_one_time_approval_request() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_result jsonb;v_snapshot jsonb;v_scope jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'APPROVAL_DECISION_NOT_CONNECTED' USING ERRCODE='42501';END IF;
 IF NEW.command_id IS NULL OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true) THEN RAISE EXCEPTION 'APPROVAL_REQUEST_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT c.result_ref->'data' INTO v_result FROM anvil.commands c WHERE c.id=NEW.command_id AND c.scope_kind='PROJECT' AND c.project_id=NEW.project_id AND c.scope_id=c.project_id AND c.actor_id=NEW.created_by AND c.client_id=NEW.client_id AND c.operation='requestApproval' AND c.expected_version=0 AND c.state='APPLIED';
 v_snapshot=v_result->'request';v_scope=v_snapshot->'details'->'actionScope';
 IF v_result IS NULL OR v_snapshot IS NULL OR NEW.version<>1 OR NEW.status<>'PENDING' OR NEW.request_json IS DISTINCT FROM v_snapshot
 OR v_result->>'status' IS DISTINCT FROM 'APPROVAL_REQUESTED' OR v_result->'ref' IS DISTINCT FROM jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash)
 OR v_snapshot->>'id' IS DISTINCT FROM NEW.id::text OR v_snapshot->>'version' IS DISTINCT FROM '1' OR v_snapshot->>'status' IS DISTINCT FROM 'PENDING' OR v_snapshot->>'projectId' IS DISTINCT FROM NEW.project_id::text
 OR v_snapshot->'details' IS DISTINCT FROM NEW.details_json OR v_snapshot->'policyRef' IS DISTINCT FROM NEW.policy_ref OR v_snapshot->>'scopeDigest' IS DISTINCT FROM NEW.scope_digest OR v_snapshot->'requiredDecider' IS DISTINCT FROM NEW.required_decider_ref
 OR NEW.required_decider_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by)
 OR v_snapshot->'requestedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by,'clientId',NEW.client_id)
 OR v_scope IS DISTINCT FROM NEW.action_scope_json OR v_scope->>'operation' IS DISTINCT FROM 'uploadArtifact' OR v_scope->'targetRef' IS DISTINCT FROM 'null'::jsonb OR v_scope->>'expectedVersion' IS DISTINCT FROM '0'
 OR v_scope->'requestedSubjectRef' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',NEW.created_by,'clientId',NEW.client_id)
 OR v_scope->'baselineRefs' IS DISTINCT FROM '[]'::jsonb OR v_scope->'sourceScopes' IS DISTINCT FROM '[]'::jsonb OR v_scope->'environmentRef' IS DISTINCT FROM 'null'::jsonb OR v_scope->'limitsRef' IS DISTINCT FROM 'null'::jsonb
 OR v_snapshot->'details'->>'candidateCommandId' IS DISTINCT FROM NEW.candidate_command_id::text OR v_snapshot->'details'->>'expiresAt' IS NULL OR NEW.expires_at IS DISTINCT FROM (v_snapshot->'details'->>'expiresAt')::timestamptz OR NEW.expires_at<=clock_timestamp()
 OR NEW.created_at IS DISTINCT FROM (v_snapshot->>'createdAt')::timestamptz
 OR NOT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=c.project_id AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id=NEW.command_id AND c.policy_ref=NEW.policy_ref AND v_snapshot->>'controlGeneration'=pc.generation::text AND v_scope->>'controlGeneration'=pc.generation::text
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (rule->'operations') ? 'requestApproval' AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (rule->'operations') ? 'uploadArtifact' AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>=NEW.expires_at)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND ((rule->'operations') ? 'uploadArtifact' OR (rule->'operations') ? 'requestApproval') AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()))
 THEN RAISE EXCEPTION 'APPROVAL_REQUEST_EXACT_CURRENT_SCOPE_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER one_time_approval_request_guard BEFORE INSERT OR UPDATE ON anvil.approval_requests FOR EACH ROW EXECUTE FUNCTION anvil.guard_one_time_approval_request();
CREATE FUNCTION anvil.guard_unconnected_approval_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user='anvil_v3_app' THEN RAISE EXCEPTION 'APPROVAL_DECISION_CONSUMPTION_NOT_CONNECTED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER unconnected_approval_decision_guard BEFORE INSERT ON anvil.approval_decisions FOR EACH ROW EXECUTE FUNCTION anvil.guard_unconnected_approval_write();
CREATE TRIGGER unconnected_approval_consumption_guard BEFORE INSERT ON anvil.approval_consumptions FOR EACH ROW EXECUTE FUNCTION anvil.guard_unconnected_approval_write();
