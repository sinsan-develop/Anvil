-- FN12 고정 검수 기준의 신규 불변 저장. 기존 SQL/공유 guard는 교체하지 않는다.
-- 등록은 적용/검수/업무 완료/실행 허가가 아니며 정식 DB 자동 반영도 아니다.
CREATE TABLE anvil.result_criteria_versions(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),criteria_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 assignment_ref jsonb NOT NULL,assignment_id uuid GENERATED ALWAYS AS ((assignment_ref->>'id')::uuid) STORED,
 assignment_version bigint GENERATED ALWAYS AS ((assignment_ref->>'version')::bigint) STORED,
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),criteria_json jsonb NOT NULL,input_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(project_id,criteria_id,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,assignment_id,assignment_version) REFERENCES anvil.assignment_versions(project_id,assignment_id,version),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.result_criteria_versions TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.result_criteria_versions FROM anvil_v3_app;

CREATE FUNCTION anvil.result_criteria_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid AND c.operation='saveResultCriteria' AND c.state='APPLIED'
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest)
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'saveResultCriteria' AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'saveResultCriteria' AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.result_criteria_payload_valid(definition jsonb,input jsonb,criteria jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;source jsonb;field text;idx integer;key text;ids text[]='{}';covered text[]='{}';local_sources text[];expected jsonb='[]'::jsonb;
BEGIN
 IF NOT anvil.execution_json_shape(input,ARRAY['assignmentRef','baseRef','items','reason']) OR NOT anvil.execution_preparation_ref_valid(input->'assignmentRef')
  OR (input->'baseRef'<>'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(input->'baseRef'))
  OR NOT anvil.result_text_valid(input->'reason',20000) OR NOT anvil.assignment_content_reason(input->>'reason') OR NOT anvil.result_texts_safe(input)
  OR NOT anvil.result_refs_valid(definition->'baselineRefs') OR jsonb_array_length(definition->'baselineRefs')=0 OR NOT anvil.execution_preparation_ref_valid(definition->'environmentRef')
  OR jsonb_typeof(input->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(input->'items') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;
 FOREACH field IN ARRAY ARRAY['acceptanceCriteria','verificationRequirements'] LOOP
  IF jsonb_typeof(definition->field) IS DISTINCT FROM 'array' OR jsonb_array_length(definition->field) NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(definition->field) LOOP
   IF NOT anvil.result_text_valid(item,20000) OR NOT anvil.assignment_content_reason(item#>>'{}') THEN RETURN false;END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(input->'items') LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['criterionId','testId','kind','environmentRef','sources']) OR jsonb_typeof(item->'criterionId') IS DISTINCT FROM 'string' OR item->>'criterionId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' OR item->>'criterionId'=ANY(ids)
   OR jsonb_typeof(item->'testId') IS DISTINCT FROM 'string' OR item->>'testId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$'
   OR jsonb_typeof(item->'kind') IS DISTINCT FROM 'string' OR item->>'kind' NOT IN('BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY')
   OR item->'environmentRef' IS DISTINCT FROM definition->'environmentRef' OR jsonb_typeof(item->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'sources') NOT BETWEEN 1 AND 20 THEN RETURN false;END IF;
  ids=array_append(ids,item->>'criterionId');local_sources='{}';
  FOR source IN SELECT value FROM jsonb_array_elements(item->'sources') LOOP
   IF NOT anvil.execution_json_shape(source,ARRAY['field','index','contentHash']) OR jsonb_typeof(source->'field') IS DISTINCT FROM 'string' OR source->>'field' NOT IN('acceptanceCriteria','verificationRequirements')
    OR jsonb_typeof(source->'index') IS DISTINCT FROM 'number' OR source->>'index' !~ '^(0|[1-9][0-9]{0,2})$' OR jsonb_typeof(source->'contentHash') IS DISTINCT FROM 'string' THEN RETURN false;END IF;
   field=source->>'field';idx=(source->>'index')::integer;key=field||':'||idx;
   IF idx>=jsonb_array_length(definition->field) OR key=ANY(local_sources) OR source->>'contentHash' IS DISTINCT FROM anvil.execution_json_hash(definition->field->idx) THEN RETURN false;END IF;
   local_sources=array_append(local_sources,key);covered=array_append(covered,key);
  END LOOP;
  expected=expected||jsonb_build_array(jsonb_build_object('criterionId',item->'criterionId','testId',item->'testId','kind',item->'kind','environmentRef',item->'environmentRef','required',true));
 END LOOP;
 FOREACH field IN ARRAY ARRAY['acceptanceCriteria','verificationRequirements'] LOOP
  FOR idx IN 0..jsonb_array_length(definition->field)-1 LOOP IF NOT (field||':'||idx)=ANY(covered) THEN RETURN false;END IF;END LOOP;
 END LOOP;
 RETURN criteria=jsonb_build_object('assignmentRef',input->'assignmentRef','baselineRefs',definition->'baselineRefs','items',expected);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_result_criteria_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;session anvil.auth_sessions%ROWTYPE;a anvil.assignment_versions%ROWTYPE;prior anvil.result_criteria_versions%ROWTYPE;
 reference jsonb;bindings jsonb;generation bigint;assignment_envelope jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'RESULT_CRITERIA_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 SELECT * INTO cmd FROM anvil.commands WHERE id=NEW.command_id AND project_id=NEW.project_id;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE id=cmd.authorization_receipt_id AND command_id=cmd.id;
 SELECT * INTO session FROM anvil.auth_sessions WHERE id::text=current_setting('anvil.result_criteria_session_id',true) AND user_id=cmd.actor_id AND client_id=cmd.client_id;
 SELECT credential_generation INTO generation FROM anvil.users WHERE id=cmd.actor_id;
 SELECT * INTO a FROM anvil.assignment_versions WHERE project_id=NEW.project_id AND assignment_id::text=NEW.assignment_ref->>'id' AND version::text=NEW.assignment_ref->>'version';
 reference=jsonb_build_object('id',NEW.criteria_id,'version',NEW.version,'contentHash',NEW.content_hash);
 SELECT COALESCE(jsonb_agg(jsonb_build_object('criterionId',item->'criterionId','sources',item->'sources') ORDER BY n),'[]'::jsonb) INTO bindings FROM jsonb_array_elements(NEW.input_json->'items') WITH ORDINALITY AS t(item,n);
 -- observedAt은 wire의 고정 ISO24 byte 길이만 반영한다. 현재성 판단/관측 시각으로 쓰지 않는다.
 assignment_envelope=jsonb_build_object('projectId',NEW.project_id,'ref',NEW.assignment_ref,'snapshot',a.version_json,'observedAt','2000-01-01T00:00:00.000Z');
 IF cmd.id IS NULL OR ar.id IS NULL OR session.id IS NULL OR session.revoked_at IS NOT NULL OR session.credential_generation IS DISTINCT FROM generation OR session.idle_expires_at<=clock_timestamp() OR session.absolute_expires_at<=clock_timestamp()
  OR NOT COALESCE(anvil.result_criteria_authorized(NEW.project_id),false) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR NEW.created_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR cmd.expected_version IS DISTINCT FROM NEW.version-1
  OR a.project_id IS NULL OR NEW.assignment_ref IS DISTINCT FROM jsonb_build_object('id',a.assignment_id,'version',a.version,'contentHash',a.content_hash) OR NEW.input_json->'assignmentRef' IS DISTINCT FROM NEW.assignment_ref
  OR a.content_hash IS DISTINCT FROM anvil.execution_json_hash(a.version_json) OR a.version_json->'contentConfirmed' IS DISTINCT FROM 'true'::jsonb OR a.version_json->'ready' IS DISTINCT FROM 'false'::jsonb OR a.version_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR a.version_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NOT COALESCE(anvil.result_criteria_payload_valid(a.version_json->'definition',NEW.input_json,NEW.criteria_json),false) OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(NEW.criteria_json)
  OR octet_length(anvil.execution_authority_canonical(jsonb_build_object('assignment',assignment_envelope,'input',NEW.input_json)))>2097152
  OR cmd.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','saveResultCriteria','targetId',CASE WHEN NEW.version=1 THEN 'null'::jsonb ELSE to_jsonb(NEW.criteria_id) END,'expectedVersion',NEW.version-1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',NEW.input_json))
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'commandId' IS DISTINCT FROM cmd.command_id::text OR cmd.result_ref->>'operationId' IS DISTINCT FROM cmd.operation_id::text OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.criteria_id::text OR cmd.result_ref->'version' IS DISTINCT FROM to_jsonb(NEW.version)
  OR cmd.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',reference,'status','RESULT_CRITERIA_STORED','snapshot',NEW.criteria_json,'sourceBindings',bindings,'registryStored',true,'reviewStored',false,'completionAccepted',false,'executionAuthorized',false,'dispatchPerformed',false)
  OR ar.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('projectId',NEW.project_id,'actorId',cmd.actor_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',reference))
  OR NEW.created_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp()) OR (cmd.result_ref->>'serverReceivedAt')::timestamptz IS DISTINCT FROM NEW.created_at
  THEN RAISE EXCEPTION 'RESULT_CRITERIA_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM anvil.result_criteria_versions WHERE project_id=NEW.project_id AND criteria_id=NEW.criteria_id AND version>=NEW.version AND command_id<>NEW.command_id) THEN RAISE EXCEPTION 'RESULT_CRITERIA_BASE_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO prior FROM anvil.result_criteria_versions WHERE project_id=NEW.project_id AND criteria_id=NEW.criteria_id AND version<NEW.version ORDER BY version DESC LIMIT 1;
 IF prior.criteria_id IS NULL THEN
  IF NEW.version<>1 OR NEW.input_json->'baseRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'RESULT_CRITERIA_BASE_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
 ELSIF NEW.version<>prior.version+1 OR NEW.input_json->'baseRef' IS DISTINCT FROM jsonb_build_object('id',prior.criteria_id,'version',prior.version,'contentHash',prior.content_hash) THEN RAISE EXCEPTION 'RESULT_CRITERIA_BASE_VERSION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_criteria_version_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.result_criteria_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_version();
CREATE CONSTRAINT TRIGGER result_criteria_version_commit_guard AFTER INSERT ON anvil.result_criteria_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_version();

CREATE FUNCTION anvil.guard_result_criteria_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation='saveResultCriteria' AND NOT EXISTS(SELECT 1 FROM anvil.result_criteria_versions r WHERE r.project_id=NEW.project_id AND r.command_id=NEW.id AND NEW.result_ref->'data'->'ref'=jsonb_build_object('id',r.criteria_id,'version',r.version,'contentHash',r.content_hash) AND NEW.result_ref->'data'->'snapshot'=r.criteria_json) THEN RAISE EXCEPTION 'RESULT_CRITERIA_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER result_criteria_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_command_complete();
CREATE FUNCTION anvil.guard_result_criteria_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF OLD.operation='saveResultCriteria' THEN RAISE EXCEPTION 'RESULT_CRITERIA_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=OLD.command_id AND c.operation='saveResultCriteria') THEN RAISE EXCEPTION 'RESULT_CRITERIA_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER result_criteria_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_shared_history();
CREATE TRIGGER result_criteria_receipt_history BEFORE UPDATE OR DELETE ON anvil.authorization_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_shared_history();
CREATE TRIGGER result_criteria_audit_history BEFORE UPDATE OR DELETE ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_criteria_shared_history();
