CREATE TABLE anvil.document_proposals (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, document_id uuid NOT NULL, base_version bigint NOT NULL, base_hash text NOT NULL,
  body_artifact_id uuid NOT NULL, diff_artifact_id uuid NOT NULL, content_json jsonb NOT NULL, proposal_json jsonb NOT NULL,
  content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), reason text NOT NULL CHECK(length(trim(reason))>0),
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,id), FOREIGN KEY(project_id,document_id,base_version,base_hash) REFERENCES anvil.document_versions(project_id,document_id,version,content_hash) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,body_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,diff_artifact_id) REFERENCES anvil.artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
CREATE INDEX document_proposal_list ON anvil.document_proposals(project_id,document_id,created_at DESC,id DESC);
CREATE TABLE anvil.document_proposal_selections (
  id uuid PRIMARY KEY, project_id uuid NOT NULL, proposal_id uuid NOT NULL, document_id uuid NOT NULL, version bigint NOT NULL,
  created_by uuid NOT NULL REFERENCES anvil.users(id) ON DELETE RESTRICT, client_id uuid NOT NULL,
  command_id uuid NOT NULL UNIQUE REFERENCES anvil.commands(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,proposal_id), FOREIGN KEY(project_id,proposal_id) REFERENCES anvil.document_proposals(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,document_id,version) REFERENCES anvil.document_versions(project_id,document_id,version) ON DELETE RESTRICT,
  FOREIGN KEY(created_by,client_id) REFERENCES anvil.clients(user_id,id) ON DELETE RESTRICT
);
-- 1명령/1artifact 제약과 기존 업로드 검사는 유지한다. 제안의 서버 diff1개만 추가한다.
CREATE OR REPLACE FUNCTION anvil.guard_project_artifact_insert() RETURNS trigger LANGUAGE plpgsql AS $$
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
        AND c.state='APPLIED' AND pc.actor_id=c.actor_id AND pc.client_id=c.client_id AND pc.revoked_at IS NULL AND pc.generation=c.control_generation
        AND c.policy_ref->>'id'=p.id::text AND (c.policy_ref->>'version')::bigint=p.head_version AND r.policy_ref=c.policy_ref
        AND ((c.operation='uploadArtifact' AND c.result_ref->'data'->'artifactRef'=jsonb_build_object('artifactId',NEW.id,'contentHash',NEW.content_hash,'bytes',NEW.bytes,'mediaType',NEW.media_type))
          OR (c.operation='proposeDocumentChange' AND NEW.media_type='application/json;charset=utf-8' AND c.result_ref->'data'->>'status'='PROPOSAL_RECORDED'
            AND c.result_ref->'data'->'proposal'->'diffRef'=jsonb_build_object('artifactId',NEW.id,'contentHash',NEW.content_hash,'bytes',NEW.bytes,'mediaType',NEW.media_type)))) THEN
    RAISE EXCEPTION 'PROJECT_ARTIFACT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION anvil.guard_document_proposal_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposal anvil.document_proposals%ROWTYPE;
BEGIN
  IF current_user<>'anvil_v3_app' THEN RETURN NEW; END IF;
  IF NEW.created_by::text IS DISTINCT FROM current_setting('anvil.actor_id',true)
    OR NEW.client_id::text IS DISTINCT FROM current_setting('anvil.client_id',true)
    OR NEW.command_id::text IS DISTINCT FROM current_setting('anvil.command_id',true) THEN RAISE EXCEPTION 'PROPOSAL_AUTHORIZATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='document_proposals' THEN
    IF NOT anvil.document_command_authorized(NEW.project_id,NEW.document_id,NEW.base_version,'proposeDocumentChange')
      OR NOT EXISTS(SELECT 1 FROM anvil.documents d JOIN anvil.commands c ON c.id=NEW.command_id
        WHERE d.project_id=NEW.project_id AND d.id=NEW.document_id AND d.head_version=NEW.base_version
          AND c.result_ref->'data'->'proposal'=NEW.proposal_json AND NEW.proposal_json->>'id'=NEW.id::text
          AND NEW.proposal_json->'baseRef'=jsonb_build_object('id',NEW.document_id,'version',NEW.base_version,'contentHash',NEW.base_hash))
      OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=NEW.project_id AND a.id=NEW.diff_artifact_id AND a.command_id=NEW.command_id
        AND NEW.proposal_json->'diffRef'=jsonb_build_object('artifactId',a.id,'contentHash',a.content_hash,'bytes',a.bytes,'mediaType',a.media_type))
      OR NOT EXISTS(SELECT 1 FROM anvil.artifacts a WHERE a.project_id=NEW.project_id AND a.id=NEW.body_artifact_id AND a.state='READY'
        AND NEW.content_json->'body'=jsonb_build_object('artifactId',a.id,'contentHash',a.content_hash,'bytes',a.bytes,'mediaType',a.media_type))
      THEN RAISE EXCEPTION 'PROPOSAL_EXACT_RECEIPT_REQUIRED' USING ERRCODE='42501'; END IF;
  ELSE
    SELECT * INTO proposal FROM anvil.document_proposals WHERE project_id=NEW.project_id AND id=NEW.proposal_id;
    IF NOT anvil.document_command_authorized(NEW.project_id,NEW.document_id,NEW.version,'saveDocumentDraft')
      OR proposal.document_id IS DISTINCT FROM NEW.document_id OR proposal.base_version+1 IS DISTINCT FROM NEW.version
      OR NOT EXISTS(SELECT 1 FROM anvil.commands c JOIN anvil.document_versions v ON v.project_id=NEW.project_id AND v.document_id=NEW.document_id AND v.version=NEW.version
        WHERE c.id=NEW.command_id AND c.result_ref->'data'->>'proposalRef'=NEW.proposal_id::text AND v.content_json=proposal.content_json)
      THEN RAISE EXCEPTION 'PROPOSAL_EXPLICIT_SELECTION_REQUIRED' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER document_proposal_guard BEFORE INSERT ON anvil.document_proposals FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_proposal_write();
CREATE TRIGGER document_proposal_selection_guard BEFORE INSERT ON anvil.document_proposal_selections FOR EACH ROW EXECUTE FUNCTION anvil.guard_document_proposal_write();
REVOKE UPDATE,DELETE ON anvil.document_proposals,anvil.document_proposal_selections FROM anvil_v3_app;
