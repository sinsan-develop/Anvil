-- FN09 부모 연결 초안 한정 A. 미적용 후보이며 기존0012/0013/0016/0017 원본은 보존한다.
-- 직접 승인 원 제안 SHA256 283E8601C8951574740630D7EA4F6A1EE59260E925B20FC2C5B9579E9D326B87.
-- 실제 PG 컴파일·DML·COMMIT/MVCC 검수 전. root/null 동작의 기존 guard를 유지한다.

CREATE FUNCTION anvil.assignment_parent_current(pid uuid,child_id uuid,s jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE r jsonb=s->'definition'->'parentAssignmentRef';d jsonb=s->'definition';
 p anvil.assignment_versions%ROWTYPE;pv anvil.assignment_draft_versions%ROWTYPE;
 c anvil.commands%ROWTYPE;dc anvil.commands%ROWTYPE;rv record;head bigint;field text;scope jsonb;original jsonb;
BEGIN
 IF r='null'::jsonb THEN RETURN true;END IF;
 IF NOT COALESCE(anvil.execution_preparation_ref_valid(r),false) OR r->>'id'=child_id::text THEN RETURN false;END IF;
 -- 모든 부모 검토·확정/기준 변경의 기존 project lock과 같은 순서를 사용한다.
 PERFORM id FROM anvil.projects WHERE id=pid FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT head_version INTO head FROM anvil.assignment_drafts WHERE project_id=pid AND id=(r->>'id')::uuid FOR UPDATE;
 IF head IS DISTINCT FROM (r->>'version')::bigint THEN RETURN false;END IF;
 SELECT * INTO p FROM anvil.assignment_versions WHERE project_id=pid AND assignment_id=(r->>'id')::uuid AND version=head;
 SELECT * INTO pv FROM anvil.assignment_draft_versions WHERE project_id=pid AND draft_id=p.assignment_id AND version=p.version;
 IF p.assignment_id IS NULL OR pv.draft_id IS NULL OR p.content_hash IS DISTINCT FROM r->>'contentHash'
  OR p.content_hash IS DISTINCT FROM anvil.execution_json_hash(p.version_json)
  OR pv.content_hash IS DISTINCT FROM anvil.execution_json_hash(pv.version_json)
  OR p.version_json->'definition' IS DISTINCT FROM pv.version_json->'definition'
  OR p.version_json->'definition'->'parentAssignmentRef' IS DISTINCT FROM 'null'::jsonb
  OR p.version_json->'draftRef' IS DISTINCT FROM jsonb_build_object('id',pv.draft_id,'version',pv.version,'contentHash',pv.content_hash)
  OR p.version_json->'contentConfirmed' IS DISTINCT FROM 'true'::jsonb
  OR p.version_json->'ready' IS DISTINCT FROM 'false'::jsonb
  OR p.version_json->'executionAuthorized' IS DISTINCT FROM 'false'::jsonb
  OR p.version_json->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb
  OR anvil.assignment_draft_basis_current(pid,pv.version_json->'basis') IS NOT TRUE THEN RETURN false;END IF;
 SELECT * INTO c FROM anvil.commands WHERE project_id=pid AND id=p.command_id;
 SELECT * INTO dc FROM anvil.commands WHERE project_id=pid AND id=pv.command_id;
 IF c.id IS NULL OR dc.id IS NULL OR c.operation IS DISTINCT FROM 'confirmAssignment' OR dc.operation IS DISTINCT FROM 'prepareAssignment'
  OR c.state IS DISTINCT FROM 'APPLIED' OR dc.state IS DISTINCT FROM 'APPLIED'
  OR c.actor_id IS DISTINCT FROM p.created_by OR c.client_id IS DISTINCT FROM p.client_id
  OR dc.actor_id IS DISTINCT FROM pv.created_by OR dc.client_id IS DISTINCT FROM pv.client_id
  OR c.expected_version IS DISTINCT FROM p.version OR dc.expected_version IS DISTINCT FROM pv.version-1
  OR c.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR c.result_ref->>'projectId' IS DISTINCT FROM pid::text
  OR c.result_ref->'data'->>'status' IS DISTINCT FROM 'ASSIGNMENT_CONTENT_CONFIRMED'
  OR c.result_ref->'data'->>'confirmationId' IS DISTINCT FROM p.confirmation_id::text
  OR c.result_ref->'data'->'ref' IS DISTINCT FROM r OR c.result_ref->'data'->'snapshot' IS DISTINCT FROM p.version_json
  OR dc.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR dc.result_ref->>'projectId' IS DISTINCT FROM pid::text
  OR dc.result_ref->'data'->>'status' IS DISTINCT FROM 'ASSIGNMENT_DRAFT_STORED'
  OR dc.result_ref->'data'->'ref' IS DISTINCT FROM p.version_json->'draftRef'
  OR dc.result_ref->'data'->'snapshot' IS DISTINCT FROM pv.version_json
  OR NOT EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED')
  OR NOT EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=dc.id AND a.operation_id=dc.operation_id AND a.outcome='APPLIED')
  THEN RETURN false;END IF;
 SELECT v.*,rc.result_ref,rc.actor_id command_actor,rc.client_id command_client,rc.operation,rc.state
 INTO rv FROM anvil.assignment_content_reviews v JOIN anvil.commands rc ON rc.project_id=v.project_id AND rc.id=v.command_id
 JOIN anvil.audit_events a ON a.project_id=v.project_id AND a.command_id=v.command_id AND a.outcome='APPLIED'
 WHERE v.project_id=pid AND v.draft_id=p.assignment_id AND v.draft_version=p.version ORDER BY a.server_sequence DESC LIMIT 1;
 IF NOT FOUND THEN RETURN false;END IF;
 IF rv.draft_hash IS DISTINCT FROM pv.content_hash OR rv.review_json->>'outcome' IS DISTINCT FROM 'ACCEPTED'
  OR rv.review_json->'draftRef' IS DISTINCT FROM p.version_json->'draftRef'
  OR anvil.assignment_content_review_valid(rv.review_json) IS NOT TRUE
  OR rv.content_hash IS DISTINCT FROM anvil.execution_json_hash(rv.review_json)
  OR rv.operation IS DISTINCT FROM 'reviewAssignmentContent' OR rv.state IS DISTINCT FROM 'APPLIED'
  OR rv.command_actor IS DISTINCT FROM rv.created_by OR rv.command_client IS DISTINCT FROM rv.client_id
  OR rv.result_ref->>'status' IS DISTINCT FROM 'APPLIED' OR rv.result_ref->'data'->>'status' IS DISTINCT FROM 'ASSIGNMENT_CONTENT_REVIEWED'
  OR rv.result_ref->'data'->'ref' IS DISTINCT FROM jsonb_build_object('id',rv.review_id,'version',1,'contentHash',rv.content_hash)
  OR rv.result_ref->'data'->'snapshot' IS DISTINCT FROM rv.review_json THEN RETURN false;END IF;
 original=p.version_json->'definition';
 IF d->'taskRef'->'applicationRef' IS DISTINCT FROM original->'taskRef'->'applicationRef'
  OR d->'taskRef'->'planRef' IS DISTINCT FROM original->'taskRef'->'planRef'
  OR d->'taskRef'->'nodeId' IS DISTINCT FROM original->'taskRef'->'nodeId' THEN RETURN false;END IF;
 FOREACH field IN ARRAY ARRAY['environmentRef','budgetRef','recordingPolicyRef'] LOOP
  IF d->field IS DISTINCT FROM original->field THEN RETURN false;END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['baselineRefs','requiredCapabilities'] LOOP
  IF jsonb_typeof(d->field) IS DISTINCT FROM 'array' OR jsonb_typeof(original->field) IS DISTINCT FROM 'array'
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->field) child WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original->field) parent WHERE parent=child)) THEN RETURN false;END IF;
 END LOOP;
 IF jsonb_typeof(d->'allowedScopes') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(d->'allowedScopes')>0 THEN
  IF anvil.execution_source_scopes_valid(d->'allowedScopes') IS NOT TRUE OR anvil.execution_source_scopes_valid(original->'allowedScopes') IS NOT TRUE THEN RETURN false;END IF;
  FOR scope IN SELECT value FROM jsonb_array_elements(d->'allowedScopes') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original->'allowedScopes') base
    WHERE base-'targets'=scope-'targets' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'targets') target
     WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(base->'targets') parent_target WHERE parent_target=target))) THEN RETURN false;END IF;
  END LOOP;
 END IF;
 RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION anvil.guard_assignment_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;snapshot jsonb;data jsonb;rid uuid;v bigint;expected_ref jsonb;previous_hash text;previous_parent jsonb;
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
  OR anvil.assignment_parent_current(NEW.project_id,rid,snapshot) IS NOT TRUE OR jsonb_typeof(snapshot->'readinessIssues') IS DISTINCT FROM 'array'
  OR NOT anvil.assignment_draft_basis_current(NEW.project_id,snapshot->'basis')
  OR snapshot->'definition'->'taskRef' IS DISTINCT FROM jsonb_build_object('planRef',snapshot->'basis'->'planRef','taskCode',snapshot->'basis'->>'taskCode','applicationRef',snapshot->'basis'->'applicationRef','nodeId',snapshot->'basis'->>'nodeId')
  OR cmd.request_hash IS DISTINCT FROM encode(sha256(convert_to(anvil.assignment_draft_canonical(jsonb_build_object('schemaVersion',1,'projectId',NEW.project_id,'commandId',cmd.command_id,'clientId',cmd.client_id,'controlGeneration',cmd.control_generation,'operation','prepareAssignment','targetId',CASE WHEN v=1 THEN 'null'::jsonb ELSE to_jsonb(rid) END,'expectedVersion',v-1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',jsonb_build_object('baseRef',snapshot->'previousRef','definition',snapshot->'definition','reason',snapshot->'reason'))),'UTF8')),'hex')
  THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_EXACT_CURRENT_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 IF v=1 THEN
  IF snapshot->'previousRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  SELECT content_hash,version_json->'definition'->'parentAssignmentRef' INTO previous_hash,previous_parent FROM anvil.assignment_draft_versions WHERE project_id=NEW.project_id AND draft_id=rid AND version=v-1;
  IF previous_parent IS DISTINCT FROM snapshot->'definition'->'parentAssignmentRef' OR previous_hash IS NULL OR snapshot->'previousRef' IS DISTINCT FROM jsonb_build_object('id',rid,'version',v-1,'contentHash',previous_hash) THEN RAISE EXCEPTION 'ASSIGNMENT_DRAFT_BASE_REQUIRED' USING ERRCODE='42501';END IF;
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

-- 기존/관리자 비정상 child 확정본도 새 후속 쓰기의 근거가 되지 않는다.
CREATE FUNCTION anvil.assignment_root_reference(pid uuid,r jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(anvil.execution_preparation_ref_valid(r),false) AND EXISTS(
 SELECT 1 FROM anvil.assignment_versions a JOIN anvil.assignment_draft_versions d
 ON d.project_id=a.project_id AND d.draft_id=a.assignment_id AND d.version=a.version
 WHERE a.project_id=pid AND a.assignment_id::text=r->>'id' AND a.version::text=r->>'version' AND a.content_hash=r->>'contentHash'
 AND a.version_json->'definition'->'parentAssignmentRef'='null'::jsonb AND d.version_json->'definition'->'parentAssignmentRef'='null'::jsonb);
$$;

CREATE FUNCTION anvil.guard_child_assignment_draft_only() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n jsonb=to_jsonb(NEW);r jsonb;pid uuid=NEW.project_id;parent jsonb;cid uuid;g jsonb;
BEGIN
 IF TG_TABLE_NAME='assignment_content_reviews' OR TG_TABLE_NAME='assignment_versions' THEN
  SELECT version_json->'definition'->'parentAssignmentRef' INTO parent FROM anvil.assignment_draft_versions
   WHERE project_id=pid AND draft_id=COALESCE(n->>'draft_id',n->>'assignment_id')::uuid AND version=COALESCE(n->>'draft_version',n->>'version')::bigint;
  IF parent IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSIGNMENT_CHILD_DRAFT_ONLY' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='assignment_versions' AND n->'version_json'->'definition'->'parentAssignmentRef' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'ASSIGNMENT_CHILD_DRAFT_ONLY' USING ERRCODE='42501';END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='agent_sessions' THEN
  SELECT result_ref->'data'->'snapshot'->'assignmentRef' INTO r FROM anvil.commands WHERE project_id=pid AND id=NEW.command_id;
 ELSIF TG_TABLE_NAME='role_bindings' THEN r=n->'snapshot_json'->'assignmentRef';
 ELSIF TG_TABLE_NAME='context_bundles' THEN r=n->'assignment_ref';
 ELSIF TG_TABLE_NAME='execution_preparations' THEN r=n->'snapshot_json'->'intent'->'assignmentRef';
 ELSIF TG_TABLE_NAME='execution_grants' THEN r=n->'snapshot_json'->'binding'->'intent'->'assignmentRef';
 ELSIF TG_TABLE_NAME='usage_reservations' THEN r=n->'snapshot_json'->'claim'->'assignmentRef';
 ELSIF TG_TABLE_NAME='executions' THEN
  SELECT b.assignment_ref INTO r FROM anvil.commands c JOIN anvil.context_bundles b ON b.project_id=c.project_id
   AND b.id::text=c.result_ref->'data'->'snapshot'->'payload'->'contextBundleRef'->>'id'
   AND b.version::text=c.result_ref->'data'->'snapshot'->'payload'->'contextBundleRef'->>'version'
   AND b.content_hash=c.result_ref->'data'->'snapshot'->'payload'->'contextBundleRef'->>'contentHash'
   WHERE c.project_id=pid AND c.id=NEW.command_id;
 ELSIF TG_TABLE_NAME='delivery_outbox' THEN
  IF NEW.kind NOT IN('EXECUTION_SYNTHETIC_ONLY','EXECUTION_INSTRUCTION_SYNTHETIC_ONLY') THEN RETURN NEW;END IF;
  g=n->'payload_ref'->'grantRef';
  SELECT snapshot_json->'binding'->'intent'->'assignmentRef' INTO r FROM anvil.execution_grants
   WHERE project_id=pid AND id::text=g->>'id' AND version::text=g->>'version' AND content_hash=g->>'contentHash';
 ELSE
  SELECT snapshot_json->'binding'->'intent'->'assignmentRef' INTO r FROM anvil.execution_grants
   WHERE project_id=pid AND id=(n->>'grant_id')::uuid AND version=(n->>'grant_version')::bigint;
 END IF;
 IF anvil.assignment_root_reference(pid,r) IS NOT TRUE THEN RAISE EXCEPTION 'ASSIGNMENT_CHILD_DRAFT_ONLY' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER child_assignment_draft_only_assignment_content_reviews BEFORE INSERT ON anvil.assignment_content_reviews FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_assignment_versions BEFORE INSERT ON anvil.assignment_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_agent_sessions BEFORE INSERT ON anvil.agent_sessions FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_role_bindings BEFORE INSERT ON anvil.role_bindings FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_context_bundles BEFORE INSERT ON anvil.context_bundles FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_execution_preparations BEFORE INSERT ON anvil.execution_preparations FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_execution_grants BEFORE INSERT ON anvil.execution_grants FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_usage_reservations BEFORE INSERT ON anvil.usage_reservations FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_executions BEFORE INSERT ON anvil.executions FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_execution_commands BEFORE INSERT ON anvil.execution_commands FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_writer_claims BEFORE INSERT ON anvil.writer_claims FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
CREATE TRIGGER child_assignment_draft_only_delivery_outbox BEFORE INSERT ON anvil.delivery_outbox FOR EACH ROW EXECUTE FUNCTION anvil.guard_child_assignment_draft_only();
