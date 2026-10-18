-- P1 C1 코드 후보: 파일 작성만. 실제 DB 적용·SQL 검수·계정/정책 seed는 실행하지 않았다.
CREATE TABLE anvil.project_roles (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),role_id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,role_id,version),UNIQUE(project_id,role_id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
CREATE UNIQUE INDEX project_one_coordinator ON anvil.project_roles(project_id) WHERE snapshot_json->>'kind'='COORDINATOR';
CREATE UNIQUE INDEX project_one_stage_owner ON anvil.project_roles(project_id,(snapshot_json->'stageRef')) WHERE snapshot_json->>'kind'='STAGE_OWNER';
CREATE TABLE anvil.agent_sessions (
 project_id uuid NOT NULL,session_id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 role_id uuid GENERATED ALWAYS AS ((snapshot_json->'roleRef'->>'id')::uuid) STORED,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,session_id,version),UNIQUE(project_id,session_id),UNIQUE(project_id,role_id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,role_id) REFERENCES anvil.project_roles(project_id,role_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),
 CHECK(COALESCE(snapshot_json->>'state'='RESERVED' AND snapshot_json->'externalSessionHandleRef'='null'::jsonb,false))
);
CREATE TABLE anvil.role_bindings (
 project_id uuid NOT NULL,binding_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),role_id uuid NOT NULL,session_id uuid NOT NULL,
 assignment_id uuid GENERATED ALWAYS AS ((snapshot_json->'assignmentRef'->>'id')::uuid) STORED,
 assignment_version bigint GENERATED ALWAYS AS ((snapshot_json->'assignmentRef'->>'version')::bigint) STORED,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,binding_id,version),UNIQUE(project_id,role_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,role_id) REFERENCES anvil.project_roles(project_id,role_id),
 FOREIGN KEY(project_id,session_id) REFERENCES anvil.agent_sessions(project_id,session_id),
 FOREIGN KEY(project_id,assignment_id,assignment_version) REFERENCES anvil.assignment_versions(project_id,assignment_id,version),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),
 CHECK(COALESCE(snapshot_json->>'state'='RESERVED' AND snapshot_json->'externalSessionHandleRef'='null'::jsonb
  AND snapshot_json->>'connectionReadiness'='CANDIDATE_ONLY' AND snapshot_json->'executionAuthorized'='false'::jsonb AND snapshot_json->'dispatchPerformed'='false'::jsonb,false))
);
GRANT SELECT,INSERT ON anvil.project_roles,anvil.agent_sessions,anvil.role_bindings TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.project_roles,anvil.agent_sessions,anvil.role_bindings FROM anvil_v3_app;

-- 실행 허가가 아닌 HUMAN 비실행 작성만 허용한다. 별도 일회 승인 분기는 미연결이면 fail-closed다.
CREATE FUNCTION anvil.execution_preparation_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op IN('defineProjectRole','bindResponsibleSession','prepareExecution') AND EXISTS(SELECT 1 FROM anvil.commands c
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
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? op AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.execution_role_stage_current(pid uuid,stage jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.project_methodologies a WHERE a.project_id=pid
 AND stage->'applicationRef'=jsonb_build_object('id',a.id,'version',a.application_version,'contentHash',a.snapshot_hash)
 AND a.application_version=(SELECT max(latest.application_version) FROM anvil.project_methodologies latest WHERE latest.project_id=pid)
 AND a.snapshot_hash=encode(sha256(convert_to(anvil.assignment_draft_canonical(a.snapshot_json),'UTF8')),'hex')
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.snapshot_json->'graph'->'nodes') node WHERE node->>'nodeId'=stage->>'nodeId' AND node->>'role'='STAGE_OWNER'));
$$;

