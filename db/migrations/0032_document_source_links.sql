-- FN03 §15.4의 저장 구조와 DETACHED 부분 계약. 정식 DB 미적용 후보.
-- LINKED 생성은 아직 app에 허용하지 않는다. migrator/후속 content verifier만 초기 자료를 제공할 수 있다.
-- 이 저장 구조는 OS/원문 진위·현재 source 접근 권한을 인증하지 않는다.
CREATE TABLE anvil.document_source_links(
 project_id uuid NOT NULL,id uuid NOT NULL,document_id uuid NOT NULL,version bigint NOT NULL,
 source_root_id uuid NOT NULL,relative_path text NOT NULL,source_snapshot_ref jsonb NOT NULL,blob_hash text NOT NULL CHECK(blob_hash~'^[0-9a-f]{64}$'),
 link_version bigint NOT NULL CHECK(link_version IN(1,2)),state text NOT NULL CHECK(state IN('ACTIVE','DETACHED')),
 current_event_id uuid NOT NULL,linked_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 PRIMARY KEY(project_id,id),
 FOREIGN KEY(project_id,document_id,version) REFERENCES anvil.document_versions(project_id,document_id,version),
 FOREIGN KEY(project_id,source_root_id) REFERENCES anvil.source_roots(project_id,id),
 CHECK((link_version=1 AND state='ACTIVE') OR (link_version=2 AND state='DETACHED')),
 CHECK(length(relative_path) BETWEEN 1 AND 4096),CHECK(jsonb_typeof(source_snapshot_ref)='object')
);
CREATE TABLE anvil.document_source_link_events(
 id uuid PRIMARY KEY,project_id uuid NOT NULL,link_id uuid NOT NULL,link_version bigint NOT NULL CHECK(link_version IN(1,2)),
 content_hash text NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),snapshot_json jsonb NOT NULL,
 command_id uuid NOT NULL,created_at timestamptz NOT NULL,
 UNIQUE(project_id,link_id,link_version),UNIQUE(project_id,link_id,link_version,id),UNIQUE(project_id,command_id),
 FOREIGN KEY(project_id,link_id) REFERENCES anvil.document_source_links(project_id,id),
 FOREIGN KEY(project_id,command_id) REFERENCES anvil.commands(project_id,id),CHECK(jsonb_typeof(snapshot_json)='object')
);
ALTER TABLE anvil.document_source_links ADD CONSTRAINT source_link_current_event
 FOREIGN KEY(project_id,id,link_version,current_event_id) REFERENCES anvil.document_source_link_events(project_id,link_id,link_version,id) DEFERRABLE INITIALLY DEFERRED;
GRANT SELECT ON anvil.document_source_links,anvil.document_source_link_events TO anvil_v3_app;
GRANT INSERT ON anvil.document_source_link_events TO anvil_v3_app;
GRANT UPDATE(link_version,state,current_event_id,updated_at) ON anvil.document_source_links TO anvil_v3_app;
REVOKE INSERT,DELETE ON anvil.document_source_links FROM anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.document_source_link_events FROM anvil_v3_app;

CREATE FUNCTION anvil.document_source_detach_authorized(pid uuid) RETURNS boolean LANGUAGE sql AS $$
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
 AND c.approval_consumption_id IS NULL AND c.payload_ref IS NULL AND ar.approval_decision_ref IS NULL
 AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND (SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=c.id)=1
 AND EXISTS(SELECT 1 FROM anvil.audit_events a WHERE a.project_id=pid AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest AND a.target_ref=c.result_ref->'data'->'ref')
 AND EXISTS(SELECT 1 FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=s.user_id
  WHERE s.user_id=c.actor_id AND s.client_id=c.client_id AND s.revoked_at IS NULL AND u.status='ACTIVE' AND u.revoked_at IS NULL AND cl.revoked_at IS NULL
  AND s.credential_generation=u.credential_generation AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp())
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'detachDocumentSource'
  AND rule->>'disposition'='AUTO' AND rule->'limitPolicyRef'='null'::jsonb AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id)
  AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',pid)) AND (rule->'operations') ? 'detachDocumentSource'
  AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp()));
$$;

CREATE FUNCTION anvil.guard_document_source_detach() RETURNS trigger LANGUAGE plpgsql AS $$
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
  OR c.request_hash IS DISTINCT FROM anvil.execution_json_hash(jsonb_build_object('schemaVersion',1,'projectId',c.project_id,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','detachDocumentSource','targetId',h.id,'expectedVersion',1,'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb,'payload',payload))
  THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_EXACT_DETACH_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER source_link_event_guard BEFORE INSERT OR UPDATE ON anvil.document_source_link_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_source_detach();
CREATE TRIGGER source_link_head_guard BEFORE UPDATE ON anvil.document_source_links FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_source_detach();

-- event append만 COMMIT하고 head를 옛 세대로 두는 부분 저장도 거절한다.
CREATE FUNCTION anvil.document_source_head_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h anvil.document_source_links%ROWTYPE;n bigint;latest bigint;
BEGIN
 SELECT * INTO h FROM anvil.document_source_links WHERE project_id=NEW.project_id AND id=NEW.link_id;
 SELECT count(*),max(link_version) INTO n,latest FROM anvil.document_source_link_events WHERE project_id=NEW.project_id AND link_id=NEW.link_id;
 IF h.id IS NULL OR h.link_version IS DISTINCT FROM latest OR n IS DISTINCT FROM latest THEN
  RAISE EXCEPTION 'DOCUMENT_SOURCE_HEAD_INCOMPLETE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER source_link_complete AFTER INSERT ON anvil.document_source_link_events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.document_source_head_complete();

-- 역방향도 검사한다. APPLIED receipt/audit만 남기고 분리 event를 생략한 COMMIT은 허용하지 않는다.
CREATE FUNCTION anvil.document_source_command_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e anvil.document_source_link_events%ROWTYPE;h anvil.document_source_links%ROWTYPE;
BEGIN
 IF NEW.operation<>'detachDocumentSource' OR NEW.state<>'APPLIED' THEN RETURN NEW;END IF;
 SELECT * INTO e FROM anvil.document_source_link_events WHERE project_id=NEW.project_id AND command_id=NEW.id;
 SELECT * INTO h FROM anvil.document_source_links WHERE project_id=e.project_id AND id=e.link_id;
 IF e.id IS NULL OR h.id IS NULL OR e.link_version<>2 OR h.link_version<>2 OR h.state<>'DETACHED' OR h.current_event_id IS DISTINCT FROM e.id
  OR NEW.result_ref->'data' IS DISTINCT FROM jsonb_build_object('ref',jsonb_build_object('id',h.id,'version',2,'contentHash',e.content_hash),'status','DOCUMENT_SOURCE_DETACHED','snapshot',e.snapshot_json)
  THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_COMMAND_INCOMPLETE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER source_link_command_complete AFTER INSERT OR UPDATE ON anvil.commands
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil.document_source_command_complete();
