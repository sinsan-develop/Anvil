CREATE TABLE anvil.documents (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK(length(trim(title))>0), head_version bigint NOT NULL CHECK(head_version>0), confirmed_version bigint,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id)
);
CREATE INDEX document_project_list ON anvil.documents(project_id,updated_at DESC,id DESC);
CREATE TABLE anvil.document_versions (
  project_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL CHECK(version>0),
  form_definition_id uuid NOT NULL, form_version bigint NOT NULL, form_hash text NOT NULL,
  stage_ref_json jsonb, body_artifact_id uuid NOT NULL, title text NOT NULL, source_refs_json jsonb NOT NULL,
  content_json jsonb NOT NULL, content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), sections_json jsonb NOT NULL,
  author_ref_json jsonb NOT NULL, validation_json jsonb NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
  client_id uuid NOT NULL REFERENCES anvil.clients(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,document_id,version), UNIQUE(project_id,document_id,version,content_hash),
  FOREIGN KEY(project_id,document_id) REFERENCES anvil.documents(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,body_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(form_definition_id,form_version,form_hash) REFERENCES anvil.form_versions(definition_id,version,content_hash) ON DELETE RESTRICT
);
ALTER TABLE anvil.documents ADD CONSTRAINT document_head_fk FOREIGN KEY(project_id,id,head_version)
  REFERENCES anvil.document_versions(project_id,document_id,version) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE anvil.documents ADD CONSTRAINT document_confirmed_fk FOREIGN KEY(project_id,id,confirmed_version)
  REFERENCES anvil.document_versions(project_id,document_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE anvil.document_artifact_links (
  project_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL, artifact_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('BODY','ATTACHMENT','SOURCE')), PRIMARY KEY(project_id,document_id,version,artifact_id,kind),
  FOREIGN KEY(project_id,document_id,version) REFERENCES anvil.document_versions(project_id,document_id,version) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT
);
CREATE TABLE anvil.document_version_events (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL,
  event_kind text NOT NULL, review_ref jsonb, actor_ref jsonb NOT NULL, reason text NOT NULL,
  command_id uuid NOT NULL REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,document_id,version) REFERENCES anvil.document_versions(project_id,document_id,version) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.guard_document_draft_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc_id uuid; target_version bigint;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='documents' THEN
    doc_id=NEW.id; target_version=NEW.head_version;
    IF NEW.confirmed_version IS NOT NULL OR TG_OP='INSERT' AND NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true) THEN
      RAISE EXCEPTION 'DOCUMENT_DRAFT_ONLY' USING ERRCODE='42501';
    END IF;
  ELSE doc_id=NEW.document_id; target_version=NEW.version; END IF;
  IF NOT EXISTS(SELECT 1 FROM anvil.commands c
    JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id
    JOIN anvil.permission_policies p ON p.project_id=c.project_id
    JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.policy_ref=c.policy_ref
    WHERE c.id::text=current_setting('anvil.command_id',true) AND c.project_id=NEW.project_id AND c.actor_id::text=current_setting('anvil.actor_id',true)
      AND c.client_id::text=current_setting('anvil.client_id',true) AND pc.revoked_at IS NULL AND pc.generation=c.control_generation
      AND c.operation='saveDocumentDraft' AND c.state='APPLIED' AND c.expected_version=target_version-1
      AND c.policy_ref->>'id'=p.id::text AND (c.policy_ref->>'version')::bigint=p.head_version
      AND c.result_ref->'data'->'ref'->>'id'=doc_id::text AND (c.result_ref->'data'->'ref'->>'version')::bigint=target_version) THEN
    RAISE EXCEPTION 'DOCUMENT_CURRENT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='document_versions' THEN
    IF NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true)
      OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
      OR NEW.author_ref_json->>'kind' IS DISTINCT FROM 'HUMAN' OR NEW.author_ref_json->>'userId' IS DISTINCT FROM current_setting('anvil.actor_id',true) THEN
      RAISE EXCEPTION 'DOCUMENT_AUTHOR_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER document_draft_guard BEFORE INSERT OR UPDATE ON anvil.documents FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_draft_write();
CREATE TRIGGER document_version_guard BEFORE INSERT ON anvil.document_versions FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_draft_write();
CREATE TRIGGER document_link_guard BEFORE INSERT ON anvil.document_artifact_links FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_draft_write();
CREATE TRIGGER document_event_guard BEFORE INSERT ON anvil.document_version_events FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_draft_write();
REVOKE UPDATE,DELETE ON anvil.documents FROM anvil_v3_app;
GRANT UPDATE(title,head_version,updated_at) ON anvil.documents TO anvil_v3_app;
REVOKE UPDATE,DELETE ON anvil.document_versions,anvil.document_artifact_links,anvil.document_version_events FROM anvil_v3_app;
