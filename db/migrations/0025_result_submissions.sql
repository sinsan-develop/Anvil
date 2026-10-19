-- FN12 계획된 원제출 보존의 신규 물리 저장. 원문은 주장이고 검수/실행 허가가 아니다.
-- 기존 START/STOP 공용 guard 교체/disable 없이 새 표와 결과 전용 guard만 추가한다.
CREATE TABLE anvil.result_submissions (
 project_id uuid NOT NULL REFERENCES anvil.projects(id),id uuid PRIMARY KEY,execution_id uuid NOT NULL,generation bigint NOT NULL,
 assignment_ref jsonb NOT NULL,execution_ref jsonb NOT NULL,manifest_ref jsonb NOT NULL,
 manifest_hash text NOT NULL CHECK(manifest_hash~'^[0-9a-f]{64}$'),submission_state text NOT NULL CHECK(submission_state IN('COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED')),
 submitted_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 submitted_at timestamptz NOT NULL,UNIQUE(project_id,id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,submitted_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(submitted_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT,INSERT ON anvil.result_submissions TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.result_submissions FROM anvil_v3_app;

CREATE FUNCTION anvil.result_submission_authorized(pid uuid,op text) RETURNS boolean LANGUAGE sql AS $$
 SELECT op='submitResult' AND EXISTS(SELECT 1 FROM anvil.commands c
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

CREATE FUNCTION anvil.result_text_valid(v jsonb,max_units integer) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE raw text;units bigint;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RETURN false;END IF;raw=v#>>'{}';
 SELECT COALESCE(sum(CASE WHEN octet_length(c)=4 THEN 2 ELSE 1 END),0) INTO units FROM regexp_split_to_table(raw,'') c;
 RETURN units<=max_units;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.result_refs_valid(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 RETURN COALESCE(jsonb_typeof(v)='array' AND jsonb_array_length(v)<=200 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v) r WHERE NOT anvil.execution_preparation_ref_valid(r)) AND (SELECT count(DISTINCT r) FROM jsonb_array_elements(v) r)=jsonb_array_length(v),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.result_texts_safe(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;raw text;
BEGIN
 IF jsonb_typeof(v)='object' THEN FOR item IN SELECT value FROM jsonb_each(v) LOOP IF NOT anvil.result_texts_safe(item) THEN RETURN false;END IF;END LOOP;
 ELSIF jsonb_typeof(v)='array' THEN FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP IF NOT anvil.result_texts_safe(item) THEN RETURN false;END IF;END LOOP;
 ELSIF jsonb_typeof(v)='string' THEN raw=v#>>'{}';
  IF raw ~* $pattern$-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\mBearer\s+[A-Za-z0-9_.~+/-]{16,}|\m(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}$pattern$ THEN RETURN false;END IF;
 END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.result_evidence_valid(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>20 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['sourceKind','ref','contentHash','environmentRef','recordedAt']) OR item->>'sourceKind' NOT IN('WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED') OR NOT anvil.execution_preparation_ref_valid(item->'ref') OR NOT anvil.execution_preparation_ref_valid(item->'environmentRef') OR jsonb_typeof(item->'contentHash') IS DISTINCT FROM 'string' OR item->>'contentHash' !~ '^[0-9a-f]{64}$' OR NOT anvil.execution_iso_valid(item->'recordedAt') THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.result_manifest_valid(m jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;arg jsonb;name text;path text;
BEGIN
 IF NOT anvil.execution_json_shape(m,ARRAY['assignmentRef','executionRef','baselineRefs','submissionState','changes','commandResults','testResults','artifactRefs','unexecuted','risks','rollback','checkpointRef'])
  OR NOT anvil.execution_preparation_ref_valid(m->'assignmentRef') OR NOT anvil.execution_preparation_ref_valid(m->'executionRef') OR NOT anvil.result_refs_valid(m->'baselineRefs') OR NOT anvil.result_refs_valid(m->'artifactRefs')
  OR m->>'submissionState' NOT IN('COMPLETED','FAILURE_REPORT','INCOMPLETE','BLOCKED','CANCELLED') OR NOT anvil.result_text_valid(m->'rollback',20000) OR (m->'checkpointRef'<>'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(m->'checkpointRef')) OR octet_length(anvil.execution_authority_canonical(m))>2097152 OR NOT anvil.result_texts_safe(m) THEN RETURN false;END IF;
 FOREACH name IN ARRAY ARRAY['changes','commandResults','testResults','unexecuted','risks'] LOOP
  IF jsonb_typeof(m->name) IS DISTINCT FROM 'array' OR jsonb_array_length(m->name)>(CASE WHEN name='risks' THEN 100 ELSE 200 END) THEN RETURN false;END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'risks') LOOP IF NOT anvil.result_text_valid(item,20000) THEN RETURN false;END IF;END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'changes') LOOP
  path=item->>'path';
  IF NOT anvil.execution_json_shape(item,ARRAY['path','kind','diffRef','beforeHash','afterHash']) OR NOT anvil.result_text_valid(item->'path',2000) OR length(btrim(path))=0 OR path ~ '^[\\/]|^[A-Za-z]:|[\u0001-\u001f]' OR EXISTS(SELECT 1 FROM regexp_split_to_table(replace(path,chr(92),'/'),'/') part WHERE part IN('','.','..')) OR item->>'kind' NOT IN('ADDED','MODIFIED','DELETED')
   OR (item->'diffRef'<>'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(item->'diffRef')) THEN RETURN false;END IF;
  FOREACH name IN ARRAY ARRAY['beforeHash','afterHash'] LOOP IF item->name<>'null'::jsonb AND (jsonb_typeof(item->name) IS DISTINCT FROM 'string' OR item->>name !~ '^[0-9a-f]{64}$') THEN RETURN false;END IF;END LOOP;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'commandResults') LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['profileRef','argv','cwdRef','hostRef','executionRef','startedAt','finishedAt','exitCode','outputRef','evidence']) OR NOT anvil.execution_preparation_ref_valid(item->'profileRef') OR NOT anvil.execution_preparation_ref_valid(item->'cwdRef') OR NOT anvil.execution_preparation_ref_valid(item->'hostRef') OR item->'executionRef' IS DISTINCT FROM m->'executionRef' OR NOT anvil.result_evidence_valid(item->'evidence') OR jsonb_typeof(item->'argv') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'argv')>200 OR (item->'outputRef'<>'null'::jsonb AND NOT anvil.execution_preparation_ref_valid(item->'outputRef')) THEN RETURN false;END IF;
  FOR arg IN SELECT value FROM jsonb_array_elements(item->'argv') LOOP IF NOT anvil.result_text_valid(arg,2000) OR (arg#>>'{}') ~* '^--?(password|passwd|token|access[-_]token|api[-_]key|secret)($|=)' THEN RETURN false;END IF;END LOOP;
  FOREACH name IN ARRAY ARRAY['startedAt','finishedAt'] LOOP IF item->name<>'null'::jsonb AND NOT anvil.execution_iso_valid(item->name) THEN RETURN false;END IF;END LOOP;
  IF item->'startedAt'<>'null'::jsonb AND item->'finishedAt'<>'null'::jsonb AND (item->>'finishedAt')::timestamptz<(item->>'startedAt')::timestamptz THEN RETURN false;END IF;
  IF item->'exitCode'<>'null'::jsonb AND (jsonb_typeof(item->'exitCode') IS DISTINCT FROM 'number' OR (item->>'exitCode') !~ '^(0|[1-9][0-9]{0,15})$' OR (item->>'exitCode')::numeric>9007199254740991) THEN RETURN false;END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'testResults') LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['criterionId','testId','baselineRefs','expected','actual','status','evidence']) OR jsonb_typeof(item->'criterionId') IS DISTINCT FROM 'string' OR item->>'criterionId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' OR jsonb_typeof(item->'testId') IS DISTINCT FROM 'string' OR item->>'testId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' OR NOT anvil.result_refs_valid(item->'baselineRefs') OR NOT anvil.result_text_valid(item->'expected',20000) OR NOT anvil.result_text_valid(item->'actual',20000) OR item->>'status' NOT IN('PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE') OR NOT anvil.result_evidence_valid(item->'evidence') THEN RETURN false;END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(m->'unexecuted') LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['criterionId','testId','reason']) OR jsonb_typeof(item->'criterionId') IS DISTINCT FROM 'string' OR item->>'criterionId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' OR jsonb_typeof(item->'testId') IS DISTINCT FROM 'string' OR item->>'testId' !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$' OR NOT anvil.result_text_valid(item->'reason',20000) OR length(btrim(item->>'reason'))=0 THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE FUNCTION anvil.guard_result_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;m jsonb;scope jsonb;manifest_ref jsonb;cmd anvil.commands%ROWTYPE;ar anvil.authorization_receipts%ROWTYPE;
 q anvil.execution_commands%ROWTYPE;g anvil.execution_grants%ROWTYPE;session anvil.auth_sessions%ROWTYPE;user_generation bigint;historical jsonb;actor_ref jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'RESULT_SUBMISSION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id FOR UPDATE;
 s=NEW.snapshot_json;m=s->'manifest';scope=s->'scope';manifest_ref=jsonb_build_object('id',NEW.id,'version',1,'contentHash',NEW.manifest_hash);
 SELECT * INTO cmd FROM anvil.commands WHERE id=NEW.command_id AND project_id=NEW.project_id;
 SELECT * INTO ar FROM anvil.authorization_receipts WHERE id=cmd.authorization_receipt_id AND command_id=cmd.id;
 SELECT * INTO session FROM anvil.auth_sessions WHERE id::text=current_setting('anvil.result_session_id',true) AND user_id=cmd.actor_id AND client_id=cmd.client_id;
 SELECT credential_generation INTO user_generation FROM anvil.users WHERE id=cmd.actor_id;
 actor_ref=jsonb_build_object('id',cmd.actor_id,'version',user_generation,'contentHash',anvil.execution_json_hash(jsonb_build_object('userId',cmd.actor_id,'clientId',cmd.client_id,'sessionId',session.id,'credentialGeneration',user_generation)));
 IF cmd.id IS NULL OR ar.id IS NULL OR session.id IS NULL OR session.revoked_at IS NOT NULL OR session.credential_generation IS DISTINCT FROM user_generation OR session.idle_expires_at<=clock_timestamp() OR session.absolute_expires_at<=clock_timestamp()
  OR NOT COALESCE(anvil.result_submission_authorized(NEW.project_id,'submitResult'),false) OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
  OR NEW.submitted_by IS DISTINCT FROM cmd.actor_id OR NEW.client_id IS DISTINCT FROM cmd.client_id OR cmd.expected_version<>0
  OR NOT anvil.execution_json_shape(s,ARRAY['transport','scope','submittedByRef','authorizationReceiptRef','manifest','manifestHash','submittedAt','sourceKind','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])
  OR s->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR s->>'sourceKind' IS DISTINCT FROM 'WORKER_CLAIM'
  OR s->'evidenceProvenanceVerified' IS DISTINCT FROM 'false'::jsonb OR s->'completionAccepted' IS DISTINCT FROM 'false'::jsonb OR s->'formalFailureCounted' IS DISTINCT FROM 'false'::jsonb OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR s->'submittedByRef' IS DISTINCT FROM actor_ref OR s->'authorizationReceiptRef' IS DISTINCT FROM jsonb_build_object('id',ar.id,'version',1,'contentHash',ar.scope_digest)
  OR NOT anvil.execution_json_shape(scope,ARRAY['projectId','assignmentRef','executionRef']) OR scope->>'projectId' IS DISTINCT FROM NEW.project_id::text OR scope->'assignmentRef' IS DISTINCT FROM NEW.assignment_ref OR scope->'executionRef' IS DISTINCT FROM NEW.execution_ref
  OR NOT COALESCE(anvil.result_manifest_valid(m),false) OR m->'assignmentRef' IS DISTINCT FROM NEW.assignment_ref OR m->'executionRef' IS DISTINCT FROM NEW.execution_ref OR m->>'submissionState' IS DISTINCT FROM NEW.submission_state
  OR cmd.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','submitResult','targetId',NEW.id,'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',jsonb_build_object('scope',scope,'submissionId',NEW.id,'manifest',m)))
  OR NEW.manifest_ref IS DISTINCT FROM manifest_ref OR NEW.manifest_hash IS DISTINCT FROM anvil.execution_json_hash(m) OR s->>'manifestHash' IS DISTINCT FROM NEW.manifest_hash OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR (s->>'submittedAt')::timestamptz IS DISTINCT FROM NEW.submitted_at OR NEW.submitted_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
  OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->>'projectId' IS DISTINCT FROM NEW.project_id::text OR cmd.result_ref->>'targetId' IS DISTINCT FROM NEW.id::text OR cmd.result_ref->'version' IS DISTINCT FROM '1'::jsonb
  OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM manifest_ref OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'RESULT_SUBMITTED' OR cmd.result_ref->'data'->'manifest' IS DISTINCT FROM m OR cmd.result_ref->'data'->>'sourceKind' IS DISTINCT FROM 'WORKER_CLAIM'
  OR cmd.result_ref->'data'->'completionAccepted' IS DISTINCT FROM 'false'::jsonb OR cmd.result_ref->'data'->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR cmd.result_ref->'data'->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR ar.scope_digest IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('projectId',NEW.project_id,'actorId',cmd.actor_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',manifest_ref))
  THEN RAISE EXCEPTION 'RESULT_SUBMISSION_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO q FROM anvil.execution_commands WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation AND snapshot_json->>'operation'='START_SESSION';
 SELECT * INTO g FROM anvil.execution_grants WHERE project_id=NEW.project_id AND id=q.grant_id AND version=q.grant_version;
 historical=jsonb_build_object('schemaVersion',1,'kind','SYNTHETIC_RESULT_EXECUTION_REFERENCE','projectId',NEW.project_id,'executionId',NEW.execution_id,'executionGeneration',NEW.generation,'assignmentRef',NEW.assignment_ref,
  'initialCommandRef',jsonb_build_object('id',q.id,'version',q.version,'contentHash',q.content_hash),'grantRef',jsonb_build_object('id',g.id,'version',g.version,'contentHash',g.content_hash),'envelopeHash',q.envelope_hash,'authorizationReceiptRef',q.authorization_ref);
 IF q.id IS NULL OR g.id IS NULL OR g.execution_id IS DISTINCT FROM NEW.execution_id OR g.generation IS DISTINCT FROM NEW.generation
  OR g.snapshot_json->'binding'->'intent'->'assignmentRef' IS DISTINCT FROM NEW.assignment_ref
  OR NOT EXISTS(SELECT 1 FROM anvil.assignment_versions v WHERE v.project_id=NEW.project_id AND v.assignment_id::text=NEW.assignment_ref->>'id' AND v.version::text=NEW.assignment_ref->>'version' AND v.content_hash=NEW.assignment_ref->>'contentHash')
  OR NEW.execution_ref IS DISTINCT FROM jsonb_build_object('id',NEW.execution_id,'version',NEW.generation,'contentHash',anvil.execution_json_hash(historical))
  THEN RAISE EXCEPTION 'RESULT_SUBMISSION_EXECUTION_BINDING_INVALID' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER result_submission_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.result_submissions FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_submission();
CREATE CONSTRAINT TRIGGER result_submission_commit_guard AFTER INSERT ON anvil.result_submissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_submission();

CREATE FUNCTION anvil.guard_result_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation='submitResult' AND NOT EXISTS(SELECT 1 FROM anvil.result_submissions r WHERE r.project_id=NEW.project_id AND r.command_id=NEW.id AND NEW.result_ref->'data'->'ref'=r.manifest_ref AND NEW.result_ref->'data'->'manifest'=r.snapshot_json->'manifest') THEN RAISE EXCEPTION 'RESULT_COMMAND_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER result_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_command_complete();
CREATE FUNCTION anvil.guard_result_shared_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='commands' THEN
  IF OLD.operation='submitResult' THEN RAISE EXCEPTION 'RESULT_SUBMISSION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM anvil.commands c WHERE c.id=OLD.command_id AND c.operation='submitResult') THEN RAISE EXCEPTION 'RESULT_SUBMISSION_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER result_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_shared_history();
CREATE TRIGGER result_receipt_history BEFORE UPDATE OR DELETE ON anvil.authorization_receipts FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_shared_history();
CREATE TRIGGER result_audit_history BEFORE UPDATE OR DELETE ON anvil.audit_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_result_shared_history();
