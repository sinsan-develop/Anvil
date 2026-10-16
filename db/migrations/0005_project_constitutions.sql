-- 확정 지식의 원문/사건은 보존하고 프로젝트 적용만 별도 이력으로 관리한다.
CREATE TABLE anvil.constitution_applications(
 project_id uuid NOT NULL REFERENCES anvil.projects(id),application_version bigint NOT NULL CHECK(application_version>0),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),entry_id uuid NOT NULL,version bigint NOT NULL,
 confirmation_id uuid NOT NULL REFERENCES anvil.knowledge_events(id),snapshot_json jsonb NOT NULL CHECK(jsonb_typeof(snapshot_json)='object'),
 applied_by uuid NOT NULL,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id),created_at timestamptz NOT NULL,
 PRIMARY KEY(project_id,application_version),UNIQUE(project_id,application_version,content_hash,entry_id,version),
 FOREIGN KEY(project_id,entry_id,version) REFERENCES anvil.knowledge_versions(project_id,entry_id,version),
 FOREIGN KEY(applied_by,client_id) REFERENCES anvil.clients(user_id,id)
);
CREATE TABLE anvil.project_constitutions(
 project_id uuid PRIMARY KEY REFERENCES anvil.projects(id),application_version bigint NOT NULL,application_hash text NOT NULL,entry_id uuid NOT NULL,version bigint NOT NULL,
 FOREIGN KEY(project_id,application_version,application_hash,entry_id,version) REFERENCES anvil.constitution_applications(project_id,application_version,content_hash,entry_id,version)
);
GRANT SELECT,INSERT ON anvil.constitution_applications,anvil.project_constitutions TO anvil_v3_app;
GRANT UPDATE(application_version,application_hash,entry_id,version) ON anvil.project_constitutions TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.constitution_applications FROM anvil_v3_app;
REVOKE DELETE ON anvil.project_constitutions FROM anvil_v3_app;
CREATE FUNCTION anvil.guard_constitution_application() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cmd anvil.commands%ROWTYPE;latest_review uuid;previous_ref jsonb;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 JOIN anvil.permission_policy_versions pv ON pv.project_id=p.project_id AND pv.policy_id=p.id AND pv.version=p.head_version AND pv.content_hash=c.policy_ref->>'contentHash'
 JOIN anvil.knowledge_entries k ON k.project_id=c.project_id AND k.id=NEW.entry_id AND k.kind='CONSTITUTION' AND k.head_version=NEW.version
 JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=NEW.version
 JOIN anvil.knowledge_events e ON e.id=NEW.confirmation_id AND e.project_id=k.project_id AND e.entry_id=k.id AND e.version=NEW.version AND e.kind='CONFIRMED'
 WHERE c.id=NEW.command_id AND c.id::text=current_setting('anvil.command_id',true) AND c.project_id=NEW.project_id
 AND c.actor_id=NEW.applied_by AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id=NEW.client_id AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.operation='applyConstitution' AND c.state='APPLIED' AND c.expected_version=NEW.application_version-1
 AND c.result_ref->'data'->>'status'='CONSTITUTION_APPLIED'
 AND c.result_ref->'data'->'ref'=jsonb_build_object('id',NEW.project_id,'version',NEW.application_version,'contentHash',NEW.content_hash)
 AND c.result_ref->'data'->'application'=NEW.snapshot_json
 AND NEW.snapshot_json->'versionRef'=jsonb_build_object('id',NEW.entry_id,'version',NEW.version,'contentHash',v.content_hash)
 AND NEW.snapshot_json->>'confirmationId'=NEW.confirmation_id::text
 AND NEW.snapshot_json->'appliedBy'=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
 AND NEW.snapshot_json->>'projectId'=NEW.project_id::text
 AND NEW.snapshot_json->'acknowledged'='true'::jsonb AND NEW.snapshot_json->'controlGeneration'=to_jsonb(c.control_generation)
 AND NEW.created_at=(c.result_ref->>'serverReceivedAt')::timestamptz
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',c.project_id)) AND rule->'operations' @> '["applyConstitution"]'::jsonb AND rule->>'disposition'='AUTO' AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pv.rules_json) rule WHERE rule->'subjectRef'=jsonb_build_object('kind','HUMAN','userId',c.actor_id) AND rule->'targetScopes'=jsonb_build_array(jsonb_build_object('kind','PROJECT','projectId',c.project_id)) AND rule->'operations' @> '["applyConstitution"]'::jsonb AND rule->>'disposition' IN('DENY','REQUIRE_APPROVAL') AND (rule->>'expiresAt')::timestamptz>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM anvil.knowledge_events excluded WHERE excluded.project_id=k.project_id AND excluded.entry_id=k.id AND excluded.version=NEW.version AND excluded.kind='EXCLUDED');
 IF cmd.id IS NULL THEN RAISE EXCEPTION 'CONSTITUTION_EXACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT r.id INTO latest_review FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id
 WHERE r.scope_kind='PROJECT' AND r.project_id=NEW.project_id AND r.target_kind='KNOWLEDGE' AND r.target_id=NEW.entry_id AND r.target_version=NEW.version AND r.target_hash=NEW.snapshot_json->'versionRef'->>'contentHash'
 ORDER BY a.server_sequence DESC LIMIT 1;
 IF latest_review IS NULL OR NOT EXISTS(SELECT 1 FROM anvil.content_reviews r WHERE r.id=latest_review AND r.outcome='ACCEPTED' AND r.source_kind='HUMAN_REVIEW' AND NEW.snapshot_json->'reviewRef'=jsonb_build_object('id',r.id,'targetRef',NEW.snapshot_json->'versionRef','criteriaVersion',1,'outcome','ACCEPTED'))
 OR NOT EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.id=NEW.confirmation_id AND e.review_refs @> jsonb_build_array(NEW.snapshot_json->'reviewRef'))
 THEN RAISE EXCEPTION 'CONSTITUTION_LATEST_CONFIRMED_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('id',project_id,'version',application_version,'contentHash',application_hash) INTO previous_ref FROM anvil.project_constitutions WHERE project_id=NEW.project_id;
 IF NEW.application_version<>COALESCE((previous_ref->>'version')::bigint,0)+1 OR NEW.snapshot_json->'previousApplicationRef' IS DISTINCT FROM COALESCE(previous_ref,'null'::jsonb)
 THEN RAISE EXCEPTION 'CONSTITUTION_APPLICATION_GENERATION_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER constitution_application_guard BEFORE INSERT ON anvil.constitution_applications FOR EACH ROW EXECUTE FUNCTION anvil.guard_constitution_application();
CREATE FUNCTION anvil.guard_constitution_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND (NEW.project_id<>OLD.project_id OR NEW.application_version<>OLD.application_version+1) THEN RAISE EXCEPTION 'CONSTITUTION_POINTER_GENERATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' AND NEW.application_version<>1 THEN RAISE EXCEPTION 'CONSTITUTION_POINTER_FIRST_GENERATION_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM anvil.constitution_applications a WHERE a.project_id=NEW.project_id AND a.application_version=NEW.application_version AND a.content_hash=NEW.application_hash AND a.entry_id=NEW.entry_id AND a.version=NEW.version AND a.command_id::text=current_setting('anvil.command_id',true) AND a.applied_by::text=current_setting('anvil.actor_id',true) AND a.client_id::text=current_setting('anvil.client_id',true)) THEN RAISE EXCEPTION 'CONSTITUTION_POINTER_EXACT_EVENT_REQUIRED' USING ERRCODE='42501';END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER constitution_pointer_guard BEFORE INSERT OR UPDATE ON anvil.project_constitutions FOR EACH ROW EXECUTE FUNCTION anvil.guard_constitution_pointer();
