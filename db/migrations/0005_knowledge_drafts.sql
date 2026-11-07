CREATE TABLE anvil.knowledge_entries (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION')),
 head_version bigint NOT NULL CHECK(head_version>0),created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
 client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,id),FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE TABLE anvil.knowledge_versions (
 project_id uuid NOT NULL,entry_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),title text NOT NULL CHECK(length(trim(title))>0 AND length(title)<=200),
 content_artifact_id uuid NOT NULL,content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),source_refs jsonb NOT NULL CHECK(jsonb_typeof(source_refs)='array'),
 reason text NOT NULL CHECK(length(trim(reason))>0 AND length(reason)<=20000),scope_json jsonb NOT NULL,related_refs jsonb NOT NULL,entry_json jsonb NOT NULL,
 supersedes_version bigint,created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,client_id uuid NOT NULL,
 command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,entry_id,version),UNIQUE(project_id,entry_id,version,content_hash),
 FOREIGN KEY(project_id,entry_id) REFERENCES anvil.knowledge_entries(project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,content_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(project_id,entry_id,supersedes_version) REFERENCES anvil.knowledge_versions(project_id,entry_id,version) ON DELETE RESTRICT,
 FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
ALTER TABLE anvil.knowledge_entries ADD CONSTRAINT knowledge_head_fk FOREIGN KEY(project_id,id,head_version) REFERENCES anvil.knowledge_versions(project_id,entry_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.knowledge_events (
 id uuid PRIMARY KEY,project_id uuid NOT NULL,entry_id uuid NOT NULL,version bigint NOT NULL,
 kind text NOT NULL CHECK(kind IN ('PROPOSED','CONFIRMED','CORRECTED','EXCLUDED','SHARED')),reason text NOT NULL,actor_ref jsonb NOT NULL,
 approval_ref jsonb,target_refs jsonb,client_id uuid NOT NULL,command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(project_id,entry_id,version) REFERENCES anvil.knowledge_versions(project_id,entry_id,version) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.guard_knowledge_draft_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot jsonb;pid uuid;kid uuid;v bigint;cmd anvil.commands%ROWTYPE;
BEGIN
 IF current_user<>'anvil_v3_app' THEN RETURN NEW;END IF;
 pid=NEW.project_id;
 IF TG_TABLE_NAME='knowledge_entries' THEN kid=NEW.id;v=NEW.head_version;ELSE kid=NEW.entry_id;v=NEW.version;END IF;
 SELECT c.* INTO cmd FROM anvil.commands c
 JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
 JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
 JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
 JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
 WHERE c.id=NEW.command_id AND c.id::text=current_setting('anvil.command_id',true) AND c.project_id=pid
 AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true)
 AND c.client_id=NEW.client_id AND c.state='APPLIED' AND c.operation='saveKnowledge' AND c.expected_version=0
 AND c.result_ref->'data'->>'status'='PROPOSED' AND c.result_ref->'data'->'ref'->>'id'=kid::text AND v=1;
 IF cmd.id IS NULL THEN RAISE EXCEPTION 'KNOWLEDGE_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 snapshot=cmd.result_ref->'data'->'entry';
 IF TG_TABLE_NAME='knowledge_entries' THEN
  IF NEW.created_by<>cmd.actor_id OR NEW.kind IS DISTINCT FROM snapshot->>'kind' THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='knowledge_versions' THEN
  IF NEW.created_by<>cmd.actor_id OR NEW.supersedes_version IS NOT NULL OR NEW.entry_json IS DISTINCT FROM snapshot
   OR NEW.content_hash IS DISTINCT FROM cmd.result_ref->'data'->'ref'->>'contentHash'
   OR NEW.content_artifact_id::text IS DISTINCT FROM snapshot->'contentRef'->>'artifactId'
   OR NEW.title IS DISTINCT FROM snapshot->>'title' OR NEW.reason IS DISTINCT FROM snapshot->>'reason'
   OR NEW.source_refs IS DISTINCT FROM snapshot->'sourceRefs' OR NEW.scope_json IS DISTINCT FROM snapshot->'scope' OR NEW.related_refs IS DISTINCT FROM snapshot->'relatedRefs'
   OR NOT EXISTS(SELECT 1 FROM anvil.knowledge_entries k WHERE k.project_id=pid AND k.id=kid AND k.head_version=v AND k.kind=snapshot->>'kind')
   OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=pid AND a.id=NEW.content_artifact_id AND a.state='READY' AND a.content_hash=snapshot->'contentRef'->>'contentHash' AND a.bytes=(snapshot->'contentRef'->>'bytes')::bigint AND a.media_type=snapshot->'contentRef'->>'mediaType') THEN RAISE EXCEPTION 'KNOWLEDGE_EXACT_SOURCE_RECEIPT_REQUIRED' USING ERRCODE='42501';END IF;
 ELSE
  IF NEW.kind<>'PROPOSED' OR NEW.reason IS DISTINCT FROM snapshot->>'reason' OR NEW.actor_ref IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',cmd.actor_id) OR NEW.approval_ref IS NOT NULL OR NEW.target_refs IS NOT NULL THEN RAISE EXCEPTION 'KNOWLEDGE_PROPOSAL_ONLY' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_entry_guard BEFORE INSERT ON anvil.knowledge_entries FOR EACH ROW EXECUTE FUNCTION anvil.guard_knowledge_draft_write();
CREATE TRIGGER knowledge_version_guard BEFORE INSERT ON anvil.knowledge_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_knowledge_draft_write();
CREATE TRIGGER knowledge_event_guard BEFORE INSERT ON anvil.knowledge_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_knowledge_draft_write();
REVOKE ALL ON anvil.knowledge_entries,anvil.knowledge_versions,anvil.knowledge_events FROM anvil_v3_app;
GRANT SELECT,INSERT ON anvil.knowledge_entries,anvil.knowledge_versions,anvil.knowledge_events TO anvil_v3_app;