CREATE FUNCTION anvil.guard_responsible_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;s jsonb;expected jsonb;payload jsonb;rid uuid;op text;status text;previous anvil.role_bindings%ROWTYPE;
 parent anvil.project_roles%ROWTYPE;role_row anvil.project_roles%ROWTYPE;session_row anvil.agent_sessions%ROWTYPE;
 assignment anvil.assignment_versions%ROWTYPE;draft anvil.assignment_draft_versions%ROWTYPE;candidate anvil.connection_candidate_versions%ROWTYPE;
 target jsonb;expected_version bigint;session_ref jsonb;assignment_key uuid;assignment_revision bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'RESPONSIBLE_SESSION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 s=NEW.snapshot_json;
 IF TG_TABLE_NAME='project_roles' THEN op='defineProjectRole';status='PROJECT_ROLE_DEFINED';rid=NEW.role_id;
 ELSIF TG_TABLE_NAME='role_bindings' THEN op='bindResponsibleSession';status='RESPONSIBLE_SESSION_RESERVED';rid=NEW.binding_id;
 ELSE op='bindResponsibleSession';status='RESPONSIBLE_SESSION_RESERVED';rid=NEW.session_id;END IF;
 expected=jsonb_build_object('id',rid,'version',NEW.version,'contentHash',NEW.content_hash);
 IF NOT COALESCE(anvil.execution_preparation_authorized(NEW.project_id,op),false) OR cmd.id IS NULL OR cmd.project_id IS DISTINCT FROM NEW.project_id
  OR NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
  OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED'
  OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM status OR octet_length(anvil.assignment_draft_canonical(s))>2097152
  THEN RAISE EXCEPTION 'RESPONSIBLE_SESSION_EXACT_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='project_roles' THEN
  IF cmd.result_ref->'data'->'ref' IS DISTINCT FROM expected OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s OR NEW.version<>1
   OR (SELECT count(*) FROM jsonb_object_keys(s))<>6 OR NOT(s ?& ARRAY['kind','stageRef','parentRoleRef','reason','definedBy','definedAt'])
   OR jsonb_typeof(s->'kind') IS DISTINCT FROM 'string' OR s->>'kind' NOT IN('COORDINATOR','STAGE_OWNER')
   OR jsonb_typeof(s->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(s->>'reason')
   OR jsonb_typeof(s->'definedAt') IS DISTINCT FROM 'string' OR s->'definedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
   OR (s->>'definedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) THEN RAISE EXCEPTION 'PROJECT_ROLE_INVALID' USING ERRCODE='42501';END IF;
  IF s->>'kind'='COORDINATOR' THEN
   IF s->'stageRef' IS DISTINCT FROM 'null'::jsonb OR s->'parentRoleRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'PROJECT_ROLE_INVALID' USING ERRCODE='42501';END IF;
  ELSE
   IF jsonb_typeof(s->'stageRef') IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(s->'stageRef'))<>2
    OR NOT((s->'stageRef') ?& ARRAY['applicationRef','nodeId']) OR jsonb_typeof(s->'stageRef'->'nodeId') IS DISTINCT FROM 'string'
    OR length(s->'stageRef'->>'nodeId')=0 OR jsonb_typeof(s->'parentRoleRef') IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'PROJECT_ROLE_STAGE_FORMAT_REQUIRED' USING ERRCODE='42501';END IF;
   SELECT * INTO parent FROM anvil.project_roles r WHERE r.project_id=NEW.project_id AND r.role_id::text=s->'parentRoleRef'->>'id' AND r.version=1;
   IF parent.role_id IS NULL OR parent.snapshot_json->>'kind' IS DISTINCT FROM 'COORDINATOR'
    OR s->'parentRoleRef' IS DISTINCT FROM jsonb_build_object('id',parent.role_id,'version',1,'contentHash',parent.content_hash)
    OR NOT COALESCE(anvil.execution_role_stage_current(NEW.project_id,s->'stageRef'),false)
    THEN RAISE EXCEPTION 'PROJECT_ROLE_CURRENT_STAGE_PARENT_REQUIRED' USING ERRCODE='42501';END IF;
  END IF;
  payload=s-ARRAY['definedBy','definedAt'];target='null'::jsonb;expected_version=0;
 ELSIF TG_TABLE_NAME='agent_sessions' THEN
  IF NEW.version<>1 OR (SELECT count(*) FROM jsonb_object_keys(s))<>6 OR s->>'state' IS DISTINCT FROM 'RESERVED' OR s->'externalSessionHandleRef' IS DISTINCT FROM 'null'::jsonb
   OR s->'reservedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
   OR (s->>'reservedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
   OR cmd.result_ref->'data'->'snapshot'->'sessionRef' IS DISTINCT FROM expected
   OR s->'roleRef' IS DISTINCT FROM cmd.result_ref->'data'->'snapshot'->'roleRef' OR s->'connectionRef' IS DISTINCT FROM cmd.result_ref->'data'->'snapshot'->'connectionRef'
   OR cmd.expected_version<>0 OR cmd.result_ref->'data'->'snapshot'->'existingSessionBindingRef' IS DISTINCT FROM 'null'::jsonb
   OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object(
    'schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,
    'operation','bindResponsibleSession','targetId','null'::jsonb,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,
    'payload',(cmd.result_ref->'data'->'snapshot')-ARRAY['sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt'])),'UTF8')),'hex')
   THEN RAISE EXCEPTION 'SESSION_RESERVATION_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
  RETURN NEW;
 ELSE
  assignment_key=(s->'assignmentRef'->>'id')::uuid;assignment_revision=(s->'assignmentRef'->>'version')::bigint;
  SELECT * INTO role_row FROM anvil.project_roles r WHERE r.project_id=NEW.project_id AND r.role_id=NEW.role_id;
  SELECT * INTO session_row FROM anvil.agent_sessions a WHERE a.project_id=NEW.project_id AND a.session_id=NEW.session_id;
  SELECT * INTO assignment FROM anvil.assignment_versions a WHERE a.project_id=NEW.project_id AND a.assignment_id=assignment_key AND a.version=assignment_revision;
  SELECT * INTO draft FROM anvil.assignment_draft_versions d WHERE d.project_id=NEW.project_id AND d.draft_id=assignment_key AND d.version=assignment_revision;
  SELECT v.* INTO candidate FROM anvil.connection_candidate_versions v JOIN anvil.connection_candidates h ON h.project_id=v.project_id AND h.id=v.candidate_id AND h.head_version=v.version
   WHERE v.project_id=NEW.project_id AND v.candidate_id::text=s->'connectionRef'->>'id' AND v.version=(s->'connectionRef'->>'version')::bigint AND v.kind='CONNECTION_CANDIDATE' AND v.expires_at>clock_timestamp();
  session_ref=jsonb_build_object('id',session_row.session_id,'version',session_row.version,'contentHash',session_row.content_hash);
  IF role_row.role_id IS NULL OR session_row.session_id IS NULL OR assignment.assignment_id IS NULL OR draft.draft_id IS NULL OR candidate.candidate_id IS NULL
   OR (SELECT count(*) FROM jsonb_object_keys(s))<>14 OR s->'generation' IS DISTINCT FROM to_jsonb(NEW.version)
   OR s->'roleRef' IS DISTINCT FROM jsonb_build_object('id',role_row.role_id,'version',role_row.version,'contentHash',role_row.content_hash)
   OR s->'assignmentRef' IS DISTINCT FROM jsonb_build_object('id',assignment.assignment_id,'version',assignment.version,'contentHash',assignment.content_hash)
   OR s->'connectionRef' IS DISTINCT FROM jsonb_build_object('id',candidate.candidate_id,'version',candidate.version,'contentHash',candidate.content_hash)
   OR s->'sessionRef' IS DISTINCT FROM session_ref OR s->'roleRef' IS DISTINCT FROM session_row.snapshot_json->'roleRef' OR s->'connectionRef' IS DISTINCT FROM session_row.snapshot_json->'connectionRef'
   OR NOT COALESCE(anvil.assignment_draft_basis_current(NEW.project_id,draft.version_json->'basis'),false)
   OR NOT EXISTS(SELECT 1 FROM anvil.assignment_drafts d WHERE d.project_id=NEW.project_id AND d.id=assignment_key AND d.head_version=assignment_revision)
   OR jsonb_typeof(s->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(s->>'reason') OR s->'boundBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id)
   OR (s->>'boundAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
   OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM expected OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s
   THEN RAISE EXCEPTION 'RESPONSIBLE_SESSION_CURRENT_BASIS_REQUIRED' USING ERRCODE='42501';END IF;
  IF role_row.snapshot_json->>'kind'='STAGE_OWNER' AND (NOT COALESCE(anvil.execution_role_stage_current(NEW.project_id,role_row.snapshot_json->'stageRef'),false)
    OR role_row.snapshot_json->'stageRef'->'applicationRef' IS DISTINCT FROM assignment.version_json->'definition'->'taskRef'->'applicationRef'
    OR role_row.snapshot_json->'stageRef'->>'nodeId' IS DISTINCT FROM assignment.version_json->'definition'->'taskRef'->>'nodeId')
   THEN RAISE EXCEPTION 'ROLE_STAGE_MISMATCH' USING ERRCODE='42501';END IF;
  SELECT * INTO previous FROM anvil.role_bindings b WHERE b.project_id=NEW.project_id AND b.role_id=NEW.role_id ORDER BY b.version DESC LIMIT 1;
  IF previous.binding_id IS NULL THEN
   IF NEW.version<>1 OR s->'existingSessionBindingRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'SESSION_BASE_REQUIRED' USING ERRCODE='42501';END IF;
   target='null'::jsonb;expected_version=0;
  ELSE
   IF NEW.binding_id IS DISTINCT FROM previous.binding_id OR NEW.version<>previous.version+1 OR NEW.session_id IS DISTINCT FROM previous.session_id
    OR s->'existingSessionBindingRef' IS DISTINCT FROM jsonb_build_object('id',previous.binding_id,'version',previous.version,'contentHash',previous.content_hash)
    THEN RAISE EXCEPTION 'SESSION_REPLACEMENT_REQUIRED' USING ERRCODE='42501';END IF;
   target=to_jsonb(previous.binding_id);expected_version=previous.version;
  END IF;
  payload=s-ARRAY['sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt'];
 END IF;
 IF cmd.expected_version IS DISTINCT FROM expected_version OR cmd.result_ref->'targetId' IS DISTINCT FROM to_jsonb(rid) OR cmd.result_ref->'version' IS DISTINCT FROM to_jsonb(NEW.version)
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation',op,'targetId',target,'expectedVersion',expected_version,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload)),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'RESPONSIBLE_SESSION_REQUEST_HASH_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER project_role_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.project_roles FOR EACH ROW EXECUTE FUNCTION anvil.guard_responsible_session();
CREATE TRIGGER agent_session_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.agent_sessions FOR EACH ROW EXECUTE FUNCTION anvil.guard_responsible_session();
CREATE TRIGGER role_binding_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.role_bindings FOR EACH ROW EXECUTE FUNCTION anvil.guard_responsible_session();

-- 예약 세션만 commit하여 해당 역할을 영구 점유하는 불완전 직접 DML을 막는다.
CREATE FUNCTION anvil.guard_session_binding_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM anvil.role_bindings b JOIN anvil.commands c ON c.project_id=b.project_id AND c.id=b.command_id
  WHERE b.project_id=NEW.project_id AND b.session_id=NEW.session_id AND b.command_id=NEW.command_id AND b.version=1
  AND b.snapshot_json->'sessionRef'=jsonb_build_object('id',NEW.session_id,'version',NEW.version,'contentHash',NEW.content_hash)
  AND b.snapshot_json->'roleRef'=NEW.snapshot_json->'roleRef' AND b.snapshot_json->'connectionRef'=NEW.snapshot_json->'connectionRef'
  AND c.result_ref->'data'->'ref'=jsonb_build_object('id',b.binding_id,'version',b.version,'contentHash',b.content_hash)
  AND c.result_ref->'data'->'snapshot'=b.snapshot_json AND c.operation='bindResponsibleSession' AND c.state='APPLIED')
 THEN RAISE EXCEPTION 'SESSION_BINDING_COMMIT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER agent_session_binding_complete AFTER INSERT ON anvil.agent_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_session_binding_complete();

CREATE TABLE anvil.execution_preparations (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,version bigint NOT NULL CHECK(version=1),
 assignment_id uuid GENERATED ALWAYS AS ((snapshot_json->'intent'->'assignmentRef'->>'id')::uuid) STORED,
 assignment_version bigint GENERATED ALWAYS AS ((snapshot_json->'intent'->'assignmentRef'->>'version')::bigint) STORED,
 binding_id uuid GENERATED ALWAYS AS ((snapshot_json->'intent'->'roleBindingRef'->>'id')::uuid) STORED,
 binding_version bigint GENERATED ALWAYS AS ((snapshot_json->'intent'->'roleBindingRef'->>'version')::bigint) STORED,
 bundle_id uuid GENERATED ALWAYS AS ((snapshot_json->'intent'->'contextBundleRef'->>'id')::uuid) STORED,
 bundle_version bigint GENERATED ALWAYS AS ((snapshot_json->'intent'->'contextBundleRef'->>'version')::bigint) STORED,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,assignment_id,assignment_version) REFERENCES anvil.assignment_versions(project_id,assignment_id,version),
 FOREIGN KEY(project_id,binding_id,binding_version) REFERENCES anvil.role_bindings(project_id,binding_id,version),
 FOREIGN KEY(project_id,bundle_id,bundle_version) REFERENCES anvil.context_bundles(project_id,id,version),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),
 CHECK(COALESCE(snapshot_json->>'authorizationState'='NOT_AUTHORIZED' AND snapshot_json->'executionAuthorized'='false'::jsonb AND snapshot_json->'dispatchPerformed'='false'::jsonb,false))
);
CREATE INDEX execution_preparation_assignment_order ON anvil.execution_preparations(project_id,assignment_id,assignment_version,created_at DESC,id DESC);
GRANT SELECT,INSERT ON anvil.execution_preparations TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.execution_preparations FROM anvil_v3_app;

