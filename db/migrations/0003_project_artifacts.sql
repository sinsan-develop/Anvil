CREATE TABLE anvil.artifacts (
  id uuid PRIMARY KEY, project_id uuid REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  draft_id uuid REFERENCES anvil.project_drafts(id) ON DELETE RESTRICT,
  bytes bigint NOT NULL CHECK(bytes>=0 AND bytes<=20971520), content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  media_type text NOT NULL CHECK(length(media_type) BETWEEN 1 AND 200), storage_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK(state IN ('STAGING','READY','QUARANTINED','FAILED')),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  CHECK((project_id IS NULL)<>(draft_id IS NULL)), UNIQUE(project_id,id), UNIQUE(draft_id,id)
);
CREATE FUNCTION anvil.guard_project_artifact_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF NEW.project_id IS NULL OR NEW.draft_id IS NOT NULL OR NEW.state<>'READY'
    OR NEW.storage_key IS DISTINCT FROM 'blobs/'||NEW.project_id::text||'/'||NEW.id::text
    OR NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
    OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
    OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.project_control pc ON pc.project_id=c.project_id
      JOIN anvil.permission_policies p ON p.project_id=c.project_id
      JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='PROJECT' AND r.scope_id=c.project_id
      WHERE c.id=NEW.command_id AND c.project_id=NEW.project_id AND c.actor_id=NEW.created_by AND c.client_id=NEW.client_id
        AND c.operation='uploadArtifact' AND c.state='APPLIED' AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.revoked_at IS NULL AND pc.generation=c.control_generation
        AND c.policy_ref->>'id'=p.id::text AND (c.policy_ref->>'version')::bigint=p.head_version AND r.policy_ref=c.policy_ref
        AND c.result_ref->'data'->'artifactRef'=jsonb_build_object('artifactId',NEW.id,'contentHash',NEW.content_hash,'bytes',NEW.bytes,'mediaType',NEW.media_type)) THEN
    RAISE EXCEPTION 'PROJECT_ARTIFACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_artifact_guard BEFORE INSERT ON anvil.artifacts FOR EACH ROW EXECUTE FUNCTION anvil.guard_project_artifact_insert();
REVOKE UPDATE,DELETE ON anvil.artifacts FROM anvil_v3_app;
