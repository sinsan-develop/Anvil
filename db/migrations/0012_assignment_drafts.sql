-- FN09 초안 후보. 기존46 SQL/정식DB를 변경하지 않으며 실제 적용은 별도 승인 대상이다.
CREATE TABLE anvil.assignment_drafts(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid NOT NULL,
 head_version bigint NOT NULL CHECK(head_version BETWEEN 1 AND 9007199254740991),
 created_by uuid NOT NULL,client_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id),FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.assignment_draft_versions(
 project_id uuid NOT NULL,draft_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),version_json jsonb NOT NULL CHECK(jsonb_typeof(version_json)='object'),
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,draft_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,draft_id) REFERENCES anvil.assignment_drafts(project_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),
 CHECK(COALESCE(version_json->>'status'='DRAFT' AND version_json->'ready'='false'::jsonb AND version_json->'executionAuthorized'='false'::jsonb AND version_json->'dispatchPerformed'='false'::jsonb,false))
);
ALTER TABLE anvil.assignment_drafts ADD CONSTRAINT assignment_draft_head_fk FOREIGN KEY(project_id,id,head_version)
 REFERENCES anvil.assignment_draft_versions(project_id,draft_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX assignment_draft_project_order ON anvil.assignment_drafts(project_id,updated_at DESC,id DESC);
GRANT SELECT,INSERT,UPDATE ON anvil.assignment_drafts TO anvil_v3_app;
GRANT SELECT,INSERT ON anvil.assignment_draft_versions TO anvil_v3_app;
REVOKE DELETE ON anvil.assignment_drafts FROM anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.assignment_draft_versions FROM anvil_v3_app;

-- 초안의 객체 키는 고정 ASCII, 숫자는 safe 정수다. 그래프/임의 실수의 canonical 함수가 아니다.
CREATE FUNCTION anvil.assignment_draft_canonical(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE encoded text;
BEGIN
 CASE jsonb_typeof(value)
 WHEN 'object' THEN SELECT '{'||COALESCE(string_agg(to_jsonb(key)::text||':'||anvil.assignment_draft_canonical(v),',' ORDER BY key COLLATE "C"),'')||'}' INTO encoded FROM jsonb_each(value) item(key,v);
 WHEN 'array' THEN SELECT '['||COALESCE(string_agg(anvil.assignment_draft_canonical(v),',' ORDER BY ordinal),'')||']' INTO encoded FROM jsonb_array_elements(value) WITH ORDINALITY item(v,ordinal);
 ELSE encoded=value::text;
 END CASE;
 RETURN encoded;
END;
$$;
CREATE FUNCTION anvil.assignment_draft_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='prepareAssignment' AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'prepareAssignment' AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'prepareAssignment' AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 );
$$;
CREATE FUNCTION anvil.assignment_draft_basis_current(pid uuid,b jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.work_plans w
 JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=w.head_version
 JOIN anvil.work_plan_confirmations f ON f.project_id=v.project_id AND f.plan_id=v.plan_id AND f.version=v.version AND f.target_hash=v.content_hash
 JOIN anvil.commands fc ON fc.id=f.command_id AND fc.project_id=f.project_id AND fc.operation='confirmWorkPlan' AND fc.state='APPLIED'
 JOIN anvil.plan_tasks task ON task.project_id=v.project_id AND task.plan_id=v.plan_id AND task.plan_version=v.version AND task.task_code=b->>'taskCode'
 JOIN anvil.project_methodologies a ON a.project_id=v.project_id AND a.id::text=b->'applicationRef'->>'id' AND a.application_version=(b->'applicationRef'->>'version')::bigint AND a.snapshot_hash=b->'applicationRef'->>'contentHash'
 WHERE w.project_id=pid AND w.head_version=w.confirmed_version AND b->'planRef'=jsonb_build_object('id',w.id,'version',v.version,'contentHash',v.content_hash)
 AND b->'designRef'=v.version_json->'designRef' AND v.version_json->>'relationalProjection'='STORED'
 AND task.card_hash=b->>'taskCardHash' AND task.card_hash=encode(sha256(convert_to(anvil.assignment_draft_canonical(task.card_json),'UTF8')),'hex')
 AND fc.result_ref->>'status'='APPLIED' AND fc.result_ref->'data'->>'status'='CONFIRMED' AND fc.result_ref->'data'->>'confirmationId'=f.id::text AND fc.result_ref->'data'->'ref'=b->'planRef'
 AND a.application_version=(SELECT max(a2.application_version) FROM anvil.project_methodologies a2 WHERE a2.project_id=pid)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.snapshot_json->'graph'->'nodes') node WHERE node->>'nodeId'=b->>'nodeId')
 AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events e ON e.project_id=r.project_id AND e.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=pid AND r.target_kind='WORK_PLAN' AND r.target_id=w.id AND r.target_version=v.version AND r.target_hash=v.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY e.server_sequence DESC LIMIT 1)='ACCEPTED'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(jsonb_build_array(v.version_json->'documentRef',v.version_json->'designRef')) ref WHERE NOT EXISTS(
  SELECT 1 FROM anvil.documents d JOIN anvil.document_versions dv ON dv.project_id=d.project_id AND dv.document_id=d.id AND dv.version=d.head_version WHERE d.project_id=pid AND d.id::text=ref->>'id' AND d.head_version=(ref->>'version')::bigint AND d.confirmed_version=d.head_version AND dv.content_hash=ref->>'contentHash'
  AND (SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.audit_events e ON e.project_id=r.project_id AND e.command_id=r.command_id WHERE r.scope_kind='PROJECT' AND r.project_id=pid AND r.target_kind='DOCUMENT' AND r.target_id=d.id AND r.target_version=d.head_version AND r.target_hash=dv.content_hash AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW' ORDER BY e.server_sequence DESC LIMIT 1)='ACCEPTED'))
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v.screen_review_refs) chosen WHERE NOT EXISTS(
  SELECT 1 FROM anvil.content_reviews r WHERE r.project_id=pid AND r.id::text=chosen->>'id' AND r.scope_kind='PROJECT' AND r.target_kind='DOCUMENT' AND r.outcome='ACCEPTED' AND r.criteria_version=1 AND r.source_kind='HUMAN_REVIEW'
  AND chosen=jsonb_build_object('id',r.id,'targetRef',jsonb_build_object('id',r.target_id,'version',r.target_version,'contentHash',r.target_hash),'criteriaVersion',1,'outcome','ACCEPTED')
  AND r.id=(SELECT r2.id FROM anvil.content_reviews r2 JOIN anvil.audit_events e ON e.project_id=r2.project_id AND e.command_id=r2.command_id WHERE r2.scope_kind='PROJECT' AND r2.project_id=pid AND r2.target_kind='DOCUMENT' AND r2.target_id=r.target_id AND r2.target_version=r.target_version AND r2.target_hash=r.target_hash ORDER BY e.server_sequence DESC LIMIT 1)))
 );