CREATE FUNCTION anvil.execution_preparation_ref_valid(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 RETURN COALESCE(jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v))=3 AND v ?& ARRAY['id','version','contentHash']
  AND jsonb_typeof(v->'id')='string' AND (v->>'id')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND jsonb_typeof(v->'version')='number' AND (v->>'version')~'^[1-9][0-9]{0,15}$' AND (v->>'version')::numeric<=9007199254740991
  AND jsonb_typeof(v->'contentHash')='string' AND (v->>'contentHash')~'^[0-9a-f]{64}$',false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_execution_preparation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;s jsonb;i jsonb;ref jsonb;field text;requested jsonb;base jsonb;target jsonb;total integer=0;
 assignment anvil.assignment_versions%ROWTYPE;draft anvil.assignment_draft_versions%ROWTYPE;binding anvil.role_bindings%ROWTYPE;
 bundle anvil.context_bundles%ROWTYPE;candidate anvil.connection_candidate_versions%ROWTYPE;expected_basis jsonb;raw_basis jsonb;
 assignment_key uuid;assignment_revision bigint;binding_key uuid;binding_revision bigint;bundle_key uuid;bundle_revision bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 s=NEW.snapshot_json;i=s->'intent';ref=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.content_hash);
 IF cmd.id IS NULL OR NOT COALESCE(anvil.execution_preparation_authorized(NEW.project_id,'prepareExecution'),false)
  OR NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id
  OR cmd.expected_version<>0 OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM ref OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s
  OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'EXECUTION_PREPARED' OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(s),'UTF8')),'hex')
  OR octet_length(anvil.assignment_draft_canonical(s))>2097152 OR (SELECT count(*) FROM jsonb_object_keys(s))<>9
  OR NOT(s ?& ARRAY['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed'])
  OR s->'preparedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR jsonb_typeof(s->'checkedAt') IS DISTINCT FROM 'string'
  OR (s->>'checkedAt')::timestamptz IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
  OR jsonb_typeof(i) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(i))<>11
  OR NOT(i ?& ARRAY['projectId','assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef','sourceScopes','mode','reason'])
  OR i->>'projectId' IS DISTINCT FROM NEW.project_id::text OR jsonb_typeof(i->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(i->>'reason')
  OR jsonb_typeof(i->'mode') IS DISTINCT FROM 'string' OR i->>'mode' NOT IN('CONTEXT_REVIEW','WORK')
  THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 FOREACH field IN ARRAY ARRAY['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef'] LOOP
  IF NOT anvil.execution_preparation_ref_valid(i->field) THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_REF_REQUIRED' USING ERRCODE='42501';END IF;
 END LOOP;
 assignment_key=(i->'assignmentRef'->>'id')::uuid;assignment_revision=(i->'assignmentRef'->>'version')::bigint;
 binding_key=(i->'roleBindingRef'->>'id')::uuid;binding_revision=(i->'roleBindingRef'->>'version')::bigint;
 bundle_key=(i->'contextBundleRef'->>'id')::uuid;bundle_revision=(i->'contextBundleRef'->>'version')::bigint;
 SELECT * INTO assignment FROM anvil.assignment_versions a WHERE a.project_id=NEW.project_id AND a.assignment_id=assignment_key AND a.version=assignment_revision;
 SELECT * INTO draft FROM anvil.assignment_draft_versions d WHERE d.project_id=NEW.project_id AND d.draft_id=assignment_key AND d.version=assignment_revision;
 SELECT * INTO binding FROM anvil.role_bindings b WHERE b.project_id=NEW.project_id AND b.binding_id=binding_key AND b.version=binding_revision;
 SELECT * INTO bundle FROM anvil.context_bundles b WHERE b.project_id=NEW.project_id AND b.id=bundle_key AND b.version=bundle_revision;
 IF assignment.assignment_id IS NULL OR draft.draft_id IS NULL OR binding.binding_id IS NULL OR bundle.id IS NULL
  OR i->'assignmentRef' IS DISTINCT FROM jsonb_build_object('id',assignment.assignment_id,'version',assignment.version,'contentHash',assignment.content_hash)
  OR i->'roleBindingRef' IS DISTINCT FROM jsonb_build_object('id',binding.binding_id,'version',binding.version,'contentHash',binding.content_hash)
  OR i->'contextBundleRef' IS DISTINCT FROM jsonb_build_object('id',bundle.id,'version',bundle.version,'contentHash',bundle.content_hash)
  OR binding.snapshot_json->'assignmentRef' IS DISTINCT FROM i->'assignmentRef' OR binding.snapshot_json->'connectionRef' IS DISTINCT FROM i->'connectionRef'
  OR bundle.assignment_ref IS DISTINCT FROM i->'assignmentRef'
  OR binding.version IS DISTINCT FROM (SELECT max(b.version) FROM anvil.role_bindings b WHERE b.project_id=NEW.project_id AND b.role_id=binding.role_id)
  OR NOT EXISTS(SELECT 1 FROM anvil.assignment_drafts d WHERE d.project_id=NEW.project_id AND d.id=assignment_key AND d.head_version=assignment_revision)
  OR NOT COALESCE(anvil.assignment_draft_basis_current(NEW.project_id,draft.version_json->'basis'),false)
  THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_CURRENT_BASIS_REQUIRED' USING ERRCODE='42501';END IF;
 FOREACH field IN ARRAY ARRAY['connectionRef','environmentRef'] LOOP
  SELECT v.* INTO candidate FROM anvil.connection_candidate_versions v JOIN anvil.connection_candidates h ON h.project_id=v.project_id AND h.id=v.candidate_id AND h.head_version=v.version
   WHERE v.project_id=NEW.project_id AND v.candidate_id::text=i->field->>'id' AND v.version=(i->field->>'version')::bigint AND v.expires_at>clock_timestamp();
  IF candidate.candidate_id IS NULL OR i->field IS DISTINCT FROM jsonb_build_object('id',candidate.candidate_id,'version',candidate.version,'contentHash',candidate.content_hash)
   OR candidate.kind IS DISTINCT FROM CASE WHEN field='connectionRef' THEN 'CONNECTION_CANDIDATE' ELSE 'ENVIRONMENT_CANDIDATE' END
   THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_CANDIDATE_CURRENT_REQUIRED' USING ERRCODE='42501';END IF;
 END LOOP;
 IF jsonb_typeof(i->'sourceScopes') IS DISTINCT FROM 'array' OR jsonb_array_length(i->'sourceScopes') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'EXECUTION_SOURCE_SCOPE_REQUIRED' USING ERRCODE='42501';END IF;
 FOR requested IN SELECT value FROM jsonb_array_elements(i->'sourceScopes') LOOP
  base=NULL;
  SELECT value INTO base FROM jsonb_array_elements(assignment.version_json->'definition'->'allowedScopes') allowed(value) WHERE (value-'targets')=(requested-'targets');
  IF base IS NULL OR jsonb_typeof(requested->'targets') IS DISTINCT FROM 'array' OR jsonb_array_length(requested->'targets') NOT BETWEEN 1 AND 200
   THEN RAISE EXCEPTION 'EXECUTION_SOURCE_SCOPE_EXCEEDED' USING ERRCODE='42501';END IF;
  FOR target IN SELECT value FROM jsonb_array_elements(requested->'targets') LOOP
   total=total+1;
   IF total>200 OR jsonb_typeof(target) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(target))<>4 OR NOT(target ?& ARRAY['relativePath','kind','access','recursive'])
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(base->'targets') allowed(value) WHERE value=target)
    THEN RAISE EXCEPTION 'EXECUTION_SOURCE_SCOPE_EXCEEDED' USING ERRCODE='42501';END IF;
  END LOOP;
 END LOOP;
 raw_basis=jsonb_build_array(draft.version_json->'basis'->'planRef',draft.version_json->'basis'->'designRef',draft.version_json->'basis'->'applicationRef')||(bundle.manifest_json->'baselineRefs');
 IF bundle.manifest_json->'constitutionRef' IS DISTINCT FROM 'null'::jsonb THEN raw_basis=raw_basis||jsonb_build_array(bundle.manifest_json->'constitutionRef');END IF;
 SELECT COALESCE(jsonb_agg(value ORDER BY first_index),'[]'::jsonb) INTO expected_basis FROM (SELECT value,min(ordinal) first_index FROM jsonb_array_elements(raw_basis) WITH ORDINALITY refs(value,ordinal) GROUP BY value) unique_refs;
 IF s->'basisRefs' IS DISTINCT FROM expected_basis OR s->'latestInstructionRefs' IS DISTINCT FROM bundle.manifest_json->'latestInstructionRefs'
  OR jsonb_typeof(s->'missingConditions') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'missingConditions')>10
  OR (SELECT count(*) FROM jsonb_array_elements(s->'missingConditions'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(s->'missingConditions'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'missingConditions') code(value) WHERE jsonb_typeof(value)<>'string' OR value #>> '{}' NOT IN('RESPONSIBLE_SESSION_RESERVED','CONNECTION_CANDIDATE_ONLY','ENVIRONMENT_CANDIDATE_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED','REQUIRED_CONTEXT_MISSING','CURRENT_CONTEXT_CHANGED','UNDERSTANDING_NOT_REVIEWED'))
  OR NOT((s->'missingConditions') @> '["RESPONSIBLE_SESSION_RESERVED","CONNECTION_CANDIDATE_ONLY","ENVIRONMENT_CANDIDATE_ONLY","CAPABILITY_UNVERIFIED","BUDGET_POLICY_UNVERIFIED","SOURCE_AUTHORIZATION_UNVERIFIED","HOST_OS_FENCE_UNVERIFIED"]'::jsonb)
  OR jsonb_array_length(bundle.manifest_json->'missingRequired')>0 AND NOT((s->'missingConditions') ? 'REQUIRED_CONTEXT_MISSING')
  OR i->>'mode'='WORK' AND NOT((s->'missingConditions') ? 'UNDERSTANDING_NOT_REVIEWED')
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','prepareExecution','targetId','null'::jsonb,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',i)),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'EXECUTION_PREPARATION_FACTS_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER execution_preparation_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.execution_preparations FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_preparation();
