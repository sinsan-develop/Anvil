-- P1 C3 합성 HUMAN 이해 검토 이력의 forward 후보. 정식 DB 미적용.
-- 기존 0016~0018은 변경하지 않는다. source/응답/수신의 실제 제공자는 여전히 별도다.
-- 이 표의 ACCEPTED는 사람의 합성 검토 기록이지 WORK/Agent/OS 허가가 아니다.
CREATE TABLE anvil.understanding_reviews (
 project_id uuid NOT NULL,execution_id uuid NOT NULL,generation bigint NOT NULL,
 id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 1000),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 created_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,id,version),UNIQUE(project_id,execution_id,generation,version),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,execution_id,generation) REFERENCES anvil.executions(project_id,id,generation),
 FOREIGN KEY(project_id,created_by) REFERENCES anvil.project_members(project_id,user_id),
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id),FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id)
);
GRANT SELECT ON anvil.understanding_reviews TO anvil_v3_app;
REVOKE UPDATE,DELETE,INSERT ON anvil.understanding_reviews FROM anvil_v3_app;

CREATE FUNCTION anvil.understanding_refs_valid(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'array' OR jsonb_array_length(value) NOT BETWEEN 1 AND 200 THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(value)v WHERE NOT anvil.execution_preparation_ref_valid(v))
  AND (SELECT count(DISTINCT v) FROM jsonb_array_elements(value)v)=jsonb_array_length(value);
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.understanding_input_valid(input jsonb,binding jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb;criterion jsonb;codes text[]=ARRAY['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];seen text[]=ARRAY[]::text[];
BEGIN
 IF NOT anvil.execution_json_shape(input,ARRAY['bundleRef','responseRef','subjectBindingRef','criteriaVersion','items','reason'])
  OR input->'criteriaVersion' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(input->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(input->>'reason')
  OR NOT anvil.execution_json_shape(binding,ARRAY['transport','scope','bundleRef','responseRef','subjectBindingRef','basisRefs','latestInstructionRefs','requiredPartRefs','receivedPartRefs','responsePartRefs','criteria','sourceState','responseSubject'])
  OR binding->>'transport' IS DISTINCT FROM 'SYNTHETIC_ONLY' OR binding->>'sourceState' IS DISTINCT FROM 'AVAILABLE' OR binding->>'responseSubject' IS DISTINCT FROM 'EXTERNAL_AGENT'
  OR NOT anvil.execution_preparation_ref_valid(input->'bundleRef') OR NOT anvil.execution_preparation_ref_valid(input->'responseRef') OR NOT anvil.execution_preparation_ref_valid(input->'subjectBindingRef')
  OR input->'bundleRef' IS DISTINCT FROM binding->'bundleRef' OR input->'responseRef' IS DISTINCT FROM binding->'responseRef' OR input->'subjectBindingRef' IS DISTINCT FROM binding->'subjectBindingRef'
  OR NOT anvil.understanding_refs_valid(binding->'basisRefs') OR NOT anvil.understanding_refs_valid(binding->'requiredPartRefs') OR NOT anvil.understanding_refs_valid(binding->'receivedPartRefs') OR NOT anvil.understanding_refs_valid(binding->'responsePartRefs')
  OR NOT((binding->'receivedPartRefs') @> (binding->'requiredPartRefs')) OR jsonb_typeof(binding->'latestInstructionRefs') IS DISTINCT FROM 'array' OR jsonb_array_length(binding->'latestInstructionRefs')>200
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(binding->'latestInstructionRefs')v WHERE NOT anvil.execution_json_shape(v,ARRAY['kind','id','contentHash']) OR v->>'kind' IS DISTINCT FROM 'CONVERSATION' OR NOT anvil.execution_preparation_ref_valid(jsonb_build_object('id',v->'id','version',1,'contentHash',v->'contentHash')))
  OR jsonb_typeof(input->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(input->'items')<>6 OR jsonb_typeof(binding->'criteria') IS DISTINCT FROM 'array' OR jsonb_array_length(binding->'criteria')<>6
  OR (SELECT count(DISTINCT v->>'code') FROM jsonb_array_elements(binding->'criteria')v)<>6 THEN RETURN false;END IF;
 FOR item IN SELECT v FROM jsonb_array_elements(input->'items')v LOOP
  IF NOT anvil.execution_json_shape(item,ARRAY['code','sourceRefs','responsePartRefs','judgement','reason']) OR NOT(item->>'code'=ANY(codes)) OR item->>'code'=ANY(seen)
   OR jsonb_typeof(item->'judgement') IS DISTINCT FROM 'string' OR item->>'judgement' NOT IN('MATCH','MISMATCH','INSUFFICIENT') OR jsonb_typeof(item->'reason') IS DISTINCT FROM 'string' OR NOT anvil.assignment_content_reason(item->>'reason')
   OR NOT anvil.understanding_refs_valid(item->'sourceRefs') OR NOT anvil.understanding_refs_valid(item->'responsePartRefs') THEN RETURN false;END IF;
  SELECT v INTO criterion FROM jsonb_array_elements(binding->'criteria')v WHERE v->>'code'=item->>'code';
  IF criterion IS NULL OR NOT anvil.execution_json_shape(criterion,ARRAY['code','sourceRefs','responsePartRefs']) OR item->'sourceRefs' IS DISTINCT FROM criterion->'sourceRefs' OR item->'responsePartRefs' IS DISTINCT FROM criterion->'responsePartRefs'
   OR NOT((binding->'basisRefs') @> (item->'sourceRefs')) OR NOT((binding->'responsePartRefs') @> (item->'responsePartRefs')) THEN RETURN false;END IF;
  seen=array_append(seen,item->>'code');
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
CREATE FUNCTION anvil.guard_understanding_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb;req jsonb;r jsonb;binding jsonb;expected jsonb;scope jsonb;digest text;cmd anvil.commands%ROWTYPE;previous anvil.understanding_reviews%ROWTYPE;policy anvil.permission_policy_versions%ROWTYPE;at_time timestamptz=clock_timestamp();
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'UNDERSTANDING_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;
 PERFORM id FROM anvil.projects WHERE id=NEW.project_id AND archived_at IS NULL FOR UPDATE;
 s=NEW.snapshot_json;req=s->'request';r=s->'reviewer';binding=s->'currentBinding';scope=jsonb_build_object('projectId',NEW.project_id,'executionId',NEW.execution_id,'executionGeneration',NEW.generation);
 expected=jsonb_build_object('id',NEW.id,'version',NEW.version,'contentHash',NEW.content_hash);
 SELECT * INTO cmd FROM anvil.commands WHERE project_id=NEW.project_id AND id=NEW.command_id;
 SELECT pv.* INTO policy FROM anvil.permission_policy_versions pv JOIN anvil.permission_policies p ON p.project_id=pv.project_id AND p.id=pv.policy_id AND p.head_version=pv.version
  WHERE p.project_id=NEW.project_id AND jsonb_build_object('id',p.id,'version',p.head_version,'contentHash',pv.content_hash)=s->'policyRef';
 digest=anvil.execution_json_hash(jsonb_build_object('projectId',NEW.project_id,'actorId',NEW.created_by,'clientId',NEW.client_id,'controlGeneration',cmd.control_generation,'requestHash',cmd.request_hash,'policyRef',cmd.policy_ref,'targetRef',expected));
 IF NOT anvil.execution_json_shape(s,ARRAY['scope','sequence','previousRef','request','requestHash','reviewer','policyRef','currentBinding','input','outcome','recordedAt','executionAuthorized','dispatchPerformed'])
  OR NOT anvil.execution_json_shape(req,ARRAY['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  OR NOT anvil.execution_json_shape(r,ARRAY['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])
  OR s->'scope' IS DISTINCT FROM scope OR binding->'scope' IS DISTINCT FROM scope OR s->'sequence' IS DISTINCT FROM to_jsonb(NEW.version)
  OR s->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb OR s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR cmd.id IS NULL OR policy.policy_id IS NULL OR cmd.scope_kind IS DISTINCT FROM 'PROJECT' OR cmd.scope_id IS DISTINCT FROM NEW.project_id OR cmd.state IS DISTINCT FROM 'APPLIED' OR cmd.operation IS DISTINCT FROM 'reviewUnderstanding'
  OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
  OR cmd.actor_id IS DISTINCT FROM NEW.created_by OR cmd.client_id IS DISTINCT FROM NEW.client_id OR cmd.approval_consumption_id IS NOT NULL OR cmd.payload_ref IS NOT NULL
  OR req->'schemaVersion' IS DISTINCT FROM '1'::jsonb OR req->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id) OR req->'commandId' IS DISTINCT FROM to_jsonb(cmd.command_id)
  OR req->'operation' IS DISTINCT FROM '"reviewUnderstanding"'::jsonb OR req->'targetId' IS DISTINCT FROM to_jsonb(NEW.execution_id) OR req->'expectedVersion' IS DISTINCT FROM to_jsonb(NEW.generation)
  OR req->'clientId' IS DISTINCT FROM to_jsonb(NEW.client_id) OR req->'controlGeneration' IS DISTINCT FROM to_jsonb(cmd.control_generation) OR req->'approvalRef' IS DISTINCT FROM 'null'::jsonb OR req->'baselineRefs' IS DISTINCT FROM '[]'::jsonb
  OR cmd.expected_version IS DISTINCT FROM NEW.generation OR req->'payload' IS DISTINCT FROM s->'input' OR s->>'requestHash' IS DISTINCT FROM cmd.request_hash OR anvil.execution_json_hash(req) IS DISTINCT FROM cmd.request_hash
  OR r->>'kind' IS DISTINCT FROM 'HUMAN' OR r->'userId' IS DISTINCT FROM to_jsonb(NEW.created_by) OR r->'clientId' IS DISTINCT FROM to_jsonb(NEW.client_id) OR r->'controlGeneration' IS DISTINCT FROM to_jsonb(cmd.control_generation)
  OR cmd.policy_ref IS DISTINCT FROM s->'policyRef' OR cmd.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR cmd.result_ref->'projectId' IS DISTINCT FROM to_jsonb(NEW.project_id)
  OR cmd.result_ref->'targetId' IS DISTINCT FROM to_jsonb(NEW.id) OR cmd.result_ref->'version' IS DISTINCT FROM to_jsonb(NEW.version) OR cmd.result_ref->'data'->'ref' IS DISTINCT FROM expected OR cmd.result_ref->'data'->'snapshot' IS DISTINCT FROM s OR cmd.result_ref->'data'->>'status' IS DISTINCT FROM 'SYNTHETIC_UNDERSTANDING_REVIEWED'
  OR NOT anvil.execution_iso_valid(s->'recordedAt') OR (s->>'recordedAt')::timestamptz>at_time OR (s->>'recordedAt')::timestamptz<at_time-interval '30 seconds'
  OR NOT anvil.understanding_input_valid(s->'input',binding)
  OR s->>'outcome' IS DISTINCT FROM (CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'input'->'items')v WHERE v->>'judgement'<>'MATCH') THEN 'ACCEPTED' ELSE 'NOT_ACCEPTED' END)
  OR NOT EXISTS(SELECT 1 FROM anvil.project_control pc JOIN anvil.project_members m ON m.project_id=pc.project_id AND m.user_id=pc.actor_id JOIN anvil.projects p ON p.id=pc.project_id WHERE pc.project_id=NEW.project_id AND pc.actor_id=NEW.created_by AND pc.client_id=NEW.client_id AND pc.generation=cmd.control_generation AND pc.revoked_at IS NULL AND m.revoked_at IS NULL AND m.participation='OWNER' AND p.archived_at IS NULL)
  OR NOT EXISTS(SELECT 1 FROM anvil.auth_sessions a JOIN anvil.users u ON u.id=a.user_id JOIN anvil.clients cl ON cl.id=a.client_id AND cl.user_id=a.user_id WHERE a.id::text=r->>'humanSessionId' AND a.user_id=NEW.created_by AND a.client_id=NEW.client_id AND a.credential_generation=u.credential_generation AND to_jsonb(u.credential_generation)=r->'credentialGeneration' AND a.revoked_at IS NULL AND u.revoked_at IS NULL AND u.status='ACTIVE' AND cl.revoked_at IS NULL AND a.idle_expires_at>at_time AND a.absolute_expires_at>at_time)
  OR NOT EXISTS(SELECT 1 FROM anvil.authorization_receipts ar JOIN anvil.audit_events a ON a.project_id=NEW.project_id AND a.command_id=cmd.id AND a.operation_id=cmd.operation_id WHERE ar.id=cmd.authorization_receipt_id AND ar.command_id=cmd.id AND ar.scope_kind='PROJECT' AND ar.scope_id=NEW.project_id AND ar.policy_ref=cmd.policy_ref AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',NEW.created_by,'clientId',NEW.client_id) AND ar.scope_digest=digest AND ar.approval_decision_ref IS NULL AND a.scope_digest=digest AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND')
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(policy.rules_json)v WHERE v->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND v->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (v->'operations') ? 'reviewUnderstanding' AND v->>'disposition'='AUTO' AND v->'limitPolicyRef'='null'::jsonb AND (v->>'expiresAt')::timestamptz>at_time)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(policy.rules_json)v WHERE v->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',NEW.created_by) AND v->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',NEW.project_id)) AND (v->'operations') ? 'reviewUnderstanding' AND v->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (v->>'expiresAt')::timestamptz>at_time)
  THEN RAISE EXCEPTION 'UNDERSTANDING_EXACT_HUMAN_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO previous FROM anvil.understanding_reviews WHERE project_id=NEW.project_id AND execution_id=NEW.execution_id AND generation=NEW.generation ORDER BY version DESC LIMIT 1;
 IF previous.id IS NULL THEN
  IF NEW.version<>1 OR s->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'UNDERSTANDING_SEQUENCE_REQUIRED';END IF;
 ELSIF NEW.id IS DISTINCT FROM previous.id OR NEW.version<>previous.version+1 OR s->'previousRef' IS DISTINCT FROM jsonb_build_object('id',previous.id,'version',previous.version,'contentHash',previous.content_hash) OR (s->>'recordedAt')::timestamptz<(previous.snapshot_json->>'recordedAt')::timestamptz THEN RAISE EXCEPTION 'UNDERSTANDING_SEQUENCE_REQUIRED';END IF;
 IF octet_length(anvil.execution_authority_canonical(COALESCE((SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',v.id,'version',v.version,'contentHash',v.content_hash),'snapshot',v.snapshot_json) ORDER BY v.version) FROM anvil.understanding_reviews v WHERE v.project_id=NEW.project_id AND v.execution_id=NEW.execution_id AND v.generation=NEW.generation),'[]'::jsonb)||jsonb_build_array(jsonb_build_object('ref',expected,'snapshot',NEW.snapshot_json))))>2097152 THEN RAISE EXCEPTION 'UNDERSTANDING_HISTORY_QUOTA_REQUIRED';END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'UNDERSTANDING_EXACT_HUMAN_RECEIPT_REQUIRED' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER understanding_review_guard BEFORE INSERT OR UPDATE OR DELETE ON anvil.understanding_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_understanding_review();
CREATE FUNCTION anvil.guard_understanding_command_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN('UPDATE','DELETE') AND OLD.operation='reviewUnderstanding' THEN RAISE EXCEPTION 'UNDERSTANDING_HISTORY_IMMUTABLE' USING ERRCODE='42501';END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;
$$;
CREATE TRIGGER understanding_command_history BEFORE UPDATE OR DELETE ON anvil.commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_understanding_command_history();
CREATE FUNCTION anvil.guard_understanding_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.scope_kind='PROJECT' AND NEW.operation='reviewUnderstanding' AND NOT EXISTS(SELECT 1 FROM anvil.understanding_reviews r WHERE r.project_id=NEW.project_id AND r.command_id=NEW.id AND NEW.result_ref->'data'->'ref'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash) AND NEW.result_ref->'data'->'snapshot'=r.snapshot_json) THEN RAISE EXCEPTION 'UNDERSTANDING_COMMAND_REVERSE_ATOMIC_REQUIRED' USING ERRCODE='42501';END IF;RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER understanding_command_complete AFTER INSERT ON anvil.commands DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.guard_understanding_command_complete();
GRANT INSERT ON anvil.understanding_reviews TO anvil_v3_app;