$$;
CREATE FUNCTION anvil.guard_assignment_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;snapshot jsonb;data jsonb;rid uuid;v bigint;expected_ref jsonb;previous_hash text;
BEGIN
 IF current_user<>'anvil_v3_app' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP='DELETE' OR TG_TABLE_NAME='assignment_draft_versions' AND TG_OP='UPDATE' THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO cmd FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 data=cmd.result_ref->'data';snapshot=data->'snapshot';
 IF TG_TABLE_NAME='assignment_drafts' THEN rid=NEW.id;v=NEW.head_version;ELSE rid=NEW.draft_id;v=NEW.version;END IF;
 expected_ref=jsonb_build_object('id',rid,'version',v,'contentHash',encode(sha256(convert_to(anvil.assignment_draft_canonical(snapshot),'UTF8')),'hex'));
 IF cmd.id IS NULL OR NOT anvil.assignment_draft_authorized(NEW.project_id) OR cmd.project_id IS DISTINCT FROM NEW.project_id OR cmd.expected_version IS DISTINCT FROM v-1
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM rid::text OR cmd.result_ref->'version' IS DISTINCT FROM to_jsonb(v)
  OR data->>'status' IS DISTINCT FROM 'ASSIGNMENT_DRAFT_STORED' OR data->'ref' IS DISTINCT FROM expected_ref
  OR snapshot->>'status' IS DISTINCT FROM 'DRAFT' OR snapshot->'ready' IS DISTINCT FROM 'false'::jsonb OR snapshot->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR snapshot->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR snapshot->'definition'->'parentAssignmentRef' IS DISTINCT FROM 'null'::jsonb OR jsonb_typeof(snapshot->'readinessIssues') IS DISTINCT FROM 'array'
  OR NOT anvil.assignment_draft_basis_current(NEW.project_id,snapshot->'basis')
  OR snapshot->'definition'->'taskRef' IS DISTINCT FROM jsonb_build_object('planRef',snapshot->'basis'->'planRef','taskCode',snapshot->'basis'->>'taskCode','applicationRef',snapshot->'basis'->'applicationRef','nodeId',snapshot->'basis'->>'nodeId')
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','prepareAssignment','targetId',CASE WHEN v=1 THEN 'null'::jsonb ELSE to_jsonb(rid) END,'expectedVersion',v-1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',jsonb_build_object('baseRef',snapshot->'previousRef','definition',snapshot->'definition','reason',snapshot->'reason'))),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_EXACT_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF v=1 THEN
  IF snapshot->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  SELECT content_hash INTO previous_hash FROM anvil.assignment_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=v-1;
  IF previous_hash IS NULL OR snapshot->'previousRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',v-1,'contentHash',previous_hash) THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME='assignment_drafts' THEN
  IF TG_OP='INSERT' THEN IF v<>1 OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_CREATOR_REQUIRED' USING ERRCODE='42501';END IF;
  ELSE IF v<>OLD.head_version+1 OR (to_jsonb(NEW)-ARRAY['head_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['head_version','updated_at']) THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;END IF;
 ELSE
  IF NEW.command_id IS DISTINCT FROM cmd.id OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR NEW.version_json IS DISTINCT FROM snapshot OR NEW.content_hash IS DISTINCT FROM expected_ref->>'contentHash'
   OR NOT EXISTS(SELECT 1 FROM anvil.assignment_drafts d WHERE d.project_id=NEW.project_id AND d.id=rid AND d.head_version=v) THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_VERSION_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER assignment_draft_identity_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.assignment_drafts FOR EACH ROW EXECUTE FUNCTION anvil.guard_assignment_draft();
CREATE TRIGGER assignment_draft_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.assignment_draft_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_assignment_draft();
