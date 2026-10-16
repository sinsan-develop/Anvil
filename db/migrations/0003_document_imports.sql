-- 신산님 별도 승인: 원본을 보존하는 가져오기 후보와 명시 선택 이력만 추가한다.
CREATE TABLE anvil.document_imports (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES anvil.projects(id) ON DELETE RESTRICT,
  original_artifact_id uuid NOT NULL, form_definition_id uuid, form_version bigint, form_hash text,
  candidate_json jsonb NOT NULL, content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), FOREIGN KEY(project_id,original_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(form_definition_id,form_version,form_hash) REFERENCES anvil.form_versions(definition_id,version,content_hash) ON DELETE RESTRICT,
  CHECK((form_definition_id IS NULL AND form_version IS NULL AND form_hash IS NULL) OR (form_definition_id IS NOT NULL AND form_version IS NOT NULL AND form_hash IS NOT NULL))
);
CREATE INDEX document_import_list ON anvil.document_imports(project_id,created_at DESC,id DESC);
CREATE TABLE anvil.document_import_selections (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, import_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,import_id) REFERENCES anvil.document_imports(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,document_id,version) REFERENCES anvil.document_versions(project_id,document_id,version) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE FUNCTION anvil.guard_document_import_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE command_row anvil.commands%ROWTYPE; candidate anvil.document_imports%ROWTYPE;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  SELECT c.* INTO command_row FROM anvil.commands c
    JOIN anvil.project_control pc ON pc.project_id=c.project_id AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.generation=c.control_generation AND pc.revoked_at IS NULL
    JOIN anvil.project_members m ON m.project_id=c.project_id AND m.user_id=c.actor_id AND m.participation='OWNER' AND m.revoked_at IS NULL
    JOIN anvil.projects pr ON pr.id=c.project_id AND pr.archived_at IS NULL
    JOIN anvil.permission_policies p ON p.project_id=c.project_id AND p.id::text=c.policy_ref->>'id' AND p.head_version=(c.policy_ref->>'version')::bigint
    JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id AND r.scope_kind='PROJECT' AND r.scope_id=c.project_id AND r.policy_ref=c.policy_ref
    WHERE c.id=NEW.command_id AND c.state='APPLIED' AND c.project_id=NEW.project_id AND c.actor_id=NEW.created_by AND c.client_id=NEW.client_id
      AND c.id::text=current_setting('anvil.command_id',true) AND c.actor_id::text=current_setting('anvil.actor_id',true) AND c.client_id::text=current_setting('anvil.client_id',true);
  IF command_row.id IS NULL THEN RAISE EXCEPTION 'IMPORT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='document_imports' THEN
    IF command_row.operation<>'importDocument' OR command_row.expected_version<>0
      OR command_row.result_ref->'data'->'candidate' IS DISTINCT FROM NEW.candidate_json
      OR NEW.candidate_json->>'id' IS DISTINCT FROM NEW.id::text
      OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=NEW.project_id AND a.id=NEW.original_artifact_id AND a.state='READY'
        AND NEW.candidate_json->'originalRef'=jsonb_build_object('artifactId',a.id,'bytes',a.bytes,'contentHash',a.content_hash,'mediaType',a.media_type))
      OR NEW.candidate_json->'intendedFormRef' IS DISTINCT FROM CASE WHEN NEW.form_definition_id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('id',NEW.form_definition_id,'version',NEW.form_version,'contentHash',NEW.form_hash) END
      THEN RAISE EXCEPTION 'IMPORT_CANDIDATE_REQUIRED' USING ERRCODE='42501'; END IF;
  ELSE
    SELECT * INTO candidate FROM anvil.document_imports WHERE project_id=NEW.project_id AND id=NEW.import_id;
    IF command_row.operation<>'saveDocumentDraft' OR command_row.result_ref->'data'->>'importCandidateRef' IS DISTINCT FROM NEW.import_id::text
      OR command_row.result_ref->>'targetId' IS DISTINCT FROM NEW.document_id::text OR (command_row.result_ref->>'version')::bigint IS DISTINCT FROM NEW.version
      OR candidate.candidate_json->>'status' IS DISTINCT FROM 'READY'
      OR NOT EXISTS(SELECT 1 FROM anvil.document_artifact_links l WHERE l.project_id=NEW.project_id AND l.document_id=NEW.document_id AND l.version=NEW.version AND l.artifact_id=candidate.original_artifact_id)
      THEN RAISE EXCEPTION 'IMPORT_EXPLICIT_SELECTION_REQUIRED' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER document_import_guard BEFORE INSERT ON anvil.document_imports FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_import_write();
CREATE TRIGGER document_import_selection_guard BEFORE INSERT ON anvil.document_import_selections FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_import_write();
REVOKE UPDATE,DELETE ON anvil.document_imports,anvil.document_import_selections FROM anvil_v3_app;
