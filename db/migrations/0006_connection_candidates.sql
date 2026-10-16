-- FN06: 미연결 후보만 저장한다. 실제 실행기 신뢰/credential/grant/Agent 실행은 만들지 않는다.
CREATE TABLE anvil.connection_candidates(
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN('CONNECTION_CANDIDATE','ENVIRONMENT_CANDIDATE')),
 head_version bigint NOT NULL CHECK(head_version BETWEEN 1 AND 9007199254740991),
 created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id),UNIQUE(project_id,id,kind)
);
CREATE TABLE anvil.connection_candidate_versions(
 project_id uuid NOT NULL,candidate_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 kind text NOT NULL,snapshot_json jsonb NOT NULL,content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,candidate_id,version),
 FOREIGN KEY(project_id,candidate_id,kind) REFERENCES anvil.connection_candidates(project_id,id,kind) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
 CHECK(snapshot_json->>'kind'=kind AND snapshot_json->'readiness'->>'state'='NOT_READY' AND snapshot_json->'readiness'->'executionAuthorized'='false'::jsonb)
);
ALTER TABLE anvil.connection_candidates ADD CONSTRAINT candidate_head_version_fk FOREIGN KEY(project_id,id,head_version)
 REFERENCES anvil.connection_candidate_versions(project_id,candidate_id,version) DEFERRABLE INITIALLY DEFERRED;
GRANT SELECT,INSERT,UPDATE ON anvil.connection_candidates TO anvil_v3_app;
GRANT SELECT,INSERT ON anvil.connection_candidate_versions TO anvil_v3_app;
REVOKE DELETE ON anvil.connection_candidates FROM anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.connection_candidate_versions FROM anvil_v3_app;

CREATE FUNCTION anvil.connection_candidate_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.operation=op AND op IN('registerConnection','saveEnvironment') AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.reauth_until>clock_timestamp() AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('AUTO','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
  OR EXISTS(SELECT 1 FROM anvil.approval_consumptions ac WHERE ac.project_id=pid AND ac.id=c.approval_consumption_id AND ac.command_id=c.id AND ac.decision_id=ar.approval_decision_ref))
 AND (c.result_ref->'data'->'candidate'->'input'->>'expiresAt')::timestamptz <=
  (SELECT min((rule->>'expiresAt')::timestamptz) FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
   AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;

CREATE FUNCTION anvil.guard_connection_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;body jsonb;cid uuid;v bigint;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 body=cmd.result_ref->'data'->'candidate';
 IF TG_TABLE_NAME='connection_candidates' THEN
  cid=NEW.id;v=NEW.head_version;
  IF TG_OP='INSERT' THEN
   IF v<>1 THEN RAISE EXCEPTION 'CANDIDATE_HEAD_REQUIRED' USING ERRCODE='42501';END IF;
  ELSIF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at OR v<>OLD.head_version+1 THEN
   RAISE EXCEPTION 'CANDIDATE_HEAD_REQUIRED' USING ERRCODE='42501';
  END IF;
 ELSE
  cid=NEW.candidate_id;v=NEW.version;
  IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR cmd.result_ref->'data'->'candidate' IS DISTINCT FROM NEW.snapshot_json OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM jsonb_build_object('id',cid,'version',v,'contentHash',NEW.content_hash)
  OR NEW.expires_at IS DISTINCT FROM (body->'input'->>'expiresAt')::timestamptz OR NEW.expires_at<=clock_timestamp()
  OR NOT EXISTS(SELECT 1 FROM anvil.connection_candidates c WHERE c.project_id=NEW.project_id AND c.id=cid AND c.head_version=v AND c.kind=NEW.kind) THEN
   RAISE EXCEPTION 'CANDIDATE_VERSION_RECEIPT_REQUIRED' USING ERRCODE='42501';
  END IF;
 END IF;
 IF cmd.id IS NULL OR cmd.project_id IS DISTINCT FROM NEW.project_id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR cmd.expected_version<>v-1
 OR body->>'kind' IS DISTINCT FROM NEW.kind OR body->'input'->'policyRef' IS DISTINCT FROM cmd.policy_ref
 OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'CANDIDATE_STORED' OR cmd.result_ref->'data'->'ref'->>'id' IS DISTINCT FROM cid::text OR cmd.result_ref->'data'->'ref'->>'version' IS DISTINCT FROM v::text
 OR body->'readiness'->>'state' IS DISTINCT FROM 'NOT_READY' OR body->'readiness'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb
 OR jsonb_array_length(body->'capabilities') IS DISTINCT FROM 6
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(body->'capabilities') capability WHERE capability->'measurement'->>'state' IS DISTINCT FROM 'UNVERIFIED' OR capability->>'controlLevel' IS DISTINCT FROM 'UNVERIFIED')
 OR (cmd.operation='registerConnection' AND NEW.kind<>'CONNECTION_CANDIDATE') OR (cmd.operation='saveEnvironment' AND NEW.kind<>'ENVIRONMENT_CANDIDATE')
 OR NOT anvil.connection_candidate_authorized(NEW.project_id,cmd.operation) THEN
  RAISE EXCEPTION 'CANDIDATE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF v=1 THEN
  IF cmd.result_ref->'data'->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'CANDIDATE_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM anvil.connection_candidate_versions old WHERE old.project_id=NEW.project_id AND old.candidate_id=cid AND old.version=v-1
    AND cmd.result_ref->'data'->'previousRef'=jsonb_build_object('id',cid,'version',old.version,'contentHash',old.content_hash)) THEN RAISE EXCEPTION 'CANDIDATE_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER connection_candidate_identity_guard BEFORE INSERT OR UPDATE ON anvil.connection_candidates FOR EACH ROW EXECUTE FUNCTION anvil.guard_connection_candidate();
