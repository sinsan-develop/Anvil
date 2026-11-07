-- FN03/FN11: detach 한 연산의 일회 승인. 미적용 forward 후보/실제 PG 검증 전 사용 불가.
-- 기존 함수의 다른 연산/초기 LINKED·파일 접근 권한은 확장하지 않는다.
CREATE FUNCTION anvil.document_source_detach_approval_target_valid(pid uuid,scope jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT COALESCE(scope->>'operation'='detachDocumentSource' AND scope->>'expectedVersion'='1'
 AND anvil.execution_json_shape(scope->'targetRef',ARRAY['id','version','contentHash'])
 AND scope->'targetRef'->>'version'='1' AND EXISTS(
 SELECT 1 FROM anvil.document_source_links l JOIN anvil.document_source_link_events e
 ON e.project_id=l.project_id AND e.link_id=l.id AND e.id=l.current_event_id AND e.link_version=l.link_version
 WHERE l.project_id=pid AND l.link_version=1 AND l.state='ACTIVE'
 AND scope->'targetRef'=jsonb_build_object('id',l.id,'version',1,'contentHash',e.content_hash)
 AND e.snapshot_json->>'kind'='LINKED' AND e.snapshot_json->>'state'='ACTIVE'
 AND e.content_hash=anvil.execution_json_hash(e.snapshot_json)),false);
$$;


CREATE OR REPLACE FUNCTION anvil.connection_candidate_approval_target_valid(pid uuid,scope jsonb) RETURNS boolean LANGUAGE sql AS $$
 SELECT (scope->>'operation' IN('registerConnection','saveEnvironment') AND
 ((scope->'targetRef'='null'::jsonb AND scope->>'expectedVersion'='0') OR EXISTS(
 SELECT 1 FROM anvil.connection_candidates c JOIN anvil.connection_candidate_versions v ON v.project_id=c.project_id AND v.candidate_id=c.id AND v.version=c.head_version
 WHERE c.project_id=pid AND scope->'targetRef'=jsonb_build_object('id',c.id,'version',v.version,'contentHash',v.content_hash) AND scope->>'expectedVersion'=v.version::text
 AND c.kind=CASE scope->>'operation' WHEN 'registerConnection' THEN 'CONNECTION_CANDIDATE' ELSE 'ENVIRONMENT_CANDIDATE' END)))
 OR anvil.host_trust_approval_target_valid(pid,scope)
 OR anvil.document_source_detach_approval_target_valid(pid,scope);
$$;

CREATE OR REPLACE FUNCTION anvil.one_time_consumption_command_authorized(p_project uuid,p_command uuid,p_decision uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref AND ar.approval_decision_ref=p_decision
 JOIN anvil.approval_decisions d ON d.id=p_decision AND d.project_id=c.project_id AND d.decision='APPROVE' AND d.command_id IS NOT NULL AND d.decision_json IS NOT NULL
 JOIN anvil.approval_requests r ON r.id=d.request_id AND r.project_id=d.project_id AND r.version=2 AND r.status='APPROVED' AND r.command_id IS NOT NULL AND r.policy_ref=c.policy_ref AND r.scope_digest=d.scope_digest AND d.request_version=1
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members pm ON pm.project_id=c.project_id AND pm.user_id=c.actor_id AND pm.participation='OWNER' AND pm.revoked_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id=p_command AND c.project_id=p_project AND c.scope_kind='PROJECT' AND c.scope_id=c.project_id AND c.operation IN('uploadArtifact','registerConnection','saveEnvironment','registerConnector','confirmConnectorRegistration','revokeConnector','detachDocumentSource') AND (c.operation IN('uploadArtifact','registerConnection','saveEnvironment') OR anvil.host_trust_approval_target_valid(p_project,r.action_scope_json) OR anvil.document_source_detach_approval_target_valid(p_project,r.action_scope_json)) AND c.state='APPLIED' AND c.expected_version=(r.action_scope_json->>'expectedVersion')::bigint AND (c.operation<>'uploadArtifact' OR c.expected_version=0) AND (c.operation='uploadArtifact' OR c.operation='detachDocumentSource' AND c.result_ref->'data'->'snapshot'->'previousRef'=r.action_scope_json->'targetRef' OR c.operation<>'detachDocumentSource' AND c.result_ref->'data'->'previousRef'=r.action_scope_json->'targetRef')
 AND ((c.operation='detachDocumentSource') IS NOT DISTINCT FROM (r.action_scope_json->>'operation'='detachDocumentSource'))
 AND (c.operation<>'detachDocumentSource' OR (
 r.action_scope_json->>'operation'='detachDocumentSource' AND c.expected_version=1
 AND c.result_ref->>'targetId'=r.action_scope_json->'targetRef'->>'id'
 AND r.action_scope_json->>'payloadHash'=anvil.execution_json_hash(jsonb_build_object('sourceLinkRef',r.action_scope_json->'targetRef','reason',c.result_ref->'data'->'snapshot'->'reason'))
 AND c.request_hash=anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',c.project_id,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','detachDocumentSource','targetId',r.action_scope_json->'targetRef'->'id','expectedVersion',1,'baselineRefs','[]'::jsonb,'approvalRef',jsonb_build_object('requestId',r.id,'decisionId',d.id,'scopeDigest',r.scope_digest),'payload',jsonb_build_object('sourceLinkRef',r.action_scope_json->'targetRef','reason',c.result_ref->'data'->'snapshot'->'reason')))))
 AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.approval_consumption_id IS NOT NULL AND c.command_id=r.candidate_command_id AND r.created_by=c.actor_id AND r.client_id=c.client_id AND d.decided_by=r.created_by AND d.client_id=r.client_id AND d.control_generation=pc.generation
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND r.request_json->>'controlGeneration'=pc.generation::text AND r.action_scope_json->>'controlGeneration'=pc.generation::text AND r.expires_at>clock_timestamp()
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',r.action_scope_json->>'payloadHash','scopeDigest',r.scope_digest)
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='REQUIRE_APPROVAL' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) AS rules(rule) WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',p_project)) AND (rule->'operations') ? c.operation AND rule->>'disposition'='DENY' AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE OR REPLACE FUNCTION anvil.document_source_detach_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM anvil.commands c
 JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id AND ar.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.projects p ON p.id=c.project_id AND p.archived_at IS NULL
 JOIN anvil.permission_policies pp ON pp.project_id=c.project_id AND pp.id::text=c.policy_ref->>'id' AND pp.head_version::text=c.policy_ref->>'version'
 JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid AND c.scope_kind='PROJECT' AND c.scope_id=pid
 AND c.operation='detachDocumentSource' AND c.state='APPLIED' AND c.expected_version=1
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND ((c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL)
 OR EXISTS(SELECT 1 FROM anvil.approval_consumptions ac
 JOIN anvil.approval_decisions d ON d.project_id=ac.project_id AND d.id=ac.decision_id AND d.decision='APPROVE'
 JOIN anvil.approval_requests r ON r.project_id=d.project_id AND r.id=d.request_id
 WHERE ac.id=c.approval_consumption_id AND ac.project_id=pid AND ac.command_id=c.id
 AND ar.approval_decision_ref=d.id AND ac.scope_digest=r.scope_digest AND r.scope_digest=d.scope_digest
 AND ac.policy_id::text=c.policy_ref->>'id' AND ac.policy_version::text=c.policy_ref->>'version'
 AND r.policy_ref=c.policy_ref AND d.decision_json->'policyRef'=c.policy_ref
 AND r.version=3 AND r.status='CONSUMED' AND r.expires_at>clock_timestamp()
 AND r.candidate_command_id=c.command_id AND r.created_by=c.actor_id AND r.client_id=c.client_id
 AND d.decided_by=c.actor_id AND d.client_id=c.client_id AND d.control_generation=c.control_generation
 AND r.required_decider_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
 AND r.action_scope_json->>'operation'='detachDocumentSource' AND r.action_scope_json->>'expectedVersion'='1'
 AND r.request_json->>'controlGeneration'=c.control_generation::text
 AND r.action_scope_json->>'controlGeneration'=c.control_generation::text
 AND r.action_scope_json->'requestedSubjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND c.result_ref->'data'->'snapshot'->'previousRef'=r.action_scope_json->'targetRef'
 AND r.action_scope_json->>'payloadHash'=anvil.execution_json_hash(jsonb_build_object('sourceLinkRef',r.action_scope_json->'targetRef','reason',c.result_ref->'data'->'snapshot'->'reason'))
 AND c.payload_ref=jsonb_build_object('kind','ONE_TIME_APPROVAL_SCOPE','payloadHash',r.action_scope_json->>'payloadHash','scopeDigest',r.scope_digest)))
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'detachDocumentSource'
  AND rule->>'disposition'=CASE WHEN c.approval_consumption_id IS NULL THEN 'AUTO' ELSE 'REQUIRE_APPROVAL' END AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'detachDocumentSource'
  AND (rule->>'disposition'='DENY' OR c.approval_consumption_id IS NULL AND rule->>'disposition'='REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE OR REPLACE FUNCTION anvil.guard_document_source_detach() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c anvil.commands%ROWTYPE;h anvil.document_source_links%ROWTYPE;e anvil.document_source_link_events%ROWTYPE;old_event anvil.document_source_link_events%ROWTYPE;s jsonb;reference jsonb;payload jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_OP NOT IN('INSERT','UPDATE') OR NOT anvil.document_source_detach_authorized(NEW.project_id) THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_DETACH_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM anvil.commands WHERE id::text=current_setting('anvil.command_id',true);
 IF TG_TABLE_NAME='document_source_link_events' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_EVENT_IMMUTABLE' USING ERRCODE='42501';END IF;
  e=NEW;SELECT * INTO h FROM anvil.document_source_links WHERE project_id=e.project_id AND id=e.link_id FOR UPDATE;
  SELECT * INTO old_event FROM anvil.document_source_link_events WHERE project_id=h.project_id AND id=h.current_event_id AND link_id=h.id AND link_version=h.link_version;
  IF h.id IS NULL OR h.link_version<>1 OR h.state<>'ACTIVE' OR old_event.id IS NULL OR old_event.link_version<>1
   OR old_event.snapshot_json->>'kind' IS DISTINCT FROM 'LINKED' OR old_event.snapshot_json->>'state' IS DISTINCT FROM 'ACTIVE'
   OR old_event.snapshot_json->'previousRef' IS DISTINCT FROM 'null'::jsonb OR old_event.content_hash IS DISTINCT FROM anvil.execution_json_hash(old_event.snapshot_json)
   THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_CURRENT_LINK_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  h=OLD;SELECT * INTO e FROM anvil.document_source_link_events WHERE project_id=NEW.project_id AND id=NEW.current_event_id AND link_id=NEW.id AND link_version=NEW.link_version;
  SELECT * INTO old_event FROM anvil.document_source_link_events WHERE project_id=h.project_id AND id=h.current_event_id AND link_id=h.id AND link_version=1;
  IF TG_OP<>'UPDATE' OR h.link_version<>1 OR h.state<>'ACTIVE' OR NEW.link_version<>2 OR NEW.state<>'DETACHED' OR e.id IS NULL
   OR (to_jsonb(NEW)-ARRAY['link_version','state','current_event_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['link_version','state','current_event_id','updated_at'])
   OR NEW.updated_at IS DISTINCT FROM e.created_at THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_HEAD_CAS_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 s=e.snapshot_json;reference=jsonb_build_object('id',h.id,'version',2,'contentHash',e.content_hash);
 payload=jsonb_build_object('sourceLinkRef',jsonb_build_object('id',h.id,'version',1,'contentHash',old_event.content_hash),'reason',s->'reason');
 IF NOT anvil.execution_json_shape(s,ARRAY['projectId','documentRef','sourceRootId','relativePath','sourceSnapshotRef','blobHash','reason','kind','state','previousRef','recordedAt'])
  OR e.link_version<>2 OR e.command_id IS DISTINCT FROM c.id OR e.created_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())
  OR e.content_hash IS DISTINCT FROM anvil.execution_json_hash(s) OR octet_length(anvil.execution_authority_canonical(s))>2097152
  OR s->>'projectId' IS DISTINCT FROM h.project_id::text OR s->>'kind' IS DISTINCT FROM 'DETACHED' OR s->>'state' IS DISTINCT FROM 'DETACHED'
  OR s->'previousRef' IS DISTINCT FROM payload->'sourceLinkRef'
  OR (s-ARRAY['kind','state','previousRef','reason','recordedAt']) IS DISTINCT FROM (old_event.snapshot_json-ARRAY['kind','state','previousRef','reason','recordedAt'])
  OR (s->>'recordedAt')::timestamptz IS DISTINCT FROM e.created_at OR e.created_at<old_event.created_at
  OR NOT anvil.result_text_valid(s->'reason',20000) OR NOT anvil.assignment_content_reason(s->>'reason') OR NOT anvil.result_texts_safe(s)
  OR s->>'relativePath' IS DISTINCT FROM h.relative_path OR s->>'sourceRootId' IS DISTINCT FROM h.source_root_id::text
  OR s->'sourceSnapshotRef' IS DISTINCT FROM h.source_snapshot_ref OR s->>'blobHash' IS DISTINCT FROM h.blob_hash
  OR NOT EXISTS(SELECT 1 FROM anvil.document_versions v WHERE v.project_id=h.project_id AND v.document_id=h.document_id AND v.version=h.version
   AND s->'documentRef'=jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash))
  OR c.result_ref->>'targetId' IS DISTINCT FROM h.id::text OR c.result_ref->'version' IS DISTINCT FROM '2'::jsonb
  OR c.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',reference,'status','DOCUMENT_SOURCE_DETACHED','snapshot',s)
  OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',c.project_id,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','detachDocumentSource','targetId',h.id,'expectedVersion',1,'baselineRefs','[]'::jsonb,'approvalRef',CASE WHEN c.approval_consumption_id IS NULL THEN 'null'::jsonb ELSE (
   SELECT jsonb_build_object('requestId',r.id,'decisionId',d.id,'scopeDigest',r.scope_digest)
   FROM anvil.approval_consumptions ac JOIN anvil.approval_decisions d ON d.project_id=ac.project_id AND d.id=ac.decision_id
   JOIN anvil.approval_requests r ON r.project_id=d.project_id AND r.id=d.request_id
   WHERE ac.id=c.approval_consumption_id AND ac.project_id=c.project_id AND ac.command_id=c.id) END,'payload',payload))
  THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_EXACT_DETACH_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;

-- 기존0032 양방향 deferred command/event/head 완결성 trigger와 app 권한 제한은 유지한다.
