-- 기존 업로드 한 후보의 실제 저장과 일회 소비를 같은 명령/transaction에 결박한다.
CREATE FUNCTION anvil.one_time_consumption_command_authorized(p_project uuid,p_command uuid,p_decision uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref=p_decision
 JOIN anvil.approval_decisions d ON d.id=p_decision AND d.project_id=c.project_id AND d.decision='APPROVE' AND d.command_id IS NOT NULL AND d.decision_json IS NOT NULL
 JOIN anvil.approval_requests r ON r.id=d.request_id AND r.project_id=d.project_id AND r.version=2 AND r.status='APPROVED' AND r.command_id IS NOT NULL AND r.policy_ref=c.policy_ref AND r.scope_digest=d.scope_digest AND d.request_version=1
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=c.project_id AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id=p_command AND c.project_id=p_project AND c.scope_kind='PROJECT' AND c.scope_id=c.project_id AND c.operation='uploadArtifact' AND c.state='APPLIED' AND c.expected_version=0
 AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NOT NULL AND c.command_id=r.candidate_command_id AND r.created_by=c.actor_id AND r.client_id=c.client_id AND d.decided_by=r.created_by AND d.client_id=r.client_id AND d.control_generation=pc.generation
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND r.request_json->>'controlGeneration'=pc.generation::text AND r.action_scope_json->>'controlGeneration'=pc.generation::text AND r.expires_at>clock_timestamp()
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',r.action_scope_json->>'payloadHash','scopeDigest',r.scope_digest)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? 'uploadArtifact' AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? 'uploadArtifact' AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;
CREATE FUNCTION anvil.guard_one_time_approval_consumption() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
 OR NOT anvil.one_time_consumption_command_authorized(NEW.project_id,NEW.command_id,NEW.decision_id)
 OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.approval_decisions d ON d.project_id=c.project_id AND d.id=NEW.decision_id JOIN anvil.approval_requests r ON r.project_id=d.project_id AND r.id=d.request_id
  WHERE c.project_id=NEW.project_id AND c.id=NEW.command_id AND c.approval_consumption_id=NEW.id AND NEW.scope_digest=r.scope_digest AND NEW.policy_id::text=c.policy_ref->>'id' AND NEW.policy_version::text=c.policy_ref->>'version')
 THEN RAISE EXCEPTION 'APPROVAL_CONSUMPTION_EXACT_CURRENT_COMMAND_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER unconnected_approval_consumption_guard ON anvil.approval_consumptions;
CREATE TRIGGER one_time_approval_consumption_guard BEFORE INSERT ON anvil.approval_consumptions FOR EACH ROW EXECUTE FUNCTION anvil.guard_one_time_approval_consumption();
CREATE OR REPLACE FUNCTION anvil.guard_one_time_approval_request() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_result jsonb;v_snapshot jsonb;v_scope jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.version=2 AND OLD.status='APPROVED' AND NEW.version=3 AND NEW.status='CONSUMED' THEN
   IF (to_jsonb(NEW)-ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version'])
   OR NOT EXISTS(SELECT 1 FROM anvil.approval_consumptions ac JOIN anvil.approval_decisions d ON d.project_id=ac.project_id AND d.id=ac.decision_id
    WHERE ac.project_id=OLD.project_id AND d.request_id=OLD.id AND ac.scope_digest=OLD.scope_digest AND ac.command_id::text=current_setting('anvil.command_id',true) AND anvil.one_time_consumption_command_authorized(ac.project_id,ac.command_id,ac.decision_id))
   THEN RAISE EXCEPTION 'APPROVAL_EXACT_CONSUMPTION_REQUIRED' USING ERRCODE='42501';END IF;
   RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version']) OR OLD.version<>1 OR OLD.status<>'PENDING' OR NEW.version<>2
  OR NOT EXISTS(SELECT 1 FROM anvil.approval_decisions d JOIN anvil.commands c ON c.id=d.command_id AND c.project_id=d.project_id
    WHERE d.project_id=OLD.project_id AND d.request_id=OLD.id AND d.request_version=OLD.version AND d.scope_digest=OLD.scope_digest AND d.decided_by=OLD.created_by AND d.client_id=OLD.client_id
    AND d.command_id::text=current_setting('anvil.command_id',true) AND anvil.one_time_decision_command_authorized(d.project_id,d.command_id)
    AND c.result_ref->'data'->>'status'='APPROVAL_DECIDED' AND c.result_ref->'data'->'decision'=d.decision_json
    AND NEW.status=CASE d.decision WHEN 'APPROVE' THEN 'APPROVED' WHEN 'REJECT' THEN 'REJECTED' WHEN 'REQUEST_CHANGE' THEN 'CHANGE_REQUESTED' END)
  THEN RAISE EXCEPTION 'APPROVAL_EXACT_DECISION_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
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