CREATE TRIGGER connection_candidate_version_guard BEFORE INSERT ON anvil.connection_candidate_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_connection_candidate();

CREATE FUNCTION anvil.connection_candidate_approval_target_valid(pid uuid,scope jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT scope->>'operation' IN('registerConnection','saveEnvironment') AND
 ((scope->'targetRef'='null'::jsonb AND scope->>'expectedVersion'='0') OR EXISTS(
 SELECT 1 FROM anvil.connection_candidates c JOIN anvil.connection_candidate_versions v ON v.project_id=c.project_id AND v.candidate_id=c.id AND v.version=c.head_version
 WHERE c.project_id=pid AND scope->'targetRef'=jsonb_build_object('id',c.id,'version',v.version,'contentHash',v.content_hash) AND scope->>'expectedVersion'=v.version::text
 AND c.kind=CASE scope->>'operation' WHEN 'registerConnection' THEN 'CONNECTION_CANDIDATE' ELSE 'ENVIRONMENT_CANDIDATE' END));
$$;

-- 기존 업로드 승인 조건은 보존하고 FN06 후보 두 연산만 결박한다.
-- 기존 업로드 한 후보의 실제 저장과 일회 소비를 같은 명령/transaction에 결박한다.
CREATE OR REPLACE FUNCTION anvil.one_time_consumption_command_authorized(p_project uuid,p_command uuid,p_decision uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref=p_decision
 JOIN anvil.approval_decisions d ON d.id=p_decision AND d.project_id=c.project_id AND d.decision='APPROVE' AND d.command_id IS NOT NULL AND d.decision_json IS NOT NULL
 JOIN anvil.approval_requests r ON r.id=d.request_id AND r.project_id=d.project_id AND r.version=2 AND r.status='APPROVED' AND r.command_id IS NOT NULL AND r.policy_ref=c.policy_ref AND r.scope_digest=d.scope_digest AND d.request_version=1
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=c.project_id AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id=p_command AND c.project_id=p_project AND c.scope_kind='PROJECT' AND c.scope_id=c.project_id AND c.operation IN('uploadArtifact','registerConnection','saveEnvironment') AND c.state='APPLIED' AND c.expected_version=(r.action_scope_json->>'expectedVersion')::bigint AND (c.operation<>'uploadArtifact' OR c.expected_version=0) AND (c.operation='uploadArtifact' OR c.result_ref->'data'->'previousRef'=r.action_scope_json->'targetRef')
 AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NOT NULL AND c.command_id=r.candidate_command_id AND r.created_by=c.actor_id AND r.client_id=c.client_id AND d.decided_by=r.created_by AND d.client_id=r.client_id AND d.control_generation=pc.generation
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND r.request_json->>'controlGeneration'=pc.generation::text AND r.action_scope_json->>'controlGeneration'=pc.generation::text AND r.expires_at>clock_timestamp()
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',r.action_scope_json->>'payloadHash','scopeDigest',r.scope_digest)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

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
 OR v_scope IS DISTINCT FROM NEW.action_scope_json OR NOT ((v_scope->>'operation'='uploadArtifact' AND v_scope->'targetRef'='null'::jsonb AND v_scope->>'expectedVersion'='0') OR anvil.connection_candidate_approval_target_valid(NEW.project_id,v_scope))
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
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (rule->'operations') ? (v_scope->>'operation') AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>=NEW.expires_at)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND ((rule->'operations') ? (v_scope->>'operation') OR (rule->'operations') ? 'requestApproval') AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()))
 THEN RAISE EXCEPTION 'APPROVAL_REQUEST_EXACT_CURRENT_SCOPE_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;

